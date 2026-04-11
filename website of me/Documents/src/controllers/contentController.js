const { readStore, updateStore, createId, slugify } = require("../store");

function uniqueSlug(value, items, currentId = "") {
  const base = slugify(value) || `item-${Date.now()}`;
  let slug = base;
  let index = 2;
  while (items.some((item) => item.slug === slug && item.id !== currentId)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function sanitizeProduct(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: String(item.name || "").trim(),
    category: String(item.category || "Gaming").trim(),
    price: Number(item.price || 0),
    image: String(item.image || "").trim(),
    description: String(item.description || "").trim(),
    badge: String(item.badge || "").trim(),
    ctaLabel: String(item.ctaLabel || "View Offer").trim(),
    ctaUrl: String(item.ctaUrl || "#").trim(),
    featured: Boolean(item.featured),
    updatedAt: item.updatedAt || null
  };
}

function sanitizePage(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: String(item.title || "").trim(),
    summary: String(item.summary || "").trim(),
    content: String(item.content || "").trim(),
    seoTitle: String(item.seoTitle || "").trim(),
    seoDescription: String(item.seoDescription || "").trim(),
    heroImage: String(item.heroImage || "").trim(),
    updatedAt: item.updatedAt || null
  };
}

function sanitizeMedia(item) {
  return {
    id: item.id,
    name: String(item.name || "").trim(),
    alt: String(item.alt || "").trim(),
    url: String(item.url || "").trim(),
    kind: String(item.kind || "image").trim(),
    updatedAt: item.updatedAt || null
  };
}

function sanitizeSection(item) {
  return {
    id: item.id,
    page: String(item.page || "home").trim(),
    label: String(item.label || "").trim(),
    heading: String(item.heading || "").trim(),
    body: String(item.body || "").trim(),
    buttonText: String(item.buttonText || "").trim(),
    buttonHref: String(item.buttonHref || "").trim(),
    image: String(item.image || "").trim(),
    updatedAt: item.updatedAt || null
  };
}

function ensureCollections(draft) {
  if (!Array.isArray(draft.products)) draft.products = [];
  if (!Array.isArray(draft.pages)) draft.pages = [];
  if (!Array.isArray(draft.media)) draft.media = [];
  if (!Array.isArray(draft.contentSections)) draft.contentSections = [];
}

function collectionDetails(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "product" || normalized === "products") {
    return { key: "products", sanitize: sanitizeProduct };
  }
  if (normalized === "page" || normalized === "pages") {
    return { key: "pages", sanitize: sanitizePage };
  }
  if (normalized === "media" || normalized === "image") {
    return { key: "media", sanitize: sanitizeMedia };
  }
  if (normalized === "section" || normalized === "sections" || normalized === "content") {
    return { key: "contentSections", sanitize: sanitizeSection };
  }
  return null;
}

function normalizeProduct(item, current, draft) {
  const source = current || {};
  const next = {
    id: source.id || createId("product"),
    slug: uniqueSlug(item.slug || item.name || source.name || source.slug || "product", draft.products || [], source.id),
    name: String(item.name || source.name || "").trim(),
    category: String(item.category || source.category || "Gaming").trim() || "Gaming",
    price: Number(item.price ?? source.price ?? 0),
    image: String(item.image || source.image || "").trim(),
    description: String(item.description || source.description || "").trim(),
    badge: String(item.badge || source.badge || "").trim(),
    ctaLabel: String(item.ctaLabel || source.ctaLabel || "View Offer").trim(),
    ctaUrl: String(item.ctaUrl || source.ctaUrl || "#").trim(),
    featured: Boolean(item.featured ?? source.featured),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!next.name) throw new Error("Product name is required.");
  return next;
}

function normalizePage(item, current, draft) {
  const source = current || {};
  const next = {
    id: source.id || createId("page"),
    slug: uniqueSlug(item.slug || item.title || source.title || source.slug || "page", draft.pages || [], source.id),
    title: String(item.title || source.title || "").trim(),
    summary: String(item.summary || source.summary || "").trim(),
    content: String(item.content || source.content || "").trim(),
    seoTitle: String(item.seoTitle || source.seoTitle || item.title || source.title || "").trim(),
    seoDescription: String(item.seoDescription || source.seoDescription || item.summary || source.summary || "").trim(),
    heroImage: String(item.heroImage || source.heroImage || "").trim(),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!next.title) throw new Error("Page title is required.");
  if (!next.content) throw new Error("Page content is required.");
  return next;
}

