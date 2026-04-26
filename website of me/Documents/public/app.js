const page = document.body.dataset.page;
const adminDashboardState = {
  lastGeneratedKey: "",
  lastGeneratedEmail: ""
};

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

function ensureHiddenAdminTrigger() {
  if (page === "admin") return null;
  let trigger = qs("hiddenAdminAccess");
  if (trigger) {
    trigger.classList.add("fixed-admin-trigger");
    return trigger;
  }
  trigger = document.createElement("button");
  trigger.id = "hiddenAdminAccess";
  trigger.type = "button";
  trigger.className = "hidden-admin-button fixed-admin-trigger";
  trigger.setAttribute("aria-label", "Open admin access");
  document.body.appendChild(trigger);
  return trigger;
}

function bindAdminAccessUi(config = {}) {
  if (page === "admin") return;
  if (document.body.dataset.adminAccessBound === "1") return;
  document.body.dataset.adminAccessBound = "1";

  const params = new URLSearchParams(window.location.search);
  const modalReady = ensureAdminAccessMarkup();
  const trigger = ensureHiddenAdminTrigger();
  const adminModal = qs("adminAccessModal");
  let logoClicks = 0;
  let logoTimer = 0;

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

  trigger?.addEventListener("click", openAdminAccess);

  document.querySelectorAll(".brand").forEach((brand) => {
    brand.addEventListener("click", (event) => {
      logoClicks += 1;
      window.clearTimeout(logoTimer);
      logoTimer = window.setTimeout(() => {
        logoClicks = 0;
      }, 1600);
      if (logoClicks >= 5) {
        event.preventDefault();
        logoClicks = 0;
        openAdminAccess();
      }
    });
  });

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
    window.location.href = "/payment.html";
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
  }
  bindAdminAccessUi(config);
}

async function initPaymentPage() {
  const session = await loadSession();
  bindAdminAccessUi(session?.settings || {});
  if (session.accessState === "verified") {
    window.location.href = "/";
    return;
  }

  setText("paymentIntroCopy", `Pay ₹${session.settings.accessPriceInr}, then message us on Telegram so we can approve your access key.`);
  setText("accessPrice", String(session.settings.accessPriceInr));
  if (qs("paymentQrImage")) qs("paymentQrImage").src = session.settings.paymentQrUrl;

  qs("paymentNotifyButton")?.addEventListener("click", async () => {
    try {
      const result = await api("/api/payment/request", { method: "POST" });
      setText("paymentStatus", "Telegram is opening with your payment verification message.");
      window.location.href = result.telegramUrl;
    } catch (error) {
      setText("paymentStatus", error.message);
    }
  });

  qs("activationForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/access/activate", {
        method: "POST",
        body: JSON.stringify({ key: qs("activationKey")?.value || "" })
      });
      setText("activationStatus", "Access unlocked. Redirecting...");
      window.location.href = result.redirect || "/";
    } catch (error) {
      setText("activationStatus", error.message);
    }
  });

  if (session.accessState === "awaiting-key") {
    setText("paymentStatus", "Payment recorded. Enter your access key as soon as it reaches you.");
  }
}

async function initHomePage() {
  const session = await loadSession();
  bindAdminAccessUi(session?.settings || {});
}

