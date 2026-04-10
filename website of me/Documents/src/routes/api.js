const express = require("express");
const { aiTools } = require("../data/aiTools");
const { addGameByName, listGames, listBundles, getGame } = require("../services/gameService");
const { listProducts, getProduct, listUpcomingProducts, searchProducts, compareProducts, autoListings } = require("../services/productService");
const { generateBlog, generateNews, getContent, ensureDailyContent, getBlogBySlug, getNewsBySlug } = require("../services/contentService");
const { generateGameData, chatReply, genericContent } = require("../services/aiOrchestrator");
const { getCache, setCache } = require("../services/cacheService");

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get("/health", (_req, res) => {
  res.json({ ok: true, platform: "Gamers Arena" });
});

router.get("/bootstrap", asyncHandler(async (_req, res) => {
  const cached = getCache("bootstrap");
  if (cached) return res.json(cached);

  await ensureDailyContent();
  const payload = {
    brand: "Gamers Arena",
    stats: {
      games: listGames().length,
      products: listProducts().length,
      tools: aiTools.length
    },
    featuredGames: listGames().slice(0, 8),
    featuredBundles: listBundles().slice(0, 3),
    featuredProducts: listProducts().slice(0, 6),
    upcomingProducts: listUpcomingProducts().slice(0, 4),
    autoListings: autoListings(),
    latestBlogs: getContent().blogs.slice(0, 3),
    latestNews: getContent().news.slice(0, 4),
    featuredDeals: listProducts().slice(0, 4).map((item) => ({
      ...item,
      badge: item.price < 1000 ? "Budget Deal" : "Hot Deal"
    }))
  };

  setCache("bootstrap", payload, 15000);
  return res.json(payload);
}));

router.get("/games", (_req, res) => {
  res.json({
    items: listGames(),
    bundles: listBundles()
  });
});

router.get("/games/:slug", (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: "Game not found" });
  return res.json(game);
});

router.post("/games", asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Game name is required" });
  const game = await addGameByName(name);
  return res.status(201).json(game);
}));

router.get("/bundles", (_req, res) => {
  res.json(listBundles());
});

router.get("/products", (_req, res) => {
  res.json({
    items: listProducts(),
    upcoming: listUpcomingProducts(),
    autoListings: autoListings()
  });
});

router.get("/products/:slug", (req, res) => {
  const product = getProduct(req.params.slug);
  if (!product) return res.status(404).json({ error: "Product not found" });
  return res.json(product);
});

router.get("/blogs", asyncHandler(async (_req, res) => {
  await ensureDailyContent();
  res.json(getContent().blogs);
}));

router.get("/blogs/:slug", asyncHandler(async (req, res) => {
  await ensureDailyContent();
  const item = getBlogBySlug(req.params.slug);
  if (!item) return res.status(404).json({ error: "Blog not found" });
  return res.json(item);
}));

router.get("/news", asyncHandler(async (_req, res) => {
  await ensureDailyContent();
  res.json(getContent().news);
}));

router.get("/news/:slug", asyncHandler(async (req, res) => {
  await ensureDailyContent();
  const item = getNewsBySlug(req.params.slug);
  if (!item) return res.status(404).json({ error: "News post not found" });
  return res.json(item);
}));

router.post("/generate-blog", asyncHandler(async (req, res) => {
  const item = await generateBlog(req.body?.topic || "Smart gaming buying guide");
  return res.json(item);
}));

router.post("/generate-news", asyncHandler(async (req, res) => {
  const item = await generateNews(req.body?.topic || "Daily gaming market update");
  return res.json(item);
}));

router.post("/auto-game-data", asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Game name is required" });
  const payload = await generateGameData(name);
  return res.json(payload);
}));

router.post("/optimize-game", asyncHandler(async (req, res) => {
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
      "Lower shadow quality and volumetrics first for faster FPS gains.",
      "Keep textures high if VRAM allows, then tune post-processing.",
      storage.toLowerCase().includes("hdd") ? "Move the game to SSD storage for smoother asset streaming." : "Your SSD setup is ideal for modern game loading.",
      String(ram).includes("8") ? "Close background apps to reduce RAM pressure." : "Your RAM headroom should support smoother frame pacing."
    ]
  });
}));

router.post("/chat", asyncHandler(async (req, res) => {
  const reply = await chatReply(req.body?.message || "Recommend something");
  return res.json(reply);
}));

router.post("/recommend-game", (req, res) => {
  const { category = "Action", lowEnd = false } = req.body || {};
  const item = listGames().find((game) => game.category === category || (lowEnd && game.category === "Low-end PC")) || listGames()[0];
  res.json({
    recommendation: item,
    reason: `Selected for ${category} players based on category fit, replay value, and broad appeal.`
  });
});

router.post("/generate-image", asyncHandler(async (req, res) => {
  const { title = "Gamers Arena visual" } = req.body || {};
  res.json({
    sourcePriority: ["existing", "unsplash", "pexels", "pixabay", "ai-fallback", "default"],
    selectedSource: "unsplash",
    image: `https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80&title=${encodeURIComponent(title)}`
  });
}));

router.post("/search-products", asyncHandler(async (req, res) => {
  const cacheKey = `search:${(req.body?.query || "").toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  const result = await searchProducts(req.body?.query || "");
  setCache(cacheKey, result, 30000);
  return res.json(result);
}));

router.post("/compare-products", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  res.json(compareProducts(items));
});

router.post("/can-run", (req, res) => {
  const { gameName = "your game", cpuTier = "mid", gpuTier = "mid", ram = 16, storage = "ssd" } = req.body || {};
  const canRun = Number(ram) >= 8;
  res.json({
    gameName,
    canRun,
    verdict: canRun ? "Playable with balanced settings." : "Hardware is below a safe baseline for modern PC gaming.",
    details: { cpuTier, gpuTier, ram, storage }
  });
});

router.post("/pc-builder", (req, res) => {
  const { budget = 60000, target = "1080p gaming" } = req.body || {};
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

router.post("/deal-finder", (_req, res) => {
  const items = listProducts().slice(0, 6).map((item) => ({
    ...item,
    badge: item.price < 1000 ? "Budget Deal" : item.rating >= 4.5 ? "Top Rated" : "Hot Deal"
  }));
  res.json(items);
});

router.post("/seo-generator", asyncHandler(async (req, res) => {
  const result = await genericContent("seo copy", req.body?.topic || "gaming accessory guide");
  res.json(result);
}));

router.post("/rewrite-content", asyncHandler(async (req, res) => {
  const text = req.body?.text || "";
  res.json({
    original: text,
    rewritten: `${text}\n\nRefined to read more naturally, clearly, and cleanly for search-first publishing.`
  });
}));

router.get("/ai-tools", (_req, res) => {
  res.json(aiTools);
});

module.exports = router;
