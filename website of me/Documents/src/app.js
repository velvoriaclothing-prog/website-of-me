const fs = require("fs");
const express = require("express");
const compression = require("compression");
const path = require("path");
const { readStore, updateStore, createId, slugify, defaultQr, normalizeConsoleGame } = require("./store");
const { attachSession, getSession, setSession, clearSession } = require("./sessionManager");
const { getMergedBlogs, getBlogBySlug } = require("./blogEngine");
const { ensureBundleDrafts, getBundleBySlug, getBundles, normalizeBundle } = require("./bundleCatalog");
const { buildRobotsTxt, buildSitemapXml, getSeoForPath, injectSeo } = require("./seo");
const createContentController = require("./controllers/contentController");
const createContentRoutes = require("./routes/contentRoutes");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gamersarena.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const ADMIN_SECONDARY_PASSWORD = process.env.ADMIN_SECONDARY_PASSWORD || "change-me";
const ADMIN_RECOVERY_DOB1 = process.env.ADMIN_RECOVERY_DOB1 || "27-03-2007";
const ADMIN_RECOVERY_DOB2 = process.env.ADMIN_RECOVERY_DOB2 || "17-10-2008";
const ADMIN_PRIMARY_WINDOW_MS = 5 * 60 * 1000;
const ADMIN_RECOVERY_WINDOW_MS = 10 * 60 * 1000;

function sanitizeGame(game) {
  const name = String(game.name || "").trim();
  return {
    id: game.id,
    slug: String(game.slug || slugify(name)).trim(),
    name,
    price: Number(game.price || 45),
    category: String(game.category || "Action").trim(),
    description: String(game.description || `${name} is available on Gamers Arena.`).trim(),
    image: String(game.image || "").trim()
  };
}

function sanitizeBlog(blog) {
  return {
    id: blog.id,
    slug: blog.slug,
    title: String(blog.title || "").trim(),
    summary: String(blog.summary || "").trim(),
    content: String(blog.content || "").trim(),
    htmlContent: String(blog.htmlContent || "").trim(),
    image: String(blog.image || "").trim(),
    category: String(blog.category || "Manual").trim(),
    keywords: Array.isArray(blog.keywords) ? blog.keywords.map((item) => String(item).trim()).filter(Boolean) : [],
    metaTitle: String(blog.metaTitle || `${blog.title || "Blog"} | Gamers Arena`).trim(),
    metaDescription: String(blog.metaDescription || blog.summary || "").trim(),
    wordCount: Number(blog.wordCount || 0),
    readTime: Number(blog.readTime || 0),
    editable: blog.editable !== false,
    source: String(blog.source || "manual").trim(),
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt
  };
}

