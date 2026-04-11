const express = require("express");
const compression = require("compression");
const path = require("path");
const { readStore, updateStore, createId, slugify, defaultQr } = require("./store");
const { attachSession, getSession, setSession, clearSession } = require("./sessionManager");
const { getMergedBlogs, getBlogBySlug } = require("./blogEngine");
const { ensureBundleDrafts, getBundleBySlug, getBundles, normalizeBundle } = require("./bundleCatalog");
const createContentRoutes = require("./routes/contentRoutes");
const {
  sanitizePage,
  sanitizeProduct: sanitizeManagedProduct,
  sanitizeSection
} = require("./controllers/contentController");
const {
  listProducts: listStaticProducts,
  listUpcomingProducts,
  autoListings
} = require("./services/productService");

const ADMIN_SECONDARY_PASSWORD = process.env.ADMIN_SECONDARY_PASSWORD || "change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gamersarena.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const ADMIN_RECOVERY_DOB1 = process.env.ADMIN_RECOVERY_DOB1 || "27-03-2007";
const ADMIN_RECOVERY_DOB2 = process.env.ADMIN_RECOVERY_DOB2 || "17-10-2008";

function sanitizeGame(game) {
  return {
    id: game.id,
    name: String(game.name || "").trim(),
    price: Number(game.price || 45),
    category: String(game.category || "Action").trim()
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

function sanitizeBundle(bundle) {
  return {
    id: bundle.id,
    slug: bundle.slug,
    name: String(bundle.name || "").trim(),
    itemCount: Number(bundle.itemCount || 0),
    price: Number(bundle.price || 45),
    description: String(bundle.description || "").trim(),
    images: Array.isArray(bundle.images) ? bundle.images.map((image) => String(image || "").trim()).filter(Boolean).slice(0, 2) : [],
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

function sanitizeCatalogProduct(item) {
  const description = String(item.description || item.summary || "").trim();
  return {
    id: item.id,
    slug: item.slug,
    name: String(item.name || "").trim(),
    category: String(item.category || "Gaming").trim(),
    price: Number(item.price || 0),
    rating: Number(item.rating || (item.featured ? 4.8 : 4.4)),
    features: Array.isArray(item.features) && item.features.length
      ? item.features.map((feature) => String(feature).trim()).filter(Boolean)
      : [String(item.badge || "").trim(), String(item.category || "Gaming").trim()].filter(Boolean),
    affiliateUrl: String(item.affiliateUrl || item.ctaUrl || "#").trim() || "#",
    image: String(item.image || "").trim(),
    summary: description,
    description,
    badge: String(item.badge || "").trim()
  };
}

function buildProductCatalog(store) {
  const managed = Array.isArray(store.products) ? store.products.map(sanitizeManagedProduct).map(sanitizeCatalogProduct) : [];
  const base = listStaticProducts().map(sanitizeCatalogProduct);
  const merged = new Map();
  managed.forEach((item) => merged.set(item.slug, item));
  base.forEach((item) => {
    if (!merged.has(item.slug)) merged.set(item.slug, item);
  });
  return [...merged.values()];
}

function parseBudget(query) {
  const match = String(query || "").match(/(\d[\d,]*)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function normalizeDobValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}-${month}-${year}`;
  }
  return raw.replace(/\//g, "-");
}

function hasValidRecoveryDob(dob1, dob2) {
  const expected = [normalizeDobValue(ADMIN_RECOVERY_DOB1), normalizeDobValue(ADMIN_RECOVERY_DOB2)].sort();
  const provided = [normalizeDobValue(dob1), normalizeDobValue(dob2)].sort();
  return provided.length === 2 && provided[0] === expected[0] && provided[1] === expected[1];
}

function createApp(io) {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  readStore();
  const pendingAdminChallenges = new Map();
  const pendingRecoveryChallenges = new Map();

  function createTimedToken(prefix, bucket, payload) {
    const token = createId(prefix);
    bucket.set(token, {
      ...payload,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    return token;
  }

  function consumeTimedToken(bucket, token) {
    const entry = bucket.get(token);
    if (!entry) return null;
    bucket.delete(token);
    if (entry.expiresAt < Date.now()) return null;
    return entry;
  }

  function getAdminCredentials(store) {
    return {
      email: ADMIN_EMAIL || store.admin.email,
      password: ADMIN_PASSWORD || store.admin.password,
      secondaryPassword: process.env.ADMIN_SECONDARY_PASSWORD || store.admin.secondaryPassword || ADMIN_SECONDARY_PASSWORD,
      emailManagedByEnv: Boolean(process.env.ADMIN_EMAIL),
      passwordManagedByEnv: Boolean(process.env.ADMIN_PASSWORD),
      secondaryManagedByEnv: Boolean(process.env.ADMIN_SECONDARY_PASSWORD),
      managedByEnv: Boolean(process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD || process.env.ADMIN_SECONDARY_PASSWORD)
    };
  }

  app.use(compression());
  app.use(express.json({ limit: "25mb" }));
  app.use((req, res, next) => {
    attachSession(req, res);
    next();
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

  function validateContact(contact) {
    const value = String(contact || "").trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const mobileOk = /^\d{10}$/.test(value.replace(/\D/g, ""));
    return emailOk || mobileOk;
  }

  function getOwnerKey(session) {
    return session?.userId || session?.ownerKey;
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

  app.use("/api/content", createContentRoutes({ requireAdmin }));

  app.get("/api/session", (req, res) => {
    const session = getSession(req);
    const store = readStore();
    const settings = store.settings || {};
    const admin = getAdminCredentials(store);
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
        qrImage: settings.qrImage || defaultQr,
        homeLayout: Array.isArray(settings.homeLayout) ? settings.homeLayout : [],
        contentSections: (store.contentSections || []).map(sanitizeSection),
        managedPages: (store.pages || []).map(sanitizePage),
        bundles: getBundles(store).map(sanitizeBundle),
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

    const user = store.users.find((item) => item.contact.toLowerCase() === contact.toLowerCase());
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

  app.post("/auth/admin/primary", (req, res) => {
    const contact = String(req.body?.contact || "").trim();
    const password = String(req.body?.password || "").trim();
    const store = readStore();
    const admin = getAdminCredentials(store);
    if (contact.toLowerCase() !== admin.email.toLowerCase() || password !== admin.password) {
      return res.status(401).json({ error: "Invalid primary admin credentials." });
    }
    const challengeId = createTimedToken("admin-stage", pendingAdminChallenges, {
      email: admin.email
    });
    return res.json({
      ok: true,
      challengeId,
      adminEmail: admin.email
    });
  });

  app.post("/auth/admin/secondary", (req, res) => {
    const challengeId = String(req.body?.challengeId || "").trim();
    const adminPasscode = String(req.body?.adminPasscode || "").trim();
    const store = readStore();
    const admin = getAdminCredentials(store);
    const challenge = consumeTimedToken(pendingAdminChallenges, challengeId);
    if (!challenge || adminPasscode !== admin.secondaryPassword) {
      return res.status(401).json({ error: "Invalid or expired second-step admin login." });
    }
    setSession(req, res, {
      ownerKey: "admin",
      userId: "admin",
      name: "Admin",
      contact: admin.email,
      isAdmin: true
    });
    return res.json({ user: { id: "admin", name: "Admin", contact: admin.email, isAdmin: true } });
  });

  app.post("/auth/admin/recovery", (_req, res) => {
    const dob1 = String(_req.body?.dob1 || "").trim();
    const dob2 = String(_req.body?.dob2 || "").trim();
    if (!hasValidRecoveryDob(dob1, dob2)) {
      return res.status(401).json({ error: "Recovery birthdays do not match." });
    }
    const recoveryId = createTimedToken("admin-recovery", pendingRecoveryChallenges, { ok: true });
    return res.json({ ok: true, recoveryId });
  });

  app.post("/auth/admin/reset", (req, res) => {
    const recoveryId = String(req.body?.recoveryId || "").trim();
    const primaryPassword = String(req.body?.primaryPassword || "").trim();
    const secondaryPassword = String(req.body?.secondaryPassword || "").trim();
    const store = readStore();
    const admin = getAdminCredentials(store);
    const recovery = consumeTimedToken(pendingRecoveryChallenges, recoveryId);
    if (!recovery) return res.status(401).json({ error: "Recovery session expired. Verify birthdays again." });
    if (primaryPassword.length < 4 || secondaryPassword.length < 4) {
      return res.status(400).json({ error: "Both admin passwords must be at least 4 characters." });
    }
    if (admin.passwordManagedByEnv || admin.secondaryManagedByEnv) {
      return res.status(400).json({ error: "Admin passwords are managed by deployment environment variables." });
    }
    updateStore((draft) => {
      draft.admin.password = primaryPassword;
      draft.admin.secondaryPassword = secondaryPassword;
      return draft;
    });
    return res.json({ ok: true, message: "Admin passwords updated." });
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
        contact.toLowerCase() !== admin.email.toLowerCase() ||
        password !== admin.password ||
        adminPasscode !== admin.secondaryPassword
      ) {
        return res.status(401).json({ error: "Invalid admin credentials." });
      }
      setSession(req, res, {
        ownerKey: "admin",
        userId: "admin",
        name: "Admin",
        contact: admin.email,
        isAdmin: true
      });
      return res.json({ user: { id: "admin", name: "Admin", contact: admin.email, isAdmin: true } });
    }

    const user = store.users.find((item) => item.contact.toLowerCase() === contact.toLowerCase() && item.password === password);
    if (!user) return res.status(401).json({ error: "Invalid user credentials." });
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
      bundles: getBundles(store).map(sanitizeBundle)
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

  app.get("/games/:slug", (req, res) => {
    const store = readStore();
    const game = (store.games || []).find((entry) => slugify(entry.slug || entry.name) === req.params.slug || entry.id === req.params.slug);
    if (!game) return res.status(404).json({ error: "Game not found." });
    const name = String(game.name || "").trim();
    const category = String(game.category || "Action").trim();
    res.json({
      id: game.id,
      slug: slugify(name),
      name,
      category,
      price: Number(game.price || 45),
      image: String(game.image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 520'><rect width='900' height='520' fill='%230b1220'/><rect x='24' y='24' width='852' height='472' rx='28' fill='none' stroke='%2322d3ee' stroke-width='3'/><text x='450' y='245' text-anchor='middle' font-family='Arial' font-size='48' fill='white'>Gamers Arena</text><text x='450' y='305' text-anchor='middle' font-family='Arial' font-size='28' fill='%2394a3b8'>Game detail preview</text></svg>").trim(),
      description: String(game.description || `${name} is available through Gamers Arena with quick checkout support and straightforward ordering.`).trim(),
      tags: Array.isArray(game.tags) ? game.tags : [category, "PC Game"],
      seo: game.seo || {
        metaTitle: `${name} | Gamers Arena`,
        metaDescription: String(game.description || `${name} is available on Gamers Arena.`).trim(),
        keywords: [name.toLowerCase(), "gamers arena", category.toLowerCase()]
      },
      systemRequirements: game.systemRequirements || {
        minimum: ["8 GB RAM", "Quad-core CPU", "Mid-range GPU", "50 GB storage"],
        recommended: ["16 GB RAM", "Modern 6-core CPU", "RTX-class GPU", "SSD storage"]
      }
    });
  });

  app.get("/bootstrap", (_req, res) => {
    const store = readStore();
    const catalog = buildProductCatalog(store);
    res.json({
      brand: "Gamers Arena",
      stats: {
        games: store.games.length,
        products: catalog.length,
        tools: 4
      },
      featuredGames: store.games.slice(0, 8).map((item) => ({
        id: item.id,
        slug: slugify(item.name),
        name: item.name,
        category: item.category || "Action",
        price: Number(item.price || 45),
        image: String(item.image || "").trim(),
        summary: String(item.description || `${item.name} is available now.`).trim()
      })),
      featuredBundles: getBundles(store).slice(0, 3).map(sanitizeBundle),
      featuredProducts: catalog.slice(0, 6),
      upcomingProducts: listUpcomingProducts().slice(0, 4),
      autoListings: autoListings(),
      latestBlogs: getMergedBlogs(store.blogs).slice(0, 3).map(sanitizeBlog),
      latestNews: getMergedBlogs(store.blogs).slice(0, 4).map((item) => ({
        ...sanitizeBlog(item),
        featuredImage: item.image || "",
        introduction: item.summary || "",
        sections: [{ title: "Overview", body: item.summary || item.content || "" }],
        conclusion: item.content || item.summary || ""
      })),
      featuredDeals: catalog.slice(0, 4).map((item) => ({
        ...item,
        badge: item.price < 1000 ? "Budget Deal" : item.badge || "Hot Deal"
      }))
    });
  });

  app.post("/auto-game-data", (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Game name is required." });
    const category = /fifa|forza|nfs|racing/i.test(name) ? "Racing" : /cod|battlefield|valorant|cs/i.test(name) ? "Shooter" : /elden|witcher|persona|final fantasy/i.test(name) ? "RPG" : "Action";
    res.json({
      category,
      releaseDate: "2026",
      tags: [category, "PC", "Popular"],
      description: `${name} is positioned as a ${category.toLowerCase()} pick for players who want fast checkout support and reliable availability on Gamers Arena.`,
      metaTitle: `${name} | Gamers Arena`,
      metaDescription: `${name} is available on Gamers Arena with fast support and clean ordering.`,
      keywords: [name.toLowerCase(), "gamers arena", category.toLowerCase()],
      systemRequirements: {
        minimum: ["8 GB RAM", "Quad-core CPU", "Mid-range GPU", "50 GB storage"],
        recommended: ["16 GB RAM", "Modern 6-core CPU", "RTX-class GPU", "SSD storage"]
      }
    });
  });

  app.post("/optimize-game", (req, res) => {
    const {
      gameName = "your game",
      cpu = "mid-range CPU",
      gpu = "mid-range GPU",
      ram = "16 GB",
      storage = "SSD"
    } = req.body || {};
    res.json({
      gameName,
      hardware: { cpu, gpu, ram, storage },
      recommendations: [
        "Lower shadow quality and heavy post-processing first for the cleanest FPS gain.",
        String(storage).toLowerCase().includes("hdd") ? "Move the game to SSD storage for better streaming and loading." : "Your SSD setup is ideal for faster game loading.",
        String(ram).includes("8") ? "Close extra background apps to reduce RAM pressure." : "Your RAM setup should handle most modern titles comfortably."
      ]
    });
  });

  app.post("/recommend-game", (req, res) => {
    const { category = "Action", lowEnd = false } = req.body || {};
    const store = readStore();
    const match = (store.games || []).find((item) => item.category === category || (lowEnd && item.category === "Low-end PC")) || store.games[0];
    res.json({
      recommendation: match ? sanitizeGame(match) : null,
      reason: `Selected for ${category} players based on category fit, value, and broad appeal.`
    });
  });

  app.get("/news", (_req, res) => {
    const store = readStore();
    res.json(
      getMergedBlogs(store.blogs)
        .slice(0, 12)
        .map((item) => ({
          ...sanitizeBlog(item),
          featuredImage: item.image || "",
          introduction: item.summary || "",
          sections: [{ title: "Overview", body: item.summary || item.content || "" }],
          conclusion: item.content || item.summary || ""
        }))
    );
  });

  app.get("/news/:slug", (req, res) => {
    const store = readStore();
    const item = getBlogBySlug(store.blogs, req.params.slug);
    if (!item) return res.status(404).json({ error: "News post not found." });
    res.json({
      ...sanitizeBlog(item),
      featuredImage: item.image || "",
      introduction: item.summary || "",
      sections: [{ title: "Overview", body: item.summary || item.content || "" }],
      conclusion: item.content || item.summary || ""
    });
  });

  app.post("/games", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const category = String(req.body?.category || "Action").trim() || "Action";
    if (!name) return res.status(400).json({ error: "Game name is required." });
    const store = updateStore((draft) => {
      draft.games.unshift({
        id: createId("game"),
        name,
        price: Number.isFinite(price) ? price : 45,
        category
      });
      return draft;
    });
    res.status(201).json(sanitizeGame(store.games[0]));
  });

  app.put("/games/:id", requireAdmin, (req, res) => {
    const name = String(req.body?.name || "").trim();
    const price = Number(req.body?.price || 45);
    const category = String(req.body?.category || "Action").trim() || "Action";
    const store = updateStore((draft) => {
      const target = draft.games.find((game) => game.id === req.params.id);
      if (!target) throw new Error("Game not found.");
      if (!name) throw new Error("Game name is required.");
      target.name = name;
      target.price = Number.isFinite(price) ? price : 45;
      target.category = category;
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
      contentSections: (store.contentSections || []).map(sanitizeSection),
      managedPages: (store.pages || []).map(sanitizePage),
      bundles: getBundles(store).map(sanitizeBundle),
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
      contentSections: (store.contentSections || []).map(sanitizeSection),
      managedPages: (store.pages || []).map(sanitizePage),
      bundles: getBundles(store).map(sanitizeBundle),
      adminEmail: activeAdmin.email,
      adminEmailManagedByEnv: activeAdmin.emailManagedByEnv,
      adminPasswordManagedByEnv: activeAdmin.passwordManagedByEnv,
      adminSecondaryManagedByEnv: activeAdmin.secondaryManagedByEnv,
      credentialsManagedByEnv: activeAdmin.managedByEnv
    });
  });

  app.get("/products", (_req, res) => {
    const store = readStore();
    res.json({
      items: buildProductCatalog(store),
      upcoming: listUpcomingProducts(),
      autoListings: autoListings()
    });
  });

  app.get("/products/:slug", (req, res) => {
    const store = readStore();
    const product = buildProductCatalog(store).find((item) => item.slug === req.params.slug);
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json(product);
  });

  app.post("/search-products", (req, res) => {
    const query = String(req.body?.query || "").trim();
    const budget = parseBudget(query);
    const normalizedQuery = normalizeSearchValue(query);
    const terms = normalizedQuery
      .split(" ")
      .filter(Boolean)
      .filter((term) => !["best", "under", "for", "with", "gaming"].includes(term) && !/^\d+$/.test(term));
    const store = readStore();
    const results = buildProductCatalog(store)
      .filter((item) => {
        const haystack = normalizeSearchValue(`${item.name} ${item.category} ${item.summary} ${item.features.join(" ")}`);
        const queryMatch = !terms.length || terms.every((term) => haystack.includes(term));
        const budgetMatch = !budget || Number(item.price || 0) <= budget;
        return queryMatch && budgetMatch;
      })
      .sort((left, right) => {
        const leftScore = Number(left.rating || 0) / Math.max(1, Number(left.price || 1));
        const rightScore = Number(right.rating || 0) / Math.max(1, Number(right.price || 1));
        return rightScore - leftScore;
      });
    res.json({
      query,
      parsed: {
        budget,
        terms
      },
      results
    });
  });

  app.post("/compare-products", (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const products = buildProductCatalog(readStore()).filter((item) => items.includes(item.id) || items.includes(item.slug));
    const bestValue = [...products].sort((left, right) => (Number(right.rating || 0) / Math.max(1, Number(right.price || 1))) - (Number(left.rating || 0) / Math.max(1, Number(left.price || 1))))[0] || null;
    const bestPerformance = [...products].sort((left, right) => Number(right.rating || 0) - Number(left.rating || 0))[0] || null;
    res.json({
      items: products,
      highlights: {
        bestValue: bestValue?.id || null,
        bestPerformance: bestPerformance?.id || null
      }
    });
  });

  app.post("/can-run", (req, res) => {
    const { gameName = "your game", cpuTier = "mid", gpuTier = "mid", ram = 16, storage = "ssd" } = req.body || {};
    const safeRam = Number(ram || 0);
    const canRun = safeRam >= 8;
    res.json({
      gameName,
      canRun,
      verdict: canRun ? "Playable with balanced settings." : "Hardware is below a safe baseline for modern PC gaming.",
      details: { cpuTier, gpuTier, ram: safeRam, storage }
    });
  });

  app.post("/pc-builder", (req, res) => {
    const budget = Number(req.body?.budget || 60000);
    const target = String(req.body?.target || "1080p gaming").trim();
    res.json({
      budget,
      target,
      build: {
        cpu: budget > 90000 ? "Ryzen 7 7800X3D" : budget > 70000 ? "Ryzen 5 7600" : "Ryzen 5 5600",
        gpu: budget > 90000 ? "RTX 4070 Super" : budget > 70000 ? "RTX 4060" : "RX 6600",
        ram: budget > 70000 ? "32 GB DDR5" : "16 GB DDR4",
        storage: "1 TB NVMe SSD",
        motherboard: budget > 70000 ? "B650 chipset board" : "B550 chipset board"
      }
    });
  });

  app.post("/deal-finder", (_req, res) => {
    const items = buildProductCatalog(readStore()).slice(0, 6).map((item) => ({
      ...item,
      badge: item.price < 1000 ? "Budget Deal" : Number(item.rating || 0) >= 4.6 ? "Top Rated" : item.badge || "Hot Deal"
    }));
    res.json(items);
  });

  app.post("/chat", (req, res) => {
    const message = String(req.body?.message || "").trim();
    const reply = message
      ? `Gamers Arena support tip: focus on price, genre, and delivery speed for "${message}". If the exact item is missing, continue on Telegram for manual help.`
      : "Gamers Arena support tip: tell us your budget, preferred genre, or product type and we will guide you faster.";
    res.json({ reply });
  });

  app.get("/api/pages", (_req, res) => {
    const store = readStore();
    res.json((store.pages || []).map(sanitizePage));
  });

  app.get("/api/pages/:slug", (req, res) => {
    const store = readStore();
    const page = (store.pages || []).find((item) => item.slug === req.params.slug);
    if (!page) return res.status(404).json({ error: "Page not found." });
    res.json(sanitizePage(page));
  });

  app.get("/bundles", (_req, res) => {
    const store = readStore();
    res.json(getBundles(store).map(sanitizeBundle));
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

  app.get("/health", (_req, res) => {
    res.json({ ok: true, app: "Gamers Arena" });
  });

  app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  app.get("/cart.html", (_req, res) => res.sendFile(path.join(publicDir, "cart.html")));
  app.get("/checkout.html", (_req, res) => res.sendFile(path.join(publicDir, "checkout.html")));
  app.get("/chat.html", (_req, res) => res.sendFile(path.join(publicDir, "chat.html")));
  app.get("/login.html", (_req, res) => res.sendFile(path.join(publicDir, "login.html")));
  app.get("/admin.html", (_req, res) => res.sendFile(path.join(publicDir, "admin.html")));
  app.get("/blog.html", (_req, res) => res.sendFile(path.join(publicDir, "blog.html")));
  app.get("/post.html", (_req, res) => res.sendFile(path.join(publicDir, "post.html")));
  app.get("/products.html", (_req, res) => res.sendFile(path.join(publicDir, "products.html")));
  app.get("/product.html", (_req, res) => res.sendFile(path.join(publicDir, "product.html")));
  app.get("/product/:slug", (_req, res) => res.sendFile(path.join(publicDir, "product.html")));
  app.get("/games.html", (_req, res) => res.sendFile(path.join(publicDir, "games.html")));
  app.get("/game.html", (_req, res) => res.sendFile(path.join(publicDir, "game.html")));
  app.get("/game/:slug", (_req, res) => res.sendFile(path.join(publicDir, "game.html")));
  app.get("/deals.html", (_req, res) => res.sendFile(path.join(publicDir, "deals.html")));
  app.get("/news.html", (_req, res) => res.sendFile(path.join(publicDir, "news.html")));
  app.get("/news/:slug", (_req, res) => res.sendFile(path.join(publicDir, "post.html")));
  app.get("/pc-builder.html", (_req, res) => res.sendFile(path.join(publicDir, "pc-builder.html")));
  app.get("/bundle.html", (_req, res) => res.sendFile(path.join(publicDir, "bundle.html")));
  app.get("/bundle/:slug", (_req, res) => res.sendFile(path.join(publicDir, "bundle.html")));
  app.get("/page.html", (_req, res) => res.sendFile(path.join(publicDir, "page.html")));
  app.get("/pages/:slug", (_req, res) => res.sendFile(path.join(publicDir, "page.html")));
  app.get("/editor.html", (_req, res) => res.sendFile(path.join(publicDir, "editor.html")));

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
