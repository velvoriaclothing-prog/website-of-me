const fs = require("fs");
const path = require("path");

const bundledStorePath = path.join(__dirname, "..", "data", "store.json");
const storePath = process.env.STORE_PATH ? path.resolve(process.env.STORE_PATH) : bundledStorePath;
const seedStorePath = process.env.STORE_SEED_PATH ? path.resolve(process.env.STORE_SEED_PATH) : bundledStorePath;
const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@gamersarena.com";
const defaultAdminPassword = process.env.ADMIN_PASSWORD || "change-me";
const defaultAdminSecondaryPassword = process.env.ADMIN_SECONDARY_PASSWORD || "change-me";
const defaultQr = "/assets/payment-qr.jpeg";
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

function normalizeConsoleGame(item = {}) {
  const name = String(item.name || "").trim();
  const platform = String(item.platform || "PS5").trim().toUpperCase() || "PS5";
  return {
    id: item.id || `console-${Date.now()}`,
    slug: String(item.slug || slugify(`${platform}-${name}`) || "").trim(),
    name,
    platform: ["PS4", "PS5"].includes(platform) ? platform : "PS5",
    image: String(item.image || "").trim(),
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

function ensureSection(sections, section) {
  if (sections.some((entry) => entry.key === section.key)) return sections;
  sections.push(normalizeSection(section));
  return sections;
}

function normalizeStore(store) {
  const next = store || {};
  const hadPages = Array.isArray(next.pages);
  const hadMedia = Array.isArray(next.media);
  const hadSections = Array.isArray(next.contentSections);
  const hadConsoleGames = Array.isArray(next.consoleGames);
  next.admin = next.admin || {};
  next.admin.email = next.admin.email || defaultAdminEmail;
  next.admin.password = next.admin.password || defaultAdminPassword;
  next.admin.secondaryPassword = next.admin.secondaryPassword || defaultAdminSecondaryPassword;
  next.settings = next.settings || {};
  next.settings.homeLayout = Array.isArray(next.settings.homeLayout) ? next.settings.homeLayout : [];
  next.games = Array.isArray(next.games) ? next.games.map(normalizeGame) : [];
  next.pages = Array.isArray(next.pages) ? next.pages.map(normalizePage) : [];
  next.media = Array.isArray(next.media) ? next.media.map(normalizeMediaItem) : [];
  next.consoleGames = Array.isArray(next.consoleGames) ? next.consoleGames.map(normalizeConsoleGame) : [];
  next.contentSections = Array.isArray(next.contentSections) ? next.contentSections.map(normalizeSection) : [];
  next.users = Array.isArray(next.users) ? next.users : [];
  next.carts = next.carts && typeof next.carts === "object" ? next.carts : {};
  next.chats = Array.isArray(next.chats) ? next.chats : [];
  next.blogs = Array.isArray(next.blogs) ? next.blogs : [];
  next.orders = Array.isArray(next.orders) ? next.orders : [];
  next.contentByPage = next.contentByPage && typeof next.contentByPage === "object" ? next.contentByPage : {};
  next.contentByPage.home = next.contentByPage.home && typeof next.contentByPage.home === "object" ? next.contentByPage.home : {
    title: "Cheap Steam Games & PC Game Deals",
    description: "Buy cheap Steam games, discounted bundles, and budget-friendly PC game deals at Gamers Arena.",
    buttonLabel: "Browse Games",
    buttonHref: "#storeSection",
    heroImage: ""
  };
  next.contentByPage.games = next.contentByPage.games && typeof next.contentByPage.games === "object" ? next.contentByPage.games : {
    title: "Browse All Game Deals",
    description: "Explore the full Gamers Arena game catalog with filters, bundle access, and fast support.",
    buttonLabel: "Start Browsing",
    buttonHref: "#gamesSection",
    heroImage: ""
  };
  next.contentByPage.cart = next.contentByPage.cart && typeof next.contentByPage.cart === "object" ? next.contentByPage.cart : {
    title: "Your Cart",
    description: "Review saved games and bundles before continuing to checkout.",
    buttonLabel: "Continue to QR Payment",
    buttonHref: "/checkout.html",
    heroImage: ""
  };
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
  if (!hadConsoleGames && !next.consoleGames.length) {
    next.consoleGames = [
      normalizeConsoleGame({
        id: "console-ps5-1",
        name: "Marvel's Spider-Man 2",
        platform: "PS5",
        image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80"
      }),
      normalizeConsoleGame({
        id: "console-ps5-2",
        name: "God of War Ragnarok",
        platform: "PS5",
        image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
      }),
      normalizeConsoleGame({
        id: "console-ps5-3",
        name: "Gran Turismo 7",
        platform: "PS5",
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80"
      }),
      normalizeConsoleGame({
        id: "console-ps4-1",
        name: "The Last of Us Remastered",
        platform: "PS4",
        image: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80"
      }),
      normalizeConsoleGame({
        id: "console-ps4-2",
        name: "Ghost of Tsushima",
        platform: "PS4",
        image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80"
      }),
      normalizeConsoleGame({
        id: "console-ps4-3",
        name: "Uncharted 4",
        platform: "PS4",
        image: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=1200&q=80"
      })
    ];
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
  ensureSection(next.contentSections, {
    id: "section-home-ps5",
    key: "home-ps5",
    title: "PS5 Game Library",
    subtitle: "console picks",
    body: "Premium PS5 titles with rich artwork, quick Telegram buying, and the same dark neon storefront feel as the PC catalog.",
    buttonLabel: "",
    buttonHref: "",
    image: ""
  });
  ensureSection(next.contentSections, {
    id: "section-home-ps4",
    key: "home-ps4",
    title: "PS4 Game Library",
    subtitle: "console picks",
    body: "Popular PS4 titles for players who still want a strong catalog, smooth browsing, and a simple direct-buy flow.",
    buttonLabel: "",
    buttonHref: "",
    image: ""
  });
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
    consoleGames: [
      {
        id: "console-ps5-1",
        name: "Marvel's Spider-Man 2",
        platform: "PS5",
        image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80"
      },
      {
        id: "console-ps5-2",
        name: "God of War Ragnarok",
        platform: "PS5",
        image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
      },
      {
        id: "console-ps4-1",
        name: "The Last of Us Remastered",
        platform: "PS4",
        image: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80"
      },
      {
        id: "console-ps4-2",
        name: "Ghost of Tsushima",
        platform: "PS4",
        image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80"
      }
    ],
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
      },
      {
        id: "section-home-ps5",
        key: "home-ps5",
        title: "PS5 Game Library",
        subtitle: "console picks",
        body: "Premium PS5 titles with rich artwork, quick Telegram buying, and the same dark neon storefront feel as the PC catalog.",
        buttonLabel: "",
        buttonHref: "",
        image: ""
      },
      {
        id: "section-home-ps4",
        key: "home-ps4",
        title: "PS4 Game Library",
        subtitle: "console picks",
        body: "Popular PS4 titles for players who still want a strong catalog, smooth browsing, and a simple direct-buy flow.",
        buttonLabel: "",
        buttonHref: "",
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
  slugify,
  normalizeConsoleGame
};
