const crypto = require("crypto");
const path = require("path");
const compression = require("compression");
const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { attachSession, clearSession, getSession, setSession } = require("./sessionManager");
const { createId, defaultLogo, defaultQr, readStore, slugify, updateStore } = require("./store");

const ACCESS_KEY_LENGTH = 12;
const CREDENTIAL_SECRET = String(process.env.CREDENTIAL_SECRET || process.env.SESSION_SECRET || "change-me-platform-secret");
const PASSWORD_SECRET = String(process.env.PASSWORD_SECRET || process.env.SESSION_SECRET || "change-me-password-secret");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const BASE_URL = String(process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/+$/, "");
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const RECOVERY_CODE_1 = String(process.env.RECOVERY_CODE_1 || "").trim();
const RECOVERY_CODE_2 = String(process.env.RECOVERY_CODE_2 || "").trim();

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  const nodeModulesDir = path.join(__dirname, "..", "node_modules");
  ensureStoreSeedState();

  app.disable("x-powered-by");
  app.use(compression());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    attachSession(req, res);
    next();
  });
  app.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/google/callback`
    }, (_accessToken, _refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value || "";
      if (!email) return done(new Error("Google account did not provide an email address."));
      const user = upsertGoogleUser({
        email,
        googleId: profile.id,
        name: profile.displayName || email.split("@")[0]
      });
      return done(null, user);
    }));
  }

  app.use(passport.initialize());

  app.use("/vendor", express.static(nodeModulesDir, { maxAge: "1d", etag: true }));
  app.use("/assets", express.static(path.join(publicDir, "assets"), { maxAge: "1d", etag: true }));
  app.use(express.static(publicDir, {
    etag: true,
    maxAge: "1h",
    index: false,
    extensions: false
  }));

  function getSettings() {
    return readStore().settings;
  }

  function getAdminState() {
    const store = readStore();
    return {
      username: ADMIN_USERNAME || "admin",
      passwordHash: store.admin?.passwordHash || "",
      hasEnvPassword: Boolean(ADMIN_PASSWORD),
      recoveryConfigured: Boolean(RECOVERY_CODE_1 && RECOVERY_CODE_2)
    };
  }

  function getBaseUrl(req) {
    const envBase = String(process.env.BASE_URL || "").trim();
    if (envBase) return envBase.replace(/\/+$/, "");
    return `${req.protocol}://${req.get("host")}`;
  }

  function getTelegramPaymentUrl(req, user) {
    const settings = getSettings();
    const baseMessage = `Hi, I have paid ₹${settings.accessPriceInr}. Please verify.`;
    const text = [
      baseMessage,
      `Email: ${user.email}`,
      `Amount: ₹${settings.accessPriceInr}`
    ].join("\n");
    return `${settings.telegramUrl}?text=${encodeURIComponent(text)}`;
  }

  function getUserBySession(req) {
    const session = getSession(req);
    if (!session?.userId || session.isAdmin) return null;
    return readStore().users.find((item) => item.id === session.userId) || null;
  }

  function getAccessState(user) {
    if (!user) return "guest";
    if (user.verified) return "verified";
    if (user.paymentStatus === "pending" || user.paymentStatus === "approved") return "awaiting-key";
    return "needs-payment";
  }

  function getSessionPayload(user, extra = {}) {
    return {
      ownerKey: user.id,
      userId: user.id,
      name: user.name,
      contact: user.email,
      isAdmin: false,
      ...extra
    };
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      paymentStatus: user.paymentStatus,
      verified: user.verified
    };
  }

  function adminPayload() {
    const store = readStore();
    return {
      users: store.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        paymentStatus: user.paymentStatus,
        verified: user.verified,
        keyAssignedAt: user.keyAssignedAt,
        keyUsedAt: user.keyUsedAt,
        createdAt: user.createdAt
      })),
      stats: {
        users: store.users.length,
        verifiedUsers: store.users.filter((item) => item.verified).length,
        pendingPayments: store.users.filter((item) => item.paymentStatus === "pending").length,
        pcGames: store.games.filter((item) => item.platform === "PC").length,
        ps4Games: store.games.filter((item) => item.platform === "PS4").length,
        ps5Games: store.games.filter((item) => item.platform === "PS5").length
      },
      games: store.games.map((game) => ({
        id: game.id,
        slug: game.slug,
        platform: game.platform,
        name: game.name,
        image: game.image,
        description: game.description,
        hasCredentials: Boolean(game.credentialIdCipher && game.credentialPasswordCipher),
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
      })),
      settings: store.settings
    };
  }

  function requireLogin(req, res, next) {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: "Login required." });
    req.userRecord = user;
    next();
  }

  function requireVerified(req, res, next) {
    const user = getUserBySession(req);
    if (!user) return res.status(401).json({ error: "Login required." });
    if (!user.verified) return res.status(403).json({ error: "Verified access required." });
    req.userRecord = user;
    next();
  }

  function requireAdmin(req, res, next) {
    const session = getSession(req);
    if (!session?.isAdmin) return res.status(403).json({ error: "Admin access required." });
    next();
  }

  function redirectForAccess(req, res, next) {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const pagePath = normalizePagePath(req.path);
    if (!pagePath) return next();

    if (pagePath === "/login.html") return next();

    const session = getSession(req);
    if (pagePath === "/admin.html") {
      if (!session?.isAdmin) return res.redirect("/login.html?mode=admin");
      return next();
    }

    if (session?.isAdmin) return next();

    const user = getUserBySession(req);
    if (!user) return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
    const state = getAccessState(user);
    if (pagePath === "/payment.html") return next();
    if (state !== "verified") return res.redirect("/payment.html");
    return next();
  }

  app.use(redirectForAccess);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: "Gamers Arena Platform" });
  });

  app.get("/auth/config", (req, res) => {
    const user = getUserBySession(req);
    const adminState = getAdminState();
    res.json({
      googleEnabled: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      googleMessage: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? ""
        : "Google sign-in will be available here once it is connected.",
      adminRecoveryEnabled: adminState.recoveryConfigured,
      accessPriceInr: getSettings().accessPriceInr,
      telegramUrl: getSettings().telegramUrl,
      session: publicUser(user),
      accessState: getAccessState(user)
    });
  });

  app.get("/auth/google", (req, res, next) => {
    if (!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)) {
      return res.redirect("/login.html?google=disabled");
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account"
    })(req, res, next);
  });

  app.get("/auth/google/callback", (req, res, next) => {
    if (!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)) {
      return res.redirect("/login.html?google=disabled");
    }
    passport.authenticate("google", { session: false }, (error, user) => {
      if (error || !user) return res.redirect("/login.html?error=google");
      setSession(req, res, getSessionPayload(user));
      return res.redirect(user.verified ? "/" : "/payment.html");
    })(req, res, next);
  });

  app.post("/auth/email-login", async (req, res, next) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
      const user = readStore().users.find((item) => item.email === email);
      if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials." });
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials." });
      setSession(req, res, getSessionPayload(user));
      res.json({ user: publicUser(user), accessState: getAccessState(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/admin-login", async (req, res, next) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      const adminState = getAdminState();
      if (!adminState.hasEnvPassword && !adminState.passwordHash) {
        return res.status(503).json({ error: "Admin access is not ready yet." });
      }
      const usernameOk = username.toLowerCase() === adminState.username.toLowerCase();
      const passwordOk = adminState.passwordHash
        ? await verifyPassword(password, adminState.passwordHash)
        : await verifyPasswordAgainstSecret(password, ADMIN_PASSWORD);
      if (!usernameOk || !passwordOk) {
        return res.status(401).json({ error: "Invalid admin login." });
      }
      setSession(req, res, {
        ownerKey: "admin",
        userId: "admin",
        name: "Admin",
        contact: adminState.username,
        isAdmin: true
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/admin/recovery", async (req, res, next) => {
    try {
      const code1 = String(req.body?.code1 || "").trim();
      const code2 = String(req.body?.code2 || "").trim();
      const nextPassword = String(req.body?.nextPassword || "");
      const adminState = getAdminState();
      if (!adminState.recoveryConfigured) {
        return res.status(503).json({ error: "Recovery is not available right now." });
      }
      const code1Ok = await compareSecret(code1, RECOVERY_CODE_1);
      const code2Ok = await compareSecret(code2, RECOVERY_CODE_2);
      if (!code1Ok || !code2Ok) {
        return res.status(401).json({ error: "Recovery codes did not match." });
      }
      if (!nextPassword || nextPassword.length < 8) {
        return res.status(400).json({ error: "Choose a stronger password with at least 8 characters." });
      }
      const passwordHash = await hashPassword(nextPassword);
      updateStore((draft) => {
        draft.admin.passwordHash = passwordHash;
        draft.admin.passwordUpdatedAt = new Date().toISOString();
        return draft;
      });
      res.json({ ok: true, message: "Admin password updated." });
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/logout", (req, res) => {
    clearSession(req, res);
    res.json({ ok: true });
  });

  app.get("/api/session", (req, res) => {
    const user = getUserBySession(req);
    res.json({
      user: publicUser(user),
      accessState: getAccessState(user),
      settings: {
        siteTitle: getSettings().siteTitle,
        siteTagline: getSettings().siteTagline,
        siteDescription: getSettings().siteDescription,
        logoUrl: getSettings().logoUrl || defaultLogo,
        paymentQrUrl: getSettings().paymentQrUrl || defaultQr,
        telegramUrl: getSettings().telegramUrl,
        accessPriceInr: getSettings().accessPriceInr
      }
    });
  });

  app.post("/api/payment/request", requireLogin, (req, res) => {
    const current = req.userRecord;
    const store = updateStore((draft) => {
      const user = draft.users.find((item) => item.id === current.id);
      if (!user) throw new Error("User not found.");
      if (user.paymentStatus === "unpaid") user.paymentStatus = "pending";
      user.updatedAt = new Date().toISOString();
      return draft;
    });
    const user = store.users.find((item) => item.id === current.id);
    res.json({
      ok: true,
      paymentStatus: user.paymentStatus,
      telegramUrl: getTelegramPaymentUrl(req, user)
    });
  });

  app.post("/api/access/activate", requireLogin, (req, res) => {
    const rawKey = String(req.body?.key || "").trim().toUpperCase();
    if (!rawKey) return res.status(400).json({ error: "Enter the access key." });
    const current = req.userRecord;
    const keyHash = hashKey(rawKey);
    const store = updateStore((draft) => {
      const user = draft.users.find((item) => item.id === current.id);
      if (!user) throw new Error("User not found.");
      const key = draft.keys.find((item) => item.keyHash === keyHash && item.userId === user.id);
      if (!key) throw new Error("Invalid access key.");
      if (key.used) throw new Error("This access key has already been used.");
      key.used = true;
      key.usedAt = new Date().toISOString();
      user.verified = true;
      user.paymentStatus = "approved";
      user.keyUsedAt = key.usedAt;
      user.updatedAt = key.usedAt;
      return draft;
    });
    const user = store.users.find((item) => item.id === current.id);
    setSession(req, res, getSessionPayload(user));
    res.json({ ok: true, user: publicUser(user), redirect: "/" });
  });

  app.get("/api/games", requireVerified, (_req, res) => {
    const store = readStore();
    res.json({
      items: store.games
        .filter((game) => game.platform === "PC")
        .map((game) => ({
          id: game.id,
          slug: game.slug,
          name: game.name,
          image: game.image,
          description: game.description,
          platform: game.platform
        }))
    });
  });

  app.get("/api/games/:slug", requireVerified, (req, res) => {
    const game = readStore().games.find((item) => item.slug === req.params.slug && item.platform === "PC");
    if (!game) return res.status(404).json({ error: "Game not found." });
    res.json({
      id: game.id,
      slug: game.slug,
      name: game.name,
      image: game.image,
      description: game.description,
      platform: game.platform
    });
  });

  app.get("/api/games/:slug/credentials", requireVerified, (req, res) => {
    const game = readStore().games.find((item) => item.slug === req.params.slug && item.platform === "PC");
    if (!game) return res.status(404).json({ error: "Game not found." });
    if (!game.credentialIdCipher || !game.credentialPasswordCipher) {
      return res.status(404).json({ error: "Credentials have not been uploaded for this game yet." });
    }
    res.json({
      accountId: decryptSecret(game.credentialIdCipher),
      accountPassword: decryptSecret(game.credentialPasswordCipher)
    });
  });

  app.get("/api/console/:platform", requireVerified, (req, res) => {
    const platform = String(req.params.platform || "").toUpperCase();
    if (!["PS4", "PS5"].includes(platform)) return res.status(400).json({ error: "Invalid platform." });
    res.json({
      items: readStore().games
        .filter((game) => game.platform === platform)
        .map((game) => ({
          id: game.id,
          slug: game.slug,
          name: game.name,
          image: game.image,
          description: game.description,
          telegramUrl: getSettings().telegramUrl
        }))
    });
  });

  app.get("/api/admin/overview", requireAdmin, (_req, res) => {
    res.json(adminPayload());
  });

  app.post("/api/admin/games", requireAdmin, (req, res) => {
    const platform = String(req.body?.platform || "PC").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();
    const image = String(req.body?.image || "").trim();
    const description = String(req.body?.description || "").trim();
    const accountId = String(req.body?.accountId || "").trim();
    const accountPassword = String(req.body?.accountPassword || "").trim();
    if (!["PC", "PS4", "PS5"].includes(platform)) return res.status(400).json({ error: "Invalid platform." });
    if (!name || !description) return res.status(400).json({ error: "Name and description are required." });
    if (platform === "PC" && (!accountId || !accountPassword)) {
      return res.status(400).json({ error: "PC games require an ID and password." });
    }

    const store = updateStore((draft) => {
      draft.games.unshift({
        id: createId("game"),
        slug: slugify(`${platform}-${name}`),
        platform,
        name,
        image,
        description,
        credentialIdCipher: platform === "PC" ? encryptSecret(accountId) : "",
        credentialPasswordCipher: platform === "PC" ? encryptSecret(accountPassword) : "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return draft;
    });

    res.status(201).json(store.games[0]);
  });

  app.put("/api/admin/games/:id", requireAdmin, (req, res) => {
    const store = updateStore((draft) => {
      const game = draft.games.find((item) => item.id === req.params.id);
      if (!game) throw new Error("Game not found.");
      const name = String(req.body?.name || game.name).trim();
      const image = String(req.body?.image || game.image).trim();
      const description = String(req.body?.description || game.description).trim();
      const platform = String(req.body?.platform || game.platform).trim().toUpperCase();
      if (!["PC", "PS4", "PS5"].includes(platform)) throw new Error("Invalid platform.");
      game.name = name;
      game.slug = slugify(`${platform}-${name}`);
      game.platform = platform;
      game.image = image;
      game.description = description;
      if (platform === "PC") {
        const accountId = String(req.body?.accountId || "").trim();
        const accountPassword = String(req.body?.accountPassword || "").trim();
        if (accountId) game.credentialIdCipher = encryptSecret(accountId);
        if (accountPassword) game.credentialPasswordCipher = encryptSecret(accountPassword);
      } else {
        game.credentialIdCipher = "";
        game.credentialPasswordCipher = "";
      }
      game.updatedAt = new Date().toISOString();
      return draft;
    });
    res.json(store.games.find((item) => item.id === req.params.id));
  });

  app.delete("/api/admin/games/:id", requireAdmin, (req, res) => {
    updateStore((draft) => {
      draft.games = draft.games.filter((item) => item.id !== req.params.id);
      return draft;
    });
    res.json({ ok: true });
  });

  app.post("/api/admin/users/:id/approve", requireAdmin, (req, res) => {
    const store = updateStore((draft) => {
      const user = draft.users.find((item) => item.id === req.params.id);
      if (!user) throw new Error("User not found.");
      user.paymentStatus = "approved";
      user.keyAssignedAt = new Date().toISOString();
      user.updatedAt = user.keyAssignedAt;
      return draft;
    });
    const user = store.users.find((item) => item.id === req.params.id);
    const keyValue = makeAccessKey();
    updateStore((draft) => {
      draft.keys = draft.keys.filter((item) => !(item.userId === user.id && item.used === false));
      draft.keys.unshift({
        id: createId("key"),
        userId: user.id,
        email: user.email,
        keyHash: hashKey(keyValue),
        keyPreview: `${keyValue.slice(0, 4)}-${keyValue.slice(-4)}`,
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: "admin",
        usedAt: ""
      });
      return draft;
    });
    res.json({
      ok: true,
      user: publicUser(user),
      generatedKey: keyValue
    });
  });

  app.post("/api/admin/settings", requireAdmin, (req, res) => {
    const store = updateStore((draft) => {
      draft.settings.siteTitle = String(req.body?.siteTitle || draft.settings.siteTitle).trim() || draft.settings.siteTitle;
      draft.settings.siteTagline = String(req.body?.siteTagline || draft.settings.siteTagline).trim() || draft.settings.siteTagline;
      draft.settings.siteDescription = String(req.body?.siteDescription || draft.settings.siteDescription).trim() || draft.settings.siteDescription;
      draft.settings.paymentQrUrl = String(req.body?.paymentQrUrl || draft.settings.paymentQrUrl).trim() || draft.settings.paymentQrUrl;
      draft.settings.telegramUrl = String(req.body?.telegramUrl || draft.settings.telegramUrl).trim() || draft.settings.telegramUrl;
      draft.settings.accessPriceInr = Number(req.body?.accessPriceInr || draft.settings.accessPriceInr) || draft.settings.accessPriceInr;
      draft.settings.logoUrl = String(req.body?.logoUrl || draft.settings.logoUrl).trim() || draft.settings.logoUrl;
      draft.settings.adminNotice = String(req.body?.adminNotice || draft.settings.adminNotice).trim() || draft.settings.adminNotice;
      return draft;
    });
    res.json(store.settings);
  });

  const pages = [
    { route: "/", file: "index.html" },
    { route: "/login", file: "login.html" },
    { route: "/login.html", file: "login.html" },
    { route: "/payment", file: "payment.html" },
    { route: "/payment.html", file: "payment.html" },
    { route: "/pc-games", file: "pc-games.html" },
    { route: "/pc-games.html", file: "pc-games.html" },
    { route: "/ps4-games", file: "ps4-games.html" },
    { route: "/ps4-games.html", file: "ps4-games.html" },
    { route: "/ps5-games", file: "ps5-games.html" },
    { route: "/ps5-games.html", file: "ps5-games.html" },
    { route: "/admin", file: "admin.html" },
    { route: "/admin.html", file: "admin.html" }
  ];

  pages.forEach((page) => {
    app.get(page.route, (_req, res) => {
      res.sendFile(path.join(publicDir, page.file));
    });
  });

  app.get("/game/:slug", (_req, res) => {
    res.sendFile(path.join(publicDir, "game.html"));
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || "Internal server error." });
  });

  return app;

  function ensureStoreSeedState() {
    updateStore((draft) => {
      if (!draft.meta) draft.meta = {};
      if (draft.meta.platformResetApplied) return draft;
      draft.games = [];
      draft.keys = [];
      draft.meta.platformResetApplied = true;
      return draft;
    });
  }
}

function normalizePagePath(pathname) {
  const value = String(pathname || "").trim();
  if (!value) return "";
  if (value === "/") return "/index.html";
  if (value === "/health") return "";
  if (value.startsWith("/game/")) return "/game.html";
  if (value.startsWith("/auth/") || value.startsWith("/api/") || value.startsWith("/vendor/") || value.startsWith("/assets/")) return "";
  if (value.includes(".") && !value.endsWith(".html")) return "";
  return value.endsWith(".html") ? value : `${value}.html`;
}

function upsertGoogleUser({ email, googleId, name }) {
  const now = new Date().toISOString();
  const store = updateStore((draft) => {
    let user = draft.users.find((item) => item.email === email.toLowerCase());
    if (!user) {
      user = {
        id: createId("user"),
        email: email.toLowerCase(),
        name,
        googleId,
        passwordHash: "",
        paymentStatus: "unpaid",
        verified: false,
        keyAssignedAt: "",
        keyUsedAt: "",
        createdAt: now,
        updatedAt: now
      };
      draft.users.unshift(user);
      return draft;
    }
    user.googleId = googleId;
    user.name = name || user.name;
    user.updatedAt = now;
    return draft;
  });
  return store.users.find((item) => item.email === email.toLowerCase());
}

function makeAccessKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let index = 0; index < ACCESS_KEY_LENGTH; index += 1) {
    key += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}`;
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value || "").trim().toUpperCase()).digest("hex");
}

function passwordKey() {
  return crypto.createHash("sha256").update(PASSWORD_SECRET).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", passwordKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value) {
  const [ivPart, tagPart, encryptedPart] = String(value || "").split(".");
  if (!ivPart || !tagPart || !encryptedPart) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    passwordKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ""), PASSWORD_SECRET, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(derivedKey.toString("hex"));
    });
  });
}

function verifyPassword(password, expectedHash) {
  if (!/^[a-f0-9]{128}$/i.test(String(expectedHash || ""))) {
    return Promise.resolve(false);
  }
  return hashPassword(password).then((hash) => crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex")));
}

function compareSecret(input, expected) {
  const left = Buffer.from(String(input || ""), "utf8");
  const right = Buffer.from(String(expected || ""), "utf8");
  if (!right.length || left.length !== right.length) {
    return Promise.resolve(false);
  }
  return Promise.resolve(crypto.timingSafeEqual(left, right));
}

function verifyPasswordAgainstSecret(password, secret) {
  if (!secret) return Promise.resolve(false);
  return Promise.all([hashPassword(password), hashPassword(secret)]).then(([left, right]) => {
    return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  });
}

module.exports = createApp;
module.exports.hashPassword = hashPassword;
