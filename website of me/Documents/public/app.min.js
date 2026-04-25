const page = document.body.dataset.page;
const DESKTOP_GAME_PAGE_SIZE = 24;
const MOBILE_GAME_PAGE_SIZE = 12;
const CATALOG_MARKETING_TOTAL = 12000;

const state = {
  session: null,
  settings: null,
  games: [],
  filteredGames: [],
  visibleGameCount: DESKTOP_GAME_PAGE_SIZE,
  totalGames: 0,
  catalogHasMore: false,
  catalogQuery: "",
  catalogCategory: "",
  categories: [],
  cart: { items: [], total: 0 },
  cartLoaded: false,
  consoleGames: { PS4: [], PS5: [] },
  consoleTotals: { PS4: 0, PS5: 0 },
  consoleFilters: { PS4: "", PS5: "" },
  blogs: [],
  filteredBlogs: [],
  blogQuery: "",
  blogCategory: "",
  bundles: [],
  aiTools: [],
  filteredAiTools: [],
  aiToolQuery: "",
  aiToolCategory: "",
  suggestedItems: [],
  bundleCandidates: [],
  wishlist: [],
  orders: [],
  bundleSelection: [],
  activeBundle: null,
  bundleSlide: 0,
  showcase: { action: [], lowEnd: [], upcoming: [], upcomingPreview: [], upcomingTotal: 0 },
  admin: { stats: {}, users: [], chats: [] },
  activeChat: null,
  socket: null,
  content: { sections: [], pages: [], media: [] }
};
const TELEGRAM_HANDLE = "gamersarena_shop";
const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;
const TELEGRAM_SHARE_URL = "https://t.me/share/url";
const WISHLIST_KEY = "ga-wishlist";
const LOCAL_CART_KEY = "ga-cart-cache";
const CART_API_BASE = "/api/cart";
const ORDERS_API_BASE = "/api/orders";
const faqEntries = [
  {
    question: "How long does delivery usually take after payment?",
    answer: "Most buyers continue directly to Telegram after QR payment, share the screenshot, and get delivery help there. Fast support is the normal flow, especially when your order details are clear."
  },
  {
    question: "What should I do after clicking I Paid?",
    answer: "After payment, open Telegram support, send your screenshot, order details, and the item names. That is the main handoff used by Gamers Arena."
  },
  {
    question: "Can I ask for a game that is not listed on the website?",
    answer: "Yes. Use the Telegram request button or search suggestions area. If a title is missing, message the exact name and the team can help manually."
  },
  {
    question: "Are bundles and games purchased in the same checkout flow?",
    answer: "Yes. Single games and bundles can both be added to cart, checked out through the same QR page, and then completed through Telegram support."
  },
  {
    question: "Can I save games or bundles for later?",
    answer: "Yes. Use the save or wishlist buttons to keep items in your browser and come back to them later."
  },
  {
    question: "Is the payment QR fixed forever?",
    answer: "No. The admin can update the QR and key site settings from the dashboard whenever needed."
  }
];
const reviewEntries = [
  {
    name: "Rohit Sharma",
    city: "Mumbai",
    rating: 5,
    title: "Fast support after payment",
    text: "I paid by QR, sent the screenshot on Telegram, and the support was quick. The process felt simple and easy to follow."
  },
  {
    name: "Aditi Verma",
    city: "Delhi",
    rating: 5,
    title: "Bundle page looked premium",
    text: "I liked that the bundle had its own page with clear visuals, price, and description. It felt more real than a normal basic store."
  },
  {
    name: "Karan Mehta",
    city: "Pune",
    rating: 4,
    title: "Good website for quick orders",
    text: "The search was easy, the cart was simple, and the Telegram handoff made the whole order flow easy for me."
  },
  {
    name: "Priya Nair",
    city: "Bengaluru",
    rating: 5,
    title: "Clean and easy to use",
    text: "The dark design looks good, and I did not feel confused while checking out. I also liked the trust and FAQ sections."
  },
  {
    name: "Arjun Patel",
    city: "Ahmedabad",
    rating: 5,
    title: "Saved items for later worked well",
    text: "I added a few games and a bundle to wishlist, came back later, and everything was still there in my browser."
  },
  {
    name: "Sneha Kapoor",
    city: "Jaipur",
    rating: 4,
    title: "Customer support felt active",
    text: "The site feels alive now because the sections move, the homepage looks more premium, and support details are visible."
  },
  {
    name: "Rahul Yadav",
    city: "Lucknow",
    rating: 5,
    title: "Checkout flow is very simple",
    text: "I liked that I only had to add items, pay by QR, and continue to Telegram. No unnecessary confusion."
  },
  {
    name: "Neha Joshi",
    city: "Indore",
    rating: 5,
    title: "Better than a plain store page",
    text: "The bundles, reviews, FAQ, and wishlists make the website feel much more trustworthy and complete."
  }
];
const DEFAULT_EDITOR_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="hero" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#03111f"/>
      <stop offset="55%" stop-color="#0b2940"/>
      <stop offset="100%" stop-color="#123447"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#hero)"/>
  <circle cx="180" cy="130" r="120" fill="rgba(34,211,238,0.18)"/>
  <circle cx="1010" cy="500" r="160" fill="rgba(52,211,153,0.16)"/>
  <rect x="90" y="96" width="1020" height="438" rx="34" fill="rgba(10,20,33,0.58)" stroke="rgba(34,211,238,0.36)" stroke-width="2"/>
  <text x="120" y="222" fill="#8ff6ff" font-family="Oxanium, Arial, sans-serif" font-size="28" font-weight="700">Gamers Arena</text>
  <text x="120" y="300" fill="#ffffff" font-family="Manrope, Arial, sans-serif" font-size="58" font-weight="800">Cheap Steam Games</text>
  <text x="120" y="360" fill="#ffffff" font-family="Manrope, Arial, sans-serif" font-size="58" font-weight="800">&amp; Fast PC Deals</text>
  <text x="120" y="432" fill="#b8d8e8" font-family="Manrope, Arial, sans-serif" font-size="28">Budget-friendly bundles, QR checkout, wishlist saves, and direct Telegram support.</text>
</svg>
`)}`;

function telegramMessageLink(message) {
  return `${TELEGRAM_SHARE_URL}?url=${encodeURIComponent(TELEGRAM_URL)}&text=${encodeURIComponent(message)}`;
}

function consoleBuyLink(game) {
  return telegramMessageLink(`Hello, I want to buy ${game.name} for ${game.platform}. Please help me continue the order.`);
}

function consoleSupportLink() {
  return telegramMessageLink("Hi, I want PS4/PS5 games");
}

function qs(id) {
  return document.getElementById(id);
}

function legacyNormalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeHref(value, fallback = "#") {
  const href = String(value || "").trim();
  return /^(https?:\/\/|\/|#)/i.test(href) ? href : fallback;
}

function getConsoleCatalogPath(platform) {
  return `/${String(platform || "ps5").toLowerCase()}-games`;
}

function getCatalogDisplayTotal() {
  const actualTotal = Number(state.totalGames || state.games.length || 0);
  if (page === "admin") return actualTotal;
  if (state.catalogQuery || state.catalogCategory) return actualTotal;
  return CATALOG_MARKETING_TOTAL;
}

function readLocalCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CART_KEY) || '{"items":[],"total":0}');
    if (!parsed || !Array.isArray(parsed.items)) return { items: [], total: 0 };
    return {
      items: parsed.items,
      total: Number(parsed.total || 0)
    };
  } catch (_error) {
    return { items: [], total: 0 };
  }
}

function writeLocalCart(cart) {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify({
    items: Array.isArray(cart?.items) ? cart.items : [],
    total: Number(cart?.total || 0)
  }));
}

function getContentSection(key) {
  return (state.content.sections || []).find((item) => item.key === key) || null;
}

async function loadPublicContent() {
  const data = await api("/api/content/public");
  const [homeContent, gamesContent, cartContent] = await Promise.all([
    loadPageContent("home"),
    loadPageContent("games"),
    loadPageContent("cart")
  ]);
  state.content = {
    ...(state.content || {}),
    sections: data.sections || [],
    pages: data.pages || [],
    pageContent: {
      home: homeContent || {},
      games: gamesContent || {},
      cart: cartContent || {}
    }
  };
  return state.content;
}

async function loadPageContent(pageKey) {
  try {
    const data = await api(`/api/content/${encodeURIComponent(pageKey)}`);
    return data.content || null;
  } catch (_error) {
    return null;
  }
}

async function loadAdminContent() {
  const data = await api("/api/content");
  const [homeContent, gamesContent, cartContent] = await Promise.all([
    loadPageContent("home"),
    loadPageContent("games"),
    loadPageContent("cart")
  ]);
  state.content = {
    sections: data.sections || [],
    pages: data.pages || [],
    media: data.media || [],
    pageContent: {
      home: homeContent || {},
      games: gamesContent || {},
      cart: cartContent || {}
    }
  };
  renderContentSectionsAdmin();
  renderPageContentAdmin();
  renderPagesAdmin();
  renderMediaAdmin();
  return state.content;
}

function applyManagedSections() {
  document.querySelectorAll("[data-section-title]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionTitle);
    if (section?.title) element.textContent = section.title;
  });

  document.querySelectorAll("[data-section-subtitle]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionSubtitle);
    if (section?.subtitle) element.textContent = section.subtitle;
  });

  document.querySelectorAll("[data-section-body]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionBody);
    if (section?.body) element.textContent = section.body;
  });

  document.querySelectorAll("[data-section-html]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionHtml);
    if (section?.body) element.innerHTML = section.body;
  });

  document.querySelectorAll("[data-section-button-label]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionButtonLabel);
    if (section?.buttonLabel) element.textContent = section.buttonLabel;
  });

  document.querySelectorAll("[data-section-button-href]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionButtonHref);
    if (section?.buttonHref) element.setAttribute("href", safeHref(section.buttonHref, element.getAttribute("href") || "#"));
  });

  document.querySelectorAll("[data-section-image]").forEach((element) => {
    const section = getContentSection(element.dataset.sectionImage);
    if (!section?.image) return;
    element.setAttribute("src", section.image);
    element.classList.remove("hidden");
  });
}

function renderContentSectionsAdmin() {
  const wrap = qs("contentSectionsList");
  if (!wrap) return;
  wrap.innerHTML = (state.content.sections || []).length
    ? state.content.sections.map((section) => `
      <article class="card admin-editor-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(section.key)}</p>
            <h3 class="card-title">${escapeHtml(section.title || "Untitled section")}</h3>
          </div>
        </div>
        <div class="stack">
          <input id="section-key-${section.id}" class="input" value="${escapeHtml(section.key)}" placeholder="Section key">
          <input id="section-subtitle-${section.id}" class="input" value="${escapeHtml(section.subtitle || "")}" placeholder="Subtitle">
          <input id="section-title-${section.id}" class="input" value="${escapeHtml(section.title || "")}" placeholder="Title">
          <textarea id="section-body-${section.id}" class="textarea" placeholder="Section body">${escapeHtml(section.body || "")}</textarea>
          <input id="section-button-label-${section.id}" class="input" value="${escapeHtml(section.buttonLabel || "")}" placeholder="Button label">
          <input id="section-button-href-${section.id}" class="input" value="${escapeHtml(section.buttonHref || "")}" placeholder="Button link">
          <input id="section-image-${section.id}" class="input" value="${escapeHtml(section.image || "")}" placeholder="Image URL (optional)">
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-section="${section.id}">Save Section</button>
            <button class="btn btn-danger" type="button" data-delete-section="${section.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No managed content sections yet.</div>`;
}

function renderPagesAdmin() {
  const wrap = qs("pagesList");
  if (!wrap) return;
  wrap.innerHTML = (state.content.pages || []).length
    ? state.content.pages.map((item) => `
      <article class="card admin-editor-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">/${escapeHtml(item.slug)}</p>
            <h3 class="card-title">${escapeHtml(item.title || "Untitled page")}</h3>
          </div>
          <a class="btn btn-secondary" href="/pages/${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">Open Page</a>
        </div>
        <div class="stack">
          <input id="page-title-${item.id}" class="input" value="${escapeHtml(item.title || "")}" placeholder="Page title">
          <input id="page-slug-${item.id}" class="input" value="${escapeHtml(item.slug || "")}" placeholder="Page slug">
          <input id="page-summary-${item.id}" class="input" value="${escapeHtml(item.summary || "")}" placeholder="Short summary">
          <input id="page-image-${item.id}" class="input" value="${escapeHtml(item.heroImage || "")}" placeholder="Hero image URL">
          <input id="page-seo-title-${item.id}" class="input" value="${escapeHtml(item.seoTitle || "")}" placeholder="SEO title">
          <textarea id="page-seo-description-${item.id}" class="textarea" placeholder="SEO description">${escapeHtml(item.seoDescription || "")}</textarea>
          <textarea id="page-content-${item.id}" class="textarea code-textarea" placeholder="HTML or text content">${escapeHtml(item.content || "")}</textarea>
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-page="${item.id}">Save Page</button>
            <button class="btn btn-danger" type="button" data-delete-page="${item.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No custom pages yet.</div>`;
}

function renderMediaAdmin() {
  const wrap = qs("mediaList");
  if (!wrap) return;
  wrap.innerHTML = (state.content.media || []).length
    ? state.content.media.map((item) => `
      <article class="card admin-editor-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(item.placement || "media")}</p>
            <h3 class="card-title">${escapeHtml(item.name || "Media item")}</h3>
          </div>
        </div>
        <div class="stack">
          <input id="media-name-${item.id}" class="input" value="${escapeHtml(item.name || "")}" placeholder="Media name">
          <input id="media-url-${item.id}" class="input" value="${escapeHtml(item.url || "")}" placeholder="Image URL or uploaded data URL">
          <input id="media-alt-${item.id}" class="input" value="${escapeHtml(item.alt || "")}" placeholder="Alt text">
          <input id="media-placement-${item.id}" class="input" value="${escapeHtml(item.placement || "")}" placeholder="Placement tag (home, banner, hero)">
          ${item.url ? `<img class="admin-media-preview" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || item.name || "Media preview")}" loading="lazy">` : ""}
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-media="${item.id}">Save Media</button>
            <button class="btn btn-danger" type="button" data-delete-media="${item.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No saved media items yet.</div>`;
}

function renderPageContentAdmin() {
  const wrap = qs("pageContentList");
  if (!wrap) return;
  const pages = state.content.pageContent || {};
  const entries = Object.entries(pages);
  wrap.innerHTML = entries.length
    ? entries.map(([pageKey, content]) => `
      <article class="card admin-editor-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(pageKey)}</p>
            <h3 class="card-title">${escapeHtml(content.title || "Page content")}</h3>
          </div>
        </div>
        <div class="stack">
          <input id="page-content-title-${pageKey}" class="input" value="${escapeHtml(content.title || "")}" placeholder="Title">
          <textarea id="page-content-description-${pageKey}" class="textarea" placeholder="Description">${escapeHtml(content.description || "")}</textarea>
          <input id="page-content-button-label-${pageKey}" class="input" value="${escapeHtml(content.buttonLabel || "")}" placeholder="Button label">
          <input id="page-content-button-href-${pageKey}" class="input" value="${escapeHtml(content.buttonHref || "")}" placeholder="Button href">
          <input id="page-content-hero-${pageKey}" class="input" value="${escapeHtml(content.heroImage || "")}" placeholder="Hero image URL">
          <button class="btn btn-secondary" type="button" data-save-page-content="${pageKey}">Save ${escapeHtml(pageKey)} Content</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No page content groups yet.</div>`;
}

function upsertMeta(selector, attributes, content) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  element.setAttribute("content", content);
}

function upsertStructuredData(data) {
  let element = document.getElementById("articleStructuredData");
  if (!element) {
    element = document.createElement("script");
    element.id = "articleStructuredData";
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

function readWishlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeWishlist(items) {
  state.wishlist = items;
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  updateWishlistBadges();
}

function updateWishlistBadges() {
  document.querySelectorAll("[data-wishlist-count]").forEach((element) => {
    element.textContent = String(state.wishlist.length);
  });
}

function updateCartBadges() {
  const count = Number(state.cart?.items?.length || readLocalCart().items.length || 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = String(count);
  });
  const floatingButton = qs("floatingCartButton");
  const floatingCount = qs("floatingCartCount");
  if (floatingCount) {
    floatingCount.textContent = String(count);
    floatingCount.classList.toggle("is-empty", count === 0);
  }
  if (floatingButton) {
    floatingButton.setAttribute("aria-label", count ? `Open cart with ${count} item${count === 1 ? "" : "s"}` : "Open cart");
  }
}

function injectFloatingCart() {
  if (document.getElementById("floatingCartButton")) return;
  const cachedCart = readLocalCart();
  const button = document.createElement("button");
  button.id = "floatingCartButton";
  button.className = "floating-cart";
  button.type = "button";
  const initialCount = Number(cachedCart.items.length || 0);
  button.setAttribute("aria-label", initialCount ? `Open cart with ${initialCount} item${initialCount === 1 ? "" : "s"}` : "Open cart");
  button.innerHTML = `
    <span class="floating-cart-controller" aria-hidden="true">
      <svg class="floating-cart-pad" viewBox="0 0 72 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 12C11.373 12 6 17.373 6 24C6 30.627 11.373 36 18 36H54C60.627 36 66 30.627 66 24C66 17.373 60.627 12 54 12H18Z" fill="currentColor"/>
        <path d="M23 18V30" stroke="#071521" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M17 24H29" stroke="#071521" stroke-width="3.4" stroke-linecap="round"/>
        <circle cx="48" cy="21" r="3.3" fill="#071521"/>
        <circle cx="55" cy="27" r="3.3" fill="#071521"/>
        <circle cx="38" cy="24" r="2.2" fill="#0EA5E9" opacity="0.95"/>
      </svg>
    </span>
    <span class="sr-only">Cart</span>
    <span id="floatingCartCount" class="floating-cart-count ${initialCount === 0 ? "is-empty" : ""}">${initialCount}</span>
  `;
  button.onclick = () => {
    window.location.href = "/cart";
  };
  document.body.appendChild(button);
}

function scheduleIdleTask(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => callback(), { timeout: 900 });
    return;
  }
  window.setTimeout(() => callback(), 90);
}

function useCompactMode() {
  return window.innerWidth <= 768 || Boolean(navigator.connection?.saveData);
}

function getGamePageSize() {
  return useCompactMode() ? MOBILE_GAME_PAGE_SIZE : DESKTOP_GAME_PAGE_SIZE;
}

