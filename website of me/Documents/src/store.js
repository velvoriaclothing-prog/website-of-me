const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "..", "data", "store.json");
const defaultQr = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'><rect width='320' height='320' rx='24' fill='white'/><rect x='26' y='26' width='84' height='84' fill='black'/><rect x='44' y='44' width='48' height='48' fill='white'/><rect x='210' y='26' width='84' height='84' fill='black'/><rect x='228' y='44' width='48' height='48' fill='white'/><rect x='26' y='210' width='84' height='84' fill='black'/><rect x='44' y='228' width='48' height='48' fill='white'/><text x='160' y='302' font-size='18' font-family='Arial' text-anchor='middle' fill='%23111'>SCAN TO PAY</text></svg>";
let cachedStore = null;
let cachedMtimeMs = 0;

function cloneStore(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    const now = new Date().toISOString();
    const initial = {
      admin: {
        email: "admin@gamersarena.com",
        password: "Aditisubhan"
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
    };
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2));
  }
}

function readStore() {
  ensureStore();
  const stat = fs.statSync(storePath);
  if (!cachedStore || stat.mtimeMs !== cachedMtimeMs) {
    cachedStore = JSON.parse(fs.readFileSync(storePath, "utf8"));
    cachedMtimeMs = stat.mtimeMs;
  }
  return cachedStore;
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(data));
  cachedStore = data;
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
  writeStore,
  updateStore,
  createId,
  slugify
};
