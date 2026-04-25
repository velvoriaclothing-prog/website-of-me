const fs = require("fs");
const path = require("path");
const { aiTools: seededAiTools } = require("./data/aiTools");

const bundledStorePath = path.join(__dirname, "..", "data", "store.json");
const storePath = process.env.STORE_PATH ? path.resolve(process.env.STORE_PATH) : bundledStorePath;
const seedStorePath = process.env.STORE_SEED_PATH ? path.resolve(process.env.STORE_SEED_PATH) : bundledStorePath;
const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@gamersarena.com";
const defaultAdminPassword = process.env.ADMIN_PASSWORD || "change-me";
const defaultAdminSecondaryPassword = process.env.ADMIN_SECONDARY_PASSWORD || "change-me";
const defaultQr = "/assets/payment-qr.jpeg";
const defaultLogo = "/assets/gamers-arena-logo.png";
let cachedStore = null;
let cachedMtimeMs = 0;

function cloneStore(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function normalizeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePageContent(value = {}, fallback = {}) {
  return {
    title: normalizeText(value.title, fallback.title),
    description: normalizeText(value.description, fallback.description),
    buttonLabel: normalizeText(value.buttonLabel, fallback.buttonLabel),
    buttonHref: normalizeUrl(value.buttonHref || fallback.buttonHref || ""),
    heroImage: normalizeUrl(value.heroImage || fallback.heroImage || "")
  };
}

function normalizeGame(game = {}) {
  const name = normalizeText(game.name);
  const category = normalizeText(game.category, "Action") || "Action";
  return {
    id: game.id || `game-${Date.now()}`,
    slug: normalizeText(game.slug, slugify(name)),
    name,
    price: Number(game.price || 45),
    category,
    description: normalizeText(
      game.description,
      `${name || "Game"} is available through Gamers Arena with fast Telegram support and QR checkout.`
    ),
    image: normalizeUrl(game.image),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: game.updatedAt || new Date().toISOString()
  };
}

function normalizePage(page = {}) {
  const title = normalizeText(page.title);
  return {
    id: page.id || `page-${Date.now()}`,
    slug: normalizeText(page.slug, slugify(title)),
    title,
    summary: normalizeText(page.summary),
    heroImage: normalizeUrl(page.heroImage),
    content: normalizeText(page.content),
    seoTitle: normalizeText(page.seoTitle),
    seoDescription: normalizeText(page.seoDescription),
    createdAt: page.createdAt || new Date().toISOString(),
    updatedAt: page.updatedAt || new Date().toISOString()
  };
}

function normalizeMediaItem(item = {}) {
  return {
    id: item.id || `media-${Date.now()}`,
    name: normalizeText(item.name),
    url: normalizeUrl(item.url),
    alt: normalizeText(item.alt),
    placement: normalizeText(item.placement),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeConsoleGame(item = {}) {
  const name = normalizeText(item.name);
  const platform = normalizeText(item.platform, "PS5").toUpperCase() || "PS5";
  return {
    id: item.id || `console-${Date.now()}`,
    slug: normalizeText(item.slug, slugify(`${platform}-${name}`)),
    name,
    platform: ["PS4", "PS5"].includes(platform) ? platform : "PS5",
    image: normalizeUrl(item.image),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeSection(item = {}) {
  return {
    id: item.id || `section-${Date.now()}`,
    key: normalizeText(item.key),
    title: normalizeText(item.title),
    subtitle: normalizeText(item.subtitle),
    body: normalizeText(item.body),
    buttonLabel: normalizeText(item.buttonLabel),
    buttonHref: normalizeUrl(item.buttonHref),
    image: normalizeUrl(item.image),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeAiTool(item = {}) {
  const name = normalizeText(item.name);
  return {
    id: item.id || `tool-${Date.now()}`,
    slug: normalizeText(item.slug, slugify(name)),
    name,
    category: normalizeText(item.category, "AI"),
    description: normalizeText(
      item.description,
      `${name || "This tool"} helps streamline modern AI workflows for creators, gamers, and digital teams.`
    ),
    url: normalizeUrl(item.url || "https://example.com"),
    featured: item.featured === true,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function defaultSocialLinks() {
  return {
    telegram: "https://t.me/gamersarena_shop",
    instagram: "/",
    facebook: "/",
    youtube: "/",
    twitter: "/",
    linkedin: "/"
  };
}

function defaultBusiness() {
  return {
    name: "Gamers Arena",
    addressLine1: "Business Address Line 1",
    addressLine2: "Business Address Line 2",
    city: "Your City",
    state: "Your State",
    postalCode: "000000",
    country: "India",
    phone: "+91 00000 00000",
    email: "support@gamersarena.com"
  };
}

function defaultAnalytics() {
  return {
    googleAnalyticsId: "",
    facebookPixelId: ""
  };
}

function defaultEmailAuthentication() {
  return {
    spfRecord: "v=spf1 include:_spf.google.com ~all",
    dmarcRecord: "v=DMARC1; p=none; rua=mailto:dmarc@example.com"
  };
}

function defaultSettings() {
  return {
    siteTitle: "Gamers Arena",
    siteTagline: "PC Games Accounts Store",
    siteDescription: "A premium gaming storefront for PC games, console deals, bundles, blogs, AI tools, and QR-first checkout.",
    logoUrl: defaultLogo,
    faviconUrl: defaultLogo,
    qrImage: defaultQr,
    homeLayout: [
      {
        id: "block-1",
        type: "text",
        content: "Discover premium gaming deals, platform-specific storefronts, and a cleaner QR payment flow across every device."
      },
      {
        id: "block-2",
        type: "text",
        content: "Admin can update games, bundles, blogs, AI tools, business info, and brand content globally from one dashboard."
      }
    ],
    bundles: [],
    socialLinks: defaultSocialLinks(),
    business: defaultBusiness(),
    analytics: defaultAnalytics(),
    emailAuthentication: defaultEmailAuthentication()
  };
}

function normalizeSettings(settings = {}) {
  const defaults = defaultSettings();
  return {
    siteTitle: normalizeText(settings.siteTitle, defaults.siteTitle) || defaults.siteTitle,
    siteTagline: normalizeText(settings.siteTagline, defaults.siteTagline) || defaults.siteTagline,
    siteDescription: normalizeText(settings.siteDescription, defaults.siteDescription) || defaults.siteDescription,
    logoUrl: normalizeUrl(settings.logoUrl || defaults.logoUrl) || defaults.logoUrl,
    faviconUrl: normalizeUrl(settings.faviconUrl || settings.logoUrl || defaults.faviconUrl) || defaults.faviconUrl,
    qrImage: normalizeUrl(settings.qrImage || defaults.qrImage) || defaults.qrImage,
    homeLayout: Array.isArray(settings.homeLayout)
      ? settings.homeLayout
        .filter((block) => block && ["text", "image", "video"].includes(block.type))
        .map((block, index) => ({
          id: block.id || `block-${index + 1}`,
          type: block.type,
          content: normalizeText(block.content)
        }))
      : defaults.homeLayout,
    bundles: Array.isArray(settings.bundles) ? settings.bundles : defaults.bundles,
    socialLinks: {
      ...defaults.socialLinks,
      ...(settings.socialLinks && typeof settings.socialLinks === "object" ? settings.socialLinks : {})
    },
    business: {
      ...defaults.business,
      ...(settings.business && typeof settings.business === "object" ? settings.business : {})
    },
    analytics: {
      ...defaults.analytics,
      ...(settings.analytics && typeof settings.analytics === "object" ? settings.analytics : {})
    },
    emailAuthentication: {
      ...defaults.emailAuthentication,
      ...(settings.emailAuthentication && typeof settings.emailAuthentication === "object" ? settings.emailAuthentication : {})
    }
  };
}

function defaultPageContent() {
  return {
    home: {
      title: "Affordable PC, PS4, And PS5 Game Deals",
      description: "Browse a premium storefront for PC game accounts, PS4 and PS5 picks, bundles, blogs, and AI tools with QR-first checkout.",
      buttonLabel: "Browse PC Games",
      buttonHref: "/pc-games",
      heroImage: ""
    },
    games: {
      title: "PC Game Accounts For Every Budget",
      description: "Explore the full PC games catalog with filters, responsive browsing, Telegram support, and fast add-to-cart actions.",
      buttonLabel: "Start Browsing",
      buttonHref: "#gamesSection",
      heroImage: ""
    },
    cart: {
      title: "Review Your Gaming Cart",
      description: "Check your games, bundles, and total amount before moving into the QR payment and Telegram confirmation flow.",
      buttonLabel: "Continue to QR Payment",
      buttonHref: "/checkout",
      heroImage: ""
    },
    deals: {
      title: "Gaming Deals, Bundles, And Budget Picks",
      description: "See current bundle offers, fast-moving PC picks, and low-price recommendations curated for buyers who want strong value.",
      buttonLabel: "Open All Deals",
      buttonHref: "/deals",
      heroImage: ""
    },
    ps4: {
      title: "PS4 Game Deals With Direct Telegram Buying",
      description: "Browse PS4 cards with bold artwork, quick-buy actions, and responsive layouts built for mobile and desktop shoppers.",
      buttonLabel: "Browse PS4 Games",
      buttonHref: "/ps4-games",
      heroImage: ""
    },
    ps5: {
      title: "PS5 Game Deals With Premium Neon Cards",
      description: "Discover PS5 releases inside a fast storefront with vivid imagery, glow accents, and direct Telegram buying links.",
      buttonLabel: "Browse PS5 Games",
      buttonHref: "/ps5-games",
      heroImage: ""
    },
    blog: {
      title: "SEO Gaming Blog And Buying Guides",
      description: "Read long-form gaming guides, rankings, and buying advice written to attract search traffic and help customers choose faster.",
      buttonLabel: "Read The Blog",
      buttonHref: "/blog",
      heroImage: ""
    },
    aiTools: {
      title: "200+ AI Tools For Creators And Sellers",
      description: "Search a large AI tools directory across writing, coding, research, design, SEO, and productivity categories.",
      buttonLabel: "Explore AI Tools",
      buttonHref: "/ai-tools",
      heroImage: ""
    },
    checkout: {
      title: "Scan QR, Submit Details, And Continue",
      description: "Use the store QR, confirm the amount, then submit your details before opening Telegram with an order-ready message.",
      buttonLabel: "I Paid, Open Telegram",
      buttonHref: "/checkout",
      heroImage: ""
    }
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
  const hadAiTools = Array.isArray(next.aiTools);

  next.admin = next.admin || {};
  next.admin.email = next.admin.email || defaultAdminEmail;
  next.admin.password = next.admin.password || defaultAdminPassword;
  next.admin.secondaryPassword = next.admin.secondaryPassword || defaultAdminSecondaryPassword;
  next.settings = normalizeSettings(next.settings || {});
  next.games = Array.isArray(next.games) ? next.games.map(normalizeGame) : [];
  next.pages = Array.isArray(next.pages) ? next.pages.map(normalizePage) : [];
  next.media = Array.isArray(next.media) ? next.media.map(normalizeMediaItem) : [];
  next.consoleGames = Array.isArray(next.consoleGames) ? next.consoleGames.map(normalizeConsoleGame) : [];
  next.contentSections = Array.isArray(next.contentSections) ? next.contentSections.map(normalizeSection) : [];
  next.aiTools = Array.isArray(next.aiTools) ? next.aiTools.map(normalizeAiTool) : [];
  next.users = Array.isArray(next.users) ? next.users : [];
  next.carts = next.carts && typeof next.carts === "object" ? next.carts : {};
  next.chats = Array.isArray(next.chats) ? next.chats : [];
  next.blogs = Array.isArray(next.blogs) ? next.blogs : [];
  next.orders = Array.isArray(next.orders) ? next.orders : [];

  const pageDefaults = defaultPageContent();
  next.contentByPage = next.contentByPage && typeof next.contentByPage === "object" ? next.contentByPage : {};
  Object.entries(pageDefaults).forEach(([pageKey, defaults]) => {
    next.contentByPage[pageKey] = normalizePageContent(next.contentByPage[pageKey], defaults);
  });

  if (!hadPages && !next.pages.length) {
    next.pages = [
      normalizePage({
        id: "page-about",
        slug: "about",
        title: "About Gamers Arena",
        summary: "Learn how Gamers Arena handles affordable game deals, QR checkout, Telegram support, and admin-managed content.",
        content: "<p>Gamers Arena helps players browse affordable PC and console game deals in a clean storefront with QR checkout and fast support.</p><p>The platform is designed for stronger SEO, direct Telegram handoff, and admin-managed global updates.</p>",
        seoTitle: "About Gamers Arena | Gaming Store Story",
        seoDescription: "Learn how Gamers Arena sells PC and console game deals with QR checkout, Telegram support, and a scalable admin-controlled storefront."
      })
    ];
  }

  if (!hadMedia && !next.media.length) {
    next.media = [
      normalizeMediaItem({
        id: "media-logo",
        name: "Gamers Arena Logo",
        url: next.settings.logoUrl,
        alt: "Gamers Arena logo",
        placement: "brand"
      })
    ];
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
        title: "Professional Gaming Storefront For Global Buyers",
        subtitle: "gaming accounts, console picks, ai tools",
        body: "Gamers Arena combines PC game accounts, PS4 and PS5 deals, curated bundles, blog SEO content, and a clean QR checkout flow into one modern storefront.",
        buttonLabel: "Browse PC Games",
        buttonHref: "/pc-games"
      }),
      normalizeSection({
        id: "section-home-store",
        key: "home-store",
        title: "PC Games And Budget-Friendly Deals",
        subtitle: "pc storefront",
        body: "Search, filter, and compare a large PC games catalog with fast add-to-cart actions, related content blocks, and responsive card layouts."
      }),
      normalizeSection({
        id: "section-home-help",
        key: "home-help",
        title: "Need A Title That Is Not Listed?",
        subtitle: "instant help",
        body: "Use Telegram support to request missing games, check availability, or continue checkout after payment confirmation.",
        buttonLabel: "Open Telegram",
        buttonHref: "https://t.me/gamersarena_shop"
      })
    ];
  }

  ensureSection(next.contentSections, {
    id: "section-home-ps5",
    key: "home-ps5",
    title: "PS5 Neon Library",
    subtitle: "playstation 5",
    body: "Premium PS5 titles with rich backgrounds, glow accents, and direct Telegram buying links.",
    buttonLabel: "Browse PS5 Games",
    buttonHref: "/ps5-games"
  });
  ensureSection(next.contentSections, {
    id: "section-home-ps4",
    key: "home-ps4",
    title: "PS4 Best Sellers",
    subtitle: "playstation 4",
    body: "Popular PS4 titles presented in the same high-contrast storefront with strong artwork and quick-buy actions.",
    buttonLabel: "Browse PS4 Games",
    buttonHref: "/ps4-games"
  });
  ensureSection(next.contentSections, {
    id: "section-home-deals",
    key: "home-deals",
    title: "Deals, Bundles, And Budget Picks",
    subtitle: "hot offers",
    body: "Show buyers your best-value offers with related bundles, internal links, and stronger conversion copy across the site.",
    buttonLabel: "View Deals",
    buttonHref: "/deals"
  });
  ensureSection(next.contentSections, {
    id: "section-home-blog",
    key: "home-blog",
    title: "SEO Blog Content That Builds Trust",
    subtitle: "blog previews",
    body: "Publish long-form gaming guides, rankings, and buying advice that can rank in search and feed homepage previews automatically.",
    buttonLabel: "Read The Blog",
    buttonHref: "/blog"
  });
  ensureSection(next.contentSections, {
    id: "section-home-ai",
    key: "home-ai",
    title: "AI Tools Directory For Creators",
    subtitle: "ai tools",
    body: "Keep a searchable directory of 200+ AI tools for creators, marketers, and digital operators inside the same brand ecosystem.",
    buttonLabel: "Open AI Tools",
    buttonHref: "/ai-tools"
  });

  if (!hadAiTools || !next.aiTools.length) {
    next.aiTools = seededAiTools.map((tool, index) => normalizeAiTool({
      ...tool,
      id: tool.id || `tool-${index + 1}`,
      featured: index < 12
    }));
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
    settings: defaultSettings(),
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
    media: [
      {
        id: "media-logo",
        name: "Gamers Arena Logo",
        url: defaultLogo,
        alt: "Gamers Arena logo",
        placement: "brand"
      }
    ],
    consoleGames: [],
    contentSections: [],
    aiTools: seededAiTools.map((tool, index) => ({
      ...tool,
      id: tool.id || `tool-${index + 1}`,
      featured: index < 12
    })),
    users: [],
    carts: {},
    chats: [],
    blogs: [
      {
        id: "blog-1",
        slug: "welcome-to-gamers-arena",
        title: "Welcome To Gamers Arena",
        summary: "A quick look at how our game store, QR checkout, support chat, and admin-managed SEO content work together.",
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

module.exports = {
  defaultLogo,
  defaultQr,
  readStore,
  storePath,
  writeStore,
  updateStore,
  createId,
  slugify,
  normalizeAiTool,
  normalizeConsoleGame,
  normalizePageContent,
  normalizeSettings
};