function renderPcGameCard(game) {
  return `
    <article class="card game-card">
      ${game.image ? `<img class="game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="game-thumb game-thumb-fallback">${escapeHtml(game.name.slice(0, 1) || "G")}</div>`}
      <strong>${escapeHtml(game.name)}</strong>
      <p class="game-summary">${escapeHtml(game.description)}</p>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/game/${encodeURIComponent(game.slug)}">View Game</a>
      </div>
    </article>
  `;
}

async function initPcGamesPage() {
  const session = await loadSession();
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
      <button id="unlockCredentialsButton" class="btn btn-primary btn-block" type="button">Unlock Game Access</button>
      <div id="credentialsBox" class="stack" style="margin-top:16px;"></div>
      <p id="gameStatus" class="status"></p>
    </aside>
  `;

  qs("unlockCredentialsButton")?.addEventListener("click", async () => {
    try {
      const credentials = await api(`/api/games/${encodeURIComponent(slug)}/credentials`);
      qs("credentialsBox").innerHTML = `
        <div class="card compact-card">
          <p><strong>ID</strong></p>
          <p>${escapeHtml(credentials.accountId)}</p>
          <p><strong>Password</strong></p>
          <p>${escapeHtml(credentials.accountPassword)}</p>
        </div>
      `;
      setText("gameStatus", "Game access unlocked successfully.");
    } catch (error) {
      setText("gameStatus", error.message);
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
        <button class="btn btn-primary admin-generate-key-btn" type="button" data-user-id="${escapeHtml(user.id)}" data-user-email="${escapeHtml(user.email)}" ${generateDisabled ? "disabled" : ""}>Generate Key</button>
      </div>
    </article>
  `;
}

function renderKeyCard(key) {
  return `
    <article class="card compact-card admin-key-card">
      <div class="admin-card-head">
        <strong>${escapeHtml(key.keyPreview || "Hidden Key")}</strong>
        <span class="${key.used ? "admin-pill" : "admin-pill admin-pill-success"}">${key.used ? "Used" : "Unused"}</span>
      </div>
      <div class="stack admin-card-meta">
        <p>Linked email: ${escapeHtml(key.email || "Not linked")}</p>
        <p>Created: ${escapeHtml(formatDateTime(key.createdAt))}</p>
        <p>${key.used ? `Used: ${escapeHtml(formatDateTime(key.usedAt))}` : "Ready to activate"}</p>
      </div>
    </article>
  `;
}

function renderAdminGameCard(game) {
  return `
    <article class="card compact-card admin-game-item">
      <div class="admin-card-head">
        <strong>${escapeHtml(game.name)}</strong>
        <span class="${game.platform === "PC" ? "admin-pill admin-pill-success" : "admin-pill"}">${escapeHtml(game.platform)}</span>
      </div>
      <input class="input admin-edit-field" data-field="name" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.name)}">
      <select class="select admin-edit-field" data-field="platform" data-game-id="${escapeHtml(game.id)}">
        <option value="PC" ${game.platform === "PC" ? "selected" : ""}>PC</option>
        <option value="PS4" ${game.platform === "PS4" ? "selected" : ""}>PS4</option>
        <option value="PS5" ${game.platform === "PS5" ? "selected" : ""}>PS5</option>
      </select>
      <input class="input admin-edit-field" data-field="image" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.image || "")}" placeholder="Image URL">
      <textarea class="textarea admin-edit-field" data-field="description" data-game-id="${escapeHtml(game.id)}" rows="3">${escapeHtml(game.description)}</textarea>
      <input class="input admin-edit-field" data-field="accountId" data-game-id="${escapeHtml(game.id)}" placeholder="New ID for PC only">
      <input class="input admin-edit-field" data-field="accountPassword" data-game-id="${escapeHtml(game.id)}" placeholder="New password for PC only">
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
      : "Create a key from the Users section to show it here."
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
    keysWrap.innerHTML = keys.length ? keys.map(renderKeyCard).join("") : `<div class="empty">No access keys created yet.</div>`;
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
      try {
        const result = await api("/api/admin/approve-user", {
          method: "POST",
          body: JSON.stringify({ userId: approveButton.dataset.userId })
        });
        setText("adminUsersStatus", `${result.user.email} is approved and ready for key delivery.`);
        await loadAdmin();
      } catch (error) {
        setText("adminUsersStatus", error.message);
      }
      return;
    }

    const generateButton = event.target.closest(".admin-generate-key-btn");
    if (!generateButton) return;

    try {
      const result = await api("/api/admin/generate-key", {
        method: "POST",
        body: JSON.stringify({ userId: generateButton.dataset.userId })
      });
      renderGeneratedKey(result);
      setText("adminKeyStatus", `Key generated for ${result.user.email}. Copy it from the card above.`);
      setText("adminUsersStatus", `${result.user.email} now has an unused one-time key.`);
      await loadAdmin();
    } catch (error) {
      setText("adminKeyStatus", error.message);
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
    } catch (error) {
      setText("adminKeyStatus", error.message);
    }
  });

  qs("adminGameForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
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
      event.target.reset();
      await loadAdmin();
    } catch (error) {
      setText("adminGameStatus", error.message);
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
        await loadAdmin();
      } catch (error) {
        setText("adminGameStatus", error.message);
      }
      return;
    }

    const button = event.target.closest(".admin-delete-game-btn");
    if (!button) return;
    try {
      await api(`/api/admin/games/${encodeURIComponent(button.dataset.gameId)}`, { method: "DELETE" });
      setText("adminGameStatus", "Game removed.");
      await loadAdmin();
    } catch (error) {
      setText("adminGameStatus", error.message);
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
  if (page === "login") return initLoginPage();
  if (page === "payment") return initPaymentPage();
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
