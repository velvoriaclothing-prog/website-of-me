(function () {
  if (document.body.dataset.page !== "admin") return;

  const managerState = {
    products: [],
    pages: [],
    media: [],
    sections: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  async function request(path, options = {}) {
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

  function setStatus(id, text, isError) {
    const node = byId(id);
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? "#fecdd3" : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function inputToDataUrl(id) {
    const input = byId(id);
    const [file] = input?.files || [];
    return file ? readFileAsDataUrl(file) : "";
  }

  function resetProductForm() {
    byId("adminProductForm")?.reset();
    if (byId("adminProductId")) byId("adminProductId").value = "";
    if (byId("adminProductCtaLabel")) byId("adminProductCtaLabel").value = "View Offer";
  }

  function resetPageForm() {
    byId("adminPageForm")?.reset();
    if (byId("adminPageId")) byId("adminPageId").value = "";
  }

  function resetMediaForm() {
    byId("adminMediaForm")?.reset();
    if (byId("adminMediaId")) byId("adminMediaId").value = "";
    if (byId("adminMediaKind")) byId("adminMediaKind").value = "image";
  }

  function resetSectionForm() {
    byId("adminSectionForm")?.reset();
    if (byId("adminSectionId")) byId("adminSectionId").value = "";
  }

  function renderProducts() {
    const wrap = byId("adminProductsList");
    if (!wrap) return;
    wrap.innerHTML = managerState.products.length
      ? managerState.products.map((item) => `
        <article class="admin-record">
          <div>
            <p class="eyebrow">${escapeHtml(item.category)}</p>
            <h4>${escapeHtml(item.name)}</h4>
            <p class="muted">${escapeHtml(item.description || "No description yet.")}</p>
            <p class="muted">₹${Number(item.price || 0).toLocaleString("en-IN")} | <code>/products/${escapeHtml(item.slug)}</code></p>
          </div>
          <div class="toolbar">
            <button class="btn btn-secondary" type="button" data-edit-content="product" data-content-id="${item.id}">Edit</button>
            <button class="btn btn-secondary danger-btn" type="button" data-delete-content="product" data-content-id="${item.id}">Delete</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty">No products saved yet.</div>`;
  }

  function renderPages() {
    const wrap = byId("adminPagesList");
    if (!wrap) return;
    wrap.innerHTML = managerState.pages.length
      ? managerState.pages.map((item) => `
        <article class="admin-record">
          <div>
            <p class="eyebrow">page</p>
            <h4>${escapeHtml(item.title)}</h4>
            <p class="muted">${escapeHtml(item.summary || "No summary yet.")}</p>
            <p class="muted"><a href="/pages/${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">/pages/${escapeHtml(item.slug)}</a></p>
          </div>
          <div class="toolbar">
            <button class="btn btn-secondary" type="button" data-edit-content="page" data-content-id="${item.id}">Edit</button>
            <button class="btn btn-secondary danger-btn" type="button" data-delete-content="page" data-content-id="${item.id}">Delete</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty">No dynamic pages created yet.</div>`;
  }

  function renderMedia() {
    const wrap = byId("adminMediaList");
    if (!wrap) return;
    wrap.innerHTML = managerState.media.length
      ? managerState.media.map((item) => `
        <article class="admin-record">
          <div class="admin-media-row">
            <img class="admin-media-thumb" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt || item.name)}" loading="lazy">
            <div>
              <p class="eyebrow">${escapeHtml(item.kind)}</p>
              <h4>${escapeHtml(item.name)}</h4>
              <p class="muted">${escapeHtml(item.alt || "No alt text yet.")}</p>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn btn-secondary" type="button" data-edit-content="media" data-content-id="${item.id}">Edit</button>
            <button class="btn btn-secondary danger-btn" type="button" data-delete-content="media" data-content-id="${item.id}">Delete</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty">No uploaded media yet.</div>`;
  }

  function renderSections() {
    const wrap = byId("adminSectionsList");
    if (!wrap) return;
    wrap.innerHTML = managerState.sections.length
      ? managerState.sections.map((item) => `
        <article class="admin-record">
          <div>
            <p class="eyebrow">${escapeHtml(item.page)}</p>
            <h4>${escapeHtml(item.heading)}</h4>
            <p class="muted">${escapeHtml(item.body || "No body text yet.")}</p>
            <p class="muted">${escapeHtml(item.buttonText || "No button text")} ${item.buttonHref ? `| ${escapeHtml(item.buttonHref)}` : ""}</p>
          </div>
          <div class="toolbar">
            <button class="btn btn-secondary" type="button" data-edit-content="section" data-content-id="${item.id}">Edit</button>
            <button class="btn btn-secondary danger-btn" type="button" data-delete-content="section" data-content-id="${item.id}">Delete</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty">No editable sections saved yet.</div>`;
  }

  function fillProductForm(item) {
    byId("adminProductId").value = item.id || "";
    byId("adminProductName").value = item.name || "";
    byId("adminProductCategory").value = item.category || "";
    byId("adminProductPrice").value = item.price || "";
    byId("adminProductImage").value = item.image || "";
    byId("adminProductDescription").value = item.description || "";
    byId("adminProductBadge").value = item.badge || "";
    byId("adminProductCtaUrl").value = item.ctaUrl || "";
    byId("adminProductCtaLabel").value = item.ctaLabel || "View Offer";
    byId("adminProductFeatured").checked = Boolean(item.featured);
  }

  function fillPageForm(item) {
    byId("adminPageId").value = item.id || "";
    byId("adminPageTitle").value = item.title || "";
    byId("adminPageSlug").value = item.slug || "";
    byId("adminPageSummary").value = item.summary || "";
    byId("adminPageHeroImage").value = item.heroImage || "";
    byId("adminPageContent").value = item.content || "";
    byId("adminPageSeoTitle").value = item.seoTitle || "";
    byId("adminPageSeoDescription").value = item.seoDescription || "";
  }

  function fillMediaForm(item) {
    byId("adminMediaId").value = item.id || "";
    byId("adminMediaName").value = item.name || "";
    byId("adminMediaAlt").value = item.alt || "";
    byId("adminMediaUrl").value = item.url || "";
    byId("adminMediaKind").value = item.kind || "image";
  }

  function fillSectionForm(item) {
    byId("adminSectionId").value = item.id || "";
    byId("adminSectionPage").value = item.page || "";
    byId("adminSectionLabel").value = item.label || "";
    byId("adminSectionHeading").value = item.heading || "";
    byId("adminSectionBody").value = item.body || "";
    byId("adminSectionButtonText").value = item.buttonText || "";
    byId("adminSectionButtonHref").value = item.buttonHref || "";
    byId("adminSectionImage").value = item.image || "";
  }

  async function loadContentManager() {
    const payload = await request("/api/content");
    managerState.products = payload.products || [];
    managerState.pages = payload.pages || [];
    managerState.media = payload.media || [];
    managerState.sections = payload.sections || [];
    renderProducts();
    renderPages();
    renderMedia();
    renderSections();
  }

  async function saveContent(type, id, item, statusId) {
    const method = id ? "PUT" : "POST";
    const payload = id ? { type, id, item } : { type, item };
    await request("/api/content", {
      method,
      body: JSON.stringify(payload)
    });
    await loadContentManager();
    setStatus(statusId, `${type.charAt(0).toUpperCase() + type.slice(1)} saved.`);
  }

  async function deleteContent(type, id, statusId) {
    await request("/api/content", {
      method: "DELETE",
      body: JSON.stringify({ type, id })
    });
    await loadContentManager();
    setStatus(statusId, `${type.charAt(0).toUpperCase() + type.slice(1)} deleted.`);
  }

  document.addEventListener("submit", async (event) => {
    if (event.target.id === "adminProductForm") {
      event.preventDefault();
      try {
        const uploadedImage = await inputToDataUrl("adminProductImageFile");
        await saveContent("product", byId("adminProductId").value, {
          name: byId("adminProductName").value,
          category: byId("adminProductCategory").value,
          price: Number(byId("adminProductPrice").value || 0),
          image: uploadedImage || byId("adminProductImage").value,
          description: byId("adminProductDescription").value,
          badge: byId("adminProductBadge").value,
          ctaUrl: byId("adminProductCtaUrl").value,
          ctaLabel: byId("adminProductCtaLabel").value,
          featured: byId("adminProductFeatured").checked
        }, "adminProductsStatus");
        resetProductForm();
      } catch (error) {
        setStatus("adminProductsStatus", error.message, true);
      }
    }

    if (event.target.id === "adminPageForm") {
      event.preventDefault();
      try {
        await saveContent("page", byId("adminPageId").value, {
          title: byId("adminPageTitle").value,
          slug: byId("adminPageSlug").value,
          summary: byId("adminPageSummary").value,
          heroImage: byId("adminPageHeroImage").value,
          content: byId("adminPageContent").value,
          seoTitle: byId("adminPageSeoTitle").value,
          seoDescription: byId("adminPageSeoDescription").value
        }, "adminPagesStatus");
        resetPageForm();
      } catch (error) {
        setStatus("adminPagesStatus", error.message, true);
      }
    }

    if (event.target.id === "adminMediaForm") {
      event.preventDefault();
      try {
        const uploadedImage = await inputToDataUrl("adminMediaFile");
        await saveContent("media", byId("adminMediaId").value, {
          name: byId("adminMediaName").value,
          alt: byId("adminMediaAlt").value,
          url: uploadedImage || byId("adminMediaUrl").value,
          kind: byId("adminMediaKind").value
        }, "adminMediaStatus");
        resetMediaForm();
      } catch (error) {
        setStatus("adminMediaStatus", error.message, true);
      }
    }

    if (event.target.id === "adminSectionForm") {
      event.preventDefault();
      try {
        await saveContent("section", byId("adminSectionId").value, {
          page: byId("adminSectionPage").value,
          label: byId("adminSectionLabel").value,
          heading: byId("adminSectionHeading").value,
          body: byId("adminSectionBody").value,
          buttonText: byId("adminSectionButtonText").value,
          buttonHref: byId("adminSectionButtonHref").value,
          image: byId("adminSectionImage").value
        }, "adminContentStatus");
        resetSectionForm();
      } catch (error) {
        setStatus("adminContentStatus", error.message, true);
      }
    }
  });

  document.addEventListener("click", async (event) => {
    const resetButton = event.target.closest("#adminProductReset, #adminPageReset, #adminMediaReset, #adminSectionReset");
    if (resetButton) {
      if (resetButton.id === "adminProductReset") resetProductForm();
      if (resetButton.id === "adminPageReset") resetPageForm();
      if (resetButton.id === "adminMediaReset") resetMediaForm();
      if (resetButton.id === "adminSectionReset") resetSectionForm();
      return;
    }

    const editButton = event.target.closest("[data-edit-content]");
    if (editButton) {
      const type = editButton.dataset.editContent;
      const id = editButton.dataset.contentId;
      if (type === "product") fillProductForm(managerState.products.find((item) => item.id === id) || {});
      if (type === "page") fillPageForm(managerState.pages.find((item) => item.id === id) || {});
      if (type === "media") fillMediaForm(managerState.media.find((item) => item.id === id) || {});
      if (type === "section") fillSectionForm(managerState.sections.find((item) => item.id === id) || {});
      return;
    }

    const deleteButton = event.target.closest("[data-delete-content]");
    if (deleteButton) {
      const type = deleteButton.dataset.deleteContent;
      const id = deleteButton.dataset.contentId;
      const statusMap = {
        product: "adminProductsStatus",
        page: "adminPagesStatus",
        media: "adminMediaStatus",
        section: "adminContentStatus"
      };
      try {
        await deleteContent(type, id, statusMap[type]);
      } catch (error) {
        setStatus(statusMap[type], error.message, true);
      }
    }
  });

  window.addEventListener("load", async () => {
    try {
      const session = await request("/api/session");
      if (!session.user?.isAdmin) return;
      resetProductForm();
      resetPageForm();
      resetMediaForm();
      resetSectionForm();
      await loadContentManager();
    } catch (_error) {
      // The main admin gate already handles unauthenticated states.
    }
  });
}());
