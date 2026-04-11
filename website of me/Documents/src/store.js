const fs = require("fs");
const path = require("path");

const bundledStorePath = path.join(__dirname, "..", "data", "store.json");
const storePath = process.env.STORE_PATH ? path.resolve(process.env.STORE_PATH) : bundledStorePath;
const seedStorePath = process.env.STORE_SEED_PATH ? path.resolve(process.env.STORE_SEED_PATH) : bundledStorePath;
const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@gamersarena.com";
const defaultAdminPassword = process.env.ADMIN_PASSWORD || "change-me";
const defaultAdminSecondaryPassword = process.env.ADMIN_SECONDARY_PASSWORD || "change-me";
const defaultQr = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'><rect width='320' height='320' rx='24' fill='white'/><rect x='26' y='26' width='84' height='84' fill='black'/><rect x='44' y='44' width='48' height='48' fill='white'/><rect x='210' y='26' width='84' height='84' fill='black'/><rect x='228' y='44' width='48' height='48' fill='white'/><rect x='26' y='210' width='84' height='84' fill='black'/><rect x='44' y='228' width='48' height='48' fill='white'/><text x='160' y='302' font-size='18' font-family='Arial' text-anchor='middle' fill='%23111'>SCAN TO PAY</text></svg>";
let cachedStore = null;
let cachedMtimeMs = 0;

