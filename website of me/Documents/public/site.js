const page = document.body.dataset.page;
const CART_KEY = "gamers-arena-cart-v1";
const TICKET_KEY = "gamers-arena-tickets-v1";
const ADMIN_GAMES_KEY = "gamers-arena-admin-games-v1";
const ADMIN_SETTINGS_KEY = "gamers-arena-admin-settings-v1";
const GAME_PRICE = 45;
const DEFAULT_SUPPORT_PROMPT = "After payment, create a private ticket and keep your order code safe.";
const defaultQr = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect width="320" height="320" rx="24" fill="white"/><rect x="26" y="26" width="84" height="84" fill="black"/><rect x="44" y="44" width="48" height="48" fill="white"/><rect x="210" y="26" width="84" height="84" fill="black"/><rect x="228" y="44" width="48" height="48" fill="white"/><rect x="26" y="210" width="84" height="84" fill="black"/><rect x="44" y="228" width="48" height="48" fill="white"/><text x="160" y="302" font-size="18" font-family="Arial" text-anchor="middle" fill="#111">SCAN TO PAY</text></svg>`;

const state = {
  cart: loadCart(),
  tickets: loadTickets(),
  adminGames: loadAdminGames(),
  adminSettings: loadAdminSettings(),
  currentCatalog: [],
  activeTicketId: null,
  activeAdminTicketId: null,
  adminUnlocked: false,
  compareSelection: []
};
let gamesPageHandlersBound = false;
let adminHandlersBound = false;

function defaultHomeCopy() {
  return "Discover game accounts, add them to cart, pay with QR, and continue in a private ticket chat. The store now focuses on game buying instead of product gear listings.";
}

function activeAdminTicket() {
  return state.tickets.find((ticket) => ticket.id === state.activeAdminTicketId) || null;
}

function normalizeGame(game) {
  return {
    ...game,
    price: Number(game.price ?? GAME_PRICE),
    tags: Array.isArray(game.tags) ? game.tags : [],
    seo: game.seo || {
      metaTitle: `${game.name} | Gamers Arena`,
      metaDescription: game.description || "",
      keywords: [String(game.name || "").toLowerCase(), "gamers arena"]
    },
    systemRequirements: game.systemRequirements || {
      minimum: ["8 GB RAM", "GTX 1050 / RX 560", "50 GB storage"],
      recommended: ["16 GB RAM", "RTX 2060 / RX 6600", "SSD storage"]
    }
  };
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  updateCartUi();
}

function loadTickets() {
  try {
    return JSON.parse(localStorage.getItem(TICKET_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadAdminGames() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_GAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAdminGames() {
  localStorage.setItem(ADMIN_GAMES_KEY, JSON.stringify(state.adminGames));
  renderAdminStats();
}

function loadAdminSettings() {
  try {
    return {
      supportPrompt: DEFAULT_SUPPORT_PROMPT,
      qrImage: defaultQr,
      ...JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "{}")
    };
  } catch {
    return {
      supportPrompt: DEFAULT_SUPPORT_PROMPT,
      qrImage: defaultQr
    };
  }
}

function saveAdminSettings() {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(state.adminSettings));
  syncAdminQrPreview();
}

function saveTickets() {
  localStorage.setItem(TICKET_KEY, JSON.stringify(state.tickets));
  updateCartUi();
  renderAdminTickets();
  renderAdminConversation();
  renderAdminStats();
}

function currency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getSlugFromPath(prefix) {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === prefix && parts[1]) return decodeURIComponent(parts[1]);
  return new URLSearchParams(window.location.search).get("slug") || "";
}

function setMeta(title, description) {
  if (title) document.title = title;
  const descriptionEl = document.querySelector('meta[name="description"]');
  if (descriptionEl && description) descriptionEl.setAttribute("content", description);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function optionalImage(inputId) {
  const input = document.getElementById(inputId);
  const [file] = input?.files || [];
  return file ? readFileAsDataUrl(file) : "";
}

function initResponsiveHeader() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || topbar.dataset.headerReady === "1") return;
  topbar.dataset.headerReady = "1";
  let lastY = window.scrollY || 0;
  let ticking = false;

  function updateHeader() {
    const currentY = window.scrollY || 0;
    const delta = currentY - lastY;
    if (currentY <= 20) {
      topbar.classList.remove("header-hidden");
      lastY = currentY;
      ticking = false;
      return;
    }
    if (Math.abs(delta) <= 6) {
      ticking = false;
      return;
    }
    if (delta > 0 && currentY > 90 && !topbar.classList.contains("nav-open")) {
      topbar.classList.add("header-hidden");
    } else if (delta < 0) {
      topbar.classList.remove("header-hidden");
    }
    lastY = currentY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  }, { passive: true });
}

function initMobileNav() {
  const topbar = document.querySelector(".topbar");
  const navLinks = document.querySelector(".nav-links");
  if (!topbar || !navLinks || topbar.querySelector(".nav-toggle")) return;

  const toggle = document.createElement("button");
  toggle.className = "nav-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Toggle navigation");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = "<span></span><span></span><span></span>";
  topbar.appendChild(toggle);

  function closeNav() {
    topbar.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    const next = !topbar.classList.contains("nav-open");
    topbar.classList.toggle("nav-open", next);
    topbar.classList.remove("header-hidden");
    toggle.setAttribute("aria-expanded", String(next));
  });

  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
  document.addEventListener("click", (event) => {
    if (!topbar.contains(event.target)) closeNav();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) closeNav();
  });
}

function updateCartUi() {
  const cartCount = state.cart.length;
  document.querySelectorAll("#cartNavLink").forEach((element) => {
    element.textContent = `Cart (${cartCount})`;
  });
  const statCart = document.getElementById("statCart");
  if (statCart) statCart.textContent = String(cartCount);
  const statTickets = document.getElementById("statTickets");
  if (statTickets) statTickets.textContent = String(state.tickets.length);
  renderAdminStats();
}

function renderAdminStats() {
  const gamesStat = document.getElementById("adminStatsGames");
  if (gamesStat) gamesStat.textContent = String(state.currentCatalog.length || state.adminGames.length);
  const ticketsStat = document.getElementById("adminStatsTickets");
  if (ticketsStat) ticketsStat.textContent = String(state.tickets.length);
  const cartStat = document.getElementById("adminStatsCart");
  if (cartStat) cartStat.textContent = String(state.cart.length);
}

function syncAdminQrPreview() {
  const preview = document.getElementById("adminQrPreview");
  if (preview) preview.src = state.adminSettings.qrImage || defaultQr;
}

function getAllGames(apiGames = []) {
  const merged = new Map();
  [...apiGames.map(normalizeGame), ...state.adminGames.map(normalizeGame)].forEach((game) => {
    merged.set(game.slug, normalizeGame(game));
  });
  return [...merged.values()];
}

function addToCart(item) {
  const existing = state.cart.find((entry) => entry.id === item.id && entry.type === item.type);
  if (existing) return;
  state.cart.push(item);
  saveCart();
}

function removeFromCart(id, type) {
  state.cart = state.cart.filter((item) => !(item.id === id && item.type === type));
  saveCart();
  renderCartPanel();
}

function totalCartValue() {
  return state.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function ensureCheckoutModal() {
  if (document.getElementById("checkoutModal")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="checkoutModal" class="checkout-modal hidden">
      <div class="checkout-card">
        <button id="closeCheckoutModal" class="modal-close" type="button">x</button>
        <p class="eyebrow">qr checkout</p>
        <h2>Complete your payment</h2>
        <p id="checkoutItemsText" class="muted"></p>
        <p id="checkoutTotalText" class="status-text"></p>
        <img id="checkoutQrImage" class="checkout-qr" src="${state.adminSettings.qrImage || defaultQr}" alt="Payment QR">
        <div class="cta-row">
          <button id="proceedTicketBtn" class="btn btn-primary" type="button">I Paid, Continue to Ticket</button>
          <button id="cancelCheckoutBtn" class="btn btn-secondary" type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);
  document.getElementById("closeCheckoutModal").addEventListener("click", closeCheckoutModal);
  document.getElementById("cancelCheckoutBtn").addEventListener("click", closeCheckoutModal);
  document.getElementById("proceedTicketBtn").addEventListener("click", () => {
    closeCheckoutModal();
    const target = document.getElementById("ticketSupport");
    if (target) target.scrollIntoView({ behavior: "smooth" });
    const message = document.getElementById("ticketMessage");
    if (message && state.cart.length) {
      message.value = `I paid for: ${state.cart.map((item) => item.name).join(", ")}. Please continue my order.`;
    }
  });
}

function openCheckoutModal() {
  ensureCheckoutModal();
  document.getElementById("checkoutItemsText").textContent = state.cart.length
    ? `Items: ${state.cart.map((item) => item.name).join(", ")}`
    : "Your cart is empty.";
  document.getElementById("checkoutTotalText").textContent = `Total: ${currency(totalCartValue())}`;
  document.getElementById("checkoutQrImage").src = state.adminSettings.qrImage || defaultQr;
  document.getElementById("checkoutModal").classList.remove("hidden");
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal")?.classList.add("hidden");
}

function renderCartPanel() {
  const container = document.getElementById("cartItems");
  const summary = document.getElementById("cartSummary");
  if (!container || !summary) return;
  if (!state.cart.length) {
    container.innerHTML = `<div class="empty-state">Your cart is empty.</div>`;
    summary.textContent = "Add one or more game accounts to continue.";
    return;
  }
  container.innerHTML = state.cart.map((item) => `
    <article class="card compact-card">
      <h4>${item.name}</h4>
      <p>${item.type === "bundle" ? "Bundle" : "Game Account"}</p>
      <p><strong>${currency(item.price)}</strong></p>
      <button class="btn btn-secondary remove-cart-btn" type="button" data-id="${item.id}" data-type="${item.type}">Remove</button>
    </article>
  `).join("");
  summary.textContent = `Total ${currency(totalCartValue())} for ${state.cart.length} item(s).`;
}

function nextTicketCode() {
  return `GA-${String(state.tickets.length + 1).padStart(4, "0")}`;
}

function createTicket({ customerName, paymentRef, message, image }) {
  const ticket = {
    id: `ticket-${Date.now()}`,
    code: nextTicketCode(),
    customerName,
    paymentRef,
    items: state.cart.map((item) => item.name),
    status: "open",
    createdAt: new Date().toISOString(),
    messages: [{
      sender: "customer",
      text: message || `I paid for ${state.cart.map((item) => item.name).join(", ")}.`,
      image,
      createdAt: new Date().toISOString()
    }]
  };
  state.tickets.unshift(ticket);
  state.activeTicketId = ticket.id;
  saveTickets();
  return ticket;
}

function getActiveTicket() {
  return state.tickets.find((ticket) => ticket.id === state.activeTicketId) || null;
}

function renderTicketThread() {
  const thread = document.getElementById("ticketThread");
  const replyForm = document.getElementById("ticketReplyForm");
  if (!thread) return;
  const ticket = getActiveTicket();
  if (!ticket) {
    thread.innerHTML = `<div class="empty-state">No private ticket open yet.</div>`;
    replyForm?.classList.add("hidden");
    return;
  }
  thread.innerHTML = `
    <article class="card compact-card">
      <h4>${ticket.code}</h4>
      <p>Customer: ${ticket.customerName}</p>
      <p>Items: ${ticket.items.join(", ")}</p>
      <p>Payment ref: ${ticket.paymentRef || "Not provided"}</p>
      <p>${state.adminSettings.supportPrompt}</p>
    </article>
    ${ticket.messages.map((message) => `
      <article class="card compact-card">
        <p><strong>${message.sender === "customer" ? "You" : "Support"}</strong> | ${new Date(message.createdAt).toLocaleString("en-IN")}</p>
        <p>${message.text}</p>
        ${message.image ? `<img src="${message.image}" alt="Ticket attachment" loading="lazy">` : ""}
      </article>
    `).join("")}
  `;
  replyForm?.classList.remove("hidden");
}

function renderAdminTickets() {
  const list = document.getElementById("adminTicketList");
  if (!list || !state.adminUnlocked) return;
  list.innerHTML = state.tickets.length ? state.tickets.map((ticket) => `
    <button class="btn btn-secondary admin-ticket-btn ${ticket.id === state.activeAdminTicketId ? "is-active" : ""}" type="button" data-ticket-id="${ticket.id}">
      <span>${ticket.customerName} | ${ticket.code}</span>
      <small>${ticket.items.join(", ")}</small>
    </button>
  `).join("") : `<div class="empty-state">No tickets yet.</div>`;
}

function renderAdminConversation() {
  const meta = document.getElementById("adminChatMeta");
  const thread = document.getElementById("adminChatThread");
  if (!meta || !thread || !state.adminUnlocked) return;
  const ticket = activeAdminTicket();
  if (!ticket) {
    meta.textContent = "Select a user chat to open the full conversation.";
    thread.innerHTML = `<div class="empty-state">No chat selected.</div>`;
    return;
  }
  meta.textContent = `${ticket.customerName} | ${ticket.code} | Items: ${ticket.items.join(", ")} | Payment: ${ticket.paymentRef || "Not provided"}`;
  thread.innerHTML = ticket.messages.map((message) => `
    <article class="card compact-card thread-message ${message.sender}">
      <p><strong>${message.sender === "admin" ? "Admin" : ticket.customerName}</strong> | ${new Date(message.createdAt).toLocaleString("en-IN")}</p>
      <p>${message.text}</p>
      ${message.image ? `<img src="${message.image}" alt="Chat attachment" loading="lazy">` : ""}
    </article>
  `).join("");
}

function renderAdminState() {
  const supportText = document.getElementById("supportPromptText");
  if (supportText) supportText.textContent = state.adminSettings.supportPrompt;
  const loginBox = document.getElementById("adminLoginBox");
  const workspace = document.getElementById("adminWorkspace");
  if (!loginBox || !workspace) return;
  loginBox.classList.toggle("hidden", state.adminUnlocked);
  workspace.classList.toggle("hidden", !state.adminUnlocked);
  if (!state.adminUnlocked) return;
  const homeEyebrow = document.getElementById("adminHomeEyebrow");
  const homeTitle = document.getElementById("adminHomeTitle");
  const homeCopy = document.getElementById("adminHomeCopy");
  const supportPrompt = document.getElementById("adminSupportPrompt");
  if (homeEyebrow) homeEyebrow.value = state.adminSettings.homeEyebrow || "clean, fast, qr-ready";
  if (homeTitle) homeTitle.value = state.adminSettings.homeTitle || "Gamers Arena";
  if (homeCopy) homeCopy.value = state.adminSettings.homeCopy || defaultHomeCopy();
  if (supportPrompt) supportPrompt.value = state.adminSettings.supportPrompt;
  if (!state.activeAdminTicketId && state.tickets[0]) {
    state.activeAdminTicketId = state.tickets[0].id;
  }
  syncAdminQrPreview();
  renderAdminStats();
  renderAdminTickets();
  renderAdminConversation();
  renderAdminCatalogEditor(state.currentCatalog);
}

function bindTicketActions() {
  if (gamesPageHandlersBound) return;
  gamesPageHandlersBound = true;
  const createForm = document.getElementById("ticketCreateForm");
  const openForm = document.getElementById("ticketOpenForm");
  const replyForm = document.getElementById("ticketReplyForm");

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.cart.length) {
      document.getElementById("ticketCreateStatus").textContent = "Add something to cart first.";
      return;
    }
    const ticket = createTicket({
      customerName: document.getElementById("ticketCustomerName").value.trim(),
      paymentRef: document.getElementById("ticketPaymentRef").value.trim(),
      message: document.getElementById("ticketMessage").value.trim(),
      image: await optionalImage("ticketImage")
    });
    document.getElementById("ticketCreateStatus").textContent = `Ticket created successfully. Your code is ${ticket.code}.`;
    createForm.reset();
    renderTicketThread();
    updateCartUi();
  });

  openForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = document.getElementById("ticketLookupCode").value.trim().toLowerCase();
    const name = document.getElementById("ticketLookupName").value.trim().toLowerCase();
    const ticket = state.tickets.find((item) => item.code.toLowerCase() === code && item.customerName.toLowerCase() === name);
    state.activeTicketId = ticket?.id || null;
    renderTicketThread();
  });

  replyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ticket = getActiveTicket();
    if (!ticket) return;
    const text = document.getElementById("ticketReplyMessage").value.trim();
    const image = await optionalImage("ticketReplyImage");
    if (!text && !image) return;
    ticket.messages.push({
      sender: "customer",
      text: text || "Sent an attachment.",
      image,
      createdAt: new Date().toISOString()
    });
    saveTickets();
    replyForm.reset();
    renderTicketThread();
  });
}

function gameCard(game) {
  const normalized = normalizeGame(game);
  return `
    <article class="card">
      <img src="${normalized.image}" alt="${normalized.name}" loading="lazy">
      <div class="chips">${normalized.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
      <h3>${normalized.name}</h3>
      <p>${normalized.description}</p>
      <p><strong>${normalized.category}</strong> | ${normalized.releaseDate}</p>
      <p><strong>${currency(normalized.price)}</strong></p>
      <div class="cta-row">
        <a class="btn btn-secondary" href="/game/${normalized.slug}">Open game</a>
        <button class="btn btn-primary add-cart-btn" type="button" data-type="game" data-id="${normalized.id}" data-name="${normalized.name}" data-price="${normalized.price}">Add to Cart</button>
      </div>
    </article>
  `;
}

function bundleCard(bundle) {
  return `
    <article class="card">
      <img src="${bundle.image}" alt="${bundle.name}" loading="lazy">
      <span class="badge">Bundle</span>
      <h3>${bundle.name}</h3>
      <p>${bundle.description}</p>
      <p>${bundle.gameNames.join(", ")}</p>
      <div class="cta-row">
        <p><strong>${currency(bundle.price)}</strong></p>
        <button class="btn btn-primary add-cart-btn" type="button" data-type="bundle" data-id="${bundle.id}" data-name="${bundle.name}" data-price="${bundle.price}">Add to Cart</button>
      </div>
    </article>
  `;
}

function productCard(product, withCompare = false) {
  return `
    <article class="card">
      <img src="${product.image}" alt="${product.name}" loading="lazy">
      <span class="chip">${product.category}</span>
      <h3>${product.name}</h3>
      <p>${product.summary || product.features.join(" | ")}</p>
      <p><strong>${currency(product.price)}</strong> | Rating ${product.rating}</p>
      <div class="chips">${product.features.map((feature) => `<span class="chip">${feature}</span>`).join("")}</div>
      <div class="cta-row">
        <a class="btn btn-secondary" href="/product/${product.slug}">Open product</a>
        <a class="btn btn-primary" href="${product.affiliateUrl}" target="_blank" rel="noreferrer">Buy link</a>
        ${withCompare ? `<button class="btn btn-secondary compare-btn" type="button" data-id="${product.id}">Compare</button>` : ""}
      </div>
    </article>
  `;
}

function postCard(item, kind) {
  return `
    <article class="card">
      ${item.featuredImage ? `<img src="${item.featuredImage}" alt="${item.title}" loading="lazy">` : ""}
      <span class="chip">${kind === "blog" ? "Blog" : "News"}</span>
      <h3>${item.title}</h3>
      <p>${item.metaDescription || item.summary}</p>
      <a class="btn btn-secondary" href="/${kind}/${item.slug}">Read more</a>
    </article>
  `;
}

async function loadHome() {
  const data = await api("/bootstrap");
  const allGames = getAllGames(data.featuredGames);
  document.getElementById("statGames").textContent = String(data.stats.games + state.adminGames.length);
  updateCartUi();
  const eyebrow = document.getElementById("homeHeroEyebrow");
  const title = document.getElementById("homeHeroTitle");
  const copy = document.getElementById("homeHeroCopy");
  if (eyebrow) eyebrow.textContent = state.adminSettings.homeEyebrow || "clean, fast, qr-ready";
  if (title) title.textContent = state.adminSettings.homeTitle || "Gamers Arena";
  if (copy) copy.textContent = state.adminSettings.homeCopy || defaultHomeCopy();
  document.getElementById("homeGames").innerHTML = allGames.slice(0, 8).map(gameCard).join("");
  document.getElementById("homeBundles").innerHTML = data.featuredBundles.map(bundleCard).join("");
  document.getElementById("homeBlogs").innerHTML = data.latestBlogs.map((item) => postCard(item, "blog")).join("");
  document.getElementById("homeNews").innerHTML = data.latestNews.map((item) => postCard(item, "news")).join("");
}

async function loadGamesPage() {
  const data = await api("/games");
  const allGames = getAllGames(data.items);
  state.currentCatalog = allGames;
  const categorySelect = document.getElementById("gamesCategory");
  const searchInput = document.getElementById("gamesSearch");
  const list = document.getElementById("gamesList");
  const bundleList = document.getElementById("bundleList");
  const params = new URLSearchParams(window.location.search);
  const categories = [...new Set(allGames.map((item) => item.category))];
  categorySelect.innerHTML += categories.map((item) => `<option value="${item}">${item}</option>`).join("");
  categorySelect.value = params.get("category") || "";

  function renderGames() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categorySelect.value;
    const filtered = allGames.filter((item) => {
      const queryMatch = !query || item.name.toLowerCase().includes(query) || item.tags.join(" ").toLowerCase().includes(query);
      const categoryMatch = !category || item.category === category;
      return queryMatch && categoryMatch;
    });
    list.innerHTML = filtered.length ? filtered.map(gameCard).join("") : `<div class="empty-state">No games match this filter.</div>`;
  }

  searchInput.addEventListener("input", renderGames);
  categorySelect.addEventListener("change", renderGames);
  renderGames();
  bundleList.innerHTML = data.bundles.map(bundleCard).join("");
  renderCartPanel();
  renderTicketThread();
  renderAdminCatalogEditor(allGames);
  renderAdminState();
  bindTicketActions();
  bindAdminActions();

  document.getElementById("checkoutBtn")?.addEventListener("click", openCheckoutModal);
  document.body.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-cart-btn");
    if (addButton) {
      addToCart({
        type: addButton.dataset.type,
        id: addButton.dataset.id,
        name: addButton.dataset.name,
        price: Number(addButton.dataset.price || 0)
      });
      renderCartPanel();
    }
    const removeButton = event.target.closest(".remove-cart-btn");
    if (removeButton) {
      removeFromCart(removeButton.dataset.id, removeButton.dataset.type);
    }
  });
}

async function loadAdminPage() {
  const data = await api("/games");
  state.currentCatalog = getAllGames(data.items);
  renderAdminState();
  bindAdminActions();
}

async function loadGamePage() {
  const slug = getSlugFromPath("game");
  const apiGame = await api(`/games/${slug}`).catch(() => null);
  const game = normalizeGame(apiGame || state.adminGames.find((item) => item.slug === slug));
  if (!game) throw new Error("Game not found");
  setMeta(game.seo.metaTitle, game.seo.metaDescription);
  document.getElementById("gameDetail").innerHTML = `
    <section class="detail-grid">
      <article class="detail-hero">
        <img class="detail-image" src="${game.image}" alt="${game.name}" loading="lazy">
        <p class="eyebrow">${game.category}</p>
        <h1>${game.name}</h1>
        <p class="hero-copy">${game.description}</p>
        <div class="chips">${game.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
      </article>
      <aside class="panel">
        <h3>Buy This Game Account</h3>
        <p><strong>${currency(game.price)}</strong></p>
        <p>${state.adminSettings.supportPrompt}</p>
        <button id="singleGameAddCart" class="btn btn-primary" type="button">Add to Cart</button>
        <button id="singleGameBuyQr" class="btn btn-secondary" type="button">Buy with QR</button>
        <div class="ad-slot blog">Use this space for premium bundle promos, partner offers, or a Telegram-only weekend discount banner.</div>
      </aside>
    </section>
    <section class="layout-2" style="margin-top:22px;">
      <article class="panel prose">
        <h2>System Requirements</h2>
        <h3>Minimum</h3>
        <ul>${game.systemRequirements.minimum.map((item) => `<li>${item}</li>`).join("")}</ul>
        <h3>Recommended</h3>
        <ul>${game.systemRequirements.recommended.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <aside class="panel">
        <h3>Keywords</h3>
        <div class="chips">${game.seo.keywords.map((item) => `<span class="chip">${item}</span>`).join("")}</div>
        <p class="muted">Need support after payment? Open cart and private ticket chat from the games page.</p>
      </aside>
    </section>
  `;

  document.getElementById("singleGameAddCart").addEventListener("click", () => {
    addToCart({ type: "game", id: game.id, name: game.name, price: game.price });
  });
  document.getElementById("singleGameBuyQr").addEventListener("click", () => {
    addToCart({ type: "game", id: game.id, name: game.name, price: game.price });
    openCheckoutModal();
  });
}

function renderAdminCatalogEditor(games) {
  const wrap = document.getElementById("adminCatalogEditor");
  if (!wrap || !state.adminUnlocked) return;
  wrap.innerHTML = games.map((game) => {
    const normalized = normalizeGame(game);
    return `
      <article class="card compact-card">
        <input data-game-field="name" data-game-id="${normalized.id}" value="${normalized.name}">
        <div class="two-col">
          <input data-game-field="category" data-game-id="${normalized.id}" value="${normalized.category}">
          <input data-game-field="price" data-game-id="${normalized.id}" type="number" step="0.01" value="${normalized.price}">
        </div>
        <div class="two-col">
          <input data-game-field="releaseDate" data-game-id="${normalized.id}" value="${normalized.releaseDate}">
          <input data-game-field="image" data-game-id="${normalized.id}" value="${normalized.image}">
        </div>
        <input data-game-upload="${normalized.id}" type="file" accept="image/*">
        <input data-game-field="tags" data-game-id="${normalized.id}" value="${normalized.tags.join(", ")}">
        <textarea data-game-field="description" data-game-id="${normalized.id}" rows="3">${normalized.description}</textarea>
        <button class="btn btn-secondary save-game-btn" type="button" data-save-game="${normalized.id}">Save Game</button>
      </article>
    `;
  }).join("");
}

function switchAdminTab(tabName) {
  document.querySelectorAll(".admin-tab-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === tabName);
  });
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== tabName);
  });
}

function bindAdminActions() {
  if (adminHandlersBound) return;
  adminHandlersBound = true;
  const loginStatus = document.getElementById("adminLoginStatus");
  if (loginStatus) {
    loginStatus.textContent = "Use the secure admin dashboard to manage products, pages, media, and passwords.";
  }
  document.getElementById("forgotPasswordPanel")?.classList.add("hidden");
  document.getElementById("changePasswordPanel")?.classList.add("hidden");
  document.getElementById("adminWorkspace")?.classList.add("hidden");
  document.getElementById("adminLoginBtn")?.addEventListener("click", () => {
    window.location.href = "/login.html";
  });
  document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => {
    window.location.href = "/login.html";
  });
  return;

  document.getElementById("adminSaveSettingsBtn")?.addEventListener("click", async () => {
    state.adminSettings.homeEyebrow = document.getElementById("adminHomeEyebrow").value.trim() || "clean, fast, qr-ready";
    state.adminSettings.homeTitle = document.getElementById("adminHomeTitle").value.trim() || "Gamers Arena";
    state.adminSettings.homeCopy = document.getElementById("adminHomeCopy").value.trim() || defaultHomeCopy();
    state.adminSettings.supportPrompt = document.getElementById("adminSupportPrompt").value.trim() || DEFAULT_SUPPORT_PROMPT;
    const qrImage = await optionalImage("adminQrUpload");
    if (qrImage) state.adminSettings.qrImage = qrImage;
    saveAdminSettings();
    document.getElementById("adminSettingsStatus").textContent = "Settings saved.";
    renderAdminState();
  });

  document.getElementById("adminAddGameBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("adminNewGameName").value.trim();
    if (!name) return;
    document.getElementById("adminAddGameStatus").textContent = "Adding game...";
    try {
      const generated = await api("/auto-game-data", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      state.adminGames.unshift(normalizeGame({
        id: `admin-game-${Date.now()}`,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        name,
        category: generated.category,
        releaseDate: generated.releaseDate,
        tags: generated.tags,
        image: `https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=900&q=80&sig=${Date.now()}`,
        description: generated.description,
        price: GAME_PRICE,
        seo: {
          metaTitle: generated.metaTitle,
          metaDescription: generated.metaDescription,
          keywords: generated.keywords
        },
        systemRequirements: generated.systemRequirements
      }));
      saveAdminGames();
      state.currentCatalog = getAllGames(state.currentCatalog);
      document.getElementById("adminAddGameStatus").textContent = "Game added successfully.";
      document.getElementById("adminNewGameName").value = "";
      renderAdminCatalogEditor(state.currentCatalog);
      renderAdminStats();
      switchAdminTab("games");
    } catch (error) {
      document.getElementById("adminAddGameStatus").textContent = error.message;
    }
  });

  document.getElementById("adminTicketList")?.addEventListener("click", (event) => {
    const button = event.target.closest(".admin-ticket-btn");
    if (!button) return;
    state.activeAdminTicketId = button.dataset.ticketId;
    state.activeTicketId = button.dataset.ticketId;
    renderAdminTickets();
    renderAdminConversation();
    renderTicketThread();
  });

  document.getElementById("adminReplyBtn")?.addEventListener("click", async () => {
    const ticket = state.tickets.find((item) => item.id === state.activeAdminTicketId);
    if (!ticket) {
      document.getElementById("adminReplyStatus").textContent = "Select a ticket first.";
      return;
    }
    const text = document.getElementById("adminReplyMessage").value.trim();
    const image = await optionalImage("adminReplyImage");
    if (!text && !image) return;
    ticket.messages.push({
      sender: "admin",
      text: text || "Admin sent an attachment.",
      image,
      createdAt: new Date().toISOString()
    });
    saveTickets();
    document.getElementById("adminReplyStatus").textContent = "Reply sent.";
    document.getElementById("adminReplyMessage").value = "";
    document.getElementById("adminReplyImage").value = "";
    renderTicketThread();
    renderAdminTickets();
    renderAdminConversation();
  });

  document.getElementById("adminCatalogEditor")?.addEventListener("click", async (event) => {
    const button = event.target.closest(".save-game-btn");
    if (!button) return;
    const gameId = button.dataset.saveGame;
    const fields = [...document.querySelectorAll(`[data-game-id="${gameId}"]`)];
    const values = {};
    fields.forEach((field) => {
      values[field.dataset.gameField] = field.value;
    });
    const index = state.adminGames.findIndex((item) => item.id === gameId);
    const existing = state.adminGames[index] || state.currentCatalog.find((item) => item.id === gameId) || { id: gameId };
    const updated = normalizeGame({
      ...existing,
      name: values.name,
      category: values.category,
      releaseDate: values.releaseDate,
      image: values.image,
      description: values.description,
      price: Number(values.price || GAME_PRICE),
      tags: String(values.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
      slug: values.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    });
    const uploadInput = document.querySelector(`[data-game-upload="${gameId}"]`);
    const [file] = uploadInput?.files || [];
    if (file) {
      updated.image = await readFileAsDataUrl(file);
    }
    if (index >= 0) {
      state.adminGames[index] = updated;
    } else {
      state.adminGames.unshift(updated);
    }
    saveAdminGames();
    state.currentCatalog = getAllGames(state.currentCatalog);
    document.getElementById("adminAddGameStatus").textContent = `${updated.name} saved successfully.`;
    renderAdminCatalogEditor(state.currentCatalog);
    renderAdminStats();
  });
}

async function loadProductsPage() {
  const status = document.getElementById("productsStatus");
  if (status) status.textContent = "Game account store is now the main focus. Product comparison remains available here if needed.";
  const data = await api("/products");
  const input = document.getElementById("productsSearch");
  const button = document.getElementById("productsSearchBtn");
  const categorySelect = document.getElementById("productsCategory");
  const list = document.getElementById("productsList");

  function render(items) {
    list.innerHTML = items.length ? items.map((item) => productCard(item, true)).join("") : `<div class="empty-state">No products found.</div>`;
  }

  function filterByCategory() {
    render(data.items.filter((item) => !categorySelect.value || item.category === categorySelect.value));
  }

  button?.addEventListener("click", async () => {
    const query = input.value.trim();
    if (!query) {
      filterByCategory();
      return;
    }
    const result = await api("/search-products", { method: "POST", body: JSON.stringify({ query }) });
    render(result.results);
    if (status) status.textContent = `Showing ${result.results.length} result(s) for ${query}.`;
  });
  categorySelect?.addEventListener("change", filterByCategory);
  filterByCategory();

  document.body.addEventListener("click", async (event) => {
    const buttonEl = event.target.closest(".compare-btn");
    if (!buttonEl) return;
    const id = buttonEl.dataset.id;
    if (state.compareSelection.includes(id)) {
      state.compareSelection = state.compareSelection.filter((item) => item !== id);
    } else {
      state.compareSelection = [...state.compareSelection, id].slice(-3);
    }
    const compare = state.compareSelection.length ? await api("/compare-products", {
      method: "POST",
      body: JSON.stringify({ items: state.compareSelection })
    }) : { items: [], highlights: {} };
    document.querySelector("#productsCompareTable tbody").innerHTML = compare.items.length
      ? compare.items.map((item) => {
        const badge = compare.highlights.bestValue === item.id ? "Best Value" : compare.highlights.bestPerformance === item.id ? "Best Performance" : "-";
        return `<tr><td>${item.name}</td><td>${currency(item.price)}</td><td>${item.features.join(", ")}</td><td>${item.rating}</td><td>${badge}</td></tr>`;
      }).join("")
      : `<tr><td colspan="5">Choose up to 3 products to compare.</td></tr>`;
  });
}

async function loadProductPage() {
  const slug = getSlugFromPath("product");
  const product = await api(`/products/${slug}`);
  setMeta(`${product.name} | Gamers Arena`, product.summary);
  document.getElementById("productDetail").innerHTML = `
    <section class="detail-grid">
      <article class="detail-hero">
        <img class="detail-image" src="${product.image}" alt="${product.name}" loading="lazy">
        <p class="eyebrow">${product.category}</p>
        <h1>${product.name}</h1>
        <p class="hero-copy">${product.summary}</p>
        <div class="chips">${product.features.map((item) => `<span class="chip">${item}</span>`).join("")}</div>
      </article>
      <aside class="panel">
        <h3>Quick Facts</h3>
        <p>Price: ${currency(product.price)}</p>
        <p>Rating: ${product.rating}</p>
        <a class="btn btn-primary" href="${product.affiliateUrl}" target="_blank" rel="noreferrer">Open affiliate link</a>
      </aside>
    </section>
  `;
}

async function loadBlogPage() {
  const blogs = await api("/blogs");
  document.getElementById("blogList").innerHTML = blogs.map((item) => postCard(item, "blog")).join("");
}

async function loadNewsPage() {
  const news = await api("/news");
  document.getElementById("newsList").innerHTML = news.map((item) => postCard(item, "news")).join("");
}

async function loadPostPage() {
  const path = window.location.pathname.split("/").filter(Boolean);
  const type = path[0] === "news" ? "news" : "blog";
  const slug = path[1] || new URLSearchParams(window.location.search).get("slug") || "";
  const item = await api(`/${type === "blog" ? "blogs" : "news"}/${slug}`);
  setMeta(item.title, item.metaDescription || item.summary);
  document.getElementById("postDetail").innerHTML = `
    <article class="detail-hero prose">
      <p class="eyebrow">${type}</p>
      <h1>${item.title}</h1>
      ${item.featuredImage ? `<img class="detail-image" src="${item.featuredImage}" alt="${item.title}" loading="lazy">` : ""}
      <p>${item.introduction || item.metaDescription || item.summary}</p>
      ${(item.sections || []).map((section) => `<h2>${section.title}</h2><p>${section.body}</p>`).join("")}
      <p>${item.content || ""}</p>
      ${item.tips ? `<h2>Tips</h2><ul>${item.tips.map((tip) => `<li>${tip}</li>`).join("")}</ul>` : ""}
      ${item.faq ? `<h2>FAQ</h2>${item.faq.map((faq) => `<h3>${faq.question}</h3><p>${faq.answer}</p>`).join("")}` : ""}
      ${item.conclusion ? `<h2>Conclusion</h2><p>${item.conclusion}</p>` : ""}
    </article>
  `;
}

async function loadDealsPage() {
  const deals = await api("/deal-finder", { method: "POST", body: JSON.stringify({}) });
  document.getElementById("dealsList").innerHTML = deals.map((item) => `
    <article class="card">
      <img src="${item.image}" alt="${item.name}" loading="lazy">
      <span class="badge">${item.badge}</span>
      <h3>${item.name}</h3>
      <p>${item.summary}</p>
      <p><strong>${currency(item.price)}</strong> | Rating ${item.rating}</p>
      <a class="btn btn-primary" href="${item.affiliateUrl}" target="_blank" rel="noreferrer">Open deal</a>
    </article>
  `).join("");
}

async function loadPcBuilderPage() {
  document.getElementById("builderRun").addEventListener("click", async () => {
    const result = await api("/pc-builder", {
      method: "POST",
      body: JSON.stringify({
        budget: Number(document.getElementById("builderBudget").value || 0),
        target: document.getElementById("builderTarget").value
      })
    });
    document.getElementById("builderStatus").textContent = `${result.build.cpu}, ${result.build.gpu}, ${result.build.ram}, ${result.build.storage}, ${result.build.motherboard}`;
  });

  document.getElementById("fpsRun").addEventListener("click", async () => {
    const result = await api("/optimize-game", {
      method: "POST",
      body: JSON.stringify({
        gameName: document.getElementById("fpsGameName").value,
        cpu: document.getElementById("fpsCpu").value,
        gpu: document.getElementById("fpsGpu").value,
        ram: document.getElementById("fpsRam").value,
        storage: document.getElementById("fpsStorage").value
      })
    });
    document.getElementById("fpsStatus").textContent = result.recommendations.join(" | ");
  });

  document.getElementById("runCheck").addEventListener("click", async () => {
    const result = await api("/can-run", {
      method: "POST",
      body: JSON.stringify({
        gameName: document.getElementById("runGameName").value,
        cpuTier: document.getElementById("runCpuTier").value,
        gpuTier: document.getElementById("runGpuTier").value,
        ram: Number(document.getElementById("runRam").value || 0),
        storage: document.getElementById("runStorage").value
      })
    });
    document.getElementById("runStatus").textContent = result.verdict;
  });

  document.getElementById("recommendRun").addEventListener("click", async () => {
    const result = await api("/recommend-game", {
      method: "POST",
      body: JSON.stringify({ category: document.getElementById("recommendPick").value })
    });
    document.getElementById("recommendStatus").textContent = `${result.recommendation.name}: ${result.reason}`;
  });

  document.getElementById("dealRun").addEventListener("click", async () => {
    const deals = await api("/deal-finder", { method: "POST", body: JSON.stringify({}) });
    document.getElementById("toolDeals").innerHTML = deals.slice(0, 3).map((item) => `<article class="card compact-card"><h4>${item.name}</h4><p>${currency(item.price)}</p></article>`).join("");
  });

  document.getElementById("chatRun").addEventListener("click", async () => {
    const result = await api("/chat", {
      method: "POST",
      body: JSON.stringify({ message: document.getElementById("chatMessage").value })
    });
    document.getElementById("chatStatus").textContent = result.reply;
  });
}

async function init() {
  try {
    initResponsiveHeader();
    initMobileNav();
    updateCartUi();
    ensureCheckoutModal();
    if (page === "home") await loadHome();
    if (page === "games") await loadGamesPage();
    if (page === "admin") await loadAdminPage();
    if (page === "game") await loadGamePage();
    if (page === "products") await loadProductsPage();
    if (page === "product") await loadProductPage();
    if (page === "blog") await loadBlogPage();
    if (page === "news") await loadNewsPage();
    if (page === "post") await loadPostPage();
    if (page === "deals") await loadDealsPage();
    if (page === "pc-builder") await loadPcBuilderPage();
  } catch (error) {
    const target = document.querySelector("main") || document.body;
    target.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

init();
