const { slugify } = require("./store");

function encodeSvg(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createBundleVisual(title, subtitle, accentA, accentB, badge) {
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" rx="36" fill="#08101f" />
      <rect x="20" y="20" width="1160" height="680" rx="28" fill="url(#bg)" opacity="0.92" />
      <circle cx="1020" cy="160" r="140" fill="rgba(255,255,255,0.09)" />
      <circle cx="930" cy="520" r="180" fill="rgba(255,255,255,0.06)" />
      <text x="80" y="120" fill="#dff7ff" font-size="36" font-family="Arial" letter-spacing="8">${badge}</text>
      <text x="80" y="290" fill="#ffffff" font-size="86" font-weight="700" font-family="Arial">${title}</text>
      <text x="80" y="380" fill="#d9f6ff" font-size="36" font-family="Arial">${subtitle}</text>
      <rect x="80" y="450" width="320" height="82" rx="22" fill="rgba(7,18,31,0.35)" stroke="rgba(255,255,255,0.25)" />
      <text x="112" y="503" fill="#ffffff" font-size="34" font-family="Arial">Gamers Arena Bundle</text>
      <text x="80" y="620" fill="#d6f5f1" font-size="28" font-family="Arial">QR checkout • Telegram support • Fast delivery flow</text>
    </svg>
  `);
}

const bundleBlueprints = [
  {
    id: "bundle-seed-700",
    slug: "700-games-bundle",
    name: "700 Games Bundle",
    itemCount: 700,
    price: 699,
    description: "A smart starting bundle for buyers who want a wide mix of action, racing, open-world, RPG, shooter, and low-end friendly titles in one clean package. It is built to feel like a premium starter vault with enough variety to cover mainstream favorites and replay-friendly picks without overwhelming the buyer.",
    images: [
      createBundleVisual("700 Games", "Starter vault with top mainstream picks", "#0f766e", "#164e63", "BUNDLE"),
      createBundleVisual("700 Games", "Built for quick buyers who want variety", "#1d4ed8", "#0f766e", "COLLECTION")
    ]
  },
  {
    id: "bundle-seed-230",
    slug: "230-games-bundle",
    name: "230 Games Bundle",
    itemCount: 230,
    price: 299,
    description: "A compact value bundle for customers who want a cleaner, easier-to-pick library without going too large. This option works well for people who want a strong curated mix of recognized titles at a lower entry price while keeping checkout and support simple.",
    images: [
      createBundleVisual("230 Games", "Compact catalog with easy value", "#7c3aed", "#1d4ed8", "VALUE"),
      createBundleVisual("230 Games", "Cleaner size for fast-selling buyers", "#2563eb", "#312e81", "CURATED")
    ]
  },
  {
    id: "bundle-seed-5000",
    slug: "5000-games-bundle",
    name: "5000 Games Bundle",
    itemCount: 5000,
    price: 2499,
    description: "A huge mixed catalog bundle for customers who want a serious all-rounder collection. This package is positioned for heavy buyers who want thousands of titles, broader franchise depth, and a much bigger long-term library from a single purchase flow.",
    images: [
      createBundleVisual("5000 Games", "Massive variety across major franchises", "#be123c", "#7c2d12", "MEGA"),
      createBundleVisual("5000 Games", "Designed for deep catalog lovers", "#ea580c", "#9f1239", "COLLECTION")
    ]
  },
  {
    id: "bundle-seed-15000",
    slug: "15000-games-bundle",
    name: "15000 Games Bundle",
    itemCount: 15000,
    price: 4999,
    description: "A premium large-library bundle built for customers who want scale, discovery, and variety at a much higher tier. It is positioned as a serious collector-style option with broad genre coverage, many franchise branches, and a stronger premium feel on the bundle page.",
    images: [
      createBundleVisual("15000 Games", "Premium large-library access", "#14532d", "#115e59", "PREMIUM"),
      createBundleVisual("15000 Games", "Collector-sized variety in one bundle", "#166534", "#0f766e", "VAULT")
    ]
  },
  {
    id: "bundle-seed-27000",
    slug: "27000-games-bundle",
    name: "27000 Games Bundle",
    itemCount: 27000,
    price: 7999,
    description: "A heavy-scale archive bundle for buyers who want one of the largest visible offers on the site. This option is meant to look bold and high-value, giving customers a clear premium upsell above the mid-tier bundles while keeping the same add-to-cart and QR flow.",
    images: [
      createBundleVisual("27000 Games", "Large archive-style access tier", "#1e293b", "#0f766e", "ULTRA"),
      createBundleVisual("27000 Games", "For buyers who want a giant library", "#0f766e", "#0f172a", "EXPANDED")
    ]
  },
  {
    id: "bundle-seed-40000",
    slug: "40000-games-bundle",
    name: "40000 Games Bundle",
    itemCount: 40000,
    price: 10999,
    description: "The flagship bundle offer on Gamers Arena. It is presented as the biggest bundle in the catalog, built to feel high-end, premium, and serious. This page is aimed at customers who want the top bundle tier with the strongest visual presentation and the same easy QR checkout path.",
    images: [
      createBundleVisual("40000 Games", "Flagship top-tier bundle offer", "#111827", "#0f766e", "FLAGSHIP"),
      createBundleVisual("40000 Games", "The largest bundle in the catalog", "#164e63", "#111827", "ELITE")
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBundle(bundle = {}, index = 0) {
  const fallback = bundleBlueprints.find((item) => item.slug === bundle.slug || item.id === bundle.id || item.name === bundle.name) || {};
  const name = String(bundle.name || fallback.name || `Bundle ${index + 1}`).trim();
  const slug = String(bundle.slug || fallback.slug || slugify(name)).trim();
  const images = Array.isArray(bundle.images) && bundle.images.length
    ? bundle.images.map((image) => String(image || "").trim()).filter(Boolean).slice(0, 2)
    : Array.isArray(fallback.images) ? fallback.images.slice(0, 2) : [];

  return {
    id: String(bundle.id || fallback.id || `bundle-${index + 1}`).trim(),
    slug,
    name,
    itemCount: Number(bundle.itemCount || fallback.itemCount || 0),
    price: Number(bundle.price || fallback.price || 45),
    description: String(bundle.description || fallback.description || "").trim(),
    images,
    gameIds: Array.isArray(bundle.gameIds) ? bundle.gameIds : Array.isArray(fallback.gameIds) ? fallback.gameIds : []
  };
}

function getDefaultBundles() {
  return bundleBlueprints.map((bundle, index) => normalizeBundle(bundle, index));
}

function getBundles(store) {
  const raw = Array.isArray(store?.settings?.bundles) && store.settings.bundles.length
    ? store.settings.bundles
    : getDefaultBundles();
  return raw.map((bundle, index) => normalizeBundle(bundle, index));
}

function getBundleBySlug(store, slug) {
  return getBundles(store).find((bundle) => bundle.slug === slug) || null;
}

function ensureBundleDrafts(draft) {
  if (!draft.settings) draft.settings = {};
  if (!Array.isArray(draft.settings.bundles) || !draft.settings.bundles.length) {
    draft.settings.bundles = clone(getDefaultBundles());
  }
  return draft.settings.bundles;
}

module.exports = {
  ensureBundleDrafts,
  getBundleBySlug,
  getBundles,
  getDefaultBundles,
  normalizeBundle
};