function syncHomeCategoryButtons() {
  document.querySelectorAll("[data-home-category]").forEach((button) => {
    button.classList.toggle("active", String(button.dataset.homeCategory || "") === String(state.catalogCategory || ""));
  });
}

function updateHomeCatalogUrl(query, category) {
  if (page !== "home") return;
  const params = new URLSearchParams(window.location.search);
  if (query) {
    params.set("q", query);
  } else {
    params.delete("q");
  }
  if (category) {
    params.set("category", category);
  } else {
    params.delete("category");
  }
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", next);
}

function updateHomeMetrics() {
  const gameCount = Number(state.totalGames || state.games.length || 0);
  const bundleCount = Number(state.bundles.length || state.settings?.bundles?.length || 0);
  const upcomingCount = Number(state.showcase.upcomingTotal || state.showcase.upcomingPreview.length || 0);
  const wishlistCount = Number(state.wishlist.length || 0);

  if (qs("metricGames")) qs("metricGames").textContent = gameCount.toLocaleString("en-IN");
  if (qs("metricBundles")) qs("metricBundles").textContent = bundleCount.toLocaleString("en-IN");
  if (qs("metricUpcoming")) qs("metricUpcoming").textContent = upcomingCount.toLocaleString("en-IN");
  if (qs("metricWishlist")) qs("metricWishlist").textContent = wishlistCount.toLocaleString("en-IN");

  syncHomeCategoryButtons();
}

function initRevealAnimations() {
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || useCompactMode()) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -6% 0px"
  });

  items.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 55}ms`);
    observer.observe(item);
  });
}

function isWishlisted(type, key) {
  return state.wishlist.some((item) => item.type === type && item.key === key);
}

function toggleWishlist(item) {
  const exists = isWishlisted(item.type, item.key);
  const next = exists
    ? state.wishlist.filter((entry) => !(entry.type === item.type && entry.key === item.key))
    : [{ ...item, savedAt: new Date().toISOString() }, ...state.wishlist];
  writeWishlist(next);
  renderGameCards();
  renderBundleSection();
  renderBundlePage();
  renderWishlistPreview();
  renderWishlistPage();
  updateHomeMetrics();
}

function legacyStars(rating) {
  return "★".repeat(Math.max(0, Math.min(5, Number(rating || 0)))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, Number(rating || 0)))));
}

function stars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating || 0)));
  return "\u2605".repeat(safeRating) + "\u2606".repeat(Math.max(0, 5 - safeRating));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function currency(value) {
  return `\u20B9${Number(value || 0).toLocaleString("en-IN")}`;
}

function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileInputToDataUrl(input) {
  const [file] = input?.files || [];
  return file ? readFileAsDataUrl(file) : "";
}

async function inputToDataUrl(inputId) {
  const input = qs(inputId);
  return fileInputToDataUrl(input);
}

function setStatus(id, text, isError = false) {
  const element = qs(id);
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#fecdd3" : "";
}

function injectSiteBanner() {
  if (document.getElementById("siteNoticeBanner")) return;
  const shell = document.querySelector(".shell");
  const topbar = document.querySelector(".topbar");
  if (!shell || !topbar) return;
  const banner = document.createElement("div");
  banner.id = "siteNoticeBanner";
  banner.className = "site-banner";
  banner.innerHTML = `Fast QR checkout, responsive browsing, and direct order help on <a href="${TELEGRAM_URL}" target="_blank" rel="noreferrer">Telegram</a>.`;
  shell.insertBefore(banner, topbar.nextSibling);
}

function enhanceBranding() {
  document.querySelectorAll(".brand").forEach((brand) => {
    if (!brand || brand.querySelector(".brand-logo")) return;
    const mark = brand.querySelector(".brand-mark");
    const image = document.createElement("img");
    image.className = "brand-logo";
    image.src = state.settings?.logoUrl || "/assets/gamers-arena-logo.png";
    image.alt = `${state.settings?.siteTitle || "Gamers Arena"} logo`;
    image.loading = "eager";
    if (mark) {
      mark.replaceWith(image);
    } else {
      brand.prepend(image);
    }
  });
}

function injectSiteFooter() {
  const shell = document.querySelector(".shell");
  const main = document.querySelector("main");
  if (!shell || !main || document.getElementById("siteFooter")) return;
  const business = state.settings?.business || {};
  const social = state.settings?.socialLinks || {};
  const footer = document.createElement("footer");
  footer.id = "siteFooter";
  footer.className = "panel site-footer";
  footer.innerHTML = `
    <div class="site-footer-grid">
      <div class="site-footer-brand">
        <a class="brand brand-footer" href="/">
          <img class="brand-logo" src="${escapeHtml(state.settings?.logoUrl || "/assets/gamers-arena-logo.png")}" alt="${escapeHtml(state.settings?.siteTitle || "Gamers Arena")} logo" loading="lazy">
          <span>
            <strong>${escapeHtml(state.settings?.siteTitle || "Gamers Arena")}</strong><br>
            <small class="muted">${escapeHtml(state.settings?.siteTagline || "PC Games Accounts Store")}</small>
          </span>
        </a>
        <p class="hero-copy">${escapeHtml(state.settings?.siteDescription || "Premium gaming storefront")}</p>
        <div class="chip-row">
          <span class="chip">Global admin updates</span>
          <span class="chip">SEO-ready content</span>
          <span class="chip">QR payment flow</span>
        </div>
      </div>
      <div>
        <p class="eyebrow">explore</p>
        <div class="site-footer-links">
          <a href="/pc-games">PC Games</a>
          <a href="/ps4-games">PS4 Games</a>
          <a href="/ps5-games">PS5 Games</a>
          <a href="/deals">Deals</a>
          <a href="/blog">Blog</a>
          <a href="/ai-tools">AI Tools</a>
        </div>
      </div>
      <div>
        <p class="eyebrow">business</p>
        <div class="site-footer-links">
          <span>${escapeHtml(business.name || "Gamers Arena")}</span>
          <span>${escapeHtml([business.addressLine1, business.city, business.state].filter(Boolean).join(", "))}</span>
          <span>${escapeHtml(business.phone || "+91 00000 00000")}</span>
          <span>${escapeHtml(business.email || "support@gamersarena.com")}</span>
        </div>
      </div>
      <div>
        <p class="eyebrow">social</p>
        <div class="social-links">
          <a class="social-link" href="${escapeHtml(social.instagram || "/")}" target="_blank" rel="noreferrer" aria-label="Instagram">IG</a>
          <a class="social-link" href="${escapeHtml(social.facebook || "/")}" target="_blank" rel="noreferrer" aria-label="Facebook">FB</a>
          <a class="social-link" href="${escapeHtml(social.youtube || "/")}" target="_blank" rel="noreferrer" aria-label="YouTube">YT</a>
          <a class="social-link" href="${escapeHtml(social.twitter || "/")}" target="_blank" rel="noreferrer" aria-label="Twitter X">X</a>
          <a class="social-link" href="${escapeHtml(social.linkedin || "/")}" target="_blank" rel="noreferrer" aria-label="LinkedIn">IN</a>
          <a class="social-link social-link-telegram" href="${escapeHtml(social.telegram || TELEGRAM_URL)}" target="_blank" rel="noreferrer" aria-label="Telegram">TG</a>
        </div>
        <p class="footer-note">SPF and DMARC guidance can be managed from admin settings before connecting branded email sending.</p>
      </div>
    </div>
  `;
  shell.appendChild(footer);
}

function injectBreadcrumbs() {
  if (["home", "admin", "login"].includes(page) || document.getElementById("siteBreadcrumbs")) return;
  const main = document.querySelector("main");
  if (!main) return;
  const labels = {
    "pc-games": "PC Games",
    games: "PC Games",
    "ps4-games": "PS4 Games",
    "ps5-games": "PS5 Games",
    deals: "Deals",
    blog: "Blog",
    "ai-tools": "AI Tools",
    cart: "Cart",
    checkout: "Checkout",
    bundle: "Bundle",
    post: "Article",
    wishlist: "Wishlist"
  };
  const currentLabel = labels[page];
  if (!currentLabel) return;
  const nav = document.createElement("nav");
  nav.id = "siteBreadcrumbs";
  nav.className = "panel breadcrumb-bar";
  nav.setAttribute("aria-label", "Breadcrumb");
  nav.innerHTML = `
    <a href="/">Home</a>
    <span>/</span>
    <span aria-current="page">${escapeHtml(currentLabel)}</span>
  `;
  main.prepend(nav);
}

function injectAdminAccess() {
  if (page === "admin") return;
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  if (!document.getElementById("adminQuickAccess")) {
    const launcher = document.createElement("button");
    launcher.id = "adminQuickAccess";
    launcher.className = "admin-header-icon";
    launcher.type = "button";
    launcher.title = "Admin Access";
    launcher.setAttribute("aria-label", "Open admin access");
    launcher.textContent = "AD";
    navActions.insertBefore(launcher, navActions.firstChild);
  }

  if (!document.getElementById("adminAccessModal")) {
    const modal = document.createElement("div");
    modal.id = "adminAccessModal";
    modal.className = "admin-modal hidden";
    modal.innerHTML = `
      <div class="admin-modal-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">admin</p>
            <h2 class="section-title">Secure Admin Access</h2>
          </div>
          <button id="closeAdminAccess" class="btn btn-secondary" type="button">Close</button>
        </div>
        <p class="hero-copy">Admin login is separate from normal users. Enter your main admin password first, then your second admin password.</p>
        <form id="adminQuickLoginForm" class="stack" data-stage="primary">
          <input id="adminQuickEmail" class="input" type="email" placeholder="Admin email" value="admin@gamersarena.com">
          <input id="adminQuickPassword" class="input" type="password" placeholder="Admin password">
          <div id="adminQuickSecondWrap" class="stack hidden">
            <input id="adminQuickPasscode" class="input" type="password" placeholder="Second admin password">
          </div>
          <button id="adminQuickSubmit" class="btn btn-primary" type="submit">Continue</button>
        </form>
        <div class="inline-actions">
          <button id="adminQuickForgot" class="btn btn-secondary" type="button">Forgot Password?</button>
          <button id="adminQuickBack" class="btn btn-secondary hidden" type="button">Back To Login</button>
        </div>
        <form id="adminRecoveryForm" class="stack hidden" data-stage="verify">
          <p class="hero-copy">Enter both recovery birthdays to unlock admin password reset.</p>
          <input id="adminRecoveryDob1" class="input" type="text" inputmode="numeric" placeholder="DOB 1 (DD-MM-YYYY)">
          <input id="adminRecoveryDob2" class="input" type="text" inputmode="numeric" placeholder="DOB 2 (DD-MM-YYYY)">
          <div id="adminRecoveryResetWrap" class="stack hidden">
            <input id="adminRecoveryPassword" class="input" type="password" placeholder="New first admin password">
            <input id="adminRecoveryPasscode" class="input" type="password" placeholder="New second admin password">
          </div>
          <button id="adminRecoverySubmit" class="btn btn-primary" type="submit">Verify Birthdays</button>
        </form>
        <p class="hero-copy">Recovery only unlocks the reset after both birthday answers match on the server.</p>
        <p id="adminRecoveryStatus" class="status"></p>
        <p id="adminQuickStatus" class="status"></p>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

function ensureExpandedNav() {
  if (["admin", "editor"].includes(page)) return;
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks) return;
  const desiredLinks = [
    { href: "/", label: "Home", pageKey: "home" },
    { href: "/pc-games", label: "PC Games", pageKey: "pc-games" },
    { href: "/ps4-games", label: "PS4", pageKey: "ps4-games" },
    { href: "/ps5-games", label: "PS5", pageKey: "ps5-games" },
    { href: "/deals", label: "Deals", pageKey: "deals" },
    { href: "/blog", label: "Blog", pageKey: "blog" },
    { href: "/ai-tools", label: "AI Tools", pageKey: "ai-tools" }
  ];

  navLinks.innerHTML = desiredLinks.map((link) => `
    <a class="nav-link" href="${link.href}" data-nav-link="${link.pageKey}">${link.label}</a>
  `).join("");

  const navActions = document.querySelector(".nav-actions");
  if (navActions && !document.getElementById("headerStoreSearch")) {
    const searchForm = document.createElement("form");
    searchForm.id = "headerStoreSearch";
    searchForm.className = "header-search";
    searchForm.innerHTML = `
      <input class="input header-search-input" type="search" name="q" placeholder="Search games" aria-label="Search games">
      <button class="btn btn-secondary" type="submit">Search</button>
    `;
    searchForm.onsubmit = (event) => {
      event.preventDefault();
      const query = searchForm.querySelector("input")?.value?.trim() || "";
      window.location.href = query ? `/pc-games?q=${encodeURIComponent(query)}` : "/pc-games";
    };
    navActions.prepend(searchForm);
  }

  if (navActions && !document.getElementById("headerCartLink")) {
    const cartLink = document.createElement("a");
    cartLink.id = "headerCartLink";
    cartLink.className = "btn btn-secondary";
    cartLink.href = "/cart";
    cartLink.innerHTML = `Cart <span data-cart-count>0</span>`;
    navActions.appendChild(cartLink);
  }
}

function resetAdminAccessModal() {
  const form = qs("adminQuickLoginForm");
  if (form) form.dataset.stage = "primary";
  const recoveryForm = qs("adminRecoveryForm");
  if (recoveryForm) recoveryForm.dataset.stage = "verify";
  qs("adminQuickSecondWrap")?.classList.add("hidden");
  qs("adminRecoveryResetWrap")?.classList.add("hidden");
  qs("adminQuickLoginForm")?.classList.remove("hidden");
  qs("adminRecoveryForm")?.classList.add("hidden");
  qs("adminQuickForgot")?.classList.remove("hidden");
  qs("adminQuickBack")?.classList.add("hidden");
  if (qs("adminQuickPassword")) qs("adminQuickPassword").value = "";
  if (qs("adminQuickPasscode")) qs("adminQuickPasscode").value = "";
  if (qs("adminQuickEmail")) qs("adminQuickEmail").value = state.settings?.adminEmail || "admin@gamersarena.com";
  if (qs("adminRecoveryDob1")) qs("adminRecoveryDob1").value = "";
  if (qs("adminRecoveryDob2")) qs("adminRecoveryDob2").value = "";
  if (qs("adminRecoveryPassword")) qs("adminRecoveryPassword").value = "";
  if (qs("adminRecoveryPasscode")) qs("adminRecoveryPasscode").value = "";
  if (qs("adminQuickSubmit")) qs("adminQuickSubmit").textContent = "Continue";
  if (qs("adminRecoverySubmit")) qs("adminRecoverySubmit").textContent = "Verify Birthdays";
  setStatus("adminQuickStatus", "");
  setStatus("adminRecoveryStatus", "");
}

async function bootstrap() {
  const includeQr = ["checkout", "admin", "editor"].includes(page);
  const sessionData = await api(`/api/session${includeQr ? "?includeQr=1" : ""}`);
  state.session = sessionData.user;
  state.settings = sessionData.settings;
  state.wishlist = readWishlist();
  state.cart = readLocalCart();
  document.querySelectorAll("[data-site-title]").forEach((element) => {
    element.textContent = state.settings.siteTitle || "Gamers Arena";
  });
  injectSiteBanner();
  injectAdminAccess();
  injectFloatingCart();
  ensureExpandedNav();
  enhanceBranding();
  injectBreadcrumbs();
  injectSiteFooter();
  updateNav();
  updateWishlistBadges();
  updateCartBadges();
}

function updateNav() {
  document.querySelectorAll("[data-nav-link]").forEach((element) => {
    element.classList.toggle("active", element.dataset.navLink === page);
  });
  document.querySelectorAll("[data-user-label]").forEach((element) => {
    element.textContent = state.session ? `${state.session.name}${state.session.isAdmin ? " (Admin)" : ""}` : "Guest";
  });
  document.querySelectorAll("[data-auth-action]").forEach((element) => {
    element.textContent = state.session ? "Logout" : "Login";
    element.onclick = async () => {
      if (state.session) {
        await api("/auth/logout", { method: "POST" });
        window.location.href = "/";
      } else {
        window.location.href = "/login";
      }
    };
  });
}

function renderHomeLayout() {
  const wrap = qs("homeLayout");
  if (!wrap || !state.settings) return;
  const blocks = Array.isArray(state.settings.homeLayout) ? state.settings.homeLayout : [];
  wrap.innerHTML = blocks.length
    ? blocks.map((block) => {
      if (block.type === "image") {
        return `<article class="block-card builder-preview"><img src="${block.content}" alt="Homepage block" loading="lazy"></article>`;
      }
      if (block.type === "video") {
        return `<article class="block-card builder-preview"><video src="${block.content}" controls preload="none"></video></article>`;
      }
      return `<article class="block-card"><p class="hero-copy">${block.content}</p></article>`;
    }).join("")
      : `<div class="empty">No custom homepage blocks saved yet.</div>`;
}

