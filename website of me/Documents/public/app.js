const page = document.body.dataset.page;

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

  const adminModal = qs("adminAccessModal");
  const toggleRecovery = () => {
    qs("adminRecoveryForm")?.classList.toggle("hidden");
  };

  qs("hiddenAdminAccess")?.addEventListener("click", () => {
    adminModal?.classList.remove("hidden");
    setText("adminAccessStatus", "");
  });
  if (params.get("mode") === "admin") {
    adminModal?.classList.remove("hidden");
  }

  qs("closeAdminAccess")?.addEventListener("click", () => {
    adminModal?.classList.add("hidden");
    setText("adminAccessStatus", "");
  });

  adminModal?.addEventListener("click", (event) => {
    if (event.target === adminModal) {
      adminModal.classList.add("hidden");
      setText("adminAccessStatus", "");
    }
  });

  qs("toggleAdminRecovery")?.addEventListener("click", () => {
    toggleRecovery();
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

async function initPaymentPage() {
  const session = await loadSession();
  if (session.accessState === "verified") {
    window.location.href = "/";
    return;
  }

  setText("paymentIntroCopy", `Pay ₹${session.settings.accessPriceInr} and message us on Telegram for verification.`);
  setText("accessPrice", String(session.settings.accessPriceInr));
  if (qs("paymentQrImage")) qs("paymentQrImage").src = session.settings.paymentQrUrl;

  qs("paymentNotifyButton")?.addEventListener("click", async () => {
    try {
      const result = await api("/api/payment/request", { method: "POST" });
      setText("paymentStatus", "Telegram is opening with your verification message.");
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
    setText("paymentStatus", "Payment recorded. Enter your one-time access key after approval.");
  }
}

async function initHomePage() {
  await loadSession();
}

function renderPcGameCard(game) {
  return `
    <article class="card game-card">
      ${game.image ? `<img class="game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="game-thumb game-thumb-fallback">${escapeHtml(game.name.slice(0, 1) || "G")}</div>`}
      <strong>${escapeHtml(game.name)}</strong>
      <p class="game-summary">${escapeHtml(game.description)}</p>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/game/${encodeURIComponent(game.slug)}">Open Detail</a>
      </div>
    </article>
  `;
}

async function initPcGamesPage() {
  await loadSession();
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
  await loadSession();
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
      <h2 class="section-title">Secure Delivery</h2>
      <p class="hero-copy">Credentials appear only after secure verification.</p>
      <button id="unlockCredentialsButton" class="btn btn-primary btn-block" type="button">Unlock ID &amp; Password</button>
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
      setText("gameStatus", "Credentials unlocked successfully.");
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
  const actionLabel = user.verified ? "Verified" : user.paymentStatus === "pending" ? "Approve And Generate Key" : "Generate Key";
  const disabled = user.verified ? "disabled" : "";
  return `
    <article class="card compact-card">
      <p><strong>${escapeHtml(user.name)}</strong></p>
      <p>${escapeHtml(user.email)}</p>
      <p>Status: ${escapeHtml(user.paymentStatus)}${user.verified ? " / verified" : ""}</p>
      <button class="btn btn-primary admin-approve-btn" type="button" data-user-id="${escapeHtml(user.id)}" ${disabled}>${actionLabel}</button>
    </article>
  `;
}

function renderAdminGameCard(game) {
  return `
    <article class="card compact-card admin-game-item">
      <input class="input admin-edit-field" data-field="name" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.name)}">
      <select class="select admin-edit-field" data-field="platform" data-game-id="${escapeHtml(game.id)}">
        <option value="PC" ${game.platform === "PC" ? "selected" : ""}>PC</option>
        <option value="PS4" ${game.platform === "PS4" ? "selected" : ""}>PS4</option>
        <option value="PS5" ${game.platform === "PS5" ? "selected" : ""}>PS5</option>
      </select>
      <input class="input admin-edit-field" data-field="image" data-game-id="${escapeHtml(game.id)}" value="${escapeHtml(game.image || "")}" placeholder="Image URL">
      <textarea class="textarea admin-edit-field" data-field="description" data-game-id="${escapeHtml(game.id)}" rows="3">${escapeHtml(game.description)}</textarea>
      <input class="input admin-edit-field" data-field="accountId" data-game-id="${escapeHtml(game.id)}" placeholder="New account ID for PC only">
      <input class="input admin-edit-field" data-field="accountPassword" data-game-id="${escapeHtml(game.id)}" placeholder="New password for PC only">
      <div class="inline-actions">
        <button class="btn btn-secondary admin-save-game-btn" type="button" data-game-id="${escapeHtml(game.id)}">Save</button>
        <button class="btn btn-danger admin-delete-game-btn" type="button" data-game-id="${escapeHtml(game.id)}">Delete</button>
      </div>
    </article>
  `;
}

async function loadAdmin() {
  const data = await api("/api/admin/overview");
  setText("statUsers", String(data.stats.users));
  setText("statVerifiedUsers", String(data.stats.verifiedUsers));
  setText("statPendingPayments", String(data.stats.pendingPayments));
  setText("statPcGames", String(data.stats.pcGames));
  setText("adminNoticeCopy", data.settings.adminNotice);

  const usersWrap = qs("adminUsersGrid");
  if (usersWrap) {
    usersWrap.innerHTML = data.users.length ? data.users.map(renderUserCard).join("") : `<div class="empty">No users yet.</div>`;
  }

  const gamesWrap = qs("adminGamesGrid");
  if (gamesWrap) {
    gamesWrap.innerHTML = data.games.length ? data.games.map(renderAdminGameCard).join("") : `<div class="empty">No games added yet.</div>`;
  }

  if (qs("settingsSiteTitle")) qs("settingsSiteTitle").value = data.settings.siteTitle || "";
  if (qs("settingsSiteTagline")) qs("settingsSiteTagline").value = data.settings.siteTagline || "";
  if (qs("settingsLogoUrl")) qs("settingsLogoUrl").value = data.settings.logoUrl || "";
  if (qs("settingsQrUrl")) qs("settingsQrUrl").value = data.settings.paymentQrUrl || "";
  if (qs("settingsTelegramUrl")) qs("settingsTelegramUrl").value = data.settings.telegramUrl || "";
  if (qs("settingsAccessPrice")) qs("settingsAccessPrice").value = data.settings.accessPriceInr || 20;
  if (qs("settingsDescription")) qs("settingsDescription").value = data.settings.siteDescription || "";
  if (qs("settingsAdminNotice")) qs("settingsAdminNotice").value = data.settings.adminNotice || "";
}

async function initAdminPage() {
  await loadSession();
  await loadAdmin();

  qs("adminUsersGrid")?.addEventListener("click", async (event) => {
    const button = event.target.closest(".admin-approve-btn");
    if (!button) return;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(button.dataset.userId)}/approve`, {
        method: "POST"
      });
      setText("adminKeyStatus", `Key generated for ${result.user.email}: ${result.generatedKey}`);
      await loadAdmin();
    } catch (error) {
      setText("adminKeyStatus", error.message);
    }
  });

  qs("adminGameForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/admin/games", {
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