function cloneStore(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeGame(game = {}) {
  const name = String(game.name || "").trim();
  const category = String(game.category || "Action").trim() || "Action";
  return {
    id: game.id || `game-${Date.now()}`,
    slug: String(game.slug || slugify(name) || "").trim(),
    name,
    price: Number(game.price || 45),
    category,
    description: String(game.description || `${name || "Game"} is available through Gamers Arena with fast Telegram support and QR checkout.`).trim(),
    image: String(game.image || "").trim(),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: game.updatedAt || new Date().toISOString()
  };
}

function normalizePage(page = {}) {
  const title = String(page.title || "").trim();
  return {
    id: page.id || `page-${Date.now()}`,
    slug: String(page.slug || slugify(title) || "").trim(),
    title,
    summary: String(page.summary || "").trim(),
    heroImage: String(page.heroImage || "").trim(),
    content: String(page.content || "").trim(),
    seoTitle: String(page.seoTitle || "").trim(),
    seoDescription: String(page.seoDescription || "").trim(),
    createdAt: page.createdAt || new Date().toISOString(),
    updatedAt: page.updatedAt || new Date().toISOString()
  };
}

function normalizeMediaItem(item = {}) {
  return {
    id: item.id || `media-${Date.now()}`,
    name: String(item.name || "").trim(),
    url: String(item.url || "").trim(),
    alt: String(item.alt || "").trim(),
    placement: String(item.placement || "").trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeSection(item = {}) {
  return {
    id: item.id || `section-${Date.now()}`,
    key: String(item.key || "").trim(),
    title: String(item.title || "").trim(),
    subtitle: String(item.subtitle || "").trim(),
    body: String(item.body || "").trim(),
    buttonLabel: String(item.buttonLabel || "").trim(),
    buttonHref: String(item.buttonHref || "").trim(),
    image: String(item.image || "").trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeStore(store) {
  const next = store || {};
  const hadPages = Array.isArray(next.pages);
  const hadMedia = Array.isArray(next.media);
  const hadSections = Array.isArray(next.contentSections);
  next.admin = next.admin || {};
  next.admin.email = next.admin.email || defaultAdminEmail;
  next.admin.password = next.admin.password || defaultAdminPassword;
  next.admin.secondaryPassword = next.admin.secondaryPassword || defaultAdminSecondaryPassword;
  next.settings = next.settings || {};
  next.settings.homeLayout = Array.isArray(next.settings.homeLayout) ? next.settings.homeLayout : [];
  next.games = Array.isArray(next.games) ? next.games.map(normalizeGame) : [];
  next.pages = Array.isArray(next.pages) ? next.pages.map(normalizePage) : [];
  next.media = Array.isArray(next.media) ? next.media.map(normalizeMediaItem) : [];
  next.contentSections = Array.isArray(next.contentSections) ? next.contentSections.map(normalizeSection) : [];
  next.users = Array.isArray(next.users) ? next.users : [];
  next.carts = next.carts && typeof next.carts === "object" ? next.carts : {};
  next.chats = Array.isArray(next.chats) ? next.chats : [];
  next.blogs = Array.isArray(next.blogs) ? next.blogs : [];
  next.orders = Array.isArray(next.orders) ? next.orders : [];
  if (!hadPages && !next.pages.length) {
    next.pages = [
      normalizePage({
        id: "page-about",
        slug: "about",
        title: "About Gamers Arena",
        summary: "Learn how Gamers Arena handles affordable game deals, QR checkout, and Telegram support.",
        content: "<p>Gamers Arena helps players browse affordable Steam and PC game deals in a clean storefront with QR checkout and fast support.</p><p>The store is built for simple discovery, quick checkout, and direct help when customers need a missing title or order update.</p>"
      })
    ];
  }
  if (!hadMedia && !next.media.length) {
    next.media = [];
  }
  if (!hadSections && !next.contentSections.length) {
    next.contentSections = [
      normalizeSection({
        id: "section-home-hero",
        key: "home-hero",
        title: "Cheap Steam Games & PC Game Deals",
        subtitle: "steam deals hub",
        body: "Buy cheap Steam games, discounted bundles, and budget-friendly PC game deals at Gamers Arena. Search fast, pay by QR, save your wishlist, and finish your order with direct Telegram support.",
        buttonLabel: "Browse Games",
        buttonHref: "#storeSection",
        image: ""
      }),
      normalizeSection({
        id: "section-home-store",
        key: "home-store",
        title: "Steam Games And Budget PC Deals",
        subtitle: "game store",
        body: "Search fast, filter by category, and add affordable Steam and PC game deals to your cart in a clean storefront. If a title is missing, the request flow sends buyers straight to Telegram.",
        buttonLabel: "",
        buttonHref: "",
        image: ""
      }),
      normalizeSection({
        id: "section-home-help",
        key: "home-help",
        title: "Need a missing title?",
        subtitle: "quick help",
        body: "Use search first. If it is not listed, the store shows a Telegram request button so customers can still place a demand quickly.",
        buttonLabel: "Ask On Telegram",
        buttonHref: "https://t.me/gamersarena_shop",
        image: ""
      })
    ];
  }
  return next;
}

function createInitialStore() {
  const now = new Date().toISOString();
  return normalizeStore({
    admin: {
      email: defaultAdminEmail,
      password: defaultAdminPassword,
      secondaryPassword: defaultAdminSecondaryPassword
    },
    settings: {
      siteTitle: "Gamers Arena",
      qrImage: defaultQr,
      homeLayout: [
        { id: "block-1", type: "text", content: "Shop cheap Steam games, discounted bundles, and budget-friendly PC game deals with a clean buying flow." },
        { id: "block-2", type: "text", content: "Search fast, pay by QR, save your wishlist, and continue the order with direct Telegram support." }
      ]
    },
    games: [
      { id: "game-1", name: "GTA V", price: 45, category: "Action", description: "Open-world crime action with a huge map, online modes, and fast-paced missions." },
      { id: "game-2", name: "EA FC 25", price: 45, category: "Sports", description: "Football gameplay, career modes, and team building for players who want a fast sports pick." },
      { id: "game-3", name: "Red Dead Redemption 2", price: 45, category: "Action", description: "Story-rich western adventure with cinematic missions and a massive world to explore." },
      { id: "game-4", name: "Elden Ring", price: 45, category: "RPG", description: "Open-world action RPG with boss fights, exploration, and build variety." },
      { id: "game-5", name: "Valorant", price: 45, category: "Shooter", description: "Competitive tactical shooter with agents, tight maps, and esports-style rounds." },
      { id: "game-6", name: "Cyberpunk 2077", price: 45, category: "RPG", description: "Story-driven futuristic RPG with character builds, action combat, and a strong single-player campaign." },
      { id: "game-7", name: "Forza Horizon 5", price: 45, category: "Racing", description: "Open-world racing with arcade driving, events, and smooth casual gameplay." },
      { id: "game-8", name: "Call of Duty", price: 45, category: "Shooter", description: "Fast multiplayer action and blockbuster combat for players who want high-energy matches." },
      { id: "game-9", name: "Minecraft", price: 45, category: "Low-end PC", description: "Creative survival sandbox with huge replay value and easy access on lighter systems." },
      { id: "game-10", name: "PUBG Battlegrounds", price: 45, category: "Shooter", description: "Battle royale matches, squad play, and tense survival gameplay." },
      { id: "game-11", name: "God of War", price: 45, category: "Action", description: "Story-focused action adventure with cinematic combat and strong character-driven moments." },
      { id: "game-12", name: "Spider-Man Remastered", price: 45, category: "Action", description: "Open-city traversal, action combat, and superhero story content in a polished package." }
    ],
    pages: [
      {
        id: "page-about",
        slug: "about",
        title: "About Gamers Arena",
        summary: "Learn how Gamers Arena handles affordable game deals, QR checkout, and Telegram support.",
        content: "<p>Gamers Arena helps players browse affordable Steam and PC game deals in a clean storefront with QR checkout and fast support.</p><p>The store is built for simple discovery, quick checkout, and direct help when customers need a missing title or order update.</p>"
      }
    ],
    media: [],
    contentSections: [
      {
        id: "section-home-hero",
        key: "home-hero",
        title: "Cheap Steam Games & PC Game Deals",
        subtitle: "steam deals hub",
        body: "Buy cheap Steam games, discounted bundles, and budget-friendly PC game deals at Gamers Arena. Search fast, pay by QR, save your wishlist, and finish your order with direct Telegram support.",
        buttonLabel: "Browse Games",
        buttonHref: "#storeSection",
        image: ""
      },
      {
        id: "section-home-store",
        key: "home-store",
        title: "Steam Games And Budget PC Deals",
        subtitle: "game store",
        body: "Search fast, filter by category, and add affordable Steam and PC game deals to your cart in a clean storefront. If a title is missing, the request flow sends buyers straight to Telegram.",
        buttonLabel: "",
        buttonHref: "",
        image: ""
      },
      {
        id: "section-home-help",
        key: "home-help",
        title: "Need a missing title?",
        subtitle: "quick help",
        body: "Use search first. If it is not listed, the store shows a Telegram request button so customers can still place a demand quickly.",
        buttonLabel: "Ask On Telegram",
        buttonHref: "https://t.me/gamersarena_shop",
        image: ""
      }
    ],
    users: [],
    carts: {},
    chats: [],
    blogs: [
      {
        id: "blog-1",
        slug: "welcome-to-gamers-arena",
        title: "Welcome To Gamers Arena",
        summary: "A quick look at how our game store, QR checkout, and support chat work together.",
        content: "Gamers Arena keeps game buying simple. Add a game, pay by QR, and continue the order in a private chat thread with admin.",
        image: "",
        createdAt: now,
        updatedAt: now
      }
    ]
  });
}

function loadSeedStore() {
  if (!fs.existsSync(seedStorePath)) return null;
  if (path.resolve(seedStorePath) === path.resolve(storePath)) return null;

  try {
    return normalizeStore(JSON.parse(fs.readFileSync(seedStorePath, "utf8")));
  } catch (_error) {
    return null;
  }
}

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    const seededStore = loadSeedStore() || createInitialStore();
    fs.writeFileSync(storePath, JSON.stringify(seededStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  const stat = fs.statSync(storePath);
  if (!cachedStore || stat.mtimeMs !== cachedMtimeMs) {
    cachedStore = normalizeStore(JSON.parse(fs.readFileSync(storePath, "utf8")));
    cachedMtimeMs = stat.mtimeMs;
  }
  return cachedStore;
}

function writeStore(data) {
  ensureStore();
  const normalizedStore = normalizeStore(data);
  fs.writeFileSync(storePath, JSON.stringify(normalizedStore, null, 2));
  cachedStore = normalizedStore;
  cachedMtimeMs = fs.statSync(storePath).mtimeMs;
  return cachedStore;
}

function updateStore(updater) {
  const current = cloneStore(readStore());
  const next = updater(current) || current;
  writeStore(next);
  return next;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  defaultQr,
  readStore,
  storePath,
  writeStore,
  updateStore,
  createId,
  slugify
};