function sanitizeConsoleGame(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: String(item.name || "").trim(),
    platform: String(item.platform || "PS5").trim(),
    image: String(item.image || "").trim(),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function sanitizeBundle(bundle, options = {}) {
  const includeImages = options.includeImages !== false;
  return {
    id: bundle.id,
    slug: bundle.slug,
    name: String(bundle.name || "").trim(),
    itemCount: Number(bundle.itemCount || 0),
    price: Number(bundle.price || 45),
    description: String(bundle.description || "").trim(),
    images: includeImages && Array.isArray(bundle.images) ? bundle.images.map((image) => String(image || "").trim()).filter(Boolean).slice(0, 2) : [],
    gameIds: Array.isArray(bundle.gameIds) ? bundle.gameIds : []
  };
}

function legacyNormalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDobValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 8) return "";
  if (digits.startsWith("19") || digits.startsWith("20")) {
    return `${digits.slice(6, 8)}-${digits.slice(4, 6)}-${digits.slice(0, 4)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
}

function stripHtmlText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function createApp(io) {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  readStore();
  const contentController = createContentController({ readStore, updateStore, createId, slugify });

  function getAdminCredentials(store) {
    return {
      email: store.admin.email || ADMIN_EMAIL,
      password: store.admin.password || ADMIN_PASSWORD || "change-me",
      secondaryPassword: store.admin.secondaryPassword || ADMIN_SECONDARY_PASSWORD || "change-me",
      emailManagedByEnv: false,
      passwordManagedByEnv: false,
      secondaryManagedByEnv: false,
      managedByEnv: false
    };
  }

  function isPrimaryVerificationActive(session, email) {
    return Boolean(
      session?.adminPrimaryEmail &&
      session.adminPrimaryEmail.toLowerCase() === String(email || "").toLowerCase() &&
      Number(session.adminPrimaryVerifiedUntil || 0) > Date.now()
    );
  }

  function isRecoveryVerificationActive(session) {
    return Number(session?.adminRecoveryVerifiedUntil || 0) > Date.now();
  }

  function resolveBaseUrl(req) {
    const envBaseUrl = String(process.env.BASE_URL || "").trim();
    if (envBaseUrl) return envBaseUrl.replace(/\/+$/, "");
    return `${req.protocol}://${req.get("host")}`;
  }

  function sendSeoPage(req, res, fileName, seoPath) {
    const filePath = path.join(publicDir, fileName);
    if (!fs.existsSync(filePath)) return res.sendStatus(404);
    const html = fs.readFileSync(filePath, "utf8");
    const seo = getSeoForPath(seoPath);
    return res.type("html").send(injectSeo(html, seo, resolveBaseUrl(req)));
  }

  function sendProtectedSeoPage(req, res, fileName, seoPath) {
    const session = getSession(req);
    if (!session?.isAdmin) {
      return res.redirect(`/login.html?redirect=${encodeURIComponent(seoPath)}`);
    }
    return sendSeoPage(req, res, fileName, seoPath);
  }

  app.use(compression());
  app.use(express.json({ limit: "25mb" }));
  app.use((req, res, next) => {
    attachSession(req, res);
    next();
  });
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(buildRobotsTxt(resolveBaseUrl(req)));
  });
  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(buildSitemapXml(resolveBaseUrl(req)));
  });
  app.use((req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const pagePath = req.path === "/" ? "/index.html" : req.path;
    if (!pagePath.endsWith(".html")) return next();
    if (["/admin.html", "/editor.html"].includes(pagePath)) {
      const session = getSession(req);
      if (!session?.isAdmin) {
        return res.redirect(`/login.html?redirect=${encodeURIComponent(pagePath)}`);
      }
    }
    const fileName = pagePath === "/index.html" ? "index.html" : pagePath.slice(1);
    const filePath = path.join(publicDir, fileName);
    if (!fs.existsSync(filePath)) return next();
    return sendSeoPage(req, res, fileName, pagePath);
  });
  app.use(express.static(publicDir, {
    etag: true,
    maxAge: "1h"
  }));

  function requireAuth(req, res, next) {
    const session = getSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Login required." });
    req.session = session;
    next();
  }

  function requireAdmin(req, res, next) {
    const session = getSession(req);
    if (!session?.isAdmin) return res.status(403).json({ error: "Admin access required." });
    req.session = session;
    next();
  }

  app.use("/api/content", createContentRoutes(contentController, requireAdmin));

  function validateContact(contact) {
    const value = String(contact || "").trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const mobileOk = /^\d{10}$/.test(value.replace(/\D/g, ""));
    return emailOk || mobileOk;
  }

  function getOwnerKey(session) {
    return session?.userId || session?.ownerKey;
  }

  function findUserByContact(store, contact) {
    return (store.users || []).find((item) => String(item.contact || "").toLowerCase() === String(contact || "").toLowerCase());
  }

  function findUserByRecovery(store, name, contact) {
    return (store.users || []).find((item) => (
      String(item.contact || "").toLowerCase() === String(contact || "").toLowerCase() &&
      String(item.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
    ));
  }

  function buildCartItems(store, ownerKey) {
    const bundles = getBundles(store);
    return (store.carts[ownerKey] || []).map((item) => {
      if (item.bundleId) {
        const bundle = bundles.find((entry) => entry.id === item.bundleId || entry.slug === item.bundleSlug);
        return {
          id: item.id,
          bundleId: item.bundleId,
          bundleSlug: bundle?.slug || item.bundleSlug,
          type: "bundle",
          name: bundle?.name || item.name,
          price: bundle?.price ?? item.price,
          itemCount: bundle?.itemCount ?? item.itemCount ?? 0
        };
      }

      const game = store.games.find((entry) => entry.id === item.gameId);
      return {
        id: item.id,
        gameId: item.gameId,
        type: "game",
        name: game?.name || item.name,
        price: game?.price ?? item.price
      };
    });
  }

  app.get("/api/session", (req, res) => {
    const session = getSession(req);
    const store = readStore();
    const settings = store.settings || {};
    const admin = getAdminCredentials(store);
    const includeQr = String(req.query?.includeQr || "") === "1";
    res.json({
      user: session?.userId ? {
        id: session.userId,
        name: session.name,
        contact: session.contact,
        isAdmin: Boolean(session.isAdmin)
      } : session?.isAdmin ? {
        id: "admin",
        name: "Admin",
        contact: admin.email,
        isAdmin: true
      } : null,
      settings: {
        siteTitle: settings.siteTitle || "Gamers Arena",
        qrImage: includeQr ? (settings.qrImage || defaultQr) : "",
        homeLayout: Array.isArray(settings.homeLayout) ? settings.homeLayout : [],
        bundles: getBundles(store).map((bundle) => sanitizeBundle(bundle, { includeImages: false })),
        adminEmail: admin.email,
        adminEmailManagedByEnv: admin.emailManagedByEnv,
        adminPasswordManagedByEnv: admin.passwordManagedByEnv,
        adminSecondaryManagedByEnv: admin.secondaryManagedByEnv,
        credentialsManagedByEnv: admin.managedByEnv
      }
    });
  });

  app.post("/auth/signup", (req, res) => {
    const name = String(req.body?.name || "").trim();
    const contact = String(req.body?.contact || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!name || !validateContact(contact) || password.length < 4) {
      return res.status(400).json({ error: "Enter a valid name, email or mobile, and password." });
    }

    const store = updateStore((draft) => {
      const exists = draft.users.some((user) => user.contact.toLowerCase() === contact.toLowerCase());
      if (exists) throw new Error("User already exists.");
      draft.users.push({
        id: createId("user"),
        name,
        contact,
        password,
        createdAt: new Date().toISOString()
      });
      return draft;
    });

    const user = findUserByContact(store, contact);
    const guestOwner = getSession(req)?.ownerKey;
    setSession(req, res, {
      ownerKey: user.id,
      userId: user.id,
      name: user.name,
      contact: user.contact,
      isAdmin: false
    });
    if (guestOwner && store.carts[guestOwner]?.length) {
      updateStore((draft) => {
        draft.carts[user.id] = [...(draft.carts[user.id] || []), ...draft.carts[guestOwner]];
        delete draft.carts[guestOwner];
        return draft;
      });
    }
    return res.status(201).json({ user: { id: user.id, name: user.name, contact: user.contact, isAdmin: false } });
  });

  app.post("/auth/login", (req, res) => {
    const contact = String(req.body?.contact || "").trim();
    const password = String(req.body?.password || "").trim();
    const adminPasscode = String(req.body?.adminPasscode || "").trim();
    const role = String(req.body?.role || "user");
    const store = readStore();
    const admin = getAdminCredentials(store);

    if (role === "admin") {
      if (
        contact.toLowerCase() === admin.email.toLowerCase() &&
        password === admin.password &&
        adminPasscode === admin.secondaryPassword
      ) {
        setSession(req, res, {
          ownerKey: "admin",
          userId: "admin",
          name: "Admin",
          contact: admin.email,
          isAdmin: true,
          adminPrimaryEmail: "",
          adminPrimaryVerifiedUntil: 0,
          adminRecoveryVerifiedUntil: 0
        });
        return res.json({ user: { id: "admin", name: "Admin", contact: admin.email, isAdmin: true } });
      }
      return res.status(401).json({ error: "Invalid admin credentials." });
    }

    const user = findUserByContact(store, contact);
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid user credentials." });
    const guestOwner = getSession(req)?.ownerKey;
    setSession(req, res, {
      ownerKey: user.id,
      userId: user.id,
      name: user.name,
      contact: user.contact,
      isAdmin: false
    });
    if (guestOwner && guestOwner !== user.id && store.carts[guestOwner]?.length) {
      updateStore((draft) => {
        draft.carts[user.id] = [...(draft.carts[user.id] || []), ...draft.carts[guestOwner]];
        delete draft.carts[guestOwner];
        return draft;
      });
    }
    return res.json({ user: { id: user.id, name: user.name, contact: user.contact, isAdmin: false } });
  });

  app.post("/auth/admin/primary", (req, res) => {
    const contact = String(req.body?.contact || "").trim();
    const password = String(req.body?.password || "").trim();
    const store = readStore();
    const admin = getAdminCredentials(store);
    if (contact.toLowerCase() !== admin.email.toLowerCase() || password !== admin.password) {
      return res.status(401).json({ error: "First admin password is incorrect." });
    }

    const current = getSession(req);
    setSession(req, res, {
      ownerKey: current?.ownerKey || "admin-check",
      userId: null,
      name: current?.name || "Guest",
      contact: current?.contact || "",
      isAdmin: false,
      adminPrimaryEmail: admin.email,
      adminPrimaryVerifiedUntil: Date.now() + ADMIN_PRIMARY_WINDOW_MS,
      adminRecoveryVerifiedUntil: 0
    });
    return res.json({ ok: true, message: "First password verified." });
  });

  app.post("/auth/admin/secondary", (req, res) => {
    const contact = String(req.body?.contact || "").trim();
    const adminPasscode = String(req.body?.adminPasscode || "").trim();
    const session = getSession(req);
    const store = readStore();
    const admin = getAdminCredentials(store);
    if (!isPrimaryVerificationActive(session, contact)) {
      return res.status(401).json({ error: "Please verify the first admin password again." });
    }
    if (adminPasscode !== admin.secondaryPassword) {
      return res.status(401).json({ error: "Second admin password is incorrect." });
    }

    setSession(req, res, {
      ownerKey: "admin",
      userId: "admin",
      name: "Admin",
      contact: admin.email,
      isAdmin: true,
      adminPrimaryEmail: "",
      adminPrimaryVerifiedUntil: 0,
      adminRecoveryVerifiedUntil: 0
    });
    return res.json({ user: { id: "admin", name: "Admin", contact: admin.email, isAdmin: true } });
  });

  app.post("/auth/admin/recovery", (req, res) => {
    const dob1 = normalizeDobValue(req.body?.dob1 || "");
    const dob2 = normalizeDobValue(req.body?.dob2 || "");
    const expectedDob1 = normalizeDobValue(ADMIN_RECOVERY_DOB1);
    const expectedDob2 = normalizeDobValue(ADMIN_RECOVERY_DOB2);
    if (!dob1 || !dob2 || dob1 !== expectedDob1 || dob2 !== expectedDob2) {
      return res.status(401).json({ error: "Security answers did not match." });
    }

    const current = getSession(req);
    setSession(req, res, {
      ownerKey: current?.ownerKey || "admin-recovery",
      userId: null,
      name: current?.name || "Guest",
      contact: current?.contact || "",
      isAdmin: false,
      adminPrimaryEmail: "",
      adminPrimaryVerifiedUntil: 0,
      adminRecoveryVerifiedUntil: Date.now() + ADMIN_RECOVERY_WINDOW_MS
    });
    return res.json({ ok: true, message: "Recovery verified. Set new admin passwords now." });
  });

  app.post("/auth/admin/reset", (req, res) => {
    const session = getSession(req);
    if (!isRecoveryVerificationActive(session)) {
      return res.status(401).json({ error: "Please complete birthday verification again." });
    }

    const password = String(req.body?.password || "").trim();
    const adminPasscode = String(req.body?.adminPasscode || "").trim();
    if (password.length < 4 || adminPasscode.length < 4) {
      return res.status(400).json({ error: "Enter a new first and second admin password." });
    }

    const store = updateStore((draft) => {
      draft.admin = draft.admin || {};
      draft.admin.email = draft.admin.email || ADMIN_EMAIL;
      draft.admin.password = password;
      draft.admin.secondaryPassword = adminPasscode;
      draft.admin.updatedAt = new Date().toISOString();
      return draft;
    });
    const admin = getAdminCredentials(store);
    setSession(req, res, {
      ownerKey: "admin",
      userId: "admin",
      name: "Admin",
      contact: admin.email,
      isAdmin: true,
      adminPrimaryEmail: "",
      adminPrimaryVerifiedUntil: 0,
      adminRecoveryVerifiedUntil: 0
    });
    return res.json({
      ok: true,
      message: "Admin password reset completed.",
      user: { id: "admin", name: "Admin", contact: admin.email, isAdmin: true }
    });
  });

  app.post("/auth/reset-password", (req, res) => {
    const name = String(req.body?.name || "").trim();
    const contact = String(req.body?.contact || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!name || !validateContact(contact) || password.length < 4) {
      return res.status(400).json({ error: "Enter the same name, valid email or mobile, and a new password." });
    }

    const session = getSession(req);
    const guestOwner = session?.isAdmin ? null : session?.ownerKey;
    const recoveryUser = findUserByRecovery(readStore(), name, contact);
    if (!recoveryUser) {
      return res.status(404).json({ error: "No account matched that name and contact." });
    }

    const store = updateStore((draft) => {
      const target = findUserByRecovery(draft, name, contact);
      if (!target) throw new Error("No account matched that name and contact.");
      target.password = password;
      target.updatedAt = new Date().toISOString();
      if (guestOwner && guestOwner !== target.id && draft.carts[guestOwner]?.length) {
        draft.carts[target.id] = [...(draft.carts[target.id] || []), ...draft.carts[guestOwner]];
        delete draft.carts[guestOwner];
      }
      return draft;
    });

    const user = findUserByContact(store, contact);
    setSession(req, res, {
      ownerKey: user.id,
      userId: user.id,
      name: user.name,
      contact: user.contact,
      isAdmin: false
    });
    return res.json({
      ok: true,
      message: "Password updated.",
      user: { id: user.id, name: user.name, contact: user.contact, isAdmin: false }
    });
  });

  app.post("/auth/logout", (req, res) => {
    clearSession(req, res);
    attachSession(req, res);
    res.json({ ok: true });
  });

  app.get("/games", (req, res) => {
    const session = getSession(req);
    const store = readStore();
    const categories = [...new Set(store.games.map((game) => String(game.category || "Action")))].sort();
    const query = normalizeSearchValue(req.query?.q || "");
    const category = String(req.query?.category || "").trim();
    const all = String(req.query?.all || "") === "1";
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const limit = Math.min(Math.max(1, Number(req.query?.limit || 24)), 120);
    let items = Array.isArray(store.games) ? store.games : [];

    if (category) {
      items = items.filter((game) => String(game.category || "Action") === category);
    }

    if (query) {
      items = items
        .filter((game) => normalizeSearchValue(game.name).includes(query))
        .sort((left, right) => {
          const leftName = normalizeSearchValue(left.name);
          const rightName = normalizeSearchValue(right.name);
          const leftRank = leftName === query ? 0 : leftName.startsWith(query) ? 1 : leftName.includes(query) ? 2 : 3;
          const rightRank = rightName === query ? 0 : rightName.startsWith(query) ? 1 : rightName.includes(query) ? 2 : 3;
          if (leftRank !== rightRank) return leftRank - rightRank;

          const leftVariant = /edition|collection|bundle|pack/i.test(left.name) ? 1 : 0;
          const rightVariant = /edition|collection|bundle|pack/i.test(right.name) ? 1 : 0;
          if (leftVariant !== rightVariant) return leftVariant - rightVariant;

          return left.name.localeCompare(right.name);
        });
    }

    const total = items.length;
    const pagedItems = (all ? items : items.slice(offset, offset + limit)).map(sanitizeGame);
      res.json({
        items: pagedItems,
        total,
        offset,
        limit: all ? total : limit,
        hasMore: all ? false : offset + pagedItems.length < total,
        canEdit: Boolean(session?.isAdmin),
        categories,
        bundles: getBundles(store).map((bundle) => sanitizeBundle(bundle, { includeImages: false }))
      });
    });

  app.get("/search-suggestions", (req, res) => {
    const store = readStore();
    const query = normalizeSearchValue(req.query?.q || "");
    if (!query || query.length < 2) {
      return res.json({ items: [] });
    }

    const gameMatches = (Array.isArray(store.games) ? store.games : [])
      .filter((game) => normalizeSearchValue(game.name).includes(query))
      .sort((left, right) => {
        const leftName = normalizeSearchValue(left.name);
        const rightName = normalizeSearchValue(right.name);
        const leftRank = leftName === query ? 0 : leftName.startsWith(query) ? 1 : 2;
        const rightRank = rightName === query ? 0 : rightName.startsWith(query) ? 1 : 2;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 6)
      .map((game) => ({
        type: "game",
        id: game.id,
        name: String(game.name || "").trim(),
        category: String(game.category || "Action").trim()
      }));

    const bundleMatches = getBundles(store)
      .filter((bundle) => normalizeSearchValue(bundle.name).includes(query))
      .slice(0, 4)
      .map((bundle) => ({
        type: "bundle",
        id: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        category: "Bundle",
        itemCount: bundle.itemCount
      }));

    res.json({
      items: [...gameMatches, ...bundleMatches].slice(0, 8)
    });
  });

  app.post("/games", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const category = String(req.body?.category || "Action").trim() || "Action";
    const description = String(req.body?.description || "").trim();
    const image = String(req.body?.image || "").trim();
    if (!name) return res.status(400).json({ error: "Game name is required." });
    const store = updateStore((draft) => {
      draft.games.unshift({
        id: createId("game"),
        slug: slugify(name),
        name,
        price: Number.isFinite(price) ? price : 45,
        category,
        description,
        image,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return draft;
    });
    res.status(201).json(sanitizeGame(store.games[0]));
  });

  app.put("/games/:id", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const category = String(req.body?.category || "Action").trim() || "Action";
    const description = String(req.body?.description || "").trim();
    const image = String(req.body?.image || "").trim();
    const store = updateStore((draft) => {
      const target = draft.games.find((game) => game.id === req.params.id);
      if (!target) throw new Error("Game not found.");
      if (!name) throw new Error("Game name is required.");
      target.name = name;
      target.slug = slugify(name);
      target.price = Number.isFinite(price) ? price : 45;
      target.category = category;
      target.description = description;
      target.image = image;
      target.updatedAt = new Date().toISOString();
      return draft;
    });
    const updated = store.games.find((game) => game.id === req.params.id);
    res.json(sanitizeGame(updated));
  });

  app.delete("/games/:id", requireAdmin, (req, res) => {
    updateStore((draft) => {
      draft.games = draft.games.filter((game) => game.id !== req.params.id);
      Object.keys(draft.carts).forEach((key) => {
        draft.carts[key] = (draft.carts[key] || []).filter((item) => item.gameId !== req.params.id);
      });
      return draft;
    });
    res.json({ ok: true });
  });

  app.get("/console-games", (req, res) => {
    const store = readStore();
    const platform = String(req.query?.platform || "").trim().toUpperCase();
    let items = Array.isArray(store.consoleGames) ? store.consoleGames : [];
    if (platform) {
      items = items.filter((item) => String(item.platform || "").toUpperCase() === platform);
    }
    res.json({
      items: items.map(sanitizeConsoleGame),
      total: items.length
    });
  });

  app.post("/console-games", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const image = String(req.body?.image || "").trim();
    const platform = String(req.body?.platform || "PS5").trim().toUpperCase() || "PS5";
    if (!name) return res.status(400).json({ error: "Console game name is required." });
    const store = updateStore((draft) => {
      draft.consoleGames = Array.isArray(draft.consoleGames) ? draft.consoleGames : [];
      draft.consoleGames.unshift(normalizeConsoleGame({
        id: createId("console"),
        name,
        platform,
        image
      }));
      return draft;
    });
    res.status(201).json(sanitizeConsoleGame(store.consoleGames[0]));
  });

  app.put("/console-games/:id", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const image = String(req.body?.image || "").trim();
    const platform = String(req.body?.platform || "PS5").trim().toUpperCase() || "PS5";
    const store = updateStore((draft) => {
      draft.consoleGames = Array.isArray(draft.consoleGames) ? draft.consoleGames : [];
      const target = draft.consoleGames.find((item) => item.id === req.params.id);
      if (!target) throw new Error("Console game not found.");
      if (!name) throw new Error("Console game name is required.");
      target.name = name;
      target.platform = ["PS4", "PS5"].includes(platform) ? platform : "PS5";
      target.slug = slugify(`${target.platform}-${name}`);
      target.image = image;
      target.updatedAt = new Date().toISOString();
      return draft;
    });
    const updated = store.consoleGames.find((item) => item.id === req.params.id);
    res.json(sanitizeConsoleGame(updated));
  });

  app.delete("/console-games/:id", requireAdmin, (req, res) => {
    updateStore((draft) => {
      draft.consoleGames = (draft.consoleGames || []).filter((item) => item.id !== req.params.id);
      return draft;
    });
    res.json({ ok: true });
  });

  app.get("/cart", (req, res) => {
    const store = readStore();
    const ownerKey = getOwnerKey(getSession(req));
    const cartItems = buildCartItems(store, ownerKey);
    res.json({
      items: cartItems,
      total: cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0)
    });
  });

  app.post("/cart/items", (req, res) => {
    const gameId = String(req.body?.gameId || "").trim();
    const store = readStore();
    const game = store.games.find((item) => item.id === gameId);
    if (!game) return res.status(404).json({ error: "Game not found." });
    const ownerKey = getOwnerKey(getSession(req));
    const next = updateStore((draft) => {
      const items = draft.carts[ownerKey] || [];
      if (!items.some((item) => item.gameId === gameId)) {
        items.push({
          id: createId("cart"),
          gameId: game.id,
          name: game.name,
          price: game.price
        });
      }
      draft.carts[ownerKey] = items;
      return draft;
    });
    const items = next.carts[ownerKey] || [];
    res.status(201).json({ items });
  });

  app.post("/cart/bundles", (req, res) => {
    const bundleId = String(req.body?.bundleId || "").trim();
    const store = readStore();
    const bundle = getBundles(store).find((item) => item.id === bundleId || item.slug === bundleId);
    if (!bundle) return res.status(404).json({ error: "Bundle not found." });
    const ownerKey = getOwnerKey(getSession(req));
    const next = updateStore((draft) => {
      const items = draft.carts[ownerKey] || [];
      if (!items.some((item) => item.bundleId === bundle.id)) {
        items.push({
          id: createId("cart"),
          bundleId: bundle.id,
          bundleSlug: bundle.slug,
          name: bundle.name,
          price: bundle.price,
          itemCount: bundle.itemCount
        });
      }
      draft.carts[ownerKey] = items;
      return draft;
    });
    res.status(201).json({ items: next.carts[ownerKey] || [] });
  });

  app.delete("/cart/items/:id", (req, res) => {
    const ownerKey = getOwnerKey(getSession(req));
    updateStore((draft) => {
      draft.carts[ownerKey] = (draft.carts[ownerKey] || []).filter((item) => item.id !== req.params.id);
      return draft;
    });
    res.json({ ok: true });
  });

  app.delete("/cart/clear", (req, res) => {
    const ownerKey = getOwnerKey(getSession(req));
    updateStore((draft) => {
      draft.carts[ownerKey] = [];
      return draft;
    });
    res.json({ ok: true });
  });

  app.post("/orders", (req, res) => {
    const session = getSession(req);
    const store = readStore();
    const ownerKey = getOwnerKey(session);
    const cartItems = buildCartItems(store, ownerKey);
    if (!cartItems.length) return res.status(400).json({ error: "Cart is empty." });

    const customerName = String(req.body?.customerName || session?.name || "Customer").trim();
    const customerContact = String(req.body?.customerContact || session?.contact || "").trim();
    const paymentNote = String(req.body?.paymentNote || "").trim();
    const screenshot = String(req.body?.screenshot || "").trim();
    const orderId = `GA-${Date.now().toString().slice(-8)}`;
    const order = {
      id: createId("order"),
      orderId,
      customerName,
      customerContact,
      paymentNote,
      screenshot,
      items: cartItems,
      total: cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0),
      createdAt: new Date().toISOString()
    };

    updateStore((draft) => {
      draft.orders = Array.isArray(draft.orders) ? draft.orders : [];
      draft.orders.unshift(order);
      return draft;
    });

    res.status(201).json(order);
  });

  app.get("/admin/orders", requireAdmin, (_req, res) => {
    const store = readStore();
    res.json(Array.isArray(store.orders) ? store.orders : []);
  });

  app.get("/blogs", (_req, res) => {
    const store = readStore();
    res.json(
      getMergedBlogs(store.blogs)
        .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
        .map(sanitizeBlog)
    );
  });

  app.get("/blogs/:slug", (req, res) => {
    const store = readStore();
    const blog = getBlogBySlug(store.blogs, req.params.slug);
    if (!blog) return res.status(404).json({ error: "Blog not found." });
    res.json(sanitizeBlog(blog));
  });

  app.post("/blogs", requireAdmin, (req, res) => {
    const title = String(req.body?.title || "").trim();
    const summary = String(req.body?.summary || "").trim();
    const content = String(req.body?.content || "").trim();
    const image = String(req.body?.image || "").trim();
    const category = String(req.body?.category || "Manual").trim() || "Manual";
    const metaTitle = String(req.body?.metaTitle || "").trim();
    const metaDescription = String(req.body?.metaDescription || "").trim();
    const keywords = String(req.body?.keywords || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const wordCount = String(content).split(/\s+/).filter(Boolean).length;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required." });
    const now = new Date().toISOString();
    const store = updateStore((draft) => {
      draft.blogs.unshift({
        id: createId("blog"),
        slug: `${slugify(title)}-${Date.now().toString().slice(-5)}`,
        title,
        summary,
        content,
        image,
        category,
        metaTitle: metaTitle || `${title} | Gamers Arena`,
        metaDescription: metaDescription || summary,
        keywords,
        wordCount,
        readTime: Math.max(1, Math.ceil(wordCount / 220)),
        createdAt: now,
        updatedAt: now
      });
      return draft;
    });
    res.status(201).json(sanitizeBlog(store.blogs[0]));
  });

  app.put("/blogs/:id", requireAdmin, (req, res) => {
    const title = String(req.body?.title || "").trim();
    const summary = String(req.body?.summary || "").trim();
    const content = String(req.body?.content || "").trim();
    const image = String(req.body?.image || "").trim();
    const category = String(req.body?.category || "Manual").trim() || "Manual";
    const metaTitle = String(req.body?.metaTitle || "").trim();
    const metaDescription = String(req.body?.metaDescription || "").trim();
    const keywords = String(req.body?.keywords || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const wordCount = String(content).split(/\s+/).filter(Boolean).length;
    const store = updateStore((draft) => {
      const blog = draft.blogs.find((item) => item.id === req.params.id);
      if (!blog) throw new Error("Blog not found.");
      if (!title || !content) throw new Error("Title and content are required.");
      blog.title = title;
      blog.summary = summary;
      blog.content = content;
      blog.image = image;
      blog.category = category;
      blog.metaTitle = metaTitle || `${title} | Gamers Arena`;
      blog.metaDescription = metaDescription || summary;
      blog.keywords = keywords;
      blog.wordCount = wordCount;
      blog.readTime = Math.max(1, Math.ceil(wordCount / 220));
      blog.slug = `${slugify(title)}-${blog.id.slice(-5)}`;
      blog.updatedAt = new Date().toISOString();
      return draft;
    });
    const updated = store.blogs.find((item) => item.id === req.params.id);
    res.json(sanitizeBlog(updated));
  });

  app.delete("/blogs/:id", requireAdmin, (req, res) => {
    updateStore((draft) => {
      draft.blogs = draft.blogs.filter((item) => item.id !== req.params.id);
      return draft;
    });
    res.json({ ok: true });
  });

  app.get("/settings", (_req, res) => {
    const store = readStore();
    const admin = getAdminCredentials(store);
    res.json({
        siteTitle: store.settings.siteTitle || "Gamers Arena",
        qrImage: store.settings.qrImage || defaultQr,
        homeLayout: Array.isArray(store.settings.homeLayout) ? store.settings.homeLayout : [],
        bundles: getBundles(store).map((bundle) => sanitizeBundle(bundle, { includeImages: false })),
        adminEmail: admin.email,
      adminEmailManagedByEnv: admin.emailManagedByEnv,
      adminPasswordManagedByEnv: admin.passwordManagedByEnv,
      adminSecondaryManagedByEnv: admin.secondaryManagedByEnv,
      credentialsManagedByEnv: admin.managedByEnv
    });
  });

  app.put("/settings", requireAdmin, (req, res) => {
    const currentStore = readStore();
    const admin = getAdminCredentials(currentStore);
    const siteTitle = String(req.body?.siteTitle || "").trim() || "Gamers Arena";
    const qrImage = String(req.body?.qrImage || "").trim() || defaultQr;
    const homeLayout = Array.isArray(req.body?.homeLayout) ? req.body.homeLayout : [];
    const bundles = Array.isArray(req.body?.bundles) ? req.body.bundles : null;
    const adminEmail = String(req.body?.adminEmail || "").trim();
    const adminPassword = String(req.body?.adminPassword || "").trim();
    const adminSecondaryPassword = String(req.body?.adminSecondaryPassword || "").trim();
    const store = updateStore((draft) => {
      draft.settings.siteTitle = siteTitle;
      draft.settings.qrImage = qrImage;
      draft.settings.homeLayout = homeLayout
        .filter((block) => block && ["text", "image", "video"].includes(block.type))
        .map((block, index) => ({
          id: block.id || `block-${index + 1}`,
          type: block.type,
          content: String(block.content || "").trim()
        }));
      if (bundles) {
        draft.settings.bundles = bundles
          .map((bundle, index) => normalizeBundle(bundle, index))
          .filter((bundle) => bundle.name);
      }
      if (adminEmail && !admin.emailManagedByEnv) draft.admin.email = adminEmail;
      if (adminPassword && !admin.passwordManagedByEnv) draft.admin.password = adminPassword;
      if (adminSecondaryPassword && !admin.secondaryManagedByEnv) draft.admin.secondaryPassword = adminSecondaryPassword;
      return draft;
    });
    const activeAdmin = getAdminCredentials(store);
    res.json({
        siteTitle: store.settings.siteTitle,
        qrImage: store.settings.qrImage,
        homeLayout: store.settings.homeLayout,
        bundles: getBundles(store).map((bundle) => sanitizeBundle(bundle, { includeImages: false })),
        adminEmail: activeAdmin.email,
      adminEmailManagedByEnv: activeAdmin.emailManagedByEnv,
      adminPasswordManagedByEnv: activeAdmin.passwordManagedByEnv,
      adminSecondaryManagedByEnv: activeAdmin.secondaryManagedByEnv,
      credentialsManagedByEnv: activeAdmin.managedByEnv
    });
  });

  app.get("/bundles", (_req, res) => {
    const store = readStore();
    res.json(getBundles(store).map((bundle) => sanitizeBundle(bundle, { includeImages: false })));
  });

  app.get("/bundles/:slug", (req, res) => {
    const store = readStore();
    const bundle = getBundleBySlug(store, req.params.slug);
    if (!bundle) return res.status(404).json({ error: "Bundle not found." });
    res.json(sanitizeBundle(bundle));
  });

  app.post("/bundles", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const gameIds = Array.isArray(req.body?.gameIds) ? req.body.gameIds : [];
    const description = String(req.body?.description || "").trim();
    const itemCount = Number(req.body?.itemCount || 0);
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    if (!name) return res.status(400).json({ error: "Bundle name is required." });
    const store = updateStore((draft) => {
      const bundlesDraft = ensureBundleDrafts(draft);
      bundlesDraft.unshift(normalizeBundle({
        id: createId("bundle"),
        slug: slugify(name),
        name,
        price: Number.isFinite(price) ? price : 45,
        itemCount,
        gameIds,
        description,
        images
      }, 0));
      return draft;
    });
    res.status(201).json(sanitizeBundle(store.settings.bundles[0]));
  });

  app.put("/bundles/:id", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const gameIds = Array.isArray(req.body?.gameIds) ? req.body.gameIds : [];
    const description = String(req.body?.description || "").trim();
    const itemCount = Number(req.body?.itemCount || 0);
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const store = updateStore((draft) => {
      const bundlesDraft = ensureBundleDrafts(draft);
      const bundle = bundlesDraft.find((item) => item.id === req.params.id);
      if (!bundle) throw new Error("Bundle not found.");
      if (!name) throw new Error("Bundle name is required.");
      bundle.name = name;
      bundle.slug = slugify(name);
      bundle.price = Number.isFinite(price) ? price : 45;
      bundle.itemCount = Number.isFinite(itemCount) ? itemCount : Number(bundle.itemCount || 0);
      bundle.gameIds = gameIds;
      bundle.description = description;
      if (images.length) bundle.images = images.slice(0, 2);
      return draft;
    });
    res.json(sanitizeBundle(store.settings.bundles.find((item) => item.id === req.params.id)));
  });

  app.delete("/bundles/:id", requireAdmin, (req, res) => {
    updateStore((draft) => {
      ensureBundleDrafts(draft);
      draft.settings.bundles = (draft.settings.bundles || []).filter((item) => item.id !== req.params.id);
      return draft;
    });
    res.json({ ok: true });
  });

  app.get("/editor-layout", requireAdmin, (_req, res) => {
    const store = readStore();
    res.json(store.settings.homeLayout || []);
  });

  app.put("/editor-layout", requireAdmin, (req, res) => {
    const homeLayout = Array.isArray(req.body?.homeLayout) ? req.body.homeLayout : [];
    const store = updateStore((draft) => {
      draft.settings.homeLayout = homeLayout
        .filter((block) => block && ["text", "image", "video"].includes(block.type))
        .map((block, index) => ({
          id: block.id || `block-${index + 1}`,
          type: block.type,
          content: String(block.content || "").trim()
        }));
      return draft;
    });
    res.json(store.settings.homeLayout);
  });

  app.get("/admin/overview", requireAdmin, (_req, res) => {
    const store = readStore();
    const mergedBlogs = getMergedBlogs(store.blogs);
    res.json({
      stats: {
        games: store.games.length,
        consoleGames: Array.isArray(store.consoleGames) ? store.consoleGames.length : 0,
        users: store.users.length,
        chats: store.chats.length,
        blogs: mergedBlogs.length,
        orders: Array.isArray(store.orders) ? store.orders.length : 0
      },
      users: store.users.map((user) => ({
        id: user.id,
        name: user.name,
        contact: user.contact
      })),
      chats: store.chats.map((chat) => ({
        id: chat.id,
        userId: chat.userId,
        userName: chat.userName,
        userContact: chat.userContact,
        gameName: chat.gameName,
        updatedAt: chat.updatedAt,
        unreadForAdmin: chat.messages.filter((message) => message.sender === "user" && !message.readByAdmin).length
      }))
    });
  });

  app.get("/admin/chats/:id", requireAdmin, (req, res) => {
    const store = updateStore((draft) => {
      const chat = draft.chats.find((item) => item.id === req.params.id);
      if (!chat) throw new Error("Chat not found.");
      chat.messages.forEach((message) => {
        if (message.sender === "user") message.readByAdmin = true;
      });
      return draft;
    });
    const chat = store.chats.find((item) => item.id === req.params.id);
    res.json(chat);
  });

  app.get("/my-chat", requireAuth, (req, res) => {
    const store = readStore();
    const user = store.users.find((item) => item.id === req.session.userId);
    const gameName = String(req.query?.game || "").trim();
    let chat = store.chats.find((item) => item.userId === req.session.userId);
    if (!chat && gameName) {
      const updated = updateStore((draft) => {
        draft.chats.unshift({
          id: createId("chat"),
          userId: req.session.userId,
          userName: req.session.name,
          userContact: req.session.contact,
          gameName,
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: createId("msg"),
              sender: "system",
              text: `Order conversation started for ${gameName}.`,
              file: "",
              fileType: "",
              createdAt: new Date().toISOString(),
              readByAdmin: true
            }
          ]
        });
        return draft;
      });
      chat = updated.chats[0];
    }
    res.json({
      user: {
        id: user?.id || req.session.userId,
        name: user?.name || req.session.name,
        contact: user?.contact || req.session.contact
      },
      chat: chat || null
    });
  });

  app.get("/pages/:slug", (req, res) => {
    const store = readStore();
    const pageRecord = (store.pages || []).find((item) => item.slug === req.params.slug);
    if (!pageRecord) return res.sendStatus(404);
    const filePath = path.join(publicDir, "page.html");
    if (!fs.existsSync(filePath)) return res.sendStatus(404);
    const html = fs.readFileSync(filePath, "utf8");
    const description = String(pageRecord.seoDescription || pageRecord.summary || stripHtmlText(pageRecord.content).slice(0, 160)).trim();
    const seo = {
      title: String(pageRecord.seoTitle || `${pageRecord.title} | Gamers Arena`).trim(),
      description,
      ogTitle: String(pageRecord.seoTitle || pageRecord.title || "Gamers Arena").trim(),
      ogDescription: description,
      ogType: "article"
    };
    return res.type("html").send(injectSeo(html, seo, resolveBaseUrl(req)));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: "Gamers Arena" });
  });

  app.get("/", (req, res) => sendSeoPage(req, res, "index.html", "/index.html"));
  app.get("/cart.html", (req, res) => sendSeoPage(req, res, "cart.html", "/cart.html"));
  app.get("/checkout.html", (req, res) => sendSeoPage(req, res, "checkout.html", "/checkout.html"));
  app.get("/chat.html", (req, res) => sendSeoPage(req, res, "chat.html", "/chat.html"));
  app.get("/login.html", (req, res) => sendSeoPage(req, res, "login.html", "/login.html"));
  app.get("/admin.html", (req, res) => sendProtectedSeoPage(req, res, "admin.html", "/admin.html"));
  app.get("/blog.html", (req, res) => sendSeoPage(req, res, "blog.html", "/blog.html"));
  app.get("/post.html", (req, res) => sendSeoPage(req, res, "post.html", "/post.html"));
  app.get("/bundle.html", (req, res) => sendSeoPage(req, res, "bundle.html", "/bundle.html"));
  app.get("/bundle/:slug", (req, res) => sendSeoPage(req, res, "bundle.html", "/bundle.html"));
  app.get("/editor.html", (req, res) => sendProtectedSeoPage(req, res, "editor.html", "/editor.html"));
  app.get("/page.html", (req, res) => sendSeoPage(req, res, "page.html", "/page.html"));

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  io.on("connection", (socket) => {
    const session = socket.request.session;
    if (!session) return;

    if (session.isAdmin) {
      socket.join("admins");
    }
    if (session.userId) {
      socket.join(`user:${session.userId}`);
    }

    socket.on("chat:user-send", (payload = {}) => {
      if (!session.userId || session.isAdmin) return;
      const text = String(payload.text || "").trim();
      const file = String(payload.file || "").trim();
      const fileType = String(payload.fileType || "").trim();
      const gameName = String(payload.gameName || "").trim() || "General Order";
      if (!text && !file) return;

      const now = new Date().toISOString();
      const store = updateStore((draft) => {
        let chat = draft.chats.find((item) => item.userId === session.userId);
        if (!chat) {
          chat = {
            id: createId("chat"),
            userId: session.userId,
            userName: session.name,
            userContact: session.contact,
            gameName,
            updatedAt: now,
            messages: []
          };
          draft.chats.unshift(chat);
        }
        if (gameName && !chat.gameName) chat.gameName = gameName;
        chat.updatedAt = now;
        chat.messages.push({
          id: createId("msg"),
          sender: "user",
          text: text || "Sent a file.",
          file,
          fileType,
          createdAt: now,
          readByAdmin: false
        });
        return draft;
      });

      const chat = store.chats.find((item) => item.userId === session.userId);
      io.to(`user:${session.userId}`).emit("chat:update", chat);
      io.to("admins").emit("admin:chat-list", store.chats.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName,
        userContact: item.userContact,
        gameName: item.gameName,
        updatedAt: item.updatedAt,
        unreadForAdmin: item.messages.filter((message) => message.sender === "user" && !message.readByAdmin).length
      })));
    });

    socket.on("chat:admin-send", (payload = {}) => {
      if (!session.isAdmin) return;
      const chatId = String(payload.chatId || "").trim();
      const text = String(payload.text || "").trim();
      const file = String(payload.file || "").trim();
      const fileType = String(payload.fileType || "").trim();
      if (!chatId || (!text && !file)) return;

      const now = new Date().toISOString();
      const store = updateStore((draft) => {
        const chat = draft.chats.find((item) => item.id === chatId);
        if (!chat) return draft;
        chat.updatedAt = now;
        chat.messages.push({
          id: createId("msg"),
          sender: "admin",
          text: text || "Admin sent a file.",
          file,
          fileType,
          createdAt: now,
          readByAdmin: true
        });
        return draft;
      });
      const chat = store.chats.find((item) => item.id === chatId);
      if (!chat) return;
      io.to(`user:${chat.userId}`).emit("chat:update", chat);
      io.to("admins").emit("chat:update-admin", chat);
      io.to("admins").emit("admin:chat-list", store.chats.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName,
        userContact: item.userContact,
        gameName: item.gameName,
        updatedAt: item.updatedAt,
        unreadForAdmin: item.messages.filter((message) => message.sender === "user" && !message.readByAdmin).length
      })));
    });

    socket.on("admin:join-chat", (chatId) => {
      if (!session.isAdmin) return;
      const store = updateStore((draft) => {
        const chat = draft.chats.find((item) => item.id === chatId);
        if (!chat) return draft;
        chat.messages.forEach((message) => {
          if (message.sender === "user") message.readByAdmin = true;
        });
        return draft;
      });
      const chat = store.chats.find((item) => item.id === chatId);
      if (chat) socket.emit("chat:update-admin", chat);
    });
  });

  return app;
}

module.exports = createApp;
