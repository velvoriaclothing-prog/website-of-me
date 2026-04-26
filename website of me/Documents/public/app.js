const page = document.body.dataset.page;
const adminDashboardState = {
  lastGeneratedKey: "",
  lastGeneratedEmail: ""
};

function currentPath() {
  return window.location.pathname === "/" ? "/index.html" : window.location.pathname;
}

function ensureToastRoot() {
  let root = qs("toastRoot");
  if (root) return root;
  root = document.createElement("div");
  root.id = "toastRoot";
  root.className = "toast-root";
  document.body.appendChild(root);
  return root;
}

function showToast(message, tone = "info") {
  if (!message) return;
  const root = ensureToastRoot();
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  root.appendChild(toast);
  window.setTimeout(() => toast.classList.add("toast-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.disabled = true;
  button.classList.add("is-loading");
  if (loadingText) button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.originalText || original;
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function qs(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = typeof id === "string" ? qs(id) : id;
  if (element) element.textContent = value;
}

function accessPageForSession(session) {
  if (!session) return "/login.html";
  if (session.accessState === "verified") return "/";
  if (session.user?.paymentStatus === "approved") return "/enter-key.html";
  return "/payment.html";
}

function enforceFrontendAccess(session) {
  if (page === "login" || page === "admin") return true;
  const path = currentPath();
  const allowedBeforeVerified = new Set(["/payment.html", "/enter-key.html"]);
  if (session?.accessState !== "verified") {
    document.querySelectorAll('.nav-links a[href], .nav-actions a[href]').forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("/") && !["/payment.html", "/enter-key.html", "/admin", "/login.html"].includes(href)) {
        link.classList.add("hidden");
      }
    });
    if (!allowedBeforeVerified.has(path)) {
      window.location.href = accessPageForSession(session);
      return false;
    }
  }
  return true;
}

function formatDateTime(value) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function copyText(value) {
  const text = String(value || "");
  if (!text) throw new Error("Nothing to copy yet.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  document.body.removeChild(helper);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateUserLabels(session) {
  document.querySelectorAll("[data-user-label]").forEach((node) => {
    if (session?.user?.email) {
      node.textContent = session.user.email;
    }
  });
}

function bindLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api("/auth/logout", { method: "POST" });
      window.location.href = "/login.html";
    });
  });
}

function ensureAdminHeaderLink() {
  document.querySelectorAll(".nav-actions").forEach((actions) => {
    if (actions.querySelector("[data-admin-link]")) return;
    const link = document.createElement("a");
    link.href = "/admin";
    link.className = "btn btn-secondary nav-admin-button";
    link.dataset.adminLink = "1";
    link.textContent = "Admin";
    actions.insertBefore(link, actions.firstChild || null);
  });
}

function getSlugFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || "";
}

function telegramLink(baseUrl, gameName) {
  const text = `Hi, I want to buy ${gameName}. Please help me on Telegram.`;
  return `${baseUrl}?text=${encodeURIComponent(text)}`;
}

