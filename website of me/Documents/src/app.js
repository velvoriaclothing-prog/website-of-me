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
  ensureBlogPostsSynced();
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

  function getPosts() {
    return sortByNewest(readStore().posts || [], "publishedAt");
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
      syncAutoBlogPosts(draft);
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
    if (req.path === "/blog" || req.path === "/blog.html" || req.path.startsWith("/blog/")) return next();
    const pagePath = normalizePagePath(req.path);
    if (!pagePath) return next();

    if (pagePath === "/login.html" || pagePath === "/blog.html" || pagePath === "/post.html") return next();

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

  app.get("/api/blog", (_req, res) => {
    const posts = getPosts().map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      image: post.image,
      publishedAt: post.publishedAt
    }));
    res.json({ items: posts });
  });

  app.get("/api/blog/:slug", (req, res) => {
    const post = getPosts().find((item) => item.slug === req.params.slug);
    if (!post) return res.status(404).json({ error: "Post not found." });
    res.json(post);
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
        syncAutoBlogPosts(draft);
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
        syncAutoBlogPosts(draft);
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

  app.get("/robots.txt", (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /api/admin",
      `Sitemap: ${baseUrl}/sitemap.xml`
    ].join("\n"));
  });

  app.get("/sitemap.xml", (req, res) => {
    const baseUrl = getBaseUrl(req);
    const staticPages = [
      "/login.html",
      "/blog",
      "/payment.html",
      "/enter-key.html",
      "/pc-games"
    ];
    const postUrls = getPosts().map((post) => `/blog/${post.slug}`);
    const items = [...staticPages, ...postUrls].map((url) => {
      return `<url><loc>${escapeXml(`${baseUrl}${url}`)}</loc></url>`;
    }).join("");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`);
  });

  app.get("/blog", (req, res) => {
    res.type("html").send(renderBlogIndexHtml({
      baseUrl: getBaseUrl(req),
      settings: getSettings(),
      posts: getPosts()
    }));
  });

  app.get("/blog.html", (req, res) => {
    res.type("html").send(renderBlogIndexHtml({
      baseUrl: getBaseUrl(req),
      settings: getSettings(),
      posts: getPosts()
    }));
  });

  app.get("/blog/:slug", (req, res) => {
    const post = getPosts().find((item) => item.slug === req.params.slug);
    if (!post) return res.status(404).send("Post not found.");
    res.type("html").send(renderBlogPostHtml({
      baseUrl: getBaseUrl(req),
      settings: getSettings(),
      post
    }));
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

function ensureBlogPostsSynced() {
  updateStore((draft) => {
    syncAutoBlogPosts(draft);
    return draft;
  });
}

function syncAutoBlogPosts(draft) {
  const manualPosts = Array.isArray(draft.posts)
    ? draft.posts.filter((post) => !post.gameId)
    : [];
  const existingAutoPosts = new Map(
    (Array.isArray(draft.posts) ? draft.posts : [])
      .filter((post) => post.gameId)
      .map((post) => [post.gameId, post])
  );

  const generated = (draft.games || []).map((game) => {
    const existing = existingAutoPosts.get(game.id);
    return buildAutoPost(game, existing);
  });

  draft.posts = [...manualPosts, ...generated].sort((left, right) => {
    return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
  });
}

function buildAutoPost(game, existing = null) {
  const publishedAt = existing?.publishedAt || game.createdAt || new Date().toISOString();
  const updatedAt = game.updatedAt || publishedAt;
  const slug = `${game.slug}-account-guide`;
  const cleanDescription = String(game.description || `${game.name} is now available through Gamers Arena.`).trim();
  const title = `${game.name} account guide: features, access tips, and what to expect`;
  const excerpt = `Learn what ${game.name} offers, why players look for this account, and how Gamers Arena helps verified users unlock it quickly.`;
  const seoTitle = `${game.name} account guide and access tips | Gamers Arena Blog`;
  const seoDescription = `Read our SEO-friendly guide for ${game.name}, including gameplay highlights, account access tips, and why verified players are looking for this title.`;
  const image = game.image || defaultLogo;
  const contentHtml = [
    `<p>${escapeHtmlServer(game.name)} is one of the titles players keep searching for when they want premium game access without wasting time hunting through unreliable sellers. At Gamers Arena, we keep the process simple for verified users: complete access payment, activate your key, and unlock the game credentials securely when you are ready.</p>`,
    `<h2>Why players want ${escapeHtmlServer(game.name)}</h2>`,
    `<p>${escapeHtmlServer(cleanDescription)}</p>`,
    `<p>Players usually look for this title because they want a smoother way to get into the game library, revisit a favorite release, or access a premium game account without long setup friction. That is exactly where a verified gaming access platform becomes useful.</p>`,
    `<h2>What verified users get</h2>`,
    `<p>Once a user finishes the Gamers Arena flow, they can open the game page, review the details, and unlock the account ID and password directly from the secure backend. Sensitive credentials are not exposed publicly and only appear after the correct access checks pass.</p>`,
    `<h2>How Gamers Arena keeps access simple</h2>`,
    `<p>Our platform is built around a clear path: login, payment, key activation, and game access. That means fewer confusing steps for players and a faster way to manage premium game accounts from one place.</p>`,
    `<p>If you are looking for reliable access to ${escapeHtmlServer(game.name)} and other premium PC games, keep an eye on the Gamers Arena catalog and blog. New games, updates, and account access guides are published here automatically as the catalog grows.</p>`
  ].join("");

  return {
    id: existing?.id || createId("post"),
    gameId: game.id,
    slug,
    title,
    excerpt,
    image,
    contentHtml,
    seoTitle,
    seoDescription,
    publishedAt,
    updatedAt
  };
}

function escapeHtmlServer(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return escapeHtmlServer(value);
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function renderSiteHead({ title, description, canonical, image, robots = "index,follow", jsonLd }) {
  const safeTitle = escapeHtmlServer(title);
  const safeDescription = escapeHtmlServer(description);
  const safeCanonical = escapeHtmlServer(canonical);
  const safeImage = escapeHtmlServer(image);
  const jsonLdBlock = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : "";
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta name="robots" content="${escapeHtmlServer(robots)}">
    <link rel="canonical" href="${safeCanonical}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safeCanonical}">
    <meta property="og:image" content="${safeImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImage}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    ${jsonLdBlock}
  `;
}

function renderBlogIndexHtml({ baseUrl, settings, posts }) {
  const title = `${settings.siteTitle} Blog | Game account guides and gaming access articles`;
  const description = `Read SEO-friendly gaming blog posts from ${settings.siteTitle}. Discover PC game account guides, access tips, and updates from the Gamers Arena catalog.`;
  const canonical = `${baseUrl}/blog`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${settings.siteTitle} Blog`,
    description,
    url: canonical
  };

  const cards = posts.length ? posts.map((post) => `
    <article class="game-card blog-card">
      ${post.image ? `<img class="game-thumb" src="${escapeHtmlServer(post.image)}" alt="${escapeHtmlServer(post.title)}" loading="lazy">` : ""}
      <div class="game-card-body">
        <p class="eyebrow">blog article</p>
        <h3>${escapeHtmlServer(post.title)}</h3>
        <p>${escapeHtmlServer(post.excerpt)}</p>
      </div>
      <a class="button button-primary button-block" href="/blog/${escapeHtmlServer(post.slug)}">Read Article</a>
    </article>
  `).join("") : `<div class="empty-state">Blog articles will appear here automatically as games are added to the platform.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>${renderSiteHead({
    title,
    description,
    canonical,
    image: `${baseUrl}${settings.logoUrl || defaultLogo}`,
    jsonLd
  })}</head>
<body>
  <div class="shell">
    <nav class="topbar">
      <a class="brand" href="/login.html">
        <span class="brand-mark">GA</span>
        <span><strong>${escapeHtmlServer(settings.siteTitle)}</strong><br><small>gaming blog</small></span>
      </a>
      <div class="nav-actions">
        <a class="button button-secondary" href="/login.html">Login</a>
        <a class="button button-secondary" href="/pc-games">Games</a>
      </div>
    </nav>
    <section class="hero">
      <p class="eyebrow">seo blog</p>
      <h1>Gaming guides, account tips, and platform updates</h1>
      <p class="hero-copy">This blog is published automatically from the Gamers Arena catalog so your website keeps growing with fresh, search-friendly content.</p>
    </section>
    <section class="panel grid-section">
      <div class="game-grid">${cards}</div>
    </section>
  </div>
</body>
</html>`;
}

function renderBlogPostHtml({ baseUrl, settings, post }) {
  const canonical = `${baseUrl}/blog/${post.slug}`;
  const image = post.image ? `${baseUrl}${post.image}` : `${baseUrl}${settings.logoUrl || defaultLogo}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Organization",
      name: settings.siteTitle
    },
    publisher: {
      "@type": "Organization",
      name: settings.siteTitle,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}${settings.logoUrl || defaultLogo}`
      }
    },
    mainEntityOfPage: canonical
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>${renderSiteHead({
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    canonical,
    image,
    jsonLd
  })}</head>
<body>
  <div class="shell">
    <nav class="topbar">
      <a class="brand" href="/blog">
        <span class="brand-mark">GA</span>
        <span><strong>${escapeHtmlServer(settings.siteTitle)}</strong><br><small>blog article</small></span>
      </a>
      <div class="nav-actions">
        <a class="button button-secondary" href="/blog">Blog</a>
        <a class="button button-secondary" href="/login.html">Login</a>
      </div>
    </nav>
    <article class="panel blog-post-shell">
      <p class="eyebrow">published ${escapeHtmlServer(new Date(post.publishedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }))}</p>
      <h1>${escapeHtmlServer(post.title)}</h1>
      <p class="hero-copy">${escapeHtmlServer(post.excerpt)}</p>
      ${post.image ? `<img class="detail-image" src="${escapeHtmlServer(post.image)}" alt="${escapeHtmlServer(post.title)}" loading="lazy">` : ""}
      <div class="blog-content">${post.contentHtml}</div>
    </article>
  </div>
</body>
</html>`;
}

module.exports = createApp;
module.exports.hashPassword = hashPassword;
