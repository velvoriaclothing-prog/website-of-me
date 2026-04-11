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

function defaultContentSections() {
  return [
    {
      id: "section-home-hero",
      page: "home",
      label: "Homepage Hero",
      heading: "Cheap Steam Games & PC Game Deals",
      body: "Buy cheap Steam games, discounted bundles, and fast PC game deals with simple QR checkout and Telegram support.",
      buttonText: "Browse Games",
      buttonHref: "#storeSection",
      updatedAt: new Date().toISOString()
    },
    {
      id: "section-about-overview",
      page: "about",
      label: "About Copy",
      heading: "Why Gamers Arena Exists",
      body: "Gamers Arena helps players find affordable PC games, quick support, and cleaner buying flows without confusing extra steps.",
      buttonText: "Open Bundles",
      buttonHref: "/bundles.html",
      updatedAt: new Date().toISOString()
    },
    {
      id: "section-deals-intro",
      page: "deals",
      label: "Deals Intro",
      heading: "Fresh Gaming Deals And Value Picks",
      body: "Use the deals area to spotlight bundle offers, budget accessories, and curated buyer recommendations that match the storefront.",
      buttonText: "See Deals",
      buttonHref: "/deals.html",
      updatedAt: new Date().toISOString()
    }
  ];
}

function defaultPages() {
  return [
    {
      id: "page-about",
      slug: "about",
      title: "About Gamers Arena",
      summary: "Learn how Gamers Arena helps buyers discover affordable PC games and faster support.",
      content: "Gamers Arena is built for players who want low-cost PC game deals, cleaner browsing, and a faster path from discovery to support. Browse the catalog, save items, check out with QR, and continue on Telegram when you need help.",
      seoTitle: "About Gamers Arena | Cheap PC Game Deals",
      seoDescription: "Learn how Gamers Arena helps players find cheap Steam games, bundle offers, and faster support.",
      updatedAt: new Date().toISOString()
    }
  ];
}

function normalizeStore(store) {
  const next = store || {};
  next.admin = next.admin || {};
  next.admin.email = process.env.ADMIN_EMAIL || next.admin.email || defaultAdminEmail;
  next.admin.password = process.env.ADMIN_PASSWORD || next.admin.password || defaultAdminPassword;
  next.admin.secondaryPassword = process.env.ADMIN_SECONDARY_PASSWORD || next.admin.secondaryPassword || defaultAdminSecondaryPassword;
  next.settings = next.settings || {};
  next.settings.siteTitle = next.settings.siteTitle || "Gamers Arena";
  next.settings.qrImage = next.settings.qrImage || defaultQr;
  next.settings.homeLayout = Array.isArray(next.settings.homeLayout) ? next.settings.homeLayout : [];
  next.games = Array.isArray(next.games) ? next.games : [];
  next.users = Array.isArray(next.users) ? next.users : [];
  next.carts = next.carts && typeof next.carts === "object" ? next.carts : {};
  next.chats = Array.isArray(next.chats) ? next.chats : [];
  next.blogs = Array.isArray(next.blogs) ? next.blogs : [];
  next.orders = Array.isArray(next.orders) ? next.orders : [];
  next.products = Array.isArray(next.products) ? next.products : [];
  next.pages = Array.isArray(next.pages) && next.pages.length ? next.pages : defaultPages();
  next.media = Array.isArray(next.media) ? next.media : [];
  next.contentSections = Array.isArray(next.contentSections) && next.contentSections.length ? next.contentSections : defaultContentSections();
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
        { id: "block-1", type: "text", content: "Buy game accounts fast, pay by QR, and continue in a private chat with admin." },
        { id: "block-2", type: "text", content: "Every game card stays clean and simple so users can decide quickly." }
      ]
    },
    games: [
      { id: "game-1", name: "GTA V", price: 45 },
      { id: "game-2", name: "EA FC 25", price: 45 },
      { id: "game-3", name: "Red Dead Redemption 2", price: 45 },
      { id: "game-4", name: "Elden Ring", price: 45 },
      { id: "game-5", name: "Valorant", price: 45 },
      { id: "game-6", name: "Cyberpunk 2077", price: 45 },
      { id: "game-7", name: "Forza Horizon 5", price: 45 },
      { id: "game-8", name: "Call of Duty", price: 45 },
      { id: "game-9", name: "Minecraft", price: 45 },
      { id: "game-10", name: "PUBG Battlegrounds", price: 45 },
      { id: "game-11", name: "God of War", price: 45 },
      { id: "game-12", name: "Spider-Man Remastered", price: 45 }
    ],
    users: [],
    carts: {},
    chats: [],
    orders: [],
    products: [],
    media: [],
    pages: defaultPages(),
    contentSections: defaultContentSections(),
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
