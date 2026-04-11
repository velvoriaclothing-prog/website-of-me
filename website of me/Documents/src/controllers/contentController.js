function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function normalizePage(item = {}, helpers = {}, existing = {}) {
  const now = new Date().toISOString();
  const title = String(item.title || existing.title || "").trim();
  const fallbackSlug = helpers.slugify ? helpers.slugify(title || existing.title || existing.slug || "") : "";
  return {
    id: existing.id || item.id || helpers.createId("page"),
    slug: String(item.slug || existing.slug || fallbackSlug || `page-${Date.now()}`).trim(),
    title,
    summary: String(item.summary || existing.summary || "").trim() || stripHtml(item.content || existing.content || "").slice(0, 160),
    heroImage: normalizeUrl(item.heroImage || existing.heroImage || ""),
    content: String(item.content || existing.content || "").trim(),
    seoTitle: String(item.seoTitle || existing.seoTitle || "").trim(),
    seoDescription: String(item.seoDescription || existing.seoDescription || "").trim(),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function normalizeMedia(item = {}, helpers = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || item.id || helpers.createId("media"),
    name: String(item.name || existing.name || "").trim(),
    url: normalizeUrl(item.url || existing.url || ""),
    alt: String(item.alt || existing.alt || "").trim(),
    placement: String(item.placement || existing.placement || "").trim(),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function normalizeSection(item = {}, helpers = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || item.id || helpers.createId("section"),
    key: String(item.key || existing.key || "").trim(),
    title: String(item.title || existing.title || "").trim(),
    subtitle: String(item.subtitle || existing.subtitle || "").trim(),
    body: String(item.body || existing.body || "").trim(),
    buttonLabel: String(item.buttonLabel || existing.buttonLabel || "").trim(),
    buttonHref: normalizeUrl(item.buttonHref || existing.buttonHref || ""),
    image: normalizeUrl(item.image || existing.image || ""),
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function sanitizePage(page) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    heroImage: page.heroImage,
    content: page.content,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt
  };
}

function sanitizeMedia(item) {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    alt: item.alt,
    placement: item.placement,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function sanitizeSection(item) {
  return {
    id: item.id,
    key: item.key,
    title: item.title,
    subtitle: item.subtitle,
    body: item.body,
    buttonLabel: item.buttonLabel,
    buttonHref: item.buttonHref,
    image: item.image,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function resolveCollection(type) {
  const map = {
    page: "pages",
    pages: "pages",
    media: "media",
    section: "contentSections",
    sections: "contentSections",
    contentSections: "contentSections"
  };
  return map[String(type || "").trim()] || "";
}

function sanitizeCollection(collectionKey, item) {
  if (collectionKey === "pages") return sanitizePage(item);
  if (collectionKey === "media") return sanitizeMedia(item);
  return sanitizeSection(item);
}

function normalizeItem(collectionKey, item, helpers, existing = {}) {
  if (collectionKey === "pages") return normalizePage(item, helpers, existing);
  if (collectionKey === "media") return normalizeMedia(item, helpers, existing);
  return normalizeSection(item, helpers, existing);
}

function createContentController(helpers) {
  const {
    readStore,
    updateStore
  } = helpers;

  function sanitizePageContent(pageContent = {}) {
    return {
      title: String(pageContent.title || "").trim(),
      description: String(pageContent.description || "").trim(),
      buttonLabel: String(pageContent.buttonLabel || "").trim(),
      buttonHref: String(pageContent.buttonHref || "").trim(),
      heroImage: String(pageContent.heroImage || "").trim()
    };
  }

  function getAll(_req, res) {
    const store = readStore();
    res.json({
      pages: (store.pages || []).map(sanitizePage),
      media: (store.media || []).map(sanitizeMedia),
      sections: (store.contentSections || []).map(sanitizeSection)
    });
  }

  function getPublicContent(_req, res) {
    const store = readStore();
    res.json({
      sections: (store.contentSections || []).map(sanitizeSection),
      pages: (store.pages || []).map((page) => ({
        slug: page.slug,
        title: page.title,
        summary: page.summary,
        heroImage: page.heroImage
      }))
    });
  }

  function getPage(req, res) {
    const store = readStore();
    const page = (store.pages || []).find((item) => item.slug === req.params.slug);
    if (!page) return res.status(404).json({ error: "Page not found." });
    return res.json(sanitizePage(page));
  }

  function getPageContent(req, res) {
    const store = readStore();
    const content = store.contentByPage && store.contentByPage[req.params.page];
    if (!content) return res.status(404).json({ error: "Page content not found." });
    return res.json({ page: req.params.page, content: sanitizePageContent(content) });
  }

  function upsertPageContent(req, res) {
    const pageKey = String(req.params.page || "").trim();
    if (!pageKey) return res.status(400).json({ error: "Page key is required." });
    const incoming = req.body?.content || {};
    const store = updateStore((draft) => {
      draft.contentByPage = draft.contentByPage && typeof draft.contentByPage === "object" ? draft.contentByPage : {};
      draft.contentByPage[pageKey] = sanitizePageContent({
        ...(draft.contentByPage[pageKey] || {}),
        ...incoming
      });
      return draft;
    });
    return res.json({ page: pageKey, content: sanitizePageContent(store.contentByPage[pageKey]) });
  }

  function createItem(req, res) {
    const collectionKey = resolveCollection(req.body?.type);
    if (!collectionKey) return res.status(400).json({ error: "Unknown content type." });
    const item = req.body?.item || {};

    const store = updateStore((draft) => {
      draft[collectionKey] = Array.isArray(draft[collectionKey]) ? draft[collectionKey] : [];
      const normalized = normalizeItem(collectionKey, item, helpers);
      if (collectionKey === "pages" && (!normalized.title || !normalized.slug || !normalized.content)) {
        throw new Error("Page title, slug, and content are required.");
      }
      if (collectionKey === "media" && (!normalized.name || !normalized.url)) {
        throw new Error("Media name and URL are required.");
      }
      if (collectionKey === "contentSections" && !normalized.key) {
        throw new Error("Section key is required.");
      }
      if (collectionKey === "pages" && draft.pages.some((entry) => entry.slug === normalized.slug)) {
        throw new Error("A page with this slug already exists.");
      }
      if (collectionKey === "contentSections" && draft.contentSections.some((entry) => entry.key === normalized.key)) {
        throw new Error("A section with this key already exists.");
      }
      draft[collectionKey].unshift(normalized);
      return draft;
    });

    const created = store[collectionKey][0];
    return res.status(201).json({
      type: collectionKey,
      item: sanitizeCollection(collectionKey, created)
    });
  }

  function updateItem(req, res) {
    const collectionKey = resolveCollection(req.params.type);
    if (!collectionKey) return res.status(400).json({ error: "Unknown content type." });
    const item = req.body?.item || {};

    const store = updateStore((draft) => {
      draft[collectionKey] = Array.isArray(draft[collectionKey]) ? draft[collectionKey] : [];
      const target = draft[collectionKey].find((entry) => entry.id === req.params.id);
      if (!target) throw new Error("Content item not found.");
      const normalized = normalizeItem(collectionKey, item, helpers, target);
      if (collectionKey === "pages" && (!normalized.title || !normalized.slug || !normalized.content)) {
        throw new Error("Page title, slug, and content are required.");
      }
      if (collectionKey === "media" && (!normalized.name || !normalized.url)) {
        throw new Error("Media name and URL are required.");
      }
      if (collectionKey === "contentSections" && !normalized.key) {
        throw new Error("Section key is required.");
      }
      if (collectionKey === "pages" && draft.pages.some((entry) => entry.id !== target.id && entry.slug === normalized.slug)) {
        throw new Error("A page with this slug already exists.");
      }
      if (collectionKey === "contentSections" && draft.contentSections.some((entry) => entry.id !== target.id && entry.key === normalized.key)) {
        throw new Error("A section with this key already exists.");
      }
      Object.assign(target, normalized);
      return draft;
    });

    const updated = store[collectionKey].find((entry) => entry.id === req.params.id);
    return res.json({
      type: collectionKey,
      item: sanitizeCollection(collectionKey, updated)
    });
  }

  function deleteItem(req, res) {
    const collectionKey = resolveCollection(req.params.type);
    if (!collectionKey) return res.status(400).json({ error: "Unknown content type." });

    updateStore((draft) => {
      draft[collectionKey] = (draft[collectionKey] || []).filter((entry) => entry.id !== req.params.id);
      return draft;
    });

    return res.json({ ok: true });
  }

  return {
    getAll,
    getPublicContent,
    getPage,
    getPageContent,
    upsertPageContent,
    createItem,
    updateItem,
    deleteItem
  };
}

module.exports = createContentController;