function renderSliderGameCards(items, emptyMessage = "No games loaded yet.") {
  return items.length
    ? items.map((game) => `
      <article class="card slider-game-card">
        ${game.image ? `<img class="slider-game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="slider-game-thumb game-thumb-fallback" aria-hidden="true">${escapeHtml((game.name || "G").slice(0, 1))}</div>`}
        <div class="stack">
          <p class="eyebrow">${escapeHtml(game.category || game.platform || "Game")}</p>
          <h3 class="card-title">${escapeHtml(game.name)}</h3>
          <p class="price">${game.category === "Upcoming" ? "Coming Soon" : currency(game.price || 45)}</p>
        </div>
        <div class="inline-actions">
          <button class="btn btn-primary" type="button" data-add-cart="${game.id}">Add to Cart</button>
          <button class="btn btn-secondary" type="button" data-save-item="game" data-save-key="${game.id}" data-save-name="${escapeHtml(game.name)}" data-save-price="${game.price || 45}" data-save-category="${escapeHtml(game.category || game.platform || "Game")}">${isWishlisted("game", game.id) ? "Saved" : "Save"}</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">${emptyMessage}</div>`;
}

function renderTrendingGamesRail() {
  const rail = qs("trendingGamesRail");
  if (!rail) return;
  const items = (state.games || []).filter((game) => game.category !== "Upcoming").slice(0, 10);
  rail.innerHTML = renderSliderGameCards(items, "No trending games loaded yet.");
}

function renderSlidingRows() {
  const rails = [qs("gameRailRow1"), qs("gameRailRow2")];
  if (!rails.some(Boolean)) return;
  const source = (state.games || []).slice(0, 16);
  const rows = [
    source.filter((_, index) => index % 2 === 0),
    source.filter((_, index) => index % 2 === 1)
  ];
  rails.forEach((rail, rowIndex) => {
    if (!rail) return;
    rail.innerHTML = renderSliderGameCards(rows[rowIndex] || []);
  });
}

function scrollSliderRow(rowId, direction) {
  const rail = qs(rowId);
  if (!rail) return;
  const amount = Math.max(260, Math.floor(rail.clientWidth * 0.8));
  rail.scrollBy({ left: amount * direction, behavior: "smooth" });
}

async function loadGames(options = {}) {
  const {
    reset = true,
    all = false,
    query = state.catalogQuery,
    category = state.catalogCategory
  } = options;
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (all) {
    params.set("all", "1");
  } else {
    params.set("offset", reset ? "0" : String(state.games.length));
    params.set("limit", String(getGamePageSize()));
  }
  const data = await api(`/games?${params.toString()}`);
  state.games = reset || all ? data.items : [...state.games, ...data.items];
  state.filteredGames = state.games;
  state.totalGames = Number(data.total || state.games.length);
  state.catalogHasMore = Boolean(data.hasMore);
  state.catalogQuery = query || "";
  state.catalogCategory = category || "";
  state.categories = data.categories || [];
  state.bundles = data.bundles || [];
  state.settings = {
    ...(state.settings || {}),
    bundles: data.bundles || []
  };
  return state.games;
}

async function loadConsoleGames() {
  const [ps4, ps5] = await Promise.all([
    api("/console-games?platform=PS4"),
    api("/console-games?platform=PS5")
  ]);
  state.consoleGames = {
    PS4: ps4.items || [],
    PS5: ps5.items || []
  };
  state.consoleTotals = {
    PS4: Number(ps4.total || state.consoleGames.PS4.length),
    PS5: Number(ps5.total || state.consoleGames.PS5.length)
  };
  return state.consoleGames;
}

function filterConsoleGames(platform, query = state.consoleFilters?.[platform] || "") {
  const items = Array.isArray(state.consoleGames?.[platform]) ? state.consoleGames[platform] : [];
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;
  return items
    .filter((game) => normalizeSearchText(`${game.name} ${game.platform}`).includes(normalizedQuery))
    .sort((left, right) => {
      const leftName = normalizeSearchText(left.name);
      const rightName = normalizeSearchText(right.name);
      const leftRank = leftName === normalizedQuery ? 0 : leftName.startsWith(normalizedQuery) ? 1 : 2;
      const rightRank = rightName === normalizedQuery ? 0 : rightName.startsWith(normalizedQuery) ? 1 : 2;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.name.localeCompare(right.name);
    });
}

function updateConsoleCatalogUrl(platform, query) {
  if (!["ps4-games", "ps5-games"].includes(page) || history.replaceState == null) return;
  const nextUrl = new URL(window.location.href);
  if (query) nextUrl.searchParams.set("q", query);
  else nextUrl.searchParams.delete("q");
  nextUrl.pathname = getConsoleCatalogPath(platform);
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
}

async function loadSearchSuggestions(query) {
  const value = String(query || "").trim();
  if (value.length < 2) {
    state.suggestedItems = [];
    renderSearchSuggestions();
    return [];
  }
  const data = await api(`/search-suggestions?q=${encodeURIComponent(value)}`);
  state.suggestedItems = data.items || [];
  renderSearchSuggestions();
  return state.suggestedItems;
}

function renderSearchSuggestions() {
  const wrap = qs("searchSuggestions");
  if (!wrap) return;
  if (!state.suggestedItems.length) {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  wrap.innerHTML = state.suggestedItems.map((item) => `
    <button class="suggestion-item" type="button" data-suggestion-type="${item.type}" data-suggestion-name="${escapeHtml(item.name)}" ${item.slug ? `data-suggestion-slug="${item.slug}"` : ""} ${item.platform ? `data-suggestion-platform="${item.platform}"` : ""}>
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small class="muted">${item.type === "bundle" ? `${(item.itemCount || 0).toLocaleString("en-IN")} games bundle` : escapeHtml(item.category || "Game")}</small>
      </span>
      <span class="chip">${item.type}</span>
    </button>
  `).join("");
}

function renderGameCards() {
  const wrap = qs("gamesGrid");
  const loadMoreWrap = qs("loadMoreWrap");
  const loadMoreBtn = qs("loadMoreGames");
  const resultsMeta = qs("resultsMeta");
  if (!wrap) return;
  const sourceGames = Array.isArray(state.filteredGames) ? state.filteredGames : state.games;
  const query = String(qs("gameSearch")?.value || "").trim();
  const safeQuery = escapeHtml(query);
  if (resultsMeta) {
    const displayTotal = getCatalogDisplayTotal();
    if (displayTotal || sourceGames.length) {
      resultsMeta.textContent = `Showing ${sourceGames.length} of ${displayTotal || sourceGames.length} game${(displayTotal || sourceGames.length) > 1 ? "s" : ""}${query ? ` for "${query}"` : ""}.`;
    } else {
      resultsMeta.textContent = query ? `No result for "${query}".` : "No games matched the current filter.";
    }
  }
  wrap.innerHTML = sourceGames.length
      ? sourceGames.map((game) => `
        <article class="card game-card">
          ${game.image ? `<img class="game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="game-thumb game-thumb-fallback" aria-hidden="true">${escapeHtml((game.name || "G").slice(0, 1))}</div>`}
          <p class="eyebrow">${escapeHtml(game.category)}</p>
          <strong>${escapeHtml(game.name)}</strong>
          <p class="muted game-summary">${escapeHtml(game.description || "Affordable game deal with fast Telegram support.")}</p>
          <div class="price">${game.category === "Upcoming" ? "Coming Soon" : currency(game.price)}</div>
          <div class="inline-actions" style="justify-content:center;">
            <button class="btn btn-primary" type="button" data-add-cart="${game.id}">Add to Cart</button>
            <button class="btn btn-secondary" type="button" data-save-item="game" data-save-key="${game.id}" data-save-name="${escapeHtml(game.name)}" data-save-price="${game.price}" data-save-category="${escapeHtml(game.category)}">${isWishlisted("game", game.id) ? "Saved" : "Save"}</button>
            ${state.session?.isAdmin ? `<button class="btn btn-secondary" type="button" data-edit-game="${game.id}">Edit</button>` : ""}
        </div>
        ${state.session?.isAdmin ? `
          <div class="stack hidden" id="edit-${game.id}">
            <input class="input" id="name-${game.id}" value="${game.name}">
              <select class="select" id="category-${game.id}">
                ${["Action", "Shooter", "RPG", "Racing", "Sports", "Low-end PC", "Upcoming"].map((category) => `<option value="${category}" ${game.category === category ? "selected" : ""}>${category}</option>`).join("")}
              </select>
              <input class="input" id="price-${game.id}" type="number" value="${game.price}">
              <input class="input" id="image-${game.id}" value="${escapeHtml(game.image || "")}" placeholder="Image URL">
              <textarea class="textarea" id="description-${game.id}" placeholder="Short description">${escapeHtml(game.description || "")}</textarea>
              <div class="inline-actions" style="justify-content:center;">
                <button class="btn btn-secondary" type="button" data-save-game="${game.id}">Save</button>
                <button class="btn btn-danger" type="button" data-delete-game="${game.id}">Delete</button>
              </div>
            </div>
        ` : ""}
      </article>
    `).join("")
    : `
      <div class="empty request-card">
        <strong>${query ? `No result for "${safeQuery}"` : "This game is not in our list yet."}</strong>
        <p class="hero-copy">Please message us on Telegram and we will help you get this game.</p>
        <a class="btn btn-primary" href="${telegramMessageLink(`Hello, I searched for ${query || "a game"} on Gamers Arena and could not find it. Please help me get this game.`)}" target="_blank" rel="noreferrer">Message On Telegram</a>
      </div>
    `;

  if (loadMoreWrap && loadMoreBtn) {
    loadMoreWrap.classList.toggle("hidden", !state.catalogHasMore);
    loadMoreBtn.textContent = state.catalogHasMore ? `Load More Games (${Math.max(0, state.totalGames - sourceGames.length)} left)` : "All games loaded";
  }
}

async function refreshCart() {
  state.cart = await api(CART_API_BASE);
  state.cartLoaded = true;
  writeLocalCart(state.cart);
  updateCartBadges();
}

function renderConsoleGameCards(items, platform) {
  return items.map((game) => `
    <article class="console-game-card">
      ${game.image ? `<img class="console-game-bg" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="console-game-bg console-game-bg-fallback" aria-hidden="true"></div>`}
      <div class="console-game-overlay"></div>
      <div class="console-game-content">
        <span class="console-platform-pill">${platform}</span>
        <h3 class="console-game-title">${escapeHtml(game.name)}</h3>
        <a class="btn btn-primary console-buy-btn" href="${consoleBuyLink(game)}" target="_blank" rel="noreferrer">Buy Now</a>
      </div>
    </article>
  `).join("");
}

function renderConsoleSection(platform, wrapId, statusId, options = {}) {
  const wrap = qs(wrapId);
  if (!wrap) return;
  const {
    query = state.consoleFilters?.[platform] || "",
    limit = 0,
    resultsMetaId = "",
    layout = "grid"
  } = options;
  const items = filterConsoleGames(platform, query);
  const visibleItems = limit ? items.slice(0, limit) : items;
  const totalItems = Number(state.consoleTotals?.[platform] || (state.consoleGames?.[platform] || []).length || 0);
  const resultsMeta = resultsMetaId ? qs(resultsMetaId) : null;

  if (resultsMeta) {
    resultsMeta.textContent = items.length
      ? `Showing ${visibleItems.length} of ${totalItems} ${platform} games${query ? ` for "${query}"` : ""}.`
      : query
        ? `No ${platform} games matched "${query}".`
        : `No ${platform} games are available right now.`;
  }

  if (qs(statusId)) {
    if (layout === "slider") {
      qs(statusId).textContent = totalItems
        ? `Showing ${visibleItems.length} of ${totalItems} ${platform} games. Swipe or use the arrows.`
        : "";
    } else {
      qs(statusId).textContent = totalItems
        ? `${totalItems} ${platform} game${totalItems === 1 ? "" : "s"} live right now.`
        : "";
    }
  }
  wrap.innerHTML = visibleItems.length
    ? renderConsoleGameCards(visibleItems, platform)
    : `<div class="empty">No ${platform} games added yet. You can publish them from the admin panel.</div>`;
}

function renderConsoleSections() {
  renderConsoleSection("PS5", "ps5GamesGrid", "ps5Status", { layout: "slider", limit: 12 });
  renderConsoleSection("PS4", "ps4GamesGrid", "ps4Status", { layout: "slider", limit: 12 });
}

function bindConsoleCatalogFilters(platform) {
  const search = qs("consoleSearch");
  const clear = qs("clearConsoleFilters");
  if (!search) {
    renderConsoleSection(platform, "consoleCatalogGrid", "consoleCatalogStatus", {
      resultsMetaId: "consoleResultsMeta"
    });
    return;
  }

  const applyFilters = () => {
    const value = String(search.value || "").trim();
    state.consoleFilters = {
      ...(state.consoleFilters || {}),
      [platform]: value
    };
    renderConsoleSection(platform, "consoleCatalogGrid", "consoleCatalogStatus", {
      query: value,
      resultsMetaId: "consoleResultsMeta"
    });
    updateConsoleCatalogUrl(platform, value);
  };

  let searchTimer;
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 140);
  };

  if (clear) {
    clear.onclick = () => {
      search.value = "";
      applyFilters();
      search.focus();
    };
  }

  applyFilters();
}

function renderCartPage() {
  const list = qs("cartItems");
  const total = qs("cartTotal");
  if (!list || !total) return;
  list.innerHTML = state.cart.items.length
    ? state.cart.items.map((item) => `
      <article class="card">
        <h3 class="card-title">${item.name}</h3>
        <div class="chip-row">
          <span class="chip">${item.type === "bundle" ? "Bundle" : "Game"}</span>
          ${item.type === "bundle" ? `<span class="chip">${(item.itemCount || 0).toLocaleString("en-IN")} games</span>` : ""}
        </div>
        <p class="price">${currency(item.price)}</p>
        <button class="btn btn-danger" type="button" data-remove-cart="${item.id}">Remove</button>
      </article>
    `).join("")
    : `<div class="empty">Your cart is empty.</div>`;
  total.textContent = currency(state.cart.total);
}

function renderBundleSection() {
  const wrap = qs("bundleList");
  if (!wrap) return;
  const bundles = state.bundles.length ? state.bundles : (state.settings?.bundles || []);
  wrap.innerHTML = bundles.length
    ? bundles.map((bundle) => {
      const names = (bundle.gameIds || [])
        .map((id) => state.games.find((game) => game.id === id)?.name)
        .filter(Boolean)
        .slice(0, 4);
      return `
        <article class="card bundle-card">
          <p class="eyebrow">bundle</p>
          <h3 class="card-title">${escapeHtml(bundle.name)}</h3>
          <p class="price">${currency(bundle.price)}</p>
          <p class="hero-copy">${escapeHtml(bundle.description || "Special grouped offer for customers who want more than one game in one order.")}</p>
          <div class="chip-row">
            <span class="chip">${(bundle.itemCount || 0).toLocaleString("en-IN")} games access</span>
            <span class="chip">2-image detail page</span>
          </div>
          <div class="chip-row">
            ${names.length ? names.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join("") : `<span class="chip">Add games later from admin</span>`}
          </div>
          <div class="inline-actions">
          <a class="btn btn-secondary" href="/bundle/${encodeURIComponent(bundle.slug)}">View Bundle</a>
            <button class="btn btn-secondary" type="button" data-save-item="bundle" data-save-key="${bundle.slug}" data-save-name="${escapeHtml(bundle.name)}" data-save-price="${bundle.price}" data-save-count="${bundle.itemCount || 0}">${isWishlisted("bundle", bundle.slug) ? "Saved" : "Save"}</button>
            <button class="btn btn-primary" type="button" data-add-bundle="${bundle.id}">Add Bundle</button>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty">Bundle section is empty for now. You can add bundles later from admin when you are ready.</div>`;
}

function renderBundleCatalogPage() {
  const wrap = qs("bundleCatalogList");
  if (!wrap) return;
  wrap.innerHTML = state.bundles.length
    ? state.bundles.map((bundle) => `
      <article class="card bundle-card bundle-catalog-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">premium bundle</p>
            <h3 class="card-title">${escapeHtml(bundle.name)}</h3>
          </div>
          <span class="chip">${(bundle.itemCount || 0).toLocaleString("en-IN")} games</span>
        </div>
        <p class="hero-copy">${escapeHtml(bundle.description)}</p>
        <div class="chip-row">
          <span class="chip">${currency(bundle.price)}</span>
          <span class="chip">2-image page</span>
          <span class="chip">QR checkout</span>
        </div>
        <div class="inline-actions">
          <a class="btn btn-secondary" href="/bundle/${encodeURIComponent(bundle.slug)}">Open Bundle</a>
          <button class="btn btn-secondary" type="button" data-save-item="bundle" data-save-key="${bundle.slug}" data-save-name="${escapeHtml(bundle.name)}" data-save-price="${bundle.price}" data-save-count="${bundle.itemCount || 0}">${isWishlisted("bundle", bundle.slug) ? "Saved" : "Save"}</button>
          <button class="btn btn-primary" type="button" data-add-bundle="${bundle.id}">Add To Cart</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No bundles are available right now.</div>`;
}

function renderFeaturedSections() {
  const wrap = qs("featuredSections");
  if (!wrap) return;

  const sections = [
    {
      title: "Popular Action Picks",
      description: "Fast-moving games that make the store feel active right away.",
      items: state.showcase.action
    },
    {
      title: "Low-End Friendly",
      description: "Easy picks for customers who want lighter games for weaker PCs.",
      items: state.showcase.lowEnd
    },
    {
      title: "Upcoming Watchlist",
      description: "Keep buyers interested with upcoming launches and future drops.",
      items: state.showcase.upcoming
    }
  ];

  wrap.innerHTML = sections.map((section) => `
    <article class="card featured-card">
      <div class="section-head">
        <div>
          <p class="eyebrow">curated</p>
          <h3 class="card-title">${section.title}</h3>
        </div>
      </div>
      <p class="hero-copy">${section.description}</p>
      <div class="chip-row">
        ${section.items.map((game) => `<span class="chip">${escapeHtml(game.name)}</span>`).join("") || `<span class="chip">No games in this section yet</span>`}
      </div>
    </article>
  `).join("");
}

function renderUpcomingPreview() {
  const wrap = qs("upcomingGrid");
  if (!wrap) return;
  const upcomingGames = state.showcase.upcomingPreview;
  wrap.innerHTML = upcomingGames.map((game) => `
    <article class="card game-card upcoming-card">
      <p class="eyebrow">upcoming</p>
      <strong>${escapeHtml(game.name)}</strong>
      <div class="price">Coming Soon</div>
      <div class="inline-actions" style="justify-content:center;">
        <button class="btn btn-secondary" type="button" data-set-upcoming-filter="Upcoming">Browse Upcoming</button>
      </div>
    </article>
  `).join("");
}

function updateBundleSlider() {
  const bundle = state.activeBundle;
  const track = qs("bundleSliderTrack");
  const dots = qs("bundleSliderDots");
  if (!bundle || !track || !Array.isArray(bundle.images)) return;
  const slides = bundle.images.length || 1;
  const currentIndex = ((state.bundleSlide % slides) + slides) % slides;
  state.bundleSlide = currentIndex;
  track.style.transform = `translateX(-${currentIndex * 100}%)`;
  if (dots) {
    dots.innerHTML = bundle.images.map((_, index) => `
      <button class="slider-dot ${index === currentIndex ? "active" : ""}" type="button" data-bundle-slide="${index}" aria-label="Show bundle image ${index + 1}"></button>
    `).join("");
  }
}

function renderBundlePage() {
  const bundle = state.activeBundle;
  if (!bundle) return;
  document.title = `${bundle.name} | Gamers Arena`;
  upsertMeta('meta[name="description"]', { name: "description" }, bundle.description || `${bundle.name} on Gamers Arena.`);
  if (qs("bundleTitle")) qs("bundleTitle").textContent = bundle.name;
  if (qs("bundlePrice")) qs("bundlePrice").textContent = currency(bundle.price);
  if (qs("bundleDescription")) qs("bundleDescription").textContent = bundle.description;
  if (qs("bundleCount")) qs("bundleCount").textContent = `${(bundle.itemCount || 0).toLocaleString("en-IN")} games bundle`;
  if (qs("bundleHeroMeta")) {
    qs("bundleHeroMeta").innerHTML = `
      <span class="chip">Bundle</span>
      <span class="chip">${(bundle.itemCount || 0).toLocaleString("en-IN")} games</span>
      <span class="chip">QR checkout ready</span>
      <span class="chip">Telegram support</span>
    `;
  }
  if (qs("bundleSaveAction")) {
    qs("bundleSaveAction").textContent = isWishlisted("bundle", bundle.slug) ? "Saved Bundle" : "Save Bundle";
    qs("bundleSaveAction").dataset.saveItem = "bundle";
    qs("bundleSaveAction").dataset.saveKey = bundle.slug;
    qs("bundleSaveAction").dataset.saveName = bundle.name;
    qs("bundleSaveAction").dataset.savePrice = String(bundle.price || 0);
    qs("bundleSaveAction").dataset.saveCount = String(bundle.itemCount || 0);
  }
  if (qs("bundleHighlights")) {
    qs("bundleHighlights").innerHTML = `
      <article class="card feature-item">
        <h3 class="card-title">Wide Access</h3>
        <p class="hero-copy">This bundle is positioned as a larger multi-game access pack so buyers can pick a bigger catalog in one order.</p>
      </article>
      <article class="card feature-item">
        <h3 class="card-title">Same Easy Flow</h3>
        <p class="hero-copy">Add the bundle to cart, continue to QR payment, then finish the order through the same Telegram support flow.</p>
      </article>
      <article class="card feature-item">
        <h3 class="card-title">Premium Bundle Page</h3>
        <p class="hero-copy">Each bundle now has its own dedicated page, description, and sliding visuals so it feels like a real product page.</p>
      </article>
    `;
  }
  const track = qs("bundleSliderTrack");
  if (track) {
    track.innerHTML = (bundle.images || []).map((image, index) => `
      <div class="bundle-slide ${index === 0 ? "active" : ""}">
        <img src="${image}" alt="${bundle.name} visual ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}">
      </div>
    `).join("");
  }
  updateBundleSlider();
}

function renderFaqCards(targetId, limit = faqEntries.length) {
  const wrap = qs(targetId);
  if (!wrap) return;
  wrap.innerHTML = faqEntries.slice(0, limit).map((entry) => `
    <article class="card faq-card">
      <h3 class="card-title">${entry.question}</h3>
      <p class="hero-copy">${entry.answer}</p>
    </article>
  `).join("");
}

function renderReviews(targetId, limit = reviewEntries.length) {
  const wrap = qs(targetId);
  if (!wrap) return;
  wrap.innerHTML = reviewEntries.slice(0, limit).map((review) => `
    <article class="card review-card auto-slide-card">
      <div class="section-head">
        <div>
          <p class="eyebrow">${review.city}</p>
          <h3 class="card-title">${review.name}</h3>
        </div>
        <span class="chip">${stars(review.rating)}</span>
      </div>
      <strong>${review.title}</strong>
      <p class="hero-copy">${review.text}</p>
    </article>
  `).join("");
}

function renderWishlistPreview() {
  const wrap = qs("wishlistPreview");
  if (!wrap) return;
  const items = state.wishlist.slice(0, 6);
  wrap.innerHTML = items.length
    ? items.map((item) => `
      <article class="card wishlist-card">
        <p class="eyebrow">${escapeHtml(item.type === "bundle" ? "bundle" : item.category || "game")}</p>
        <h3 class="card-title">${escapeHtml(item.name)}</h3>
        <div class="chip-row">
          ${item.type === "bundle" ? `<span class="chip">${Number(item.itemCount || 0).toLocaleString("en-IN")} games</span>` : ""}
          <span class="chip">${currency(item.price)}</span>
        </div>
        <div class="inline-actions">
          ${item.type === "bundle"
      ? `<a class="btn btn-secondary" href="/bundle/${encodeURIComponent(item.key)}">Open Bundle</a>`
            : `<button class="btn btn-secondary" type="button" data-quick-search="${escapeHtml(item.name)}">Find Game</button>`}
          <button class="btn btn-danger" type="button" data-remove-wishlist="${item.type}" data-remove-key="${item.key}">Remove</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No saved items yet. Use Save on any game or bundle and it will appear here.</div>`;
}

function renderWishlistPage() {
  const wrap = qs("wishlistList");
  if (!wrap) return;
  wrap.innerHTML = state.wishlist.length
    ? state.wishlist.map((item) => `
      <article class="card wishlist-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(item.type === "bundle" ? "bundle" : item.category || "game")}</p>
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
          </div>
          <span class="chip">${currency(item.price)}</span>
        </div>
        <div class="chip-row">
          ${item.type === "bundle" ? `<span class="chip">${Number(item.itemCount || 0).toLocaleString("en-IN")} games</span>` : `<span class="chip">${escapeHtml(item.category || "Game")}</span>`}
          <span class="chip">Saved for later</span>
        </div>
        <div class="inline-actions">
          ${item.type === "bundle"
      ? `<a class="btn btn-secondary" href="/bundle/${encodeURIComponent(item.key)}">Open Bundle</a>
               <button class="btn btn-primary" type="button" data-add-bundle-by-slug="${item.key}">Add To Cart</button>`
            : `<button class="btn btn-secondary" type="button" data-quick-search="${escapeHtml(item.name)}">Find Game</button>`}
          <button class="btn btn-danger" type="button" data-remove-wishlist="${item.type}" data-remove-key="${item.key}">Remove</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty">Your wishlist is empty right now. Save games or bundles to come back later.</div>`;
}

function renderHomeCollectionLoading() {
  const featured = qs("featuredSections");
  const upcoming = qs("upcomingGrid");

  if (featured && !featured.children.length) {
    featured.innerHTML = Array.from({ length: 3 }, () => `
      <article class="card loading-card">
        <div class="loading-bar loading-bar-lg"></div>
        <div class="loading-bar"></div>
        <div class="loading-bar"></div>
      </article>
    `).join("");
  }

  if (upcoming && !upcoming.children.length) {
    upcoming.innerHTML = Array.from({ length: 4 }, () => `
      <article class="card game-card loading-card">
        <div class="loading-bar loading-bar-sm"></div>
        <div class="loading-bar loading-bar-lg"></div>
        <div class="loading-bar"></div>
      </article>
    `).join("");
  }
}

function initAutoRails() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || useCompactMode()) return;
  document.querySelectorAll("[data-auto-rail]").forEach((rail) => {
    if (rail.dataset.autoRailReady === "1") return;
    rail.dataset.autoRailReady = "1";
    let direction = 1;
    let paused = false;
    const tick = () => {
      if (document.hidden || paused || rail.scrollWidth <= rail.clientWidth + 12) return;
      const step = Math.max(220, Math.floor(rail.clientWidth * 0.55));
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 10) direction = -1;
      if (rail.scrollLeft <= 10) direction = 1;
      rail.scrollBy({ left: step * direction, behavior: "smooth" });
    };
    rail.addEventListener("mouseenter", () => {
      paused = true;
    }, { passive: true });
    rail.addEventListener("mouseleave", () => {
      paused = false;
    }, { passive: true });
    rail.addEventListener("focusin", () => {
      paused = true;
    });
    rail.addEventListener("focusout", () => {
      paused = false;
    });
    setInterval(tick, Number(rail.dataset.autoRailSpeed || 3200));
  });
}

async function loadHomeShowcase() {
  const [action, lowEnd, upcomingPreview] = await Promise.all([
    api("/games?category=Action&limit=4"),
    api("/games?category=Low-end%20PC&limit=4"),
    api("/games?category=Upcoming&limit=8")
  ]);
  state.showcase = {
    action: action.items || [],
    lowEnd: lowEnd.items || [],
    upcoming: (upcomingPreview.items || []).slice(0, 4),
    upcomingPreview: upcomingPreview.items || [],
    upcomingTotal: Number(upcomingPreview.total || 0)
  };
}

async function applyGameFilters() {
  const query = String(qs("gameSearch")?.value || "").trim();
  const category = String(qs("gameCategory")?.value || "").trim();
  await loadGames({ reset: true, query, category });
  renderGameCards();
  updateHomeCatalogUrl(query, category);
  updateHomeMetrics();
}

function hydrateGameFilters() {
  const select = qs("gameCategory");
  if (select) {
    select.innerHTML = `<option value="">All categories</option>${state.categories.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
    select.value = state.catalogCategory || "";
    select.onchange = applyGameFilters;
  }
  const search = qs("gameSearch");
  if (search) {
    search.value = state.catalogQuery || "";
    let searchTimer;
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        applyGameFilters();
        loadSearchSuggestions(search.value);
      }, 160);
    };
    search.onfocus = () => {
      if (search.value.trim().length >= 2) loadSearchSuggestions(search.value);
    };
  }
  const clear = qs("clearGameFilters");
  if (clear) {
    clear.onclick = () => {
      if (search) search.value = "";
      if (select) select.value = "";
      state.suggestedItems = [];
      renderSearchSuggestions();
      applyGameFilters();
    };
  }

  syncHomeCategoryButtons();
}

function renderCheckoutPage() {
  const itemsWrap = qs("checkoutItems");
  const total = qs("checkoutTotal");
  const qr = qs("checkoutQr");
  if (!itemsWrap || !total || !qr) return;
  qr.src = state.settings.qrImage;
  itemsWrap.innerHTML = state.cart.items.length
    ? state.cart.items.map((item) => `
      <article class="card">
        <h3 class="card-title">${item.name}</h3>
        <div class="chip-row">
          <span class="chip">${item.type === "bundle" ? "Bundle" : "Game"}</span>
          ${item.type === "bundle" ? `<span class="chip">${(item.itemCount || 0).toLocaleString("en-IN")} games</span>` : ""}
        </div>
        <p>${currency(item.price)}</p>
      </article>
    `).join("")
    : `<div class="empty">Your cart is empty.</div>`;
  total.textContent = currency(state.cart.total);
}

function ensureUserForChat() {
  const gate = qs("chatGate");
  const app = qs("chatApp");
  if (!gate || !app) return true;
  if (!state.session || state.session.isAdmin) {
    gate.classList.remove("hidden");
    app.classList.add("hidden");
    return false;
  }
  gate.classList.add("hidden");
  app.classList.remove("hidden");
  return true;
}

function renderMessages(messages, wrapId) {
  const wrap = qs(wrapId);
  if (!wrap) return;
  wrap.innerHTML = messages.length
    ? messages.map((message) => `
      <article class="chat-bubble ${message.sender}">
        <p><strong>${message.sender === "admin" ? "Admin" : message.sender === "system" ? "System" : "You"}</strong></p>
        <p class="meta">${new Date(message.createdAt).toLocaleString("en-IN")}</p>
        <p>${message.text}</p>
        ${renderAttachment(message)}
      </article>
    `).join("")
    : `<div class="empty">No messages yet.</div>`;
  wrap.scrollTop = wrap.scrollHeight;
}

function renderAttachment(message) {
  if (!message.file) return "";
  if (message.fileType.startsWith("image/")) {
    return `<img class="file-preview" src="${message.file}" alt="Attachment" loading="lazy">`;
  }
  if (message.fileType.startsWith("video/")) {
    return `<video class="file-preview" src="${message.file}" controls preload="metadata"></video>`;
  }
  return `<a class="btn btn-secondary" href="${message.file}" download>Download File</a>`;
}

function connectSocket() {
  if (state.socket || typeof io === "undefined") return;
  state.socket = io();
  state.socket.on("chat:update", (chat) => {
    state.activeChat = chat;
    renderMessages(chat.messages || [], "chatThread");
  });
  state.socket.on("admin:chat-list", (items) => {
    state.admin.chats = items;
    renderAdminChats();
  });
  state.socket.on("chat:update-admin", (chat) => {
    state.activeChat = chat;
    renderAdminChatThread();
    loadAdminOverview();
  });
}

async function loadUserChat() {
  if (!ensureUserForChat()) return;
  const paidGame = localStorage.getItem("ga-last-paid-game") || "";
  const gameName = getQuery("game") || paidGame || "General Order";
  const data = await api(`/my-chat?game=${encodeURIComponent(gameName)}`);
  state.activeChat = data.chat;
  if (qs("chatGameName")) qs("chatGameName").value = state.activeChat?.gameName || gameName;
  renderMessages(state.activeChat?.messages || [], "chatThread");
  connectSocket();
}

async function loadBlogs() {
  state.blogs = (await api("/blogs")).sort((left, right) => {
    const leftDate = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightDate = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });
  state.filteredBlogs = [...state.blogs];
  return state.blogs;
}

function applyBlogFilters() {
  const searchValue = normalizeSearchText(qs("blogSearch")?.value || "");
  const categoryValue = String(qs("blogCategory")?.value || "").trim();
  state.blogQuery = searchValue;
  state.blogCategory = categoryValue;
  state.filteredBlogs = state.blogs.filter((blog) => {
    const haystack = normalizeSearchText([
      blog.title,
      blog.summary,
      ...(blog.keywords || []),
      blog.category
    ].join(" "));
    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesCategory = !categoryValue || blog.category === categoryValue;
    return matchesSearch && matchesCategory;
  });
  renderBlogList();
}

function hydrateBlogFilters() {
  const search = qs("blogSearch");
  const category = qs("blogCategory");
  if (!search && !category) return;

  const categories = [...new Set(state.blogs.map((blog) => blog.category).filter(Boolean))].sort();
  if (category) {
    category.innerHTML = `<option value="">All topics</option>${categories.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
    category.value = state.blogCategory;
    category.onchange = applyBlogFilters;
  }

  if (search) {
    let searchTimer;
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyBlogFilters, 160);
    };
  }

  if (qs("clearBlogFilters")) {
    qs("clearBlogFilters").onclick = () => {
      if (search) search.value = "";
      if (category) category.value = "";
      applyBlogFilters();
    };
  }
}

async function loadAiTools() {
  const data = await api("/api/ai-tools");
  state.aiTools = data.items || [];
  state.filteredAiTools = [...state.aiTools];
  state.aiToolCategories = data.categories || [];
  return state.aiTools;
}

function applyAiToolFilters() {
  const searchValue = normalizeSearchText(qs("toolSearchInput")?.value || "");
  const categoryValue = String(qs("toolFilter")?.value || "").trim();
  state.aiToolQuery = searchValue;
  state.aiToolCategory = categoryValue;
  state.filteredAiTools = state.aiTools.filter((tool) => {
    const haystack = normalizeSearchText(`${tool.name} ${tool.description} ${tool.category}`);
    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesCategory = !categoryValue || tool.category === categoryValue;
    return matchesSearch && matchesCategory;
  });
  renderAiToolGrid();
}

function hydrateAiToolFilters() {
  const search = qs("toolSearchInput");
  const category = qs("toolFilter");
  if (!search && !category) return;

  const categories = [...new Set(state.aiTools.map((tool) => tool.category).filter(Boolean))].sort();
  if (category) {
    category.innerHTML = `<option value="">All categories</option>${categories.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
    category.value = state.aiToolCategory;
    category.onchange = applyAiToolFilters;
  }

  if (search) {
    let searchTimer;
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyAiToolFilters, 140);
    };
  }
}

function renderAiToolGrid() {
  const wrap = qs("toolsGrid") || qs("aiToolsGrid");
  if (!wrap) return;
  const items = state.filteredAiTools || [];
  const meta = qs("toolsMeta");
  if (meta) {
    meta.textContent = items.length
      ? `Showing ${items.length} of ${state.aiTools.length} AI tools${state.aiToolQuery ? ` for "${qs("toolSearchInput")?.value || ""}"` : ""}.`
      : "No AI tools matched this search.";
  }
  wrap.innerHTML = items.length
    ? items.map((tool, index) => `
      <article class="card blog-card ai-tool-card" style="animation-delay:${Math.min(index, 10) * 50}ms;">
        <div class="blog-card-glow"></div>
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(tool.category)}</p>
            <h3 class="card-title">${escapeHtml(tool.name)}</h3>
          </div>
          ${tool.featured ? `<span class="chip">Featured</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(tool.description)}</p>
        <div class="inline-actions">
          <a class="btn btn-primary" href="${escapeHtml(tool.url)}" target="_blank" rel="noreferrer">Open Tool</a>
          <a class="btn btn-secondary" href="/blog">Read Related Guides</a>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No AI tools matched your search right now.</div>`;
}

function renderHomeAiToolsPreview() {
  const wrap = qs("homeAiToolsGrid");
  if (!wrap) return;
  wrap.innerHTML = state.aiTools.slice(0, 4).map((tool) => `
    <article class="card feature-item ai-tool-card">
      <p class="eyebrow">${escapeHtml(tool.category)}</p>
      <h3 class="card-title">${escapeHtml(tool.name)}</h3>
      <p class="hero-copy">${escapeHtml(tool.description)}</p>
      <a class="btn btn-secondary" href="/ai-tools">View Directory</a>
    </article>
  `).join("");
}

function renderHomeBlogPreview() {
  const wrap = qs("homeBlogGrid");
  if (!wrap) return;
  wrap.innerHTML = state.blogs.slice(0, 3).map((blog) => `
    <article class="card feature-item">
      <p class="eyebrow">${escapeHtml(blog.category || "Guide")}</p>
      <h3 class="card-title">${escapeHtml(blog.title)}</h3>
      <p class="hero-copy">${escapeHtml(blog.summary)}</p>
      <a class="btn btn-secondary" href="/blog/${encodeURIComponent(blog.slug)}">Read Article</a>
    </article>
  `).join("");
}

function renderAdminAiTools() {
  const wrap = qs("adminAiToolsList");
  if (!wrap) return;
  wrap.innerHTML = state.aiTools.length
    ? state.aiTools.map((tool) => `
      <article class="card blog-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(tool.category)}</p>
            <h3 class="card-title">${escapeHtml(tool.name)}</h3>
          </div>
          ${tool.featured ? `<span class="chip">Featured</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(tool.description)}</p>
        <div class="inline-actions">
          <a class="btn btn-secondary" href="${escapeHtml(tool.url)}" target="_blank" rel="noreferrer">Open Tool</a>
        </div>
        <div class="stack" style="margin-top:12px;">
          <input class="input" id="ai-tool-name-${tool.id}" value="${escapeHtml(tool.name)}">
          <input class="input" id="ai-tool-category-${tool.id}" value="${escapeHtml(tool.category)}">
          <input class="input" id="ai-tool-url-${tool.id}" value="${escapeHtml(tool.url)}">
          <textarea class="textarea" id="ai-tool-description-${tool.id}">${escapeHtml(tool.description)}</textarea>
          <label class="muted"><input id="ai-tool-featured-${tool.id}" type="checkbox" ${tool.featured ? "checked" : ""}> Featured</label>
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-ai-tool="${tool.id}">Save</button>
            <button class="btn btn-danger" type="button" data-delete-ai-tool="${tool.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No AI tools available yet.</div>`;
}

function renderBlogList() {
  const wrap = qs("blogList");
  if (!wrap) return;
  const wrapItems = page === "admin" ? state.blogs.filter((blog) => blog.editable !== false) : state.filteredBlogs;
  const resultsMeta = qs("blogResultsMeta");
  if (resultsMeta) {
    resultsMeta.textContent = wrapItems.length
      ? `Showing ${wrapItems.length} of ${state.blogs.length} blog posts${state.blogQuery ? ` for "${qs("blogSearch")?.value || ""}"` : ""}.`
      : "No matching blog posts. Try another keyword or topic.";
  }

  wrap.innerHTML = wrapItems.length
    ? wrapItems.map((blog, index) => `
      <article class="card blog-card" style="animation-delay:${Math.min(index, 8) * 60}ms;">
        <div class="blog-card-glow"></div>
        <div class="section-head">
          <div>
            <p class="eyebrow">${blog.category || "Guide"}</p>
            <h3 class="card-title">${blog.title}</h3>
          </div>
          <div class="chip-row">
            <span class="chip">${blog.readTime || Math.max(1, Math.ceil((blog.wordCount || stripHtml(blog.content).split(/\s+/).filter(Boolean).length) / 220))} min read</span>
            <span class="chip">${(blog.wordCount || stripHtml(blog.content).split(/\s+/).filter(Boolean).length).toLocaleString("en-IN")} words</span>
          </div>
        </div>
        <p class="muted">${blog.summary}</p>
        <div class="chip-row">
          ${(blog.keywords || []).slice(0, 4).map((keyword) => `<span class="chip">${keyword}</span>`).join("") || `<span class="chip">SEO article</span>`}
        </div>
        <div class="inline-actions">
          <a class="btn btn-primary" href="/blog/${encodeURIComponent(blog.slug)}">Read Full Post</a>
          ${state.session?.isAdmin && blog.editable !== false ? `<button class="btn btn-secondary" type="button" data-edit-blog="${blog.id}">Edit</button>` : ""}
        </div>
        ${state.session?.isAdmin && blog.editable !== false ? `
          <div class="stack hidden" id="blog-edit-${blog.id}">
            <input class="input" id="blog-title-${blog.id}" value="${blog.title}">
            <input class="input" id="blog-category-${blog.id}" value="${blog.category || "Manual"}" placeholder="Category">
            <input class="input" id="blog-summary-${blog.id}" value="${blog.summary}">
            <input class="input" id="blog-keywords-${blog.id}" value="${(blog.keywords || []).join(", ")}" placeholder="Keywords separated by comma">
            <textarea class="textarea" id="blog-meta-${blog.id}" placeholder="SEO meta description">${blog.metaDescription || ""}</textarea>
            <input class="input" id="blog-image-${blog.id}" value="${blog.image || ""}" placeholder="Image URL or data URL">
            <textarea class="textarea" id="blog-content-${blog.id}">${blog.content}</textarea>
            <div class="inline-actions">
              <button class="btn btn-secondary" type="button" data-save-blog="${blog.id}">Save</button>
              <button class="btn btn-danger" type="button" data-delete-blog="${blog.id}">Delete</button>
            </div>
          </div>
        ` : ""}
      </article>
    `).join("")
    : `<div class="empty">No blog posts matched this search. Use the filters above to explore more long-form guides.</div>`;
}

async function loadPost() {
  const slug = getQuery("slug") || window.location.pathname.split("/blog/")[1] || "";
  if (!slug) throw new Error("Missing post slug.");
  const blog = await api(`/blogs/${encodeURIComponent(slug)}`);
  const title = blog.metaTitle || `${blog.title} | Gamers Arena`;
  const metaDescription = blog.metaDescription || blog.summary;
  const plainText = stripHtml(blog.htmlContent || blog.content);
  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description" }, metaDescription);
  upsertMeta('meta[name="keywords"]', { name: "keywords" }, (blog.keywords || []).join(", "));
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, metaDescription);
  upsertMeta('meta[property="og:type"]', { property: "og:type" }, "article");
  upsertMeta('meta[property="og:url"]', { property: "og:url" }, window.location.href);
  if (blog.image) {
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, blog.image);
  }
  upsertStructuredData({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    description: metaDescription,
    image: blog.image || undefined,
    author: {
      "@type": "Organization",
      name: "Gamers Arena"
    },
    publisher: {
      "@type": "Organization",
      name: "Gamers Arena"
    },
    datePublished: blog.createdAt,
    dateModified: blog.updatedAt || blog.createdAt,
    keywords: blog.keywords || [],
    wordCount: blog.wordCount || plainText.split(/\s+/).filter(Boolean).length,
    mainEntityOfPage: window.location.href
  });

  qs("postTitle").textContent = blog.title;
  qs("postSummary").textContent = blog.summary;
  if (qs("postMetaBar")) {
    qs("postMetaBar").innerHTML = `
      <span class="chip">${blog.category || "Guide"}</span>
      <span class="chip">${(blog.wordCount || plainText.split(/\s+/).filter(Boolean).length).toLocaleString("en-IN")} words</span>
      <span class="chip">${blog.readTime || Math.max(1, Math.ceil(plainText.split(/\s+/).filter(Boolean).length / 220))} min read</span>
      <span class="chip">${new Date(blog.updatedAt || blog.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span>
    `;
  }
  if (qs("postKeywordList")) {
    qs("postKeywordList").innerHTML = (blog.keywords || []).slice(0, 8).map((keyword) => `<span class="chip">${keyword}</span>`).join("");
  }
  qs("postContent").innerHTML = blog.htmlContent
    || String(blog.content || "")
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  const image = qs("postImage");
  if (blog.image) {
    image.src = blog.image;
    image.loading = "lazy";
    image.classList.remove("hidden");
  } else {
    image.classList.add("hidden");
  }

  await loadBlogs();
  const relatedWrap = qs("relatedPosts");
  if (relatedWrap) {
    relatedWrap.innerHTML = state.blogs
      .filter((item) => item.slug !== blog.slug)
      .slice(0, 3)
      .map((item) => `
        <article class="card feature-item">
          <p class="eyebrow">${escapeHtml(item.category || "Guide")}</p>
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="hero-copy">${escapeHtml(item.summary)}</p>
          <a class="btn btn-secondary" href="/blog/${encodeURIComponent(item.slug)}">Read Article</a>
        </article>
      `).join("");
  }
}

async function loadAdminOverview() {
  if (!state.session?.isAdmin) return;
  const data = await api("/admin/overview");
  state.admin = data;
  if (qs("adminGamesCount")) qs("adminGamesCount").textContent = String(data.stats.games || 0);
  if (qs("adminConsoleGamesCount")) qs("adminConsoleGamesCount").textContent = String(data.stats.consoleGames || 0);
  if (qs("adminUsersCount")) qs("adminUsersCount").textContent = String(data.stats.users || 0);
  if (qs("adminChatsCount")) qs("adminChatsCount").textContent = String(data.stats.chats || 0);
  if (qs("adminBlogsCount")) qs("adminBlogsCount").textContent = String(data.stats.blogs || 0);
  if (qs("adminAiToolsCount")) qs("adminAiToolsCount").textContent = String(data.stats.aiTools || 0);
  if (qs("adminOrdersCount")) qs("adminOrdersCount").textContent = String(data.stats.orders || 0);
  renderAdminChats();
}

async function loadAdminOrders() {
  if (!state.session?.isAdmin) return [];
  state.orders = await api("/admin/orders");
  renderAdminOrders();
  return state.orders;
}

function renderAdminOrders() {
  const wrap = qs("adminOrdersList");
  if (!wrap) return;
  wrap.innerHTML = state.orders.length
    ? state.orders.map((order) => `
      <article class="card order-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">order</p>
            <h3 class="card-title">${order.orderId}</h3>
          </div>
          <strong class="price">${currency(order.total)}</strong>
        </div>
        <div class="order-meta">
          <span class="chip">${order.customerName || "Customer"}</span>
          <span class="chip">${order.customerContact || "No contact"}</span>
          <span class="chip">${new Date(order.createdAt).toLocaleString("en-IN")}</span>
        </div>
        <p class="hero-copy">${order.paymentNote || "No payment note shared."}</p>
        <div class="chip-row">
          ${(order.items || []).map((item) => `<span class="chip">${item.name}</span>`).join("")}
        </div>
        <div class="inline-actions">
          <a class="btn btn-secondary" href="${telegramMessageLink(`Hello, I am checking order ${order.orderId} for ${order.customerName || "customer"}.`)}" target="_blank" rel="noreferrer">Open Telegram</a>
          ${order.screenshot ? `<a class="btn btn-primary" href="${order.screenshot}" target="_blank" rel="noreferrer">View Screenshot</a>` : `<span class="muted">No screenshot uploaded</span>`}
        </div>
      </article>
    `).join("")
    : `<div class="empty">No orders yet. New checkout orders will appear here automatically.</div>`;
}

async function loadBundles() {
  state.bundles = await api("/bundles");
  renderAdminBundles();
  renderBundleSection();
  return state.bundles;
}

async function loadBundleBySlug() {
  const slug = getQuery("slug") || window.location.pathname.split("/bundle/")[1] || "";
  if (!slug) throw new Error("Bundle not found.");
  state.activeBundle = await api(`/bundles/${encodeURIComponent(slug)}`);
  state.bundleSlide = 0;
  return state.activeBundle;
}

async function loadBundleCandidates(query = "") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", query ? "120" : "60");
  const data = await api(`/games?${params.toString()}`);
  state.bundleCandidates = data.items || [];
  return state.bundleCandidates;
}

