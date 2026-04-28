const page = document.body.dataset.page || "";

function qs(id) {
  return document.getElementById(id);
}

function setText(target, value) {
  const node = typeof target === "string" ? qs(target) : target;
  if (node) node.textContent = value || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function showToast(message, tone = "info") {
  if (!message) return;
  let root = qs("toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function setButtonLoading(button, text) {
  if (!button) return () => {};
  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.disabled = true;
  button.classList.add("is-loading");
  if (text) button.textContent = text;
  return () => {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.originalText || original;
  };
}

function bindLogout() {
  document.querySelectorAll("[data-logout-button]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api("/auth/logout", { method: "POST" });
      window.location.href = "/login.html";
    });
  });
}

function updateUserLabels(session) {
  document.querySelectorAll("[data-user-label]").forEach((node) => {
    node.textContent = session?.user?.email || "Player";
  });
}

function accessDestination(session) {
  if (!session?.user) return "/login.html";
  if (session.user.verified) return "/pc-games";
  if (session.user.paymentStatus === "approved") return "/enter-key.html";
  return "/payment.html";
}

async function loadSession() {
  const session = await api("/api/session");
  bindLogout();
  updateUserLabels(session);
  return session;
}

function requireUserFlow(session, allowedPage) {
  if (!session?.user) {
    window.location.href = "/login.html";
    return false;
  }
  const target = accessDestination(session);
  if (allowedPage !== target && !(allowedPage === "/pc-games" && target === "/pc-games")) {
    if (!(allowedPage === "/game" && target === "/pc-games")) {
      window.location.href = target;
      return false;
    }
  }
  return true;
}