function ensureAdminAccessMarkup() {
  if (qs("adminAccessModal")) return true;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="adminAccessModal" class="admin-access-modal hidden">
      <div class="admin-access-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">private admin access</p>
            <h2 class="section-title">Admin sign in</h2>
          </div>
          <button id="closeAdminAccess" class="btn btn-secondary" type="button">Close</button>
        </div>
        <form id="adminLoginForm" class="stack">
          <input id="adminUsername" class="input" autocomplete="username" placeholder="Username">
          <input id="adminPassword" class="input" autocomplete="current-password" type="password" placeholder="Password">
          <button class="btn btn-primary btn-block" type="submit">Open Admin Panel</button>
        </form>
        <button id="toggleAdminRecovery" class="btn btn-secondary btn-block" type="button">Forgot Password?</button>
        <form id="adminRecoveryForm" class="stack hidden">
          <input id="recoveryCode1" class="input" type="password" placeholder="Recovery code 1">
          <input id="recoveryCode2" class="input" type="password" placeholder="Recovery code 2">
          <input id="recoveryNextPassword" class="input" type="password" placeholder="New admin password">
          <button class="btn btn-secondary btn-block" type="submit">Reset Password</button>
        </form>
        <p id="adminAccessStatus" class="status"></p>
      </div>
    </div>
  `);
  return Boolean(qs("adminAccessModal"));
}

function bindAdminAccessUi(config = {}) {
  if (page === "admin") return;
  if (document.body.dataset.adminAccessBound === "1") return;
  document.body.dataset.adminAccessBound = "1";

  const params = new URLSearchParams(window.location.search);
  const modalReady = ensureAdminAccessMarkup();
  const adminModal = qs("adminAccessModal");

  const openAdminAccess = () => {
    if (!modalReady || !adminModal) {
      window.location.href = "/admin.html";
      return;
    }
    adminModal.classList.remove("hidden");
    setText("adminAccessStatus", "");
  };

  const closeAdminAccess = () => {
    adminModal?.classList.add("hidden");
    setText("adminAccessStatus", "");
  };

  if (params.get("mode") === "admin") {
    openAdminAccess();
  }

  qs("closeAdminAccess")?.addEventListener("click", closeAdminAccess);
  adminModal?.addEventListener("click", (event) => {
    if (event.target === adminModal) {
      closeAdminAccess();
    }
  });

  qs("toggleAdminRecovery")?.addEventListener("click", () => {
    qs("adminRecoveryForm")?.classList.toggle("hidden");
    setText("adminAccessStatus", config.adminRecoveryEnabled ? "" : "Recovery is not available right now.");
  });

  qs("adminLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({
          username: qs("adminUsername")?.value || "",
          password: qs("adminPassword")?.value || ""
        })
      });
      window.location.href = "/admin.html";
    } catch (error) {
      setText("adminAccessStatus", error.message);
    }
  });

  qs("adminRecoveryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/auth/admin/recovery", {
        method: "POST",
        body: JSON.stringify({
          code1: qs("recoveryCode1")?.value || "",
          code2: qs("recoveryCode2")?.value || "",
          nextPassword: qs("recoveryNextPassword")?.value || ""
        })
      });
      setText("adminAccessStatus", "Password updated. You can sign in now.");
      qs("adminRecoveryForm")?.classList.add("hidden");
    } catch (error) {
      setText("adminAccessStatus", error.message);
    }
  });
}

async function loadSession() {
  const session = await api("/api/session");
  updateUserLabels(session);
  bindLogout();
  return session;
}

async function initLoginPage() {
  const config = await api("/auth/config");
  const params = new URLSearchParams(window.location.search);
  if (config.accessState === "verified") {
    window.location.href = "/";
    return;
  }
  if (config.accessState !== "guest") {
    window.location.href = config.session?.paymentStatus === "approved" ? "/enter-key.html" : "/payment.html";
    return;
  }

  if (!config.googleEnabled) {
    const link = qs("googleLoginLink");
    if (link) {
      link.classList.add("btn-secondary");
      link.classList.remove("btn-primary");
      link.textContent = "Google sign-in coming soon";
      link.href = "#";
    }
    setText("loginStatus", config.googleMessage || "Google sign-in will be available soon.");
  }
  if (params.get("google") === "disabled") {
    setText("loginStatus", config.googleMessage || "Google sign-in will be available soon.");
  }
  if (params.get("error") === "google") {
    setText("loginStatus", "We could not complete Google sign-in. Please try again.");
    showToast("We could not complete Google sign-in", "warning");
  }
  bindAdminAccessUi(config);
}

async function initPaymentPage() {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
  if (session.accessState === "verified") {
    window.location.href = "/";
    return;
  }
  if (session.user?.paymentStatus === "approved") {
    window.location.href = "/enter-key.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "success") showToast("Logged in successfully", "success");
  setText("paymentIntroCopy", `Pay ₹${session.settings.accessPriceInr}, then message us on Telegram so we can approve your access key.`);
  setText("accessPrice", String(session.settings.accessPriceInr));
  if (qs("paymentQrImage")) qs("paymentQrImage").src = session.settings.paymentQrUrl;

  qs("paymentNotifyButton")?.addEventListener("click", async () => {
    const restoreButton = setButtonLoading(qs("paymentNotifyButton"), "Opening Telegram...");
    try {
      const result = await api("/api/payment/request", { method: "POST" });
      setText("paymentStatus", "Telegram is opening with your payment verification message.");
      showToast("Payment message is ready on Telegram", "success");
      window.location.href = result.telegramUrl;
    } catch (error) {
      setText("paymentStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });
}

async function initEnterKeyPage() {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
  if (session.accessState === "verified") {
    window.location.href = "/";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "success") showToast("Logged in successfully", "success");
  setText(
    "enterKeyNotice",
    session.user?.paymentStatus === "unpaid"
      ? "Complete payment first, then use your one-time key here."
      : "Your access unlocks permanently after a valid one-time key."
  );

  qs("activationForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const restoreButton = setButtonLoading(qs("activateAccessButton"), "Unlocking...");
    try {
      const result = await api("/api/access/activate", {
        method: "POST",
        body: JSON.stringify({ key: qs("activationKey")?.value || "" })
      });
      setText("activationStatus", "Access unlocked");
      showToast("Access unlocked", "success");
      window.setTimeout(() => {
        window.location.href = result.redirect || "/";
      }, 450);
    } catch (error) {
      setText("activationStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });
}

async function initHomePage() {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
}

function renderPcGameCard(game) {
  return `
    <article class="card game-card premium-game-card">
      ${game.image ? `<img class="game-thumb premium-game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="game-thumb game-thumb-fallback premium-game-thumb">${escapeHtml(game.name.slice(0, 1) || "G")}</div>`}
      <div class="game-card-body">
        <p class="eyebrow">Premium account</p>
        <strong>${escapeHtml(game.name)}</strong>
        <p class="game-summary">${escapeHtml(game.description)}</p>
      </div>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/game/${encodeURIComponent(game.slug)}">View Game</a>
      </div>
    </article>
  `;
}

async function initPcGamesPage() {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
  const result = await api("/api/games");
  const grid = qs("gamesGrid");
  if (!grid) return;
  if (!result.items.length) {
    grid.innerHTML = `<div class="empty">No PC games are available right now.</div>`;
    return;
  }
  grid.innerHTML = result.items.map(renderPcGameCard).join("");
}

async function initGamePage() {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
  const slug = getSlugFromPath();
  const game = await api(`/api/games/${encodeURIComponent(slug)}`);
  const wrap = qs("gameDetail");
  if (!wrap) return;
  wrap.innerHTML = `
    <section class="panel">
      <article class="detail-hero">
        ${game.image ? `<img class="detail-image" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : ""}
        <p class="eyebrow">${escapeHtml(game.platform)}</p>
        <h1>${escapeHtml(game.name)}</h1>
        <p class="hero-copy">${escapeHtml(game.description)}</p>
      </article>
    </section>
    <aside class="panel">
      <h2 class="section-title">Game Access</h2>
      <p class="hero-copy">Your game login details appear only after your verified access is confirmed.</p>
      <div id="credentialsBox" class="card compact-card credentials-box credentials-box-hidden" style="margin-top:16px;">
        <p><strong>ID</strong></p>
        <p class="masked-secret">********</p>
        <p><strong>Password</strong></p>
        <p class="masked-secret">********</p>
      </div>
      <button id="unlockCredentialsButton" class="btn btn-primary btn-block" type="button">Unlock Credentials</button>
      <p id="gameStatus" class="status"></p>
    </aside>
  `;

  qs("unlockCredentialsButton")?.addEventListener("click", async () => {
    if (session.accessState !== "verified") {
      setText("gameStatus", "Complete payment first");
      showToast("Complete payment first", "warning");
      return;
    }
    const restoreButton = setButtonLoading(qs("unlockCredentialsButton"), "Unlocking...");
    try {
      const credentials = await api(`/api/games/${encodeURIComponent(slug)}/credentials`);
      const box = qs("credentialsBox");
      box.innerHTML = `
        <p><strong>ID</strong></p>
        <p>${escapeHtml(credentials.accountId)}</p>
        <p><strong>Password</strong></p>
        <p>${escapeHtml(credentials.accountPassword)}</p>
      `;
      box.classList.remove("credentials-box-hidden");
      box.classList.add("credentials-box-revealed");
      setText("gameStatus", "Credentials unlocked");
      showToast("Credentials unlocked", "success");
    } catch (error) {
      setText("gameStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });
}

function renderConsoleCard(game, telegramUrl) {
  const href = telegramLink(telegramUrl, game.name);
  return `
    <article class="card console-game-card">
      ${game.image ? `<img class="game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : ""}
      <div class="console-game-content">
        <h3 class="card-title">${escapeHtml(game.name)}</h3>
        <p class="hero-copy">${escapeHtml(game.description)}</p>
        <a class="btn btn-primary" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Message Us On Telegram</a>
      </div>
    </article>
  `;
}

async function initConsolePage(platform) {
  const session = await loadSession();
  if (!enforceFrontendAccess(session)) return;
  bindAdminAccessUi(session?.settings || {});
  const result = await api(`/api/console/${platform}`);
  const grid = qs("consoleCatalogGrid");
  if (!grid) return;
  if (!result.items.length) {
    grid.innerHTML = `<div class="empty">No ${platform} games are available right now.</div>`;
    return;
  }
  grid.innerHTML = result.items.map((item) => renderConsoleCard(item, session.settings.telegramUrl)).join("");
}

function renderUserCard(user) {
  const approveDisabled = user.verified || user.paymentStatus === "approved";
  const generateDisabled = user.verified || user.paymentStatus !== "approved";
  const comboDisabled = user.verified;
  const statusClass = user.verified
    ? "admin-pill admin-pill-success"
    : user.paymentStatus === "approved"
      ? "admin-pill admin-pill-warning"
      : user.paymentStatus === "pending"
        ? "admin-pill admin-pill-warning"
        : "admin-pill";
  const statusLabel = user.verified
    ? "Verified"
    : user.paymentStatus === "approved"
      ? "Approved"
      : user.paymentStatus === "pending"
        ? "Pending Payment"
        : "Unpaid";
  return `
    <article class="card compact-card admin-user-card">
      <div class="admin-card-head">
        <div class="stack" style="gap:4px;">
          <strong>${escapeHtml(user.email)}</strong>
          <span class="muted">${escapeHtml(user.name || "Player")}</span>
        </div>
        <span class="${statusClass}">${statusLabel}</span>
      </div>
      <div class="stack admin-card-meta">
        <p>Payment: ${escapeHtml(user.paymentStatus)}</p>
        <p>Unused keys: ${escapeHtml(String(user.unusedKeyCount || 0))}</p>
        <p>Latest key: ${escapeHtml(user.latestKeyPreview || "No key yet")}</p>
      </div>
      <div class="inline-actions">
        <button class="btn btn-secondary admin-approve-user-btn" type="button" data-user-id="${escapeHtml(user.id)}" ${approveDisabled ? "disabled" : ""}>Approve User</button>
        <button class="btn btn-primary admin-generate-key-btn" type="button" data-user-id="${escapeHtml(user.id)}" data-user-email="${escapeHtml(user.email)}" ${generateDisabled ? "disabled" : ""}>Generate Linked Key</button>
        <button class="btn btn-secondary admin-approve-generate-key-btn" type="button" data-user-id="${escapeHtml(user.id)}" data-user-email="${escapeHtml(user.email)}" ${comboDisabled ? "disabled" : ""}>Approve + Generate Key</button>
      </div>
    </article>
  `;
}

function renderKeyCard(key, users = []) {
  const assignableUsers = users.filter((user) => !user.verified && user.paymentStatus === "approved");
  const canAssign = !key.used && !key.userId && assignableUsers.length > 0;
  const options = assignableUsers.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.email)}</option>`).join("");
  return `
    <article class="card compact-card admin-key-card">
      <div class="admin-card-head">
        <strong>${escapeHtml(key.keyPreview || "Hidden Key")}</strong>
        <span class="${key.used ? "admin-pill" : "admin-pill admin-pill-success"}">${key.used ? "Used" : "Unused"}</span>
      </div>
      <div class="stack admin-card-meta">
        <p>Linked email: ${escapeHtml(key.linkedEmail || key.email || "Not linked")}</p>
        <p>Created: ${escapeHtml(formatDateTime(key.createdAt))}</p>
        <p>${key.used ? `Used: ${escapeHtml(formatDateTime(key.usedAt))}` : "Ready to activate"}</p>
      </div>
      <div class="inline-actions">
        <button class="btn btn-primary admin-copy-key-btn" type="button" data-key-preview="${escapeHtml(key.keyPreview || "")}" ${key.keyPreview ? "" : "disabled"}>Copy Key</button>
      </div>
      ${canAssign ? `
      <div class="inline-actions admin-key-assign-row">
        <select class="select admin-key-user-select" data-key-id="${escapeHtml(key.id)}">
          <option value="">Assign to approved user</option>
          ${options}
        </select>
        <button class="btn btn-secondary admin-assign-key-btn" type="button" data-key-id="${escapeHtml(key.id)}">Assign Key</button>
      </div>
      ` : ""}
    </article>
  `;
}

function renderAdminGameCard(game) {
  return `
    <article class="card compact-card admin-game-item">
      <div class="admin-game-preview">
        ${game.image ? `<img class="admin-game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="admin-game-thumb admin-game-thumb-fallback">${escapeHtml(game.name.slice(0, 1) || "G")}</div>`}
      </div>
      <div class="admin-card-head">
        <div class="stack" style="gap:4px;">
          <strong>${escapeHtml(game.name)}</strong>
          <span class="muted">${escapeHtml(game.slug)}</span>
        </div>
        <span class="${game.platform === "PC" ? "admin-pill admin-pill-success" : "admin-pill"}">${escapeHtml(game.platform)}</span>
      </div>
      <label class="admin-field">
        <span class="admin-field-label">Game Name</span>
        <input class="input admin-edit-field" data-field="name" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.name)}">
      </label>
      <label class="admin-field">
        <span class="admin-field-label">Platform</span>
        <select class="select admin-edit-field" data-field="platform" data-game-id="${escapeHtml(game.id)}">
          <option value="PC" ${game.platform === "PC" ? "selected" : ""}>PC</option>
          <option value="PS4" ${game.platform === "PS4" ? "selected" : ""}>PS4</option>
          <option value="PS5" ${game.platform === "PS5" ? "selected" : ""}>PS5</option>
        </select>
      </label>
      <label class="admin-field">
        <span class="admin-field-label">Image URL</span>
        <input class="input admin-edit-field" data-field="image" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.image || "")}" placeholder="Image URL">
      </label>
      <label class="admin-field">
        <span class="admin-field-label">Description</span>
        <textarea class="textarea admin-edit-field" data-field="description" data-game-id="${escapeHtml(game.id)}" rows="3">${escapeHtml(game.description)}</textarea>
      </label>
      <label class="admin-field">
        <span class="admin-field-label">Game ID</span>
        <input class="input admin-edit-field" data-field="accountId" data-game-id="${escapeHtml(game.id)}" placeholder="New ID for PC only">
      </label>
      <label class="admin-field">
        <span class="admin-field-label">Game Password</span>
        <input class="input admin-edit-field" data-field="accountPassword" data-game-id="${escapeHtml(game.id)}" placeholder="New password for PC only">
      </label>
      <p class="muted">Credentials saved: ${game.hasCredentials ? "Yes" : "No"}</p>
      <div class="inline-actions">
        <button class="btn btn-primary admin-save-game-btn" type="button" data-game-id="${escapeHtml(game.id)}">Save</button>
        <button class="btn btn-danger admin-delete-game-btn" type="button" data-game-id="${escapeHtml(game.id)}">Delete</button>
      </div>
    </article>
  `;
}

function renderGeneratedKey(result) {
  adminDashboardState.lastGeneratedKey = result?.generatedKey || "";
  adminDashboardState.lastGeneratedEmail = result?.user?.email || "";
  const card = qs("generatedKeyCard");
  if (!card) return;
  card.classList.toggle("hidden", !adminDashboardState.lastGeneratedKey);
  setText("generatedKeyValue", adminDashboardState.lastGeneratedKey || "----");
  setText(
    "generatedKeyMeta",
    adminDashboardState.lastGeneratedEmail
      ? `Linked to ${adminDashboardState.lastGeneratedEmail}`
      : "Unassigned key ready to copy or assign."
  );
}

async function loadAdmin() {
  const [overview, usersResult, keysResult, gamesResult] = await Promise.all([
    api("/api/admin/overview"),
    api("/api/admin/users"),
    api("/api/admin/keys"),
    api("/api/admin/games")
  ]);

  setText("statUsers", String(overview.stats.users || 0));
  setText("statVerifiedUsers", String(overview.stats.verifiedUsers || 0));
  setText("statPendingPayments", String(overview.stats.pendingPayments || 0));
  setText("statUnusedKeys", String(overview.stats.unusedKeys || 0));
  setText("adminNoticeCopy", overview.settings.adminNotice);

  const users = usersResult.items || [];
  const keys = keysResult.items || [];
  const games = gamesResult.items || [];

  const usersWrap = qs("adminUsersGrid");
  if (usersWrap) {
    usersWrap.innerHTML = users.length ? users.map(renderUserCard).join("") : `<div class="empty">No users have signed in yet.</div>`;
  }

  const keysWrap = qs("adminKeysGrid");
  if (keysWrap) {
    keysWrap.innerHTML = keys.length ? keys.map((key) => renderKeyCard(key, users)).join("") : `<div class="empty">No access keys created yet.</div>`;
  }

  const gamesWrap = qs("adminGamesGrid");
  if (gamesWrap) {
    gamesWrap.innerHTML = games.length ? games.map(renderAdminGameCard).join("") : `<div class="empty">No games added yet.</div>`;
  }

  if (qs("settingsSiteTitle")) qs("settingsSiteTitle").value = overview.settings.siteTitle || "";
  if (qs("settingsSiteTagline")) qs("settingsSiteTagline").value = overview.settings.siteTagline || "";
  if (qs("settingsLogoUrl")) qs("settingsLogoUrl").value = overview.settings.logoUrl || "";
  if (qs("settingsQrUrl")) qs("settingsQrUrl").value = overview.settings.paymentQrUrl || "";
  if (qs("settingsTelegramUrl")) qs("settingsTelegramUrl").value = overview.settings.telegramUrl || "";
  if (qs("settingsAccessPrice")) qs("settingsAccessPrice").value = overview.settings.accessPriceInr || 20;
  if (qs("settingsDescription")) qs("settingsDescription").value = overview.settings.siteDescription || "";
  if (qs("settingsAdminNotice")) qs("settingsAdminNotice").value = overview.settings.adminNotice || "";
}

async function initAdminPage() {
  try {
    await loadSession();
    await loadAdmin();
  } catch (error) {
    if (/login required|admin access required|request failed/i.test(String(error.message || ""))) {
      window.location.href = "/login.html?mode=admin";
      return;
    }
    throw error;
  }

  qs("adminUsersGrid")?.addEventListener("click", async (event) => {
    const approveButton = event.target.closest(".admin-approve-user-btn");
    if (approveButton) {
      const restoreButton = setButtonLoading(approveButton, "Approving...");
      try {
        const result = await api("/api/admin/approve-user", {
          method: "POST",
          body: JSON.stringify({ userId: approveButton.dataset.userId })
        });
        setText("adminUsersStatus", `${result.user.email} is approved and ready for key delivery.`);
        showToast("User approved", "success");
        await loadAdmin();
      } catch (error) {
        setText("adminUsersStatus", error.message);
        showToast(error.message, "warning");
      } finally {
        restoreButton();
      }
      return;
    }

    const comboButton = event.target.closest(".admin-approve-generate-key-btn");
    if (comboButton) {
      const restoreButton = setButtonLoading(comboButton, "Processing...");
      try {
        const result = await api("/api/admin/approve-and-generate-key", {
          method: "POST",
          body: JSON.stringify({ userId: comboButton.dataset.userId })
        });
        renderGeneratedKey(result);
        try {
          await copyText(result.generatedKey);
          setText("adminKeyStatus", `Key generated for ${result.user.email} and copied automatically.`);
        } catch (_copyError) {
          setText("adminKeyStatus", `Key generated for ${result.user.email}. Copy it from the card above.`);
        }
        setText("adminUsersStatus", `${result.user.email} is approved and now has an unused one-time key.`);
        showToast("Approved and key copied", "success");
        await loadAdmin();
      } catch (error) {
        setText("adminKeyStatus", error.message);
        showToast(error.message, "warning");
      } finally {
        restoreButton();
      }
      return;
    }

    const generateButton = event.target.closest(".admin-generate-key-btn");
    if (!generateButton) return;

    const restoreButton = setButtonLoading(generateButton, "Generating...");
    try {
      const result = await api("/api/admin/generate-key", {
        method: "POST",
        body: JSON.stringify({ userId: generateButton.dataset.userId })
      });
      renderGeneratedKey(result);
      try {
        await copyText(result.generatedKey);
        setText("adminKeyStatus", `Key generated for ${result.user.email} and copied automatically.`);
      } catch (_copyError) {
        setText("adminKeyStatus", `Key generated for ${result.user.email}. Copy it from the card above.`);
      }
      setText("adminUsersStatus", `${result.user.email} now has an unused one-time key.`);
      showToast("Key generated", "success");
      await loadAdmin();
    } catch (error) {
      setText("adminKeyStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });

  qs("adminKeysGrid")?.addEventListener("click", async (event) => {
    const copyButton = event.target.closest(".admin-copy-key-btn");
    if (copyButton) {
      try {
        await copyText(copyButton.dataset.keyPreview || "");
        setText("adminKeyStatus", "Key copied to clipboard.");
        showToast("Key copied", "success");
      } catch (error) {
        setText("adminKeyStatus", error.message);
        showToast(error.message, "warning");
      }
      return;
    }

    const assignButton = event.target.closest(".admin-assign-key-btn");
    if (!assignButton) return;

    const keyId = assignButton.dataset.keyId;
    const select = document.querySelector(`.admin-key-user-select[data-key-id="${CSS.escape(keyId)}"]`);
    const userId = select?.value || "";
    if (!userId) {
      setText("adminKeyStatus", "Choose an approved user before assigning this key.");
      showToast("Choose an approved user before assigning this key.", "warning");
      return;
    }

    try {
      const result = await api("/api/admin/assign-key", {
        method: "POST",
        body: JSON.stringify({ keyId, userId })
      });
      setText("adminKeyStatus", `Key assigned to ${result.user.email}.`);
      setText("adminUsersStatus", `${result.user.email} now has a linked access key.`);
      showToast("Key assigned", "success");
      await loadAdmin();
    } catch (error) {
      setText("adminKeyStatus", error.message);
      showToast(error.message, "warning");
    }
  });

  qs("generateStandaloneKeyButton")?.addEventListener("click", async () => {
    const restoreButton = setButtonLoading(qs("generateStandaloneKeyButton"), "Generating...");
    try {
      const result = await api("/api/admin/generate-key", {
        method: "POST",
        body: JSON.stringify({})
      });
      renderGeneratedKey(result);
      try {
        await copyText(result.generatedKey);
        setText("adminKeyStatus", "New unused key generated and copied automatically.");
      } catch (_copyError) {
        setText("adminKeyStatus", "New unused key generated. Copy it or assign it to an approved user.");
      }
      showToast("New key generated", "success");
      await loadAdmin();
    } catch (error) {
      setText("adminKeyStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });

  qs("refreshAdminKeysButton")?.addEventListener("click", async () => {
    try {
      await loadAdmin();
      setText("adminKeyStatus", "Key list refreshed.");
    } catch (error) {
      setText("adminKeyStatus", error.message);
    }
  });

  qs("copyGeneratedKeyButton")?.addEventListener("click", async () => {
    try {
      await copyText(adminDashboardState.lastGeneratedKey);
      setText("adminKeyStatus", "Key copied to clipboard.");
      showToast("Key copied", "success");
    } catch (error) {
      setText("adminKeyStatus", error.message);
      showToast(error.message, "warning");
    }
  });

  qs("adminGameForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const restoreButton = setButtonLoading(submitButton, "Adding...");
    try {
      await api("/api/admin/game", {
        method: "POST",
        body: JSON.stringify({
          name: qs("adminGameName")?.value || "",
          platform: qs("adminGamePlatform")?.value || "PC",
          image: qs("adminGameImage")?.value || "",
          description: qs("adminGameDescription")?.value || "",
          accountId: qs("adminGameAccountId")?.value || "",
          accountPassword: qs("adminGameAccountPassword")?.value || ""
        })
      });
      setText("adminGameStatus", "Game added successfully.");
      showToast("Game added", "success");
      event.target.reset();
      await loadAdmin();
    } catch (error) {
      setText("adminGameStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });

  qs("refreshAdminGamesButton")?.addEventListener("click", async () => {
    try {
      await loadAdmin();
      setText("adminGameStatus", "Game catalog refreshed.");
    } catch (error) {
      setText("adminGameStatus", error.message);
    }
  });

  qs("adminGamesGrid")?.addEventListener("click", async (event) => {
    const saveButton = event.target.closest(".admin-save-game-btn");
    if (saveButton) {
      const restoreButton = setButtonLoading(saveButton, "Saving...");
      try {
        const gameId = saveButton.dataset.gameId;
        const fields = [...document.querySelectorAll(`.admin-edit-field[data-game-id="${gameId}"]`)];
        const payload = fields.reduce((acc, field) => {
          acc[field.dataset.field] = field.value;
          return acc;
        }, {});
        await api(`/api/admin/games/${encodeURIComponent(gameId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setText("adminGameStatus", "Game updated.");
        showToast("Game updated", "success");
        await loadAdmin();
      } catch (error) {
        setText("adminGameStatus", error.message);
        showToast(error.message, "warning");
      } finally {
        restoreButton();
      }
      return;
    }

    const button = event.target.closest(".admin-delete-game-btn");
    if (!button) return;
    const restoreButton = setButtonLoading(button, "Deleting...");
    try {
      await api(`/api/admin/games/${encodeURIComponent(button.dataset.gameId)}`, { method: "DELETE" });
      setText("adminGameStatus", "Game removed.");
      showToast("Game removed", "success");
      await loadAdmin();
    } catch (error) {
      setText("adminGameStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restoreButton();
    }
  });

  qs("adminSettingsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({
          siteTitle: qs("settingsSiteTitle")?.value || "",
          siteTagline: qs("settingsSiteTagline")?.value || "",
          logoUrl: qs("settingsLogoUrl")?.value || "",
          paymentQrUrl: qs("settingsQrUrl")?.value || "",
          telegramUrl: qs("settingsTelegramUrl")?.value || "",
          accessPriceInr: Number(qs("settingsAccessPrice")?.value || 20),
          siteDescription: qs("settingsDescription")?.value || "",
          adminNotice: qs("settingsAdminNotice")?.value || ""
        })
      });
      setText("adminSettingsStatus", "Settings saved.");
      await loadAdmin();
    } catch (error) {
      setText("adminSettingsStatus", error.message);
    }
  });

  renderGeneratedKey();
}

async function init() {
  ensureAdminHeaderLink();
  if (page === "login") return initLoginPage();
  if (page === "payment") return initPaymentPage();
  if (page === "enter-key") return initEnterKeyPage();
  if (page === "home") return initHomePage();
  if (page === "pc-games") return initPcGamesPage();
  if (page === "game") return initGamePage();
  if (page === "ps4-games") return initConsolePage("PS4");
  if (page === "ps5-games") return initConsolePage("PS5");
  if (page === "admin") return initAdminPage();
}

init().catch((error) => {
  const target = document.querySelector("main") || document.body;
  const message = `<div class="panel"><p class="status">${escapeHtml(error.message)}</p></div>`;
  if (target) target.insertAdjacentHTML("afterbegin", message);
});
