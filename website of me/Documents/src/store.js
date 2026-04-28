const fs = require("fs");
const path = require("path");

const bundledStorePath = path.join(__dirname, "..", "data", "store.json");
const storePath = process.env.STORE_PATH ? path.resolve(process.env.STORE_PATH) : bundledStorePath;
const defaultQr = "/assets/payment-qr.jpeg";
const defaultLogo = "/assets/gamers-arena-logo.png";
const SCHEMA_VERSION = 2;

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

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizeUrl(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizeSettings(settings = {}) {
  return {
    siteTitle: normalizeText(settings.siteTitle, "Gamers Arena"),
    siteTagline: normalizeText(settings.siteTagline, "Cinematic Access Platform"),
    siteDescription: normalizeText(
      settings.siteDescription,
      "A secure premium gaming platform with login, payment verification, admin controls, and cinematic 3D presentation."
    ),
    logoUrl: normalizeUrl(settings.logoUrl, defaultLogo) || defaultLogo,
    faviconUrl: normalizeUrl(settings.faviconUrl || settings.logoUrl, defaultLogo) || defaultLogo,
    paymentQrUrl: normalizeUrl(settings.paymentQrUrl || settings.qrImage, defaultQr) || defaultQr,
    telegramUrl: normalizeUrl(settings.telegramUrl, "https://t.me/gamersarena_shop"),
    accessPriceInr: Number(settings.accessPriceInr || 20) || 20,
    supportEmail: normalizeText(settings.supportEmail, "support@gamersarena.com"),
    brandAccent: normalizeText(settings.brandAccent, "#22d3ee"),
    adminNotice: normalizeText(
      settings.adminNotice,
      "Approve payment, generate one-time keys, and manage all game inventory from one secure control panel."
    )
  };
}

function normalizeUser(user = {}) {
  return {
    id: normalizeText(user.id, createId("user")),
    email: normalizeText(user.email).toLowerCase(),
    name: normalizeText(user.name, "Player"),
    googleId: normalizeText(user.googleId),
    passwordHash: normalizeText(user.passwordHash),
    paymentStatus: normalizeText(user.paymentStatus, "unpaid"),
    verified: user.verified === true,
    keyAssignedAt: normalizeText(user.keyAssignedAt),
    keyUsedAt: normalizeText(user.keyUsedAt),
    createdAt: normalizeText(user.createdAt, new Date().toISOString()),
    updatedAt: normalizeText(user.updatedAt, new Date().toISOString())
  };
}

function normalizeGame(game = {}) {
  const platform = normalizeText(game.platform, "PC").toUpperCase();
  const name = normalizeText(game.name);
  return {
    id: normalizeText(game.id, createId("game")),
    slug: normalizeText(game.slug, slugify(`${platform}-${name}`)),
    platform: ["PC", "PS4", "PS5"].includes(platform) ? platform : "PC",
    name,
    image: normalizeUrl(game.image),
    description: normalizeText(game.description, `${name || "Game"} is available on Gamers Arena.`),
    credentialIdCipher: normalizeText(game.credentialIdCipher),
    credentialPasswordCipher: normalizeText(game.credentialPasswordCipher),
    createdAt: normalizeText(game.createdAt, new Date().toISOString()),
    updatedAt: normalizeText(game.updatedAt, new Date().toISOString())
  };
}

function normalizeKey(key = {}) {
  return {
    id: normalizeText(key.id, createId("key")),
    userId: normalizeText(key.userId),
    email: normalizeText(key.email).toLowerCase(),
    keyHash: normalizeText(key.keyHash),
    keyPreview: normalizeText(key.keyPreview),
    used: key.used === true,
    createdAt: normalizeText(key.createdAt, new Date().toISOString()),
    createdBy: normalizeText(key.createdBy, "admin"),
    usedAt: normalizeText(key.usedAt)
  };
}

function normalizePost(post = {}) {
  return {
    id: normalizeText(post.id, createId("post")),
    gameId: normalizeText(post.gameId),
    slug: normalizeText(post.slug),
    title: normalizeText(post.title),
    excerpt: normalizeText(post.excerpt),
    image: normalizeUrl(post.image),
    contentHtml: normalizeText(post.contentHtml),
    seoTitle: normalizeText(post.seoTitle || post.title),
    seoDescription: normalizeText(post.seoDescription || post.excerpt),
    publishedAt: normalizeText(post.publishedAt, new Date().toISOString()),
    updatedAt: normalizeText(post.updatedAt, new Date().toISOString())
  };
}

function createBaseStore(seed = {}) {
  const meta = seed.meta && typeof seed.meta === "object" ? seed.meta : {};
  return {
    meta: {
      ...meta,
      schemaVersion: SCHEMA_VERSION
    },
    admin: {
      passwordHash: normalizeText(seed.admin?.passwordHash),
      passwordUpdatedAt: normalizeText(seed.admin?.passwordUpdatedAt)
    },
    settings: normalizeSettings(seed.settings),
    users: Array.isArray(seed.users) ? seed.users.map(normalizeUser).filter((user) => user.email) : [],
    keys: Array.isArray(seed.keys) ? seed.keys.map(normalizeKey) : [],
    games: Array.isArray(seed.games) ? seed.games.map(normalizeGame).filter((game) => game.name) : [],
    posts: Array.isArray(seed.posts) ? seed.posts.map(normalizePost).filter((post) => post.slug && post.title) : []
  };
}

function migrateLegacyStore(store = {}) {
  const base = createBaseStore({
    admin: store.admin,
    settings: {
      siteTitle: store.settings?.siteTitle,
      siteTagline: store.settings?.siteTagline,
      siteDescription: store.settings?.siteDescription,
      logoUrl: store.settings?.logoUrl,
      faviconUrl: store.settings?.faviconUrl,
      paymentQrUrl: store.settings?.paymentQrUrl || store.settings?.qrImage,
      telegramUrl: store.settings?.socialLinks?.telegram,
      supportEmail: store.settings?.business?.email
    }
  });

  if (Array.isArray(store.users)) {
    base.users = store.users.map((user) => normalizeUser({
      id: user.id,
      email: user.email || user.contact,
      name: user.name,
      passwordHash: user.passwordHash || "",
      paymentStatus: user.paymentStatus || "unpaid",
      verified: user.verified === true,
      keyAssignedAt: user.keyAssignedAt,
      keyUsedAt: user.keyUsedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })).filter((user) => user.email);
  }

  if (Array.isArray(store.games)) {
    base.games = store.games
      .map((game) => normalizeGame({
        id: game.id,
        platform: game.platform || "PC",
        name: game.name,
        image: game.image,
        description: game.description,
        credentialIdCipher: game.credentialIdCipher,
        credentialPasswordCipher: game.credentialPasswordCipher,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
      }))
      .filter((game) => game.name);
  }

  if (Array.isArray(store.keys)) {
    base.keys = store.keys.map(normalizeKey);
  }

  if (Array.isArray(store.posts)) {
    base.posts = store.posts.map(normalizePost).filter((post) => post.slug && post.title);
  }

  return base;
}

function normalizeStore(store = {}) {
  if (Number(store.meta?.schemaVersion || 0) !== SCHEMA_VERSION) {
    return migrateLegacyStore(store);
  }

  return createBaseStore(store);
}

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createBaseStore(), null, 2));
  }
}

function readStore() {
  ensureStore();
  const stat = fs.statSync(storePath);
  if (!cachedStore || cachedMtimeMs !== stat.mtimeMs) {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const normalized = normalizeStore(raw);
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      fs.writeFileSync(storePath, JSON.stringify(normalized, null, 2));
      cachedMtimeMs = fs.statSync(storePath).mtimeMs;
    } else {
      cachedMtimeMs = stat.mtimeMs;
    }
    cachedStore = normalized;
  }
  return cachedStore;
}

function writeStore(value) {
  ensureStore();
  const normalized = normalizeStore(value);
  const tempPath = `${storePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(normalized, null, 2));
  fs.renameSync(tempPath, storePath);
  cachedStore = normalized;
  cachedMtimeMs = fs.statSync(storePath).mtimeMs;
  return normalized;
}

function updateStore(updater) {
  const current = cloneStore(readStore());
  const next = updater(current) || current;
  return writeStore(next);
}

module.exports = {
  createId,
  defaultLogo,
  defaultQr,
  readStore,
  slugify,
  storePath,
  updateStore,
  writeStore
};
