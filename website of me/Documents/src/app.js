const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const compression = require("compression");
const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { attachSession, clearSession, getSession, setSession } = require("./sessionManager");
const { createId, defaultLogo, defaultQr, readStore, slugify, updateStore } = require("./store");

const CREDENTIAL_SECRET = String(process.env.CREDENTIAL_SECRET || process.env.SESSION_SECRET || "change-me-platform-secret");
const PASSWORD_SECRET = String(process.env.PASSWORD_SECRET || process.env.SESSION_SECRET || "change-me-password-secret");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const BASE_URL = String(process.env.BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/+$/, "");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "aditi0110";

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  const uploadDir = path.join(publicDir, "assets", "uploads");
  const nodeModulesDir = path.join(__dirname, "..", "node_modules");
  ensureDir(uploadDir);
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
  app.use((req, res, next) => {
    if (req.path !== "/admin" && req.path !== "/admin.html") return next();
    return res.sendFile(path.join(publicDir, "admin.html"));
  });

  const publicStatic = express.static(publicDir, {
    etag: true,
    maxAge: 0,
    index: false,
    extensions: false,
    setHeaders: (res, filePath) => {
      if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, must-revalidate");
      }
    }
  });
  app.use((req, res, next) => {
    if (req.path === "/" || req.path.endsWith(".html")) return next();
    return publicStatic(req, res, next);
  });

  function getSettings() {
    return readStore().settings;
  }

  function getAdminState() {
    return {
      username: ADMIN_USERNAME,
      passwordHash: "",
      hasEnvPassword: true,
      recoveryConfigured: false
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

  function accessRedirectPath(user) {
    if (!user) return "/login.html";
    if (user.verified) return "/pc-games";
    if (user.paymentStatus === "approved") return "/enter-key.html";
    return "/payment.html";
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

  function sortByNewest(items, field = "createdAt") {
    return [...items].sort((left, right) => String(right?.[field] || "").localeCompare(String(left?.[field] || "")));
  }

  function adminKeyRecord(key) {
    return {
      id: key.id,
      userId: key.userId,
      email: key.email,
      linkedEmail: key.email,
      keyPreview: key.keyPreview,
      used: key.used === true,
      createdAt: key.createdAt,
      createdBy: key.createdBy,
      usedAt: key.usedAt
    };
  }

  function adminGameRecord(game) {
    return {
      id: game.id,
      slug: game.slug,
      platform: game.platform,
      name: game.name,
      image: game.image,
      description: game.description,
      hasCredentials: Boolean(game.credentialIdCipher && game.credentialPasswordCipher),
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    };
  }

  function adminUserRecord(user, keys = []) {
    const unusedKeys = keys.filter((item) => !item.used);
    const usedKeys = keys.filter((item) => item.used);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      paymentStatus: user.paymentStatus,
      verified: user.verified,
      hasUnusedKey: unusedKeys.length > 0,
      unusedKeyCount: unusedKeys.length,
      usedKeyCount: usedKeys.length,
      latestKeyPreview: keys[0]?.keyPreview || "",
      keyAssignedAt: user.keyAssignedAt,
      keyUsedAt: user.keyUsedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  function getAdminKeys() {
    return sortByNewest(readStore().keys.map(adminKeyRecord));
  }

  function getAdminGames() {
    return sortByNewest(readStore().games.map(adminGameRecord));
  }

  function getAdminUsers() {
    const store = readStore();
    const keysByUser = new Map();
    store.keys.forEach((key) => {
      const list = keysByUser.get(key.userId) || [];
      list.push(adminKeyRecord(key));
      keysByUser.set(key.userId, list);
    });

    keysByUser.forEach((keys, userId) => {
      keysByUser.set(userId, sortByNewest(keys));
    });

    return sortByNewest(
      store.users.map((user) => adminUserRecord(user, keysByUser.get(user.id) || [])),
      "updatedAt"
    );
  }

  function getAdminStats() {
    const store = readStore();
    return {
      users: store.users.length,
      verifiedUsers: store.users.filter((item) => item.verified).length,
      pendingPayments: store.users.filter((item) => item.paymentStatus === "pending").length,
      approvedUsers: store.users.filter((item) => item.paymentStatus === "approved").length,
      unusedKeys: store.keys.filter((item) => item.used !== true).length,
      usedKeys: store.keys.filter((item) => item.used === true).length,
      pcGames: store.games.filter((item) => item.platform === "PC").length,
      ps4Games: store.games.filter((item) => item.platform === "PS4").length,
      ps5Games: store.games.filter((item) => item.platform === "PS5").length
    };
  }

  function adminPayload() {
    return {
      users: getAdminUsers(),
      keys: getAdminKeys(),
      games: getAdminGames(),
      stats: getAdminStats(),
      settings: getSettings()
    };
  }

  function approveUserAccess(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) throw createHttpError(400, "Select a user first.");

    const store = updateStore((draft) => {
      const user = draft.users.find((item) => item.id === normalizedUserId);
      if (!user) throw createHttpError(404, "User not found.");
      const now = new Date().toISOString();
      user.paymentStatus = "approved";
      user.updatedAt = now;
      return draft;
    });

    const user = store.users.find((item) => item.id === normalizedUserId);
    return getAdminUsers().find((item) => item.id === user.id);
  }

  function generateAccessKeyForUser(userId) {
    const normalizedUserId = String(userId || "").trim();
    let generatedKey = "";
    let createdKeyId = "";

    const store = updateStore((draft) => {
      const now = new Date().toISOString();
      let user = null;
      if (normalizedUserId) {
        user = draft.users.find((item) => item.id === normalizedUserId);
        if (!user) throw createHttpError(404, "User not found.");
        if (user.verified) throw createHttpError(400, "This user already unlocked full access.");
        if (user.paymentStatus !== "approved") {
          throw createHttpError(400, "Approve this user before generating a key.");
        }
        draft.keys = draft.keys.filter((item) => !(item.userId === user.id && item.used === false));
      }

      do {
        generatedKey = makeAccessKey();
      } while (draft.keys.some((item) => item.keyHash === hashKey(generatedKey)));

      createdKeyId = createId("key");
      draft.keys.unshift({
        id: createdKeyId,
        userId: user?.id || "",
        email: user?.email || "",
        keyHash: hashKey(generatedKey),
        keyPreview: generatedKey,
        used: false,
        createdAt: now,
        createdBy: "admin",
        usedAt: ""
      });

      if (user) {
        user.keyAssignedAt = now;
        user.updatedAt = now;
      }
      return draft;
    });

    const user = normalizedUserId ? getAdminUsers().find((item) => item.id === normalizedUserId) : null;
    const key = adminKeyRecord(store.keys.find((item) => item.id === createdKeyId));

    return {
      ok: true,
      user,
      key,
      generatedKey
    };
  }

  function assignAccessKeyToUser(keyId, userId) {
    const normalizedKeyId = String(keyId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedKeyId || !normalizedUserId) throw createHttpError(400, "Choose both a key and a user.");

    const store = updateStore((draft) => {
      const user = draft.users.find((item) => item.id === normalizedUserId);
      if (!user) throw createHttpError(404, "User not found.");
      if (user.verified) throw createHttpError(400, "This user already has full access.");
      if (user.paymentStatus !== "approved") throw createHttpError(400, "Approve this user before assigning a key.");

      const key = draft.keys.find((item) => item.id === normalizedKeyId);
      if (!key) throw createHttpError(404, "Key not found.");
      if (key.used) throw createHttpError(400, "This key has already been used.");
      if (key.userId && key.userId !== user.id) throw createHttpError(400, "This key is already linked to another user.");

      const now = new Date().toISOString();
      key.userId = user.id;
      key.email = user.email;
      user.keyAssignedAt = now;
      user.updatedAt = now;
      return draft;
    });

    const user = getAdminUsers().find((item) => item.id === normalizedUserId);
    const key = adminKeyRecord(store.keys.find((item) => item.id === normalizedKeyId));
    return { ok: true, user, key };
  }

  function createAdminGame(input) {
    const platform = String(input?.platform || "PC").trim().toUpperCase();
    const name = String(input?.name || "").trim();
    const image = String(input?.image || "").trim();
    const description = String(input?.description || "").trim();
    const accountId = String(input?.accountId || "").trim();
    const accountPassword = String(input?.accountPassword || "").trim();

    if (!["PC", "PS4", "PS5"].includes(platform)) throw createHttpError(400, "Choose a valid platform.");
    if (!name || !description) throw createHttpError(400, "Game name and description are required.");
    if (platform === "PC" && (!accountId || !accountPassword)) {
      throw createHttpError(400, "PC games require an ID and password.");
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

    return adminGameRecord(store.games[0]);
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
    if (pagePath === "/admin.html") return next();

    if (session?.isAdmin) return next();

    const user = getUserBySession(req);
    if (!user) return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
    const state = getAccessState(user);
    if (pagePath === "/payment.html") {
      if (user.paymentStatus === "approved") return res.redirect("/enter-key.html");
      return next();
    }
    if (pagePath === "/enter-key.html") {
      if (state === "verified") return res.redirect("/pc-games");
      return next();
    }
    if (state !== "verified") return res.redirect(accessRedirectPath(user));
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
      return res.redirect(`${accessRedirectPath(user)}?login=success`);
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
      const usernameOk = username.toLowerCase() === adminState.username.toLowerCase();
      const passwordOk = await verifyPasswordAgainstSecret(password, ADMIN_PASSWORD);
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

  app.post("/auth/admin/recovery", (_req, res) => {
    res.status(404).json({ error: "Recovery is not enabled." });
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
      telegramUrl: getTelegramPaymentUrl(req, user),
      redirect: user.paymentStatus === "approved" ? "/enter-key.html" : "/payment.html"
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
      if (user.paymentStatus === "unpaid") throw createHttpError(400, "Complete payment first.");
      const key = draft.keys.find((item) => item.keyHash === keyHash);
      if (!key || key.used) throw createHttpError(400, "Invalid or already used key");
      if (key.userId && key.userId !== user.id) throw createHttpError(400, "Invalid or already used key");
      if (key.email && key.email !== user.email) throw createHttpError(400, "Invalid or already used key");
      const usedAt = new Date().toISOString();
      key.userId = user.id;
      key.email = user.email;
      key.used = true;
      key.usedAt = usedAt;
      user.verified = true;
      user.paymentStatus = "approved";
      user.keyUsedAt = key.usedAt;
      if (!user.keyAssignedAt) user.keyAssignedAt = usedAt;
      user.updatedAt = key.usedAt;
      return draft;
    });
    const user = store.users.find((item) => item.id === current.id);
    setSession(req, res, getSessionPayload(user));
    res.json({ ok: true, user: publicUser(user), redirect: "/pc-games" });
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
    res.json({
      stats: getAdminStats(),
      settings: getSettings()
    });
  });

  app.get("/api/admin/users", requireAdmin, (_req, res) => {
    res.json({ items: getAdminUsers() });
  });

  app.post("/api/admin/approve-user", requireAdmin, (req, res, next) => {
    try {
      const user = approveUserAccess(req.body?.userId);
      res.json({ ok: true, user });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/users/:id/approve", requireAdmin, (req, res, next) => {
    try {
      const user = approveUserAccess(req.params.id);
      res.json({ ok: true, user });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/keys", requireAdmin, (_req, res) => {
    res.json({ items: getAdminKeys() });
  });

  app.post("/api/admin/generate-key", requireAdmin, (req, res, next) => {
    try {
      res.json(generateAccessKeyForUser(req.body?.userId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/upload-image", requireAdmin, (req, res, next) => {
    try {
      const item = saveAdminImageUpload({
        uploadDir,
        fileName: req.body?.fileName,
        dataUrl: req.body?.dataUrl
      });
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/assign-key", requireAdmin, (req, res, next) => {
    try {
      res.json(assignAccessKeyToUser(req.body?.keyId, req.body?.userId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/approve-and-generate-key", requireAdmin, (req, res, next) => {
    try {
      const user = approveUserAccess(req.body?.userId);
      const generated = generateAccessKeyForUser(req.body?.userId);
      res.json({
        ok: true,
        user,
        key: generated.key,
        generatedKey: generated.generatedKey
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/games", requireAdmin, (_req, res) => {
    res.json({ items: getAdminGames() });
  });

  app.post("/api/admin/game", requireAdmin, (req, res, next) => {
    try {
      const item = createAdminGame(req.body);
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/games", requireAdmin, (req, res, next) => {
    try {
      const item = createAdminGame(req.body);
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/games/:id", requireAdmin, (req, res, next) => {
    try {
      const store = updateStore((draft) => {
        const game = draft.games.find((item) => item.id === req.params.id);
        if (!game) throw createHttpError(404, "Game not found.");

        const name = String(req.body?.name || game.name).trim();
        const image = String(req.body?.image || game.image).trim();
        const description = String(req.body?.description || game.description).trim();
        const platform = String(req.body?.platform || game.platform).trim().toUpperCase();

        if (!["PC", "PS4", "PS5"].includes(platform)) throw createHttpError(400, "Choose a valid platform.");
        if (!name || !description) throw createHttpError(400, "Game name and description are required.");

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
          if (!game.credentialIdCipher || !game.credentialPasswordCipher) {
            throw createHttpError(400, "PC games must keep an ID and password configured.");
          }
        } else {
          game.credentialIdCipher = "";
          game.credentialPasswordCipher = "";
        }

        game.updatedAt = new Date().toISOString();
        return draft;
      });

      const item = adminGameRecord(store.games.find((game) => game.id === req.params.id));
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/games/:id", requireAdmin, (req, res, next) => {
    try {
      let removed = false;
      updateStore((draft) => {
        const before = draft.games.length;
        draft.games = draft.games.filter((item) => item.id !== req.params.id);
        removed = draft.games.length !== before;
        return draft;
      });
      if (!removed) throw createHttpError(404, "Game not found.");
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
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
    { route: "/login", file: "login.html" },
    { route: "/login.html", file: "login.html" },
    { route: "/payment", file: "payment.html" },
    { route: "/payment.html", file: "payment.html" },
    { route: "/enter-key", file: "enter-key.html" },
    { route: "/enter-key.html", file: "enter-key.html" },
    { route: "/pc-games", file: "pc-games.html" },
    { route: "/pc-games.html", file: "pc-games.html" },
    { route: "/admin", file: "admin.html" },
    { route: "/admin.html", file: "admin.html" }
  ];

  app.get("/", (req, res) => {
    const session = getSession(req);
    if (session?.isAdmin) return res.redirect("/admin");
    const user = getUserBySession(req);
    if (!user) return res.redirect("/login.html");
    return res.redirect(accessRedirectPath(user));
  });

  pages.forEach((page) => {
    if (page.route === "/admin" || page.route === "/admin.html") return;
    app.get(page.route, (_req, res) => {
      res.sendFile(path.join(publicDir, page.file));
    });
  });

  app.get("/game/:slug", (_req, res) => {
    res.sendFile(path.join(publicDir, "game.html"));
  });

  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message || "Internal server error." });
  });

  return app;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function ensureDir(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function sanitizeUploadFileName(value) {
  return String(value || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    throw createHttpError(400, "Please choose a valid image file.");
  }
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64")
  };
}

function extensionForMime(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".jpg";
}

function saveAdminImageUpload({ uploadDir, fileName, dataUrl }) {
  const { mimeType, buffer } = parseImageDataUrl(dataUrl);
  if (buffer.length > 5 * 1024 * 1024) {
    throw createHttpError(400, "Image must be smaller than 5 MB.");
  }

  const cleanBase = sanitizeUploadFileName(fileName).replace(/\.[a-z0-9]+$/i, "");
  const finalName = `${cleanBase || "game-image"}-${Date.now()}${extensionForMime(mimeType)}`;
  const finalPath = path.join(uploadDir, finalName);
  fs.writeFileSync(finalPath, buffer);

  return {
    ok: true,
    imagePath: `/assets/uploads/${finalName}`
  };
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
  const words = [
    "EMBER", "RAVEN", "PIXEL", "TIGER", "NOVA", "RIVER", "FALCON", "QUARTZ",
    "VORTEX", "SHADOW", "ROCKET", "MATRIX", "ORBIT", "CIPHER", "BLAZE", "SUMMIT",
    "TUNDRA", "ECHO", "PHANTOM", "NEON", "DRAGON", "PULSE", "ATLAS", "STORM",
    "VISION", "FROST", "COMET", "LEGEND", "TITAN", "AURORA", "VECTOR", "CRYSTAL"
  ];
  const parts = [];
  for (let index = 0; index < 6; index += 1) {
    parts.push(words[Math.floor(Math.random() * words.length)]);
  }
  return parts.join("-");
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