function normalizeMedia(item, current) {
  const source = current || {};
  const next = {
    id: source.id || createId("media"),
    name: String(item.name || source.name || "").trim() || "Media item",
    alt: String(item.alt || source.alt || "").trim(),
    url: String(item.url || source.url || "").trim(),
    kind: String(item.kind || source.kind || "image").trim() || "image",
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!next.url) throw new Error("Media URL or uploaded image is required.");
  return next;
}

function normalizeSection(item, current) {
  const source = current || {};
  const next = {
    id: source.id || createId("section"),
    page: String(item.page || source.page || "home").trim() || "home",
    label: String(item.label || source.label || item.heading || source.heading || "Section").trim(),
    heading: String(item.heading || source.heading || "").trim(),
    body: String(item.body || source.body || "").trim(),
    buttonText: String(item.buttonText || source.buttonText || "").trim(),
    buttonHref: String(item.buttonHref || source.buttonHref || "").trim(),
    image: String(item.image || source.image || "").trim(),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!next.heading) throw new Error("Section heading is required.");
  return next;
}

function buildPayload(store) {
  return {
    products: (store.products || []).map(sanitizeProduct),
    pages: (store.pages || []).map(sanitizePage),
    media: (store.media || []).map(sanitizeMedia),
    sections: (store.contentSections || []).map(sanitizeSection)
  };
}

function listContent(req, res) {
  const store = readStore();
  const details = collectionDetails(req.query?.type || "");
  if (!details) {
    return res.json(buildPayload(store));
  }
  return res.json({ items: (store[details.key] || []).map(details.sanitize) });
}

function createContent(req, res) {
  const details = collectionDetails(req.body?.type || "");
  if (!details) return res.status(400).json({ error: "Unknown content type." });

  const item = req.body?.item || {};
  let created = null;
  const store = updateStore((draft) => {
    ensureCollections(draft);
    if (details.key === "products") created = normalizeProduct(item, null, draft);
    if (details.key === "pages") created = normalizePage(item, null, draft);
    if (details.key === "media") created = normalizeMedia(item, null);
    if (details.key === "contentSections") created = normalizeSection(item, null);
    draft[details.key].unshift(created);
    return draft;
  });

  const saved = (store[details.key] || []).find((entry) => entry.id === created.id);
  return res.status(201).json({ item: details.sanitize(saved) });
}

function updateContentItem(req, res) {
  const details = collectionDetails(req.body?.type || "");
  const id = String(req.body?.id || "").trim();
  if (!details || !id) return res.status(400).json({ error: "Content type and id are required." });

  const item = req.body?.item || {};
  let updated = null;
  const store = updateStore((draft) => {
    ensureCollections(draft);
    const current = (draft[details.key] || []).find((entry) => entry.id === id);
    if (!current) throw new Error("Content item not found.");
    if (details.key === "products") updated = normalizeProduct(item, current, draft);
    if (details.key === "pages") updated = normalizePage(item, current, draft);
    if (details.key === "media") updated = normalizeMedia(item, current);
    if (details.key === "contentSections") updated = normalizeSection(item, current);
    draft[details.key] = draft[details.key].map((entry) => (entry.id === id ? updated : entry));
    return draft;
  });

  const saved = (store[details.key] || []).find((entry) => entry.id === id);
  return res.json({ item: details.sanitize(saved) });
}

function deleteContent(req, res) {
  const details = collectionDetails(req.body?.type || req.query?.type || "");
  const id = String(req.body?.id || req.query?.id || "").trim();
  if (!details || !id) return res.status(400).json({ error: "Content type and id are required." });

  updateStore((draft) => {
    ensureCollections(draft);
    draft[details.key] = (draft[details.key] || []).filter((entry) => entry.id !== id);
    return draft;
  });

  return res.json({ ok: true });
}

module.exports = {
  buildPayload,
  deleteContent,
  listContent,
  sanitizeMedia,
  sanitizePage,
  sanitizeProduct,
  sanitizeSection,
  updateContentItem,
  createContent
};