function parseBundleGameIds(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBundleSelection() {
  return [...new Set(state.bundleSelection)];
}

function updateBundleSelectionMeta() {
  const selectedIds = getBundleSelection();
  const selectedNames = selectedIds
    .map((id) => state.bundleCandidates.find((game) => game.id === id)?.name || state.games.find((game) => game.id === id)?.name)
    .filter(Boolean)
    .slice(0, 5);
  const meta = qs("bundleGameSelectionMeta");
  if (!meta) return;
  meta.textContent = selectedIds.length
    ? `${selectedIds.length} game${selectedIds.length > 1 ? "s" : ""} selected${selectedNames.length ? `: ${selectedNames.join(", ")}${selectedIds.length > selectedNames.length ? "..." : ""}` : ""}`
    : "Select games with the tick boxes below.";
}

function renderBundleGameChecklist() {
  const wrap = qs("bundleGameChecklist");
  if (!wrap) return;
  const query = String(qs("bundleGameSearch")?.value || "").trim().toLowerCase();
  const selectedIds = new Set(getBundleSelection());
  const games = state.bundleCandidates
    .filter((game) => !query || game.name.toLowerCase().includes(query) || game.category.toLowerCase().includes(query))
    .slice(0, 160);

  wrap.innerHTML = games.length
    ? games.map((game) => `
      <label class="bundle-option">
        <input type="checkbox" data-bundle-pick="${game.id}" ${selectedIds.has(game.id) ? "checked" : ""}>
        <span>
          <strong>${game.name}</strong>
          <small class="muted">${game.category} · ${currency(game.price)}</small>
        </span>
      </label>
    `).join("")
    : `<div class="empty">No games matched that search. Try a different keyword.</div>`;

  updateBundleSelectionMeta();
}

function renderAdminBundles() {
  const wrap = qs("bundleAdminList");
  if (!wrap) return;
  wrap.innerHTML = state.bundles.length
    ? state.bundles.map((bundle) => {
      const gameNames = (bundle.gameIds || [])
        .map((id) => state.games.find((game) => game.id === id)?.name || id)
        .filter(Boolean);
      return `
        <article class="card bundle-editor-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">bundle item</p>
              <h3 class="card-title">${bundle.name}</h3>
            </div>
            <strong class="price">${currency(bundle.price)}</strong>
          </div>
          <div class="chip-row">
            <span class="chip">${(bundle.itemCount || 0).toLocaleString("en-IN")} games</span>
          <a class="btn btn-secondary" href="/bundle/${encodeURIComponent(bundle.slug)}" target="_blank" rel="noreferrer">Open Page</a>
          </div>
          <input class="input" id="bundle-name-${bundle.id}" value="${bundle.name}" placeholder="Bundle name">
          <input class="input" id="bundle-count-${bundle.id}" type="number" value="${bundle.itemCount || 0}" placeholder="How many games are in this bundle">
          <input class="input" id="bundle-price-${bundle.id}" type="number" value="${bundle.price}" placeholder="Bundle price">
          <input class="input" id="bundle-games-${bundle.id}" value="${(bundle.gameIds || []).join(", ")}" placeholder="Game IDs separated by comma">
          <textarea class="textarea" id="bundle-description-${bundle.id}" placeholder="Bundle description">${bundle.description || ""}</textarea>
          <div class="chip-row">
            ${gameNames.length ? gameNames.map((name) => `<span class="chip">${name}</span>`).join("") : `<span class="chip">No linked games yet</span>`}
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-bundle="${bundle.id}">Save Bundle</button>
            <button class="btn btn-danger" type="button" data-delete-bundle="${bundle.id}">Delete</button>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty">No bundles added yet. This section is ready for you whenever you want to launch combos later.</div>`;
}

function renderAdminChats() {
  const list = qs("adminChatList");
  if (!list) return;
  list.innerHTML = state.admin.chats.length
    ? state.admin.chats.map((chat) => `
      <button class="btn btn-secondary chat-list-item ${state.activeChat?.id === chat.id ? "active" : ""}" type="button" data-open-admin-chat="${chat.id}">
        <strong>${chat.userName}</strong><br>
        <span class="muted">${chat.userContact}</span><br>
        <span class="muted">${chat.gameName}</span><br>
        <span class="muted">${chat.unreadForAdmin} unread</span>
      </button>
    `).join("")
    : `<div class="empty">No user chats yet.</div>`;
}

function renderAdminChatThread() {
  if (!state.activeChat) {
    renderMessages([], "adminChatThread");
    return;
  }
  qs("adminChatMeta").textContent = `${state.activeChat.userName} | ${state.activeChat.userContact} | ${state.activeChat.gameName}`;
  renderMessages(state.activeChat.messages || [], "adminChatThread");
}

function renderAdminConsoleGames() {
  const wrap = qs("consoleGamesAdminList");
  if (!wrap) return;
  const items = [...(state.consoleGames?.PS5 || []), ...(state.consoleGames?.PS4 || [])];
  wrap.innerHTML = items.length
    ? items.map((game) => `
      <article class="card console-admin-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(game.platform)}</p>
            <h3 class="card-title">${escapeHtml(game.name)}</h3>
          </div>
          <a class="btn btn-secondary" href="${consoleBuyLink(game)}" target="_blank" rel="noreferrer">Telegram</a>
        </div>
        ${game.image ? `<img class="console-admin-preview" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : ""}
        <div class="stack">
          <input id="console-name-${game.id}" class="input" value="${escapeHtml(game.name)}" placeholder="Game name">
          <select id="console-platform-${game.id}" class="select">
            ${["PS5", "PS4"].map((platform) => `<option value="${platform}" ${game.platform === platform ? "selected" : ""}>${platform}</option>`).join("")}
          </select>
          <input id="console-image-${game.id}" class="input" value="${escapeHtml(game.image || "")}" placeholder="Image URL">
          <input id="console-image-upload-${game.id}" class="input" type="file" accept="image/*">
          <div class="inline-actions">
            <button class="btn btn-secondary" type="button" data-save-console-game="${game.id}">Save</button>
            <button class="btn btn-danger" type="button" data-delete-console-game="${game.id}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No PS4 or PS5 games added yet.</div>`;
}

function renderEditorBlocks(blocks) {
  const wrap = qs("editorBlocks");
  if (!wrap) return;
  wrap.innerHTML = blocks.length
    ? blocks.map((block, index) => `
      <article class="card builder-block">
        <div class="inline-actions">
          <strong>${block.type.toUpperCase()}</strong>
          <button class="btn btn-secondary" type="button" data-move-up="${block.id}">Up</button>
          <button class="btn btn-secondary" type="button" data-move-down="${block.id}">Down</button>
          <button class="btn btn-danger" type="button" data-delete-block="${block.id}">Delete</button>
        </div>
        <textarea class="textarea" id="block-${block.id}" data-block-id="${block.id}" data-block-type="${block.type}">${block.content}</textarea>
      </article>
    `).join("")
    : `<div class="empty">No page builder blocks yet.</div>`;
}

async function initHome() {
  await loadPublicContent();
  applyManagedSections();
  await loadConsoleGames();
  const homePageContent = await loadPageContent("home");
  if (homePageContent?.title && qs("managedHomeTitle")) qs("managedHomeTitle").textContent = homePageContent.title;
  if (homePageContent?.description && qs("managedHomeDescription")) qs("managedHomeDescription").textContent = homePageContent.description;
  if (homePageContent?.buttonLabel && qs("managedHomeButton")) qs("managedHomeButton").textContent = homePageContent.buttonLabel;
  if (homePageContent?.buttonHref && qs("managedHomeButton")) qs("managedHomeButton").setAttribute("href", safeHref(homePageContent.buttonHref, "#storeSection"));
  const initialQuery = getQuery("q") || "";
  const initialCategory = getQuery("category") || "";
  await loadGames({ reset: true, query: initialQuery, category: initialCategory });
  hydrateGameFilters();
  renderGameCards();
  renderConsoleSections();
  renderTrendingGamesRail();
  renderSlidingRows();
  renderBundleSection();
  renderHomeCollectionLoading();
  updateHomeMetrics();
  initRevealAnimations();

  scheduleIdleTask(async () => {
    try {
      renderHomeLayout();
      renderFaqCards("faqPreview", useCompactMode() ? 3 : 4);
      renderReviews("reviewPreview", useCompactMode() ? 4 : 6);
      renderWishlistPreview();
      await loadBlogs();
      await loadAiTools();
      renderHomeBlogPreview();
      renderHomeAiToolsPreview();
      await loadHomeShowcase();
      renderFeaturedSections();
      renderUpcomingPreview();
      updateHomeMetrics();
      initAutoRails();
    } catch (_error) {
      renderHomeLayout();
      renderFaqCards("faqPreview", useCompactMode() ? 3 : 4);
      renderReviews("reviewPreview", useCompactMode() ? 4 : 6);
      renderWishlistPreview();
      renderHomeBlogPreview();
      renderHomeAiToolsPreview();
      renderFeaturedSections();
      renderUpcomingPreview();
    }
  });
}

async function initGamesCatalog() {
  const gamesPageContent = await loadPageContent("games");
  if (gamesPageContent?.title && qs("managedGamesTitle")) qs("managedGamesTitle").textContent = gamesPageContent.title;
  if (gamesPageContent?.description && qs("managedGamesDescription")) qs("managedGamesDescription").textContent = gamesPageContent.description;
  if (gamesPageContent?.buttonLabel && qs("managedGamesButton")) qs("managedGamesButton").textContent = gamesPageContent.buttonLabel;
  if (gamesPageContent?.buttonHref && qs("managedGamesButton")) qs("managedGamesButton").setAttribute("href", safeHref(gamesPageContent.buttonHref, "#gamesSection"));
  const initialQuery = getQuery("q") || "";
  const initialCategory = getQuery("category") || "";
  await loadGames({ reset: true, query: initialQuery, category: initialCategory });
  hydrateGameFilters();
  renderGameCards();
  renderBundleSection();
  renderWishlistPreview();
  renderFaqCards("faqPreview", useCompactMode() ? 3 : 5);
  initRevealAnimations();
}

async function initPcGamesPage() {
  return initGamesCatalog();
}

async function initConsoleCatalogPage(platform, pageKey) {
  const pageContent = await loadPageContent(pageKey);
  if (pageContent?.title && qs("managedConsoleTitle")) qs("managedConsoleTitle").textContent = pageContent.title;
  if (pageContent?.description && qs("managedConsoleDescription")) qs("managedConsoleDescription").textContent = pageContent.description;
  if (pageContent?.buttonLabel && qs("managedConsoleButton")) qs("managedConsoleButton").textContent = pageContent.buttonLabel;
  if (pageContent?.buttonHref && qs("managedConsoleButton")) qs("managedConsoleButton").setAttribute("href", safeHref(pageContent.buttonHref, `/${pageKey}-games`));
  await loadConsoleGames();
  const initialQuery = getQuery("q") || "";
  state.consoleFilters = {
    ...(state.consoleFilters || {}),
    [platform]: initialQuery
  };
  if (qs("consoleSearch")) qs("consoleSearch").value = initialQuery;
  bindConsoleCatalogFilters(platform);
  await loadBlogs();
  const relatedWrap = qs("relatedBlogCards");
  if (relatedWrap) {
    relatedWrap.innerHTML = state.blogs.slice(0, 3).map((blog) => `
      <article class="card feature-item">
        <p class="eyebrow">${escapeHtml(blog.category || "Guide")}</p>
        <h3 class="card-title">${escapeHtml(blog.title)}</h3>
        <p class="hero-copy">${escapeHtml(blog.summary)}</p>
        <a class="btn btn-secondary" href="/blog/${encodeURIComponent(blog.slug)}">Read Guide</a>
      </article>
    `).join("");
  }
}

async function initDealsPage() {
  const dealsContent = await loadPageContent("deals");
  if (dealsContent?.title && qs("managedDealsTitle")) qs("managedDealsTitle").textContent = dealsContent.title;
  if (dealsContent?.description && qs("managedDealsDescription")) qs("managedDealsDescription").textContent = dealsContent.description;
  await Promise.all([loadGames({ reset: true }), loadBundles(), loadBlogs()]);
  const dealWrap = qs("dealsList");
  if (dealWrap) {
    const bundles = state.bundles.slice(0, 4).map((bundle) => ({
      type: "bundle",
      name: bundle.name,
      description: bundle.description,
      price: bundle.price,
      href: `/bundle/${encodeURIComponent(bundle.slug)}`,
      badge: `${bundle.itemCount} games`
    }));
    const games = state.games.filter((game) => game.category !== "Upcoming").slice(0, 8).map((game) => ({
      type: "game",
      name: game.name,
      description: game.description,
      price: game.price,
      href: `/pc-games?q=${encodeURIComponent(game.name)}`,
      badge: game.category
    }));
    dealWrap.innerHTML = [...bundles, ...games].map((item, index) => `
      <article class="card blog-card" style="animation-delay:${Math.min(index, 10) * 50}ms;">
        <div class="blog-card-glow"></div>
        <p class="eyebrow">${escapeHtml(item.badge)}</p>
        <h3 class="card-title">${escapeHtml(item.name)}</h3>
        <p class="muted">${escapeHtml(item.description)}</p>
        <div class="inline-actions">
          <a class="btn btn-primary" href="${item.href}">${item.type === "bundle" ? "Open Bundle" : "View Deal"}</a>
          <span class="chip">${currency(item.price)}</span>
        </div>
      </article>
    `).join("");
  }
  const relatedWrap = qs("dealsRelatedLinks");
  if (relatedWrap) {
    relatedWrap.innerHTML = `
      <a class="btn btn-secondary" href="/pc-games">Explore PC Games</a>
      <a class="btn btn-secondary" href="/ps5-games">Browse PS5 Deals</a>
      <a class="btn btn-secondary" href="/blog">Read Buying Guides</a>
      <a class="btn btn-secondary" href="/ai-tools">Open AI Tools</a>
    `;
  }
}

async function initAiTools() {
  const aiToolsContent = await loadPageContent("aiTools");
  if (aiToolsContent?.title && qs("managedAiToolsTitle")) qs("managedAiToolsTitle").textContent = aiToolsContent.title;
  if (aiToolsContent?.description && qs("managedAiToolsDescription")) qs("managedAiToolsDescription").textContent = aiToolsContent.description;
  await loadAiTools();
  hydrateAiToolFilters();
  renderAiToolGrid();
}

async function initManagedPage() {
  const slug = window.location.pathname.split("/pages/")[1] || "";
  if (!slug) throw new Error("Page not found.");
  const data = await api(`/api/content/pages/${encodeURIComponent(slug)}`);
  const title = qs("managedPageTitle");
  const subtitle = qs("managedPageSummary");
  const body = qs("managedPageBody");
  const image = qs("managedPageImage");
  if (title) title.textContent = data.title || "Custom Page";
  if (subtitle) subtitle.textContent = data.summary || "";
  if (body) body.innerHTML = data.content || "<p>No content added yet.</p>";
  if (image) {
    if (data.heroImage) {
      image.src = data.heroImage;
      image.classList.remove("hidden");
    } else {
      image.classList.add("hidden");
    }
  }
}

async function initCart() {
  const cartPageContent = await loadPageContent("cart");
  if (cartPageContent?.title && qs("managedCartTitle")) qs("managedCartTitle").textContent = cartPageContent.title;
  if (cartPageContent?.description && qs("managedCartDescription")) qs("managedCartDescription").textContent = cartPageContent.description;
  if (cartPageContent?.buttonLabel && qs("goCheckoutBtn")) qs("goCheckoutBtn").textContent = cartPageContent.buttonLabel;
    if (!state.cartLoaded) await refreshCart();
    renderCartPage();
  }

async function initCheckout() {
  if (!state.cartLoaded) await refreshCart();
  renderCheckoutPage();
}

async function initBundle() {
  await loadBundleBySlug();
  renderBundlePage();
}

async function initBundlesPage() {
  await loadBundles();
  renderBundleCatalogPage();
  initAutoRails();
}

async function initChat() {
  const orderGames = localStorage.getItem("ga-last-paid-game") || "my order";
  const orderId = localStorage.getItem("ga-last-order-id") || "";
  const supportLink = qs("telegramSupportLink");
  const queryLink = qs("telegramQueryLink");
  const orderLink = qs("telegramOrderLink");
  const orderInfo = qs("supportOrderInfo");
  if (supportLink) supportLink.href = TELEGRAM_URL;
  if (queryLink) queryLink.href = telegramMessageLink("Hello, I have a question about Gamers Arena.");
  if (orderLink) orderLink.href = telegramMessageLink(`Hello, I need support for ${orderGames}${orderId ? ` | Order ID: ${orderId}` : ""}. I will share my payment screenshot here.`);
  if (orderInfo) orderInfo.textContent = orderId ? `Latest order: ${orderId} | Games: ${orderGames}` : `Latest games: ${orderGames}`;
}

async function initLogin() {
  if (state.session) {
    qs("loginStatus").textContent = `You are already logged in as ${state.session.name}.`;
  }
}

async function initAdmin() {
  if (!state.session?.isAdmin) {
    qs("adminGate").classList.remove("hidden");
    qs("adminApp").classList.add("hidden");
    return;
  }
  qs("adminGate").classList.add("hidden");
  qs("adminApp").classList.remove("hidden");
  await Promise.all([
    loadGames({ reset: true }),
    loadConsoleGames(),
    loadBlogs(),
    loadAiTools(),
    loadBundles(),
    loadAdminOrders(),
    loadAdminOverview(),
    loadBundleCandidates()
  ]);
  await loadAdminContent();
  hydrateGameFilters();
  renderGameCards();
  renderAdminConsoleGames();
  renderBlogList();
  renderAdminAiTools();
  renderAdminBundles();
  renderBundleGameChecklist();
  renderEditorBlocks(state.settings.homeLayout || []);
  if (qs("siteTitleInput")) qs("siteTitleInput").value = state.settings.siteTitle || "Gamers Arena";
  if (qs("siteTaglineInput")) qs("siteTaglineInput").value = state.settings.siteTagline || "";
  if (qs("siteDescriptionInput")) qs("siteDescriptionInput").value = state.settings.siteDescription || "";
  if (qs("logoUrlInput")) qs("logoUrlInput").value = state.settings.logoUrl || "";
  if (qs("faviconUrlInput")) qs("faviconUrlInput").value = state.settings.faviconUrl || "";
  const adminEmailInput = qs("adminEmailInput");
  if (adminEmailInput) {
    adminEmailInput.value = state.settings.adminEmail || state.session.contact || "admin@gamersarena.com";
    adminEmailInput.disabled = Boolean(state.settings.adminEmailManagedByEnv);
  }
  const adminPasswordInput = qs("adminPasswordInput");
  if (adminPasswordInput) {
    adminPasswordInput.disabled = Boolean(state.settings.adminPasswordManagedByEnv);
    adminPasswordInput.placeholder = state.settings.adminPasswordManagedByEnv
      ? "Managed by Render environment variables"
      : "New first admin password (leave blank to keep current)";
  }
  const adminSecondaryPasswordInput = qs("adminSecondaryPasswordInput");
  if (adminSecondaryPasswordInput) {
    adminSecondaryPasswordInput.disabled = Boolean(state.settings.adminSecondaryManagedByEnv);
    adminSecondaryPasswordInput.placeholder = state.settings.adminSecondaryManagedByEnv
      ? "Managed by Render environment variables"
      : "New second admin password (leave blank to keep current)";
  }
  const credentialsHint = qs("credentialsHint");
  if (credentialsHint) {
    credentialsHint.textContent = state.settings.credentialsManagedByEnv
      ? "Admin login credentials are managed by deployment environment variables on this server."
      : "Admin login uses two passwords. If you get locked out, use the admin Forgot Password flow and verify both recovery birthdays before resetting access.";
  }
  const qrPreview = qs("qrPreview");
  if (qrPreview) qrPreview.src = state.settings.qrImage;
  if (qs("businessNameInput")) qs("businessNameInput").value = state.settings.business?.name || "";
  if (qs("businessPhoneInput")) qs("businessPhoneInput").value = state.settings.business?.phone || "";
  if (qs("businessEmailInput")) qs("businessEmailInput").value = state.settings.business?.email || "";
  if (qs("businessAddressInput")) qs("businessAddressInput").value = state.settings.business?.addressLine1 || "";
  if (qs("businessCityInput")) qs("businessCityInput").value = state.settings.business?.city || "";
  if (qs("businessStateInput")) qs("businessStateInput").value = state.settings.business?.state || "";
  if (qs("instagramUrlInput")) qs("instagramUrlInput").value = state.settings.socialLinks?.instagram || "";
  if (qs("facebookUrlInput")) qs("facebookUrlInput").value = state.settings.socialLinks?.facebook || "";
  if (qs("youtubeUrlInput")) qs("youtubeUrlInput").value = state.settings.socialLinks?.youtube || "";
  if (qs("twitterUrlInput")) qs("twitterUrlInput").value = state.settings.socialLinks?.twitter || "";
  if (qs("linkedinUrlInput")) qs("linkedinUrlInput").value = state.settings.socialLinks?.linkedin || "";
  if (qs("telegramUrlInput")) qs("telegramUrlInput").value = state.settings.socialLinks?.telegram || "";
  if (qs("googleAnalyticsIdInput")) qs("googleAnalyticsIdInput").value = state.settings.analytics?.googleAnalyticsId || "";
  if (qs("facebookPixelIdInput")) qs("facebookPixelIdInput").value = state.settings.analytics?.facebookPixelId || "";
  if (qs("spfRecordInput")) qs("spfRecordInput").value = state.settings.emailAuthentication?.spfRecord || "";
  if (qs("dmarcRecordInput")) qs("dmarcRecordInput").value = state.settings.emailAuthentication?.dmarcRecord || "";
  connectSocket();
}

async function initBlog() {
  await loadBlogs();
  hydrateBlogFilters();
  applyBlogFilters();
  renderBlogList();
}

async function initFaq() {
  renderFaqCards("faqList");
}

async function initReviews() {
  renderReviews("reviewsList");
  initAutoRails();
}

async function initWishlist() {
  await loadBundles();
  renderWishlistPage();
}

async function initEditor() {
  if (!state.session?.isAdmin) {
    qs("editorGate").classList.remove("hidden");
    qs("editorApp").classList.add("hidden");
    return;
  }
  qs("editorGate").classList.add("hidden");
  qs("editorApp").classList.remove("hidden");
  const blocks = await api("/editor-layout");
  renderEditorBlocks(blocks);
}

document.addEventListener("click", async (event) => {
  if (!event.target.closest(".search-suggestions-shell")) {
    qs("searchSuggestions")?.classList.add("hidden");
  }

  const suggestion = event.target.closest("[data-suggestion-type]");
  if (suggestion) {
    const type = suggestion.dataset.suggestionType;
    const name = suggestion.dataset.suggestionName || "";
    const slug = suggestion.dataset.suggestionSlug || "";
    const platform = suggestion.dataset.suggestionPlatform || "";
    if (type === "bundle" && slug) {
    window.location.href = `/bundle/${encodeURIComponent(slug)}`;
      return;
    }
    if (type === "console" && platform) {
      window.location.href = `${getConsoleCatalogPath(platform)}?q=${encodeURIComponent(name)}`;
      return;
    }
    const searchInput = qs("gameSearch");
    if (searchInput) {
      searchInput.value = name;
      state.suggestedItems = [];
      renderSearchSuggestions();
      await applyGameFilters();
      searchInput.focus();
      return;
    }
  }

  const addCart = event.target.closest("[data-add-cart]");
  if (addCart) {
    try {
      await api(`${CART_API_BASE}/items`, {
        method: "POST",
        body: JSON.stringify({ gameId: addCart.dataset.addCart })
      });
      await refreshCart();
      setStatus("homeStatus", "Game added to cart.");
    } catch (error) {
      setStatus("homeStatus", error.message, true);
    }
  }

  const addBundle = event.target.closest("[data-add-bundle]");
  if (addBundle) {
    try {
      await api(`${CART_API_BASE}/bundles`, {
        method: "POST",
        body: JSON.stringify({ bundleId: addBundle.dataset.addBundle })
      });
      await refreshCart();
      setStatus("homeStatus", "Bundle added to cart.");
      setStatus("bundleStatus", "Bundle added to cart.");
    } catch (error) {
      setStatus("homeStatus", error.message, true);
      setStatus("bundleStatus", error.message, true);
    }
  }

  const addBundleBySlug = event.target.closest("[data-add-bundle-by-slug]");
  if (addBundleBySlug) {
    try {
      const bundle = state.bundles.find((item) => item.slug === addBundleBySlug.dataset.addBundleBySlug);
      if (!bundle) throw new Error("Bundle not found.");
      await api(`${CART_API_BASE}/bundles`, {
        method: "POST",
        body: JSON.stringify({ bundleId: bundle.id })
      });
      await refreshCart();
      setStatus("wishlistStatus", "Bundle added to cart.");
    } catch (error) {
      setStatus("wishlistStatus", error.message, true);
    }
  }

  const saveItem = event.target.closest("[data-save-item]");
  if (saveItem) {
    toggleWishlist({
      type: saveItem.dataset.saveItem,
      key: saveItem.dataset.saveKey,
      name: saveItem.dataset.saveName,
      price: Number(saveItem.dataset.savePrice || 0),
      category: saveItem.dataset.saveCategory || "",
      itemCount: Number(saveItem.dataset.saveCount || 0)
    });
    setStatus("homeStatus", "Wishlist updated.");
    setStatus("bundleStatus", "Wishlist updated.");
    setStatus("wishlistStatus", "Wishlist updated.");
  }

  const removeWishlist = event.target.closest("[data-remove-wishlist]");
  if (removeWishlist) {
    writeWishlist(state.wishlist.filter((item) => !(item.type === removeWishlist.dataset.removeWishlist && item.key === removeWishlist.dataset.removeKey)));
    renderWishlistPreview();
    renderWishlistPage();
  }

  const setUpcomingFilter = event.target.closest("[data-set-upcoming-filter]");
  if (setUpcomingFilter) {
    const categorySelect = qs("gameCategory");
    if (categorySelect) {
      categorySelect.value = setUpcomingFilter.dataset.setUpcomingFilter;
      await applyGameFilters();
      categorySelect.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const quickSearch = event.target.closest("[data-quick-search]");
  if (quickSearch) {
    const searchInput = qs("gameSearch");
    if (searchInput) {
      searchInput.value = quickSearch.dataset.quickSearch;
      await applyGameFilters();
      searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.location.href = `/?q=${encodeURIComponent(quickSearch.dataset.quickSearch || "")}`;
    }
  }

  const homeCategory = event.target.closest("[data-home-category]");
  if (homeCategory) {
    const categorySelect = qs("gameCategory");
    if (categorySelect) {
      categorySelect.value = homeCategory.dataset.homeCategory || "";
      await applyGameFilters();
      qs("gamesGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const sliderDot = event.target.closest("[data-bundle-slide]");
  if (sliderDot) {
    state.bundleSlide = Number(sliderDot.dataset.bundleSlide || 0);
    updateBundleSlider();
  }

  const removeCart = event.target.closest("[data-remove-cart]");
  if (removeCart) {
    await api(`${CART_API_BASE}/items/${removeCart.dataset.removeCart}`, { method: "DELETE" });
    await refreshCart();
    renderCartPage();
    renderCheckoutPage();
  }

  const editGame = event.target.closest("[data-edit-game]");
  if (editGame) {
    qs(`edit-${editGame.dataset.editGame}`)?.classList.toggle("hidden");
  }

  const saveGame = event.target.closest("[data-save-game]");
  if (saveGame) {
    try {
      await api(`/games/${saveGame.dataset.saveGame}`, {
        method: "PUT",
        body: JSON.stringify({
          name: qs(`name-${saveGame.dataset.saveGame}`).value,
          category: qs(`category-${saveGame.dataset.saveGame}`).value,
          price: Number(qs(`price-${saveGame.dataset.saveGame}`).value || 45),
          image: qs(`image-${saveGame.dataset.saveGame}`).value,
          description: qs(`description-${saveGame.dataset.saveGame}`).value
        })
      });
      await applyGameFilters();
      setStatus("adminGamesStatus", "Game updated.");
    } catch (error) {
      setStatus("adminGamesStatus", error.message, true);
    }
  }

  const deleteGame = event.target.closest("[data-delete-game]");
  if (deleteGame) {
    try {
      await api(`/games/${deleteGame.dataset.deleteGame}`, { method: "DELETE" });
      await applyGameFilters();
      setStatus("adminGamesStatus", "Game deleted.");
    } catch (error) {
      setStatus("adminGamesStatus", error.message, true);
    }
  }

  const saveConsoleGame = event.target.closest("[data-save-console-game]");
  if (saveConsoleGame) {
    try {
      const consoleImageUpload = await fileInputToDataUrl(qs(`console-image-upload-${saveConsoleGame.dataset.saveConsoleGame}`));
      await api(`/console-games/${saveConsoleGame.dataset.saveConsoleGame}`, {
        method: "PUT",
        body: JSON.stringify({
          name: qs(`console-name-${saveConsoleGame.dataset.saveConsoleGame}`).value,
          platform: qs(`console-platform-${saveConsoleGame.dataset.saveConsoleGame}`).value,
          image: consoleImageUpload || qs(`console-image-${saveConsoleGame.dataset.saveConsoleGame}`).value
        })
      });
      await loadConsoleGames();
      renderConsoleSections();
      renderAdminConsoleGames();
      await loadAdminOverview();
      setStatus("adminConsoleGamesStatus", "Console game updated.");
    } catch (error) {
      setStatus("adminConsoleGamesStatus", error.message, true);
    }
  }

  const deleteConsoleGame = event.target.closest("[data-delete-console-game]");
  if (deleteConsoleGame) {
    try {
      await api(`/console-games/${deleteConsoleGame.dataset.deleteConsoleGame}`, { method: "DELETE" });
      await loadConsoleGames();
      renderConsoleSections();
      renderAdminConsoleGames();
      await loadAdminOverview();
      setStatus("adminConsoleGamesStatus", "Console game deleted.");
    } catch (error) {
      setStatus("adminConsoleGamesStatus", error.message, true);
    }
  }

  const saveSection = event.target.closest("[data-save-section]");
  if (saveSection) {
    try {
      await api(`/api/content/sections/${saveSection.dataset.saveSection}`, {
        method: "PUT",
        body: JSON.stringify({
          item: {
            key: qs(`section-key-${saveSection.dataset.saveSection}`).value,
            subtitle: qs(`section-subtitle-${saveSection.dataset.saveSection}`).value,
            title: qs(`section-title-${saveSection.dataset.saveSection}`).value,
            body: qs(`section-body-${saveSection.dataset.saveSection}`).value,
            buttonLabel: qs(`section-button-label-${saveSection.dataset.saveSection}`).value,
            buttonHref: qs(`section-button-href-${saveSection.dataset.saveSection}`).value,
            image: qs(`section-image-${saveSection.dataset.saveSection}`).value
          }
        })
      });
      await loadAdminContent();
      await loadPublicContent();
      applyManagedSections();
      setStatus("contentStatus", "Content section updated.");
    } catch (error) {
      setStatus("contentStatus", error.message, true);
    }
  }

  const deleteSection = event.target.closest("[data-delete-section]");
  if (deleteSection) {
    try {
      await api(`/api/content/sections/${deleteSection.dataset.deleteSection}`, { method: "DELETE" });
      await loadAdminContent();
      await loadPublicContent();
      applyManagedSections();
      setStatus("contentStatus", "Content section deleted.");
    } catch (error) {
      setStatus("contentStatus", error.message, true);
    }
  }

  const savePageContent = event.target.closest("[data-save-page-content]");
  if (savePageContent) {
    try {
      const pageKey = savePageContent.dataset.savePageContent;
      await api(`/api/content/${encodeURIComponent(pageKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          content: {
            title: qs(`page-content-title-${pageKey}`).value,
            description: qs(`page-content-description-${pageKey}`).value,
            buttonLabel: qs(`page-content-button-label-${pageKey}`).value,
            buttonHref: qs(`page-content-button-href-${pageKey}`).value,
            heroImage: qs(`page-content-hero-${pageKey}`).value
          }
        })
      });
      await loadAdminContent();
      if (page === "home" || page === "games" || page === "cart") await loadPublicContent();
      setStatus("contentStatus", `${pageKey} page content updated.`);
    } catch (error) {
      setStatus("contentStatus", error.message, true);
    }
  }

  const savePage = event.target.closest("[data-save-page]");
  if (savePage) {
    try {
      await api(`/api/content/pages/${savePage.dataset.savePage}`, {
        method: "PUT",
        body: JSON.stringify({
          item: {
            title: qs(`page-title-${savePage.dataset.savePage}`).value,
            slug: qs(`page-slug-${savePage.dataset.savePage}`).value,
            summary: qs(`page-summary-${savePage.dataset.savePage}`).value,
            heroImage: qs(`page-image-${savePage.dataset.savePage}`).value,
            seoTitle: qs(`page-seo-title-${savePage.dataset.savePage}`).value,
            seoDescription: qs(`page-seo-description-${savePage.dataset.savePage}`).value,
            content: qs(`page-content-${savePage.dataset.savePage}`).value
          }
        })
      });
      await loadAdminContent();
      setStatus("pagesStatus", "Page updated.");
    } catch (error) {
      setStatus("pagesStatus", error.message, true);
    }
  }

  const deletePage = event.target.closest("[data-delete-page]");
  if (deletePage) {
    try {
      await api(`/api/content/pages/${deletePage.dataset.deletePage}`, { method: "DELETE" });
      await loadAdminContent();
      setStatus("pagesStatus", "Page deleted.");
    } catch (error) {
      setStatus("pagesStatus", error.message, true);
    }
  }

  const saveMedia = event.target.closest("[data-save-media]");
  if (saveMedia) {
    try {
      await api(`/api/content/media/${saveMedia.dataset.saveMedia}`, {
        method: "PUT",
        body: JSON.stringify({
          item: {
            name: qs(`media-name-${saveMedia.dataset.saveMedia}`).value,
            url: qs(`media-url-${saveMedia.dataset.saveMedia}`).value,
            alt: qs(`media-alt-${saveMedia.dataset.saveMedia}`).value,
            placement: qs(`media-placement-${saveMedia.dataset.saveMedia}`).value
          }
        })
      });
      await loadAdminContent();
      setStatus("mediaStatus", "Media updated.");
    } catch (error) {
      setStatus("mediaStatus", error.message, true);
    }
  }

  const deleteMedia = event.target.closest("[data-delete-media]");
  if (deleteMedia) {
    try {
      await api(`/api/content/media/${deleteMedia.dataset.deleteMedia}`, { method: "DELETE" });
      await loadAdminContent();
      setStatus("mediaStatus", "Media deleted.");
    } catch (error) {
      setStatus("mediaStatus", error.message, true);
    }
  }

  const editBlog = event.target.closest("[data-edit-blog]");
  if (editBlog) {
    qs(`blog-edit-${editBlog.dataset.editBlog}`)?.classList.toggle("hidden");
  }

  const saveBlog = event.target.closest("[data-save-blog]");
  if (saveBlog) {
    try {
      await api(`/blogs/${saveBlog.dataset.saveBlog}`, {
        method: "PUT",
        body: JSON.stringify({
          title: qs(`blog-title-${saveBlog.dataset.saveBlog}`).value,
          category: qs(`blog-category-${saveBlog.dataset.saveBlog}`).value,
          summary: qs(`blog-summary-${saveBlog.dataset.saveBlog}`).value,
          keywords: qs(`blog-keywords-${saveBlog.dataset.saveBlog}`).value,
          metaDescription: qs(`blog-meta-${saveBlog.dataset.saveBlog}`).value,
          image: qs(`blog-image-${saveBlog.dataset.saveBlog}`).value,
          content: qs(`blog-content-${saveBlog.dataset.saveBlog}`).value
        })
      });
      await loadBlogs();
      renderBlogList();
      await loadAdminOverview();
      setStatus("adminBlogsStatus", "Blog updated.");
    } catch (error) {
      setStatus("adminBlogsStatus", error.message, true);
    }
  }

  const deleteBlog = event.target.closest("[data-delete-blog]");
  if (deleteBlog) {
    try {
      await api(`/blogs/${deleteBlog.dataset.deleteBlog}`, { method: "DELETE" });
      await loadBlogs();
      renderBlogList();
      await loadAdminOverview();
      setStatus("adminBlogsStatus", "Blog deleted.");
    } catch (error) {
      setStatus("adminBlogsStatus", error.message, true);
    }
  }

  const saveAiTool = event.target.closest("[data-save-ai-tool]");
  if (saveAiTool) {
    try {
      await api(`/api/ai-tools/${saveAiTool.dataset.saveAiTool}`, {
        method: "PUT",
        body: JSON.stringify({
          name: qs(`ai-tool-name-${saveAiTool.dataset.saveAiTool}`).value,
          category: qs(`ai-tool-category-${saveAiTool.dataset.saveAiTool}`).value,
          url: qs(`ai-tool-url-${saveAiTool.dataset.saveAiTool}`).value,
          description: qs(`ai-tool-description-${saveAiTool.dataset.saveAiTool}`).value,
          featured: Boolean(qs(`ai-tool-featured-${saveAiTool.dataset.saveAiTool}`)?.checked)
        })
      });
      await loadAiTools();
      renderAdminAiTools();
      renderAiToolGrid();
      await loadAdminOverview();
      setStatus("adminAiToolsStatus", "AI tool updated.");
    } catch (error) {
      setStatus("adminAiToolsStatus", error.message, true);
    }
  }

  const deleteAiTool = event.target.closest("[data-delete-ai-tool]");
  if (deleteAiTool) {
    try {
      await api(`/api/ai-tools/${deleteAiTool.dataset.deleteAiTool}`, { method: "DELETE" });
      await loadAiTools();
      renderAdminAiTools();
      renderAiToolGrid();
      await loadAdminOverview();
      setStatus("adminAiToolsStatus", "AI tool deleted.");
    } catch (error) {
      setStatus("adminAiToolsStatus", error.message, true);
    }
  }

  const openAdminChat = event.target.closest("[data-open-admin-chat]");
  if (openAdminChat) {
    state.activeChat = await api(`/admin/chats/${openAdminChat.dataset.openAdminChat}`);
    renderAdminChats();
    renderAdminChatThread();
    connectSocket();
    state.socket?.emit("admin:join-chat", state.activeChat.id);
  }

  const saveBundle = event.target.closest("[data-save-bundle]");
  if (saveBundle) {
    try {
      await api(`/bundles/${saveBundle.dataset.saveBundle}`, {
        method: "PUT",
        body: JSON.stringify({
          name: qs(`bundle-name-${saveBundle.dataset.saveBundle}`).value,
          itemCount: Number(qs(`bundle-count-${saveBundle.dataset.saveBundle}`).value || 0),
          price: Number(qs(`bundle-price-${saveBundle.dataset.saveBundle}`).value || 45),
          gameIds: parseBundleGameIds(qs(`bundle-games-${saveBundle.dataset.saveBundle}`).value),
          description: qs(`bundle-description-${saveBundle.dataset.saveBundle}`).value
        })
      });
      await loadBundles();
      setStatus("adminBundlesStatus", "Bundle updated.");
    } catch (error) {
      setStatus("adminBundlesStatus", error.message, true);
    }
  }

  const deleteBundle = event.target.closest("[data-delete-bundle]");
  if (deleteBundle) {
    try {
      await api(`/bundles/${deleteBundle.dataset.deleteBundle}`, { method: "DELETE" });
      await loadBundles();
      setStatus("adminBundlesStatus", "Bundle deleted.");
    } catch (error) {
      setStatus("adminBundlesStatus", error.message, true);
    }
  }

  const bundlePick = event.target.closest("[data-bundle-pick]");
  if (bundlePick) {
    const value = bundlePick.dataset.bundlePick;
    if (bundlePick.checked) {
      state.bundleSelection = [...new Set([...state.bundleSelection, value])];
    } else {
      state.bundleSelection = state.bundleSelection.filter((id) => id !== value);
    }
    updateBundleSelectionMeta();
  }

  const moveUp = event.target.closest("[data-move-up]");
  const moveDown = event.target.closest("[data-move-down]");
  const deleteBlock = event.target.closest("[data-delete-block]");
  if (moveUp || moveDown || deleteBlock) {
    const current = await api("/editor-layout");
    let blocks = [...current];
    const id = moveUp?.dataset.moveUp || moveDown?.dataset.moveDown || deleteBlock?.dataset.deleteBlock;
    const index = blocks.findIndex((block) => block.id === id);
    if (index === -1) return;
    if (moveUp && index > 0) [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
    if (moveDown && index < blocks.length - 1) [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]];
    if (deleteBlock) blocks = blocks.filter((block) => block.id !== id);
    renderEditorBlocks(blocks);
  }

  if (event.target.id === "toggleForgotPassword") {
    const form = qs("resetPasswordForm");
    const isHidden = form?.classList.contains("hidden");
    form?.classList.toggle("hidden", !isHidden);
    event.target.textContent = isHidden ? "Hide Reset Form" : "Forgot Password?";
    setStatus("resetStatus", "");
    if (isHidden) {
      const loginContactValue = qs("loginContact")?.value?.trim() || "";
      if (qs("resetContact") && loginContactValue) qs("resetContact").value = loginContactValue;
      qs("resetName")?.focus();
    }
  }

  if (event.target.id === "adminQuickForgot") {
    qs("adminQuickLoginForm")?.classList.add("hidden");
    qs("adminRecoveryForm")?.classList.remove("hidden");
    qs("adminQuickForgot")?.classList.add("hidden");
    qs("adminQuickBack")?.classList.remove("hidden");
    setStatus("adminQuickStatus", "");
    setStatus("adminRecoveryStatus", "");
    qs("adminRecoveryDob1")?.focus();
  }

  if (event.target.id === "adminQuickBack") {
    resetAdminAccessModal();
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id === "userSignupForm") {
    event.preventDefault();
    try {
      await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: qs("signupName").value,
          contact: qs("signupContact").value,
          password: qs("signupPassword").value
        })
      });
      window.location.href = "/";
    } catch (error) {
      setStatus("loginStatus", error.message, true);
    }
  }

  if (event.target.id === "userLoginForm") {
    event.preventDefault();
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          contact: qs("loginContact").value,
          password: qs("loginPassword").value,
          role: "user"
        })
      });
      window.location.href = getQuery("redirect") || "/";
    } catch (error) {
      setStatus("loginStatus", error.message, true);
    }
  }

  if (event.target.id === "resetPasswordForm") {
    event.preventDefault();
    if (qs("resetPassword").value !== qs("resetPasswordConfirm").value) {
      setStatus("resetStatus", "New password and confirm password must match.", true);
      return;
    }
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          name: qs("resetName").value,
          contact: qs("resetContact").value,
          password: qs("resetPassword").value
        })
      });
      if (qs("loginContact")) qs("loginContact").value = qs("resetContact").value.trim();
      if (qs("loginPassword")) qs("loginPassword").value = qs("resetPassword").value;
      setStatus("resetStatus", "Password updated. You are now logged in.");
      window.location.href = getQuery("redirect") || "/";
    } catch (error) {
      setStatus("resetStatus", error.message, true);
    }
  }

  if (event.target.id === "adminLoginForm") {
    event.preventDefault();
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          contact: qs("adminLoginEmail").value,
          password: qs("adminLoginPassword").value,
          adminPasscode: qs("adminLoginPasscode")?.value || "",
          role: "admin"
        })
      });
      window.location.href = "/admin.html";
    } catch (error) {
      setStatus("loginStatus", error.message, true);
    }
  }

  if (event.target.id === "adminQuickLoginForm") {
    event.preventDefault();
    const form = event.target;
    const stage = form.dataset.stage || "primary";
    if (stage === "primary") {
      if (!qs("adminQuickEmail").value.trim() || !qs("adminQuickPassword").value.trim()) {
        setStatus("adminQuickStatus", "Enter admin email and password first.", true);
        return;
      }
      try {
        await api("/auth/admin/primary", {
          method: "POST",
          body: JSON.stringify({
            contact: qs("adminQuickEmail").value,
            password: qs("adminQuickPassword").value
          })
        });
        qs("adminQuickSecondWrap")?.classList.remove("hidden");
        form.dataset.stage = "secondary";
        if (qs("adminQuickSubmit")) qs("adminQuickSubmit").textContent = "Login As Admin";
        setStatus("adminQuickStatus", "First password verified. Enter the second admin password.");
        qs("adminQuickPasscode")?.focus();
      } catch (error) {
        setStatus("adminQuickStatus", error.message, true);
      }
      return;
    }

    try {
      await api("/auth/admin/secondary", {
        method: "POST",
        body: JSON.stringify({
          contact: qs("adminQuickEmail").value,
          adminPasscode: qs("adminQuickPasscode").value
        })
      });
      window.location.href = "/admin.html";
    } catch (error) {
      setStatus("adminQuickStatus", error.message, true);
    }
  }

  if (event.target.id === "adminRecoveryForm") {
    event.preventDefault();
    const form = event.target;
    const stage = form.dataset.stage || "verify";
    if (stage === "verify") {
      try {
        await api("/auth/admin/recovery", {
          method: "POST",
          body: JSON.stringify({
            dob1: qs("adminRecoveryDob1").value,
            dob2: qs("adminRecoveryDob2").value
          })
        });
        form.dataset.stage = "reset";
        qs("adminRecoveryResetWrap")?.classList.remove("hidden");
        if (qs("adminRecoverySubmit")) qs("adminRecoverySubmit").textContent = "Reset And Login";
        setStatus("adminRecoveryStatus", "Birthdays verified. Set new admin passwords now.");
        qs("adminRecoveryPassword")?.focus();
      } catch (error) {
        setStatus("adminRecoveryStatus", error.message, true);
      }
      return;
    }

    if (!qs("adminRecoveryPassword").value.trim() || !qs("adminRecoveryPasscode").value.trim()) {
      setStatus("adminRecoveryStatus", "Enter both new admin passwords.", true);
      return;
    }

    try {
      await api("/auth/admin/reset", {
        method: "POST",
        body: JSON.stringify({
          password: qs("adminRecoveryPassword").value,
          adminPasscode: qs("adminRecoveryPasscode").value
        })
      });
      window.location.href = "/admin.html";
    } catch (error) {
      setStatus("adminRecoveryStatus", error.message, true);
    }
  }

  if (event.target.id === "chatSendForm") {
    event.preventDefault();
    if (!state.socket) return;
    const text = qs("chatMessage").value.trim();
    const [file] = qs("chatFile").files || [];
    const fileData = file ? await readFileAsDataUrl(file) : "";
    if (!text && !fileData) return;
    state.socket.emit("chat:user-send", {
      gameName: qs("chatGameName").value.trim(),
      text,
      file: fileData,
      fileType: file?.type || ""
    });
    event.target.reset();
    if (qs("chatGameName")) qs("chatGameName").value = state.activeChat?.gameName || localStorage.getItem("ga-last-paid-game") || "";
  }

  if (event.target.id === "adminReplyForm") {
    event.preventDefault();
    if (!state.socket || !state.activeChat) return;
    const text = qs("adminReplyMessage").value.trim();
    const [file] = qs("adminReplyFile").files || [];
    const fileData = file ? await readFileAsDataUrl(file) : "";
    if (!text && !fileData) return;
    state.socket.emit("chat:admin-send", {
      chatId: state.activeChat.id,
      text,
      file: fileData,
      fileType: file?.type || ""
    });
    event.target.reset();
  }

  if (event.target.id === "addGameForm") {
    event.preventDefault();
    try {
      const gameImageUpload = await inputToDataUrl("newGameImage");
      await api("/games", {
        method: "POST",
        body: JSON.stringify({
          name: qs("newGameName").value,
          category: qs("newGameCategory").value,
          price: Number(qs("newGamePrice").value || 45),
          description: qs("newGameDescription")?.value || "",
          image: gameImageUpload || qs("newGameImageUrl")?.value || ""
        })
      });
      event.target.reset();
      if (qs("newGamePrice")) qs("newGamePrice").value = 45;
      if (qs("newGameCategory")) qs("newGameCategory").value = "Action";
      await applyGameFilters();
      setStatus("adminGamesStatus", "Game added.");
    } catch (error) {
      setStatus("adminGamesStatus", error.message, true);
    }
  }

  if (event.target.id === "createBlogForm") {
    event.preventDefault();
    try {
      const image = await inputToDataUrl("newBlogImage");
      await api("/blogs", {
        method: "POST",
        body: JSON.stringify({
          title: qs("newBlogTitle").value,
          category: qs("newBlogCategory")?.value || "Manual",
          summary: qs("newBlogSummary").value,
          keywords: qs("newBlogKeywords")?.value || "",
          metaDescription: qs("newBlogMeta")?.value || "",
          content: qs("newBlogContent").value,
          image
        })
      });
      event.target.reset();
      await loadBlogs();
      renderBlogList();
      await loadAdminOverview();
      setStatus("adminBlogsStatus", "Blog created.");
    } catch (error) {
      setStatus("adminBlogsStatus", error.message, true);
    }
  }

  if (event.target.id === "createAiToolForm") {
    event.preventDefault();
    try {
      await api("/api/ai-tools", {
        method: "POST",
        body: JSON.stringify({
          name: qs("newAiToolName").value,
          category: qs("newAiToolCategory").value,
          url: qs("newAiToolUrl").value,
          description: qs("newAiToolDescription").value,
          featured: Boolean(qs("newAiToolFeatured")?.checked)
        })
      });
      event.target.reset();
      await loadAiTools();
      renderAdminAiTools();
      renderAiToolGrid();
      await loadAdminOverview();
      setStatus("adminAiToolsStatus", "AI tool created.");
    } catch (error) {
      setStatus("adminAiToolsStatus", error.message, true);
    }
  }

  if (event.target.id === "addBundleForm") {
    event.preventDefault();
    try {
      const selectedGameIds = getBundleSelection();
      await api("/bundles", {
        method: "POST",
        body: JSON.stringify({
          name: qs("newBundleName").value,
          itemCount: Number(qs("newBundleCount").value || 0),
          price: Number(qs("newBundlePrice").value || 45),
          gameIds: selectedGameIds,
          description: qs("newBundleDescription").value
        })
      });
      event.target.reset();
      if (qs("newBundlePrice")) qs("newBundlePrice").value = 45;
      if (qs("newBundleCount")) qs("newBundleCount").value = "";
      state.bundleSelection = [];
      await loadBundles();
      renderBundleGameChecklist();
      setStatus("adminBundlesStatus", "Bundle added.");
    } catch (error) {
      setStatus("adminBundlesStatus", error.message, true);
    }
  }

  if (event.target.id === "createConsoleGameForm") {
    event.preventDefault();
    try {
      const consoleImageUpload = await inputToDataUrl("newConsoleGameImage");
      await api("/console-games", {
        method: "POST",
        body: JSON.stringify({
          name: qs("newConsoleGameName").value,
          platform: qs("newConsoleGamePlatform").value,
          image: consoleImageUpload || qs("newConsoleGameImageUrl").value || ""
        })
      });
      event.target.reset();
      if (qs("newConsoleGamePlatform")) qs("newConsoleGamePlatform").value = "PS5";
      await loadConsoleGames();
      renderConsoleSections();
      renderAdminConsoleGames();
      await loadAdminOverview();
      setStatus("adminConsoleGamesStatus", "Console game added.");
    } catch (error) {
      setStatus("adminConsoleGamesStatus", error.message, true);
    }
  }

  if (event.target.id === "settingsForm") {
    event.preventDefault();
    try {
      const qrUpload = await inputToDataUrl("qrFile");
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          siteTitle: qs("siteTitleInput").value,
          siteTagline: qs("siteTaglineInput")?.value || "",
          siteDescription: qs("siteDescriptionInput")?.value || "",
          logoUrl: qs("logoUrlInput")?.value || "",
          faviconUrl: qs("faviconUrlInput")?.value || "",
          qrImage: qrUpload || qs("qrUrlInput").value || state.settings.qrImage,
          homeLayout: state.settings.homeLayout,
          bundles: state.bundles,
          socialLinks: {
            instagram: qs("instagramUrlInput")?.value || "/",
            facebook: qs("facebookUrlInput")?.value || "/",
            youtube: qs("youtubeUrlInput")?.value || "/",
            twitter: qs("twitterUrlInput")?.value || "/",
            linkedin: qs("linkedinUrlInput")?.value || "/",
            telegram: qs("telegramUrlInput")?.value || TELEGRAM_URL
          },
          business: {
            name: qs("businessNameInput")?.value || "",
            phone: qs("businessPhoneInput")?.value || "",
            email: qs("businessEmailInput")?.value || "",
            addressLine1: qs("businessAddressInput")?.value || "",
            city: qs("businessCityInput")?.value || "",
            state: qs("businessStateInput")?.value || ""
          },
          analytics: {
            googleAnalyticsId: qs("googleAnalyticsIdInput")?.value || "",
            facebookPixelId: qs("facebookPixelIdInput")?.value || ""
          },
          emailAuthentication: {
            spfRecord: qs("spfRecordInput")?.value || "",
            dmarcRecord: qs("dmarcRecordInput")?.value || ""
          },
          adminEmail: qs("adminEmailInput").value,
          adminPassword: qs("adminPasswordInput").value,
          adminSecondaryPassword: qs("adminSecondaryPasswordInput")?.value || ""
        })
      });
      await bootstrap();
      await loadBundles();
      const qrPreview = qs("qrPreview");
      if (qrPreview) qrPreview.src = state.settings.qrImage;
      setStatus("settingsStatus", "Settings saved.");
      } catch (error) {
        setStatus("settingsStatus", error.message, true);
      }
    }

    if (event.target.id === "createSectionForm") {
      event.preventDefault();
      try {
        await api("/api/content", {
          method: "POST",
          body: JSON.stringify({
            type: "sections",
            item: {
              key: qs("newSectionKey").value,
              subtitle: qs("newSectionSubtitle").value,
              title: qs("newSectionTitle").value,
              body: qs("newSectionBody").value,
              buttonLabel: qs("newSectionButtonLabel").value,
              buttonHref: qs("newSectionButtonHref").value,
              image: qs("newSectionImage").value
            }
          })
        });
        event.target.reset();
        await loadAdminContent();
        setStatus("contentStatus", "Content section added.");
      } catch (error) {
        setStatus("contentStatus", error.message, true);
      }
    }

    if (event.target.id === "createPageForm") {
      event.preventDefault();
      try {
        await api("/api/content", {
          method: "POST",
          body: JSON.stringify({
            type: "pages",
            item: {
              title: qs("newPageTitle").value,
              slug: qs("newPageSlug").value,
              summary: qs("newPageSummary").value,
              heroImage: qs("newPageImage").value,
              seoTitle: qs("newPageSeoTitle").value,
              seoDescription: qs("newPageSeoDescription").value,
              content: qs("newPageContent").value
            }
          })
        });
        event.target.reset();
        await loadAdminContent();
        setStatus("pagesStatus", "Page created.");
      } catch (error) {
        setStatus("pagesStatus", error.message, true);
      }
    }

    if (event.target.id === "createMediaForm") {
      event.preventDefault();
      try {
        const upload = await inputToDataUrl("newMediaFile");
        await api("/api/content", {
          method: "POST",
          body: JSON.stringify({
            type: "media",
            item: {
              name: qs("newMediaName").value,
              url: upload || qs("newMediaUrl").value,
              alt: qs("newMediaAlt").value,
              placement: qs("newMediaPlacement").value
            }
          })
        });
        event.target.reset();
        await loadAdminContent();
        setStatus("mediaStatus", "Media saved.");
      } catch (error) {
        setStatus("mediaStatus", error.message, true);
      }
    }

    if (event.target.id === "editorSaveForm") {
      event.preventDefault();
      try {
        const blocks = [...document.querySelectorAll("[data-block-id]")].map((input) => ({
        id: input.dataset.blockId,
        type: input.dataset.blockType,
        content: input.value
      }));
      const saved = await api("/editor-layout", {
        method: "PUT",
        body: JSON.stringify({ homeLayout: blocks })
      });
      state.settings.homeLayout = saved;
      renderEditorBlocks(saved);
      setStatus("editorStatus", "Homepage layout saved.");
    } catch (error) {
      setStatus("editorStatus", error.message, true);
    }
  }
});

async function bindPageActions() {
  if (qs("goCheckoutBtn")) {
    qs("goCheckoutBtn").onclick = () => {
    window.location.href = "/checkout";
    };
  }

  if (qs("loadMoreGames")) {
    qs("loadMoreGames").onclick = async () => {
      await loadGames({ reset: false });
      renderGameCards();
    };
  }

  document.querySelectorAll("[data-slider-row]").forEach((button) => {
    button.onclick = () => {
      scrollSliderRow(button.dataset.sliderRow, Number(button.dataset.sliderDirection || 1));
    };
  });

  if (qs("bundlePrev")) {
    qs("bundlePrev").onclick = () => {
      state.bundleSlide -= 1;
      updateBundleSlider();
    };
  }

  if (qs("bundleNext")) {
    qs("bundleNext").onclick = () => {
      state.bundleSlide += 1;
      updateBundleSlider();
    };
  }

  if (qs("addBundleToCart")) {
    qs("addBundleToCart").onclick = async () => {
      if (!state.activeBundle) return;
      try {
        await api(`${CART_API_BASE}/bundles`, {
          method: "POST",
          body: JSON.stringify({ bundleId: state.activeBundle.id })
        });
        await refreshCart();
        setStatus("bundleStatus", "Bundle added to cart.");
      } catch (error) {
        setStatus("bundleStatus", error.message, true);
      }
    };
  }

  if (qs("buyBundleNow")) {
    qs("buyBundleNow").onclick = async () => {
      if (!state.activeBundle) return;
      try {
        await api(`${CART_API_BASE}/bundles`, {
          method: "POST",
          body: JSON.stringify({ bundleId: state.activeBundle.id })
        });
        await refreshCart();
    window.location.href = "/checkout";
      } catch (error) {
        setStatus("bundleStatus", error.message, true);
      }
    };
  }

  if (qs("adminQuickAccess")) {
    qs("adminQuickAccess").onclick = () => {
      if (state.session?.isAdmin) {
        window.location.href = "/admin.html";
        return;
      }
      resetAdminAccessModal();
      qs("adminAccessModal")?.classList.remove("hidden");
    };
  }

  if (qs("closeAdminAccess")) {
    qs("closeAdminAccess").onclick = () => {
      resetAdminAccessModal();
      qs("adminAccessModal")?.classList.add("hidden");
    };
  }

  if (qs("adminAccessModal")) {
    qs("adminAccessModal").onclick = (event) => {
      if (event.target.id === "adminAccessModal") {
        resetAdminAccessModal();
        event.currentTarget.classList.add("hidden");
      }
    };
  }

  if (qs("paidBtn")) {
    qs("paidBtn").onclick = async () => {
      try {
        const cart = await api(CART_API_BASE);
        const gameNames = cart.items.map((item) => item.name).join(", ");
        const total = currency(cart.total);
        const screenshot = await inputToDataUrl("checkoutScreenshot");
        const order = await api(ORDERS_API_BASE, {
          method: "POST",
          body: JSON.stringify({
            customerName: qs("checkoutName")?.value || "",
            customerContact: qs("checkoutContact")?.value || "",
            paymentNote: qs("checkoutNote")?.value || "",
            screenshot
          })
        });
        localStorage.setItem("ga-last-paid-game", gameNames);
        localStorage.setItem("ga-last-order-id", order.orderId);
        await api(`${CART_API_BASE}/clear`, { method: "DELETE" });
        window.location.href = telegramMessageLink(`Hello, I paid for: ${gameNames || "General Order"} | Total: ${total} | Order ID: ${order.orderId}. I will send my payment screenshot here.`);
      } catch (error) {
        setStatus("checkoutStatus", error.message, true);
      }
    };
  }

  if (qs("telegramSupportLink")) {
    qs("telegramSupportLink").href = TELEGRAM_URL;
  }
  document.querySelectorAll("[data-telegram-general]").forEach((element) => {
    element.href = telegramMessageLink("Hello, I have a question about Gamers Arena.");
  });
  document.querySelectorAll("[data-telegram-console]").forEach((element) => {
    element.href = consoleSupportLink();
  });
  document.querySelectorAll("[data-telegram-order]").forEach((element) => {
    const orderGames = localStorage.getItem("ga-last-paid-game") || "my order";
    element.href = telegramMessageLink(`Hello, I need support for ${orderGames}.`);
  });

  if (qs("chatLoginBtn")) {
    qs("chatLoginBtn").onclick = () => {
      window.location.href = "/login?redirect=/chat.html";
    };
  }

  if (qs("adminLoginRedirect")) {
    qs("adminLoginRedirect").onclick = () => {
      window.location.href = "/login";
    };
  }

  if (qs("editorLoginRedirect")) {
    qs("editorLoginRedirect").onclick = () => {
      window.location.href = "/login";
    };
  }

  if (qs("addTextBlock")) {
    qs("addTextBlock").onclick = async () => {
      const current = await api("/editor-layout");
      renderEditorBlocks([...current, { id: `block-${Date.now()}`, type: "text", content: "New text block" }]);
    };
  }

  if (qs("addImageBlock")) {
    qs("addImageBlock").onclick = async () => {
      const current = await api("/editor-layout");
      renderEditorBlocks([...current, { id: `block-${Date.now()}`, type: "image", content: DEFAULT_EDITOR_IMAGE }]);
    };
  }

  if (qs("addVideoBlock")) {
    qs("addVideoBlock").onclick = async () => {
      const current = await api("/editor-layout");
      renderEditorBlocks([...current, { id: `block-${Date.now()}`, type: "video", content: "" }]);
    };
  }

  if (qs("bundleGameSearch")) {
    let bundleSearchTimer;
    qs("bundleGameSearch").oninput = () => {
      clearTimeout(bundleSearchTimer);
      bundleSearchTimer = setTimeout(async () => {
        await loadBundleCandidates(qs("bundleGameSearch").value.trim());
        renderBundleGameChecklist();
      }, 140);
    };
  }

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll("[data-admin-panel]").forEach((panel) => panel.classList.add("hidden"));
      button.classList.add("active");
      qs(button.dataset.adminTab).classList.remove("hidden");
    };
  });
}

async function init() {
  try {
    await bootstrap();
    await refreshCart();
    await bindPageActions();
    if (page === "home") await initHome();
    if (page === "games") await initGamesCatalog();
    if (page === "pc-games") await initPcGamesPage();
    if (page === "ps4-games") await initConsoleCatalogPage("PS4", "ps4");
    if (page === "ps5-games") await initConsoleCatalogPage("PS5", "ps5");
    if (page === "deals") await initDealsPage();
    if (page === "ai-tools") await initAiTools();
    if (page === "cart") await initCart();
    if (page === "checkout") await initCheckout();
    if (page === "bundle") await initBundle();
    if (page === "bundles") await initBundlesPage();
    if (page === "chat") await initChat();
    if (page === "login") await initLogin();
    if (page === "admin") await initAdmin();
    if (page === "blog") await initBlog();
    if (page === "faq") await initFaq();
    if (page === "reviews") await initReviews();
    if (page === "wishlist") await initWishlist();
    if (page === "post") await loadPost();
    if (page === "managed-page") await initManagedPage();
    if (page === "editor") await initEditor();
  } catch (error) {
    const target = qs("pageStatus") || document.querySelector("main") || document.body;
    target.innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

init();