function gameCardTemplate(game) {
  return `
    <article class="game-card">
      ${game.image ? `<img class="game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="game-thumb game-thumb-fallback">${escapeHtml((game.name || "G").slice(0, 1))}</div>`}
      <div class="game-card-body">
        <h3>${escapeHtml(game.name)}</h3>
        <p>${escapeHtml(game.description)}</p>
      </div>
      <a class="button button-primary button-block" href="/game/${encodeURIComponent(game.slug)}">View Game</a>
    </article>
  `;
}

function adminUserTemplate(user) {
  const status = user.verified ? "Verified" : user.paymentStatus === "approved" ? "Approved" : "Pending";
  return `
    <article class="admin-card">
      <div class="row-between">
        <div>
          <h3>${escapeHtml(user.email)}</h3>
          <p class="muted">${escapeHtml(user.name || "Player")}</p>
        </div>
        <span class="badge ${user.verified ? "badge-success" : user.paymentStatus === "approved" ? "badge-info" : "badge-warning"}">${status}</span>
      </div>
      <div class="button-row">
        <button class="button button-secondary admin-approve-user" data-user-id="${escapeHtml(user.id)}" ${user.paymentStatus === "approved" || user.verified ? "disabled" : ""}>Approve User</button>
        <button class="button button-primary admin-generate-user-key" data-user-id="${escapeHtml(user.id)}" ${user.paymentStatus !== "approved" || user.verified ? "disabled" : ""}>Generate Key</button>
      </div>
    </article>
  `;
}

function adminKeyTemplate(key) {
  return `
    <article class="admin-card">
      <div class="row-between">
        <h3>${escapeHtml(key.keyPreview || "Hidden key")}</h3>
        <span class="badge ${key.used ? "badge-warning" : "badge-success"}">${key.used ? "Used" : "Unused"}</span>
      </div>
      <p class="muted">Linked: ${escapeHtml(key.linkedEmail || "Not linked")}</p>
      <div class="button-row">
        <button class="button button-secondary admin-copy-key" data-key="${escapeHtml(key.keyPreview || "")}" ${key.keyPreview ? "" : "disabled"}>Copy</button>
      </div>
    </article>
  `;
}

function adminGameTemplate(game) {
  return `
    <article class="admin-card admin-game-card">
      ${game.image ? `<img class="admin-game-thumb" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : `<div class="admin-game-thumb admin-game-thumb-fallback">${escapeHtml((game.name || "G").slice(0, 1))}</div>`}
      <label class="field">
        <span>Name</span>
        <input class="input admin-game-field" data-game-id="${escapeHtml(game.id)}" data-field="name" value="${escapeHtml(game.name)}">
      </label>
      <label class="field">
        <span>Image URL</span>
        <input class="input admin-game-field" data-game-id="${escapeHtml(game.id)}" data-field="image" value="${escapeHtml(game.image || "")}">
      </label>
      <label class="field">
        <span>Upload New Image From PC</span>
        <input class="input file-input admin-game-image-file" data-game-id="${escapeHtml(game.id)}" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
      </label>
      <label class="field">
        <span>Description</span>
        <textarea class="textarea admin-game-field" data-game-id="${escapeHtml(game.id)}" data-field="description" rows="4">${escapeHtml(game.description)}</textarea>
      </label>
      <label class="field">
        <span>Account ID</span>
        <input class="input admin-game-field" data-game-id="${escapeHtml(game.id)}" data-field="accountId" placeholder="Leave blank to keep current">
      </label>
      <label class="field">
        <span>Account Password</span>
        <input class="input admin-game-field" data-game-id="${escapeHtml(game.id)}" data-field="accountPassword" placeholder="Leave blank to keep current">
      </label>
      <div class="button-row">
        <button class="button button-primary admin-save-game" data-game-id="${escapeHtml(game.id)}">Save</button>
        <button class="button button-danger admin-delete-game" data-game-id="${escapeHtml(game.id)}">Delete</button>
      </div>
    </article>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  if (!file) return "";
  const dataUrl = await readFileAsDataUrl(file);
  const result = await api("/api/admin/upload-image", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      dataUrl
    })
  });
  return result.imagePath || "";
}

async function initLoginPage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "admin") {
    window.location.href = "/admin";
    return;
  }
  const config = await api("/auth/config");
  if (config.session) {
    window.location.href = accessDestination({ user: config.session });
    return;
  }

  const googleLink = qs("googleLoginLink");
  if (googleLink && !config.googleEnabled) {
    googleLink.classList.remove("button-primary");
    googleLink.classList.add("button-secondary");
    googleLink.textContent = "Google login coming soon";
    googleLink.removeAttribute("href");
    setText("loginStatus", config.googleMessage || "Google login is not configured yet.");
  }
}

async function initPaymentPage() {
  const session = await loadSession();
  if (!requireUserFlow(session, "/payment.html")) return;
  if (session.user.paymentStatus === "approved") {
    window.location.href = "/enter-key.html";
    return;
  }

  setText("paymentPrice", String(session.settings.accessPriceInr || 20));
  if (qs("paymentQr")) qs("paymentQr").src = session.settings.paymentQrUrl;

  qs("paymentButton")?.addEventListener("click", async () => {
    const restore = setButtonLoading(qs("paymentButton"), "Saving...");
    try {
      const result = await api("/api/payment/request", { method: "POST" });
      setText("paymentStatus", "Payment request saved. Complete the Telegram message and wait for admin approval.");
      showToast("Payment request saved", "success");
      window.open(result.telegramUrl, "_blank", "noopener");
    } catch (error) {
      setText("paymentStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  window.setInterval(async () => {
    const latest = await api("/api/session").catch(() => null);
    if (!latest?.user) return;
    if (latest.user.verified) {
      window.location.href = "/pc-games";
      return;
    }
    if (latest.user.paymentStatus === "approved") {
      window.location.href = "/enter-key.html";
    }
  }, 5000);
}

async function initEnterKeyPage() {
  const session = await loadSession();
  if (!session?.user) {
    window.location.href = "/login.html";
    return;
  }
  if (session.user.verified) {
    window.location.href = "/pc-games";
    return;
  }
  if (session.user.paymentStatus !== "approved") {
    window.location.href = "/payment.html";
    return;
  }

  qs("activationForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const restore = setButtonLoading(qs("activateButton"), "Activating...");
    try {
      const result = await api("/api/access/activate", {
        method: "POST",
        body: JSON.stringify({ key: qs("activationKey")?.value || "" })
      });
      setText("activationStatus", "Access unlocked successfully.");
      showToast("Access unlocked", "success");
      window.setTimeout(() => {
        window.location.href = result.redirect || "/pc-games";
      }, 400);
    } catch (error) {
      setText("activationStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });
}

async function initGamesPage() {
  const session = await loadSession();
  if (!requireUserFlow(session, "/pc-games")) return;
  const result = await api("/api/games");
  const grid = qs("gamesGrid");
  if (!grid) return;
  grid.innerHTML = result.items.length
    ? result.items.map(gameCardTemplate).join("")
    : `<div class="empty-state">No games have been added yet.</div>`;
}

function slugFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || "";
}

async function initGamePage() {
  const session = await loadSession();
  if (!requireUserFlow(session, "/game")) return;
  const slug = slugFromPath();
  const game = await api(`/api/games/${encodeURIComponent(slug)}`);
  const shell = qs("gameDetail");
  if (!shell) return;
  shell.innerHTML = `
    <section class="detail-layout">
      <article class="panel">
        ${game.image ? `<img class="detail-image" src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}" loading="lazy">` : ""}
        <h1>${escapeHtml(game.name)}</h1>
        <p class="muted">${escapeHtml(game.description)}</p>
      </article>
      <aside class="panel">
        <h2>Unlock Credentials</h2>
        <p class="muted">Click the button below to fetch the game account ID and password securely from the backend.</p>
        <button id="unlockCredentialsButton" class="button button-primary button-block">Unlock Credentials</button>
        <div id="credentialsCard" class="credential-card hidden">
          <div>
            <span class="credential-label">ID</span>
            <strong id="credentialIdValue">********</strong>
          </div>
          <div>
            <span class="credential-label">Password</span>
            <strong id="credentialPasswordValue">********</strong>
          </div>
        </div>
        <p id="gameStatus" class="status-text"></p>
      </aside>
    </section>
  `;

  qs("unlockCredentialsButton")?.addEventListener("click", async () => {
    const restore = setButtonLoading(qs("unlockCredentialsButton"), "Unlocking...");
    try {
      const credentials = await api(`/api/games/${encodeURIComponent(slug)}/credentials`);
      setText("credentialIdValue", credentials.accountId);
      setText("credentialPasswordValue", credentials.accountPassword);
      qs("credentialsCard")?.classList.remove("hidden");
      setText("gameStatus", "Credentials unlocked.");
      showToast("Credentials unlocked", "success");
    } catch (error) {
      setText("gameStatus", error.message);
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = value;
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

async function initAdminPage() {
  const loginPanel = qs("adminLoginPanel");
  const dashboard = qs("adminDashboard");
  const loginStatus = qs("adminLoginStatus");

  async function loadDashboard() {
    const [overview, users, keys, games] = await Promise.all([
      api("/api/admin/overview"),
      api("/api/admin/users"),
      api("/api/admin/keys"),
      api("/api/admin/games")
    ]);

    loginPanel?.classList.add("hidden");
    dashboard?.classList.remove("hidden");
    bindLogout();

    setText("adminUsersCount", String(overview.stats.users || 0));
    setText("adminPendingCount", String(overview.stats.pendingPayments || 0));
    setText("adminKeysCount", String(overview.stats.unusedKeys || 0));
    setText("adminGamesCount", String(overview.stats.pcGames || 0));

    const usersGrid = qs("adminUsersGrid");
    if (usersGrid) {
      usersGrid.innerHTML = users.items.length
        ? users.items.map(adminUserTemplate).join("")
        : `<div class="empty-state">No users have logged in yet.</div>`;
    }

    const keysGrid = qs("adminKeysGrid");
    if (keysGrid) {
      keysGrid.innerHTML = keys.items.length
        ? keys.items.map(adminKeyTemplate).join("")
        : `<div class="empty-state">No keys generated yet.</div>`;
    }

    const gamesGrid = qs("adminGamesGrid");
    if (gamesGrid) {
      gamesGrid.innerHTML = games.items.length
        ? games.items.map(adminGameTemplate).join("")
        : `<div class="empty-state">No games added yet.</div>`;
    }
  }

  async function ensureAdminView() {
    try {
      await loadDashboard();
    } catch (_error) {
      loginPanel?.classList.remove("hidden");
      dashboard?.classList.add("hidden");
    }
  }

  qs("adminLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('button[type="submit"]');
    const restore = setButtonLoading(submit, "Signing in...");
    try {
      await api("/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({
          username: qs("adminUsername")?.value || "",
          password: qs("adminPassword")?.value || ""
        })
      });
      setText(loginStatus, "");
      showToast("Admin signed in", "success");
      await loadDashboard();
    } catch (error) {
      setText(loginStatus, error.message);
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  qs("generateStandaloneKeyButton")?.addEventListener("click", async () => {
    const restore = setButtonLoading(qs("generateStandaloneKeyButton"), "Generating...");
    try {
      const result = await api("/api/admin/generate-key", {
        method: "POST",
        body: JSON.stringify({})
      });
      setText("latestGeneratedKey", result.generatedKey || "");
      await copyText(result.generatedKey || "");
      showToast("Key generated and copied", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  qs("adminUsersGrid")?.addEventListener("click", async (event) => {
    const approveButton = event.target.closest(".admin-approve-user");
    if (approveButton) {
      const restore = setButtonLoading(approveButton, "Approving...");
      try {
        await api("/api/admin/approve-user", {
          method: "POST",
          body: JSON.stringify({ userId: approveButton.dataset.userId })
        });
        showToast("User approved", "success");
        await loadDashboard();
      } catch (error) {
        showToast(error.message, "warning");
      } finally {
        restore();
      }
      return;
    }

    const keyButton = event.target.closest(".admin-generate-user-key");
    if (!keyButton) return;
    const restore = setButtonLoading(keyButton, "Generating...");
    try {
      const result = await api("/api/admin/generate-key", {
        method: "POST",
        body: JSON.stringify({ userId: keyButton.dataset.userId })
      });
      setText("latestGeneratedKey", result.generatedKey || "");
      await copyText(result.generatedKey || "");
      showToast("Key generated and copied", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  qs("adminKeysGrid")?.addEventListener("click", async (event) => {
    const button = event.target.closest(".admin-copy-key");
    if (!button) return;
    try {
      await copyText(button.dataset.key || "");
      showToast("Key copied", "success");
    } catch (error) {
      showToast(error.message, "warning");
    }
  });

  qs("adminGameForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.target.querySelector('button[type="submit"]');
    const restore = setButtonLoading(submit, "Adding...");
    try {
      const pickedFile = qs("adminGameImageFile")?.files?.[0] || null;
      const uploadedImage = pickedFile ? await uploadImageFile(pickedFile) : "";
      await api("/api/admin/game", {
        method: "POST",
        body: JSON.stringify({
          name: qs("adminGameName")?.value || "",
          image: uploadedImage || qs("adminGameImage")?.value || "",
          description: qs("adminGameDescription")?.value || "",
          platform: "PC",
          accountId: qs("adminGameAccountId")?.value || "",
          accountPassword: qs("adminGameAccountPassword")?.value || ""
        })
      });
      event.target.reset();
      showToast("Game added", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  qs("adminGamesGrid")?.addEventListener("click", async (event) => {
    const saveButton = event.target.closest(".admin-save-game");
    if (saveButton) {
      const restore = setButtonLoading(saveButton, "Saving...");
      try {
        const gameId = saveButton.dataset.gameId;
        const fields = [...document.querySelectorAll(`.admin-game-field[data-game-id="${gameId}"]`)];
        const payload = fields.reduce((acc, field) => {
          acc[field.dataset.field] = field.value;
          return acc;
        }, {});
        const imageInput = document.querySelector(`.admin-game-image-file[data-game-id="${gameId}"]`);
        const pickedFile = imageInput?.files?.[0] || null;
        if (pickedFile) {
          payload.image = await uploadImageFile(pickedFile);
        }
        await api(`/api/admin/games/${encodeURIComponent(gameId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("Game updated", "success");
        await loadDashboard();
      } catch (error) {
        showToast(error.message, "warning");
      } finally {
        restore();
      }
      return;
    }

    const deleteButton = event.target.closest(".admin-delete-game");
    if (!deleteButton) return;
    const restore = setButtonLoading(deleteButton, "Deleting...");
    try {
      await api(`/api/admin/games/${encodeURIComponent(deleteButton.dataset.gameId)}`, {
        method: "DELETE"
      });
      showToast("Game deleted", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "warning");
    } finally {
      restore();
    }
  });

  await ensureAdminView();
}

async function init() {
  if (page === "login") return initLoginPage();
  if (page === "payment") return initPaymentPage();
  if (page === "enter-key") return initEnterKeyPage();
  if (page === "pc-games") return initGamesPage();
  if (page === "game") return initGamePage();
  if (page === "admin") return initAdminPage();
}

init().catch((error) => {
  showToast(error.message || "Something went wrong.", "warning");
});
