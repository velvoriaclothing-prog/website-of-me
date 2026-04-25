const { getBundleBySlug, getBundles } = require("./bundleCatalog");
const { getBlogBySlug, getMergedBlogs } = require("./blogEngine");

const canonicalAliases = {
  "/index.html": "/",
  "/games.html": "/pc-games",
  "/pc-games.html": "/pc-games",
  "/ps4-games.html": "/ps4-games",
  "/ps5-games.html": "/ps5-games",
  "/deals.html": "/deals",
  "/blog.html": "/blog",
  "/ai-tools.html": "/ai-tools",
  "/cart.html": "/cart",
  "/checkout.html": "/checkout",
  "/login.html": "/login",
  "/admin.html": "/admin",
  "/bundle.html": "/deals",
  "/post.html": "/blog",
  "/page.html": "/"
};

function ensureAbsoluteBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  if (!value) return "https://example.com";
  return value.replace(/\/+$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clampDescription(value, fallback) {
  const text = stripHtml(value || fallback || "");
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trim()}...`;
}

function normalizePath(pathname) {
  if (!pathname) return "/";
  return canonicalAliases[pathname] || pathname;
}

function canonicalUrl(baseUrl, pathname) {
  const root = ensureAbsoluteBaseUrl(baseUrl);
  const normalized = normalizePath(pathname);
  return `${root}${normalized === "/" ? "/" : normalized}`;
}

function imageUrl(baseUrl, url) {
  const value = String(url || "").trim();
  if (!value) return canonicalUrl(baseUrl, "/assets/gamers-arena-logo.png");
  if (/^https?:\/\//i.test(value)) return value;
  return `${ensureAbsoluteBaseUrl(baseUrl)}${value.startsWith("/") ? value : `/${value}`}`;
}

function buildBreadcrumbSchema(baseUrl, items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(baseUrl, item.path)
    }))
  };
}

function buildCommonSchemas(store, baseUrl) {
  const settings = store.settings || {};
  const business = settings.business || {};
  const logo = imageUrl(baseUrl, settings.logoUrl);
  const sameAs = Object.values(settings.socialLinks || {}).filter((value) => /^https?:\/\//i.test(String(value || "")));
  const address = {
    "@type": "PostalAddress",
    streetAddress: [business.addressLine1, business.addressLine2].filter(Boolean).join(", "),
    addressLocality: business.city || "Your City",
    addressRegion: business.state || "Your State",
    postalCode: business.postalCode || "000000",
    addressCountry: business.country || "India"
  };

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: settings.siteTitle || "Gamers Arena",
      url: canonicalUrl(baseUrl, "/"),
      description: settings.siteDescription || "Gaming storefront",
      potentialAction: {
        "@type": "SearchAction",
        target: `${canonicalUrl(baseUrl, "/pc-games")}?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${canonicalUrl(baseUrl, "/")}#organization`,
      name: business.name || settings.siteTitle || "Gamers Arena",
      url: canonicalUrl(baseUrl, "/"),
      logo,
      sameAs
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${canonicalUrl(baseUrl, "/")}#localbusiness`,
      name: business.name || settings.siteTitle || "Gamers Arena",
      image: logo,
      url: canonicalUrl(baseUrl, "/"),
      telephone: business.phone || "+91 00000 00000",
      email: business.email || "support@gamersarena.com",
      address,
      sameAs
    }
  ];
}

function productSchemasForItems(baseUrl, items = []) {
  return items.map((item) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: clampDescription(item.description, `${item.name} is available on Gamers Arena.`),
    image: item.image ? imageUrl(baseUrl, item.image) : undefined,
    brand: {
      "@type": "Brand",
      name: "Gamers Arena"
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl(baseUrl, item.url || "/pc-games"),
      priceCurrency: "INR",
      price: Number(item.price || 45),
      availability: "https://schema.org/InStock"
    }
  }));
}

function buildStaticPageSeo(pathname) {
  const pages = {
    "/": {
      title: "Gamers Arena Gaming Store | PC, PS4 & PS5 Deals",
      description: "Shop PC games, PS4 and PS5 deals, bundles, blog guides, and AI tools on a fast gaming storefront with QR payment and Telegram support.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [{ name: "Home", path: "/" }]
    },
    "/pc-games": {
      title: "PC Game Deals, Accounts & Bundles | Gamers Arena",
      description: "Browse PC game deals, budget accounts, bundles, and fast Telegram-assisted checkout inside the main Gamers Arena storefront.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "PC Games", path: "/pc-games" }
      ]
    },
    "/ps4-games": {
      title: "PS4 Game Deals & Direct Buy Links | Gamers Arena",
      description: "Explore PS4 game cards with rich artwork, quick Telegram buying links, and responsive browsing built for mobile and desktop buyers.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "PS4 Games", path: "/ps4-games" }
      ]
    },
    "/ps5-games": {
      title: "PS5 Game Deals With Neon Cards | Gamers Arena",
      description: "Discover PS5 game offers with premium neon cards, image-led layouts, and direct Telegram buying actions across Gamers Arena.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "PS5 Games", path: "/ps5-games" }
      ]
    },
    "/deals": {
      title: "Gaming Deals, Bundles & Budget Picks | Gamers Arena",
      description: "Compare bundle offers, featured deals, and budget-friendly gaming picks with internal links, QR checkout, and fast support.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Deals", path: "/deals" }
      ]
    },
    "/blog": {
      title: "Gaming Blog Guides & SEO Articles | Gamers Arena",
      description: "Read gaming guides, rankings, and buying advice from Gamers Arena to discover better titles, platforms, and bundle decisions.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" }
      ]
    },
    "/ai-tools": {
      title: "200+ AI Tools Directory For Creators | Gamers Arena",
      description: "Search 200+ AI tools for writing, coding, research, design, SEO, and productivity with admin-managed updates on Gamers Arena.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "AI Tools", path: "/ai-tools" }
      ]
    },
    "/cart": {
      title: "Review Your Gaming Cart Before Checkout",
      description: "Review games and bundles in your cart, confirm totals, and continue to the QR payment step without losing your selected items.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Cart", path: "/cart" }
      ]
    },
    "/checkout": {
      title: "QR Checkout For Games And Bundles",
      description: "Scan the QR code, review your amount, upload payment details, and open Telegram with an order-ready message on Gamers Arena.",
      image: "/assets/gamers-arena-logo.png",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Checkout", path: "/checkout" }
      ]
    },
    "/login": {
      title: "Login And Secure Admin Access | Gamers Arena",
      description: "Log in as a customer, reset passwords, or open the secure two-step admin access flow with recovery support on Gamers Arena.",
      image: "/assets/gamers-arena-logo.png",
      robots: "noindex,follow",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Login", path: "/login" }
      ]
    },
    "/admin": {
      title: "Admin CMS Dashboard | Gamers Arena",
      description: "Manage games, bundles, blogs, AI tools, QR settings, business info, and storefront content from the Gamers Arena admin panel.",
      image: "/assets/gamers-arena-logo.png",
      robots: "noindex,nofollow",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Admin", path: "/admin" }
      ]
    }
  };

  return pages[pathname] || null;
}

function getSeoForPath(pathname, store) {
  const normalized = normalizePath(pathname);
  const staticSeo = buildStaticPageSeo(normalized);
  if (staticSeo) return { ...staticSeo, canonicalPath: normalized };

  if (normalized.startsWith("/bundle/")) {
    const bundle = getBundleBySlug(store, normalized.split("/bundle/")[1]);
    if (!bundle) return null;
    return {
      title: `${bundle.name} Bundle Deal | Gamers Arena`,
      description: clampDescription(bundle.description, `${bundle.name} bundle is available on Gamers Arena.`),
      image: Array.isArray(bundle.images) && bundle.images[0] ? bundle.images[0] : "/assets/gamers-arena-logo.png",
      ogType: "product",
      canonicalPath: normalized,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Deals", path: "/deals" },
        { name: bundle.name, path: normalized }
      ],
      schemas: productSchemasForItems("", [{
        name: bundle.name,
        description: bundle.description,
        image: bundle.images?.[0],
        price: bundle.price,
        url: normalized
      }])
    };
  }

  if (normalized.startsWith("/blog/")) {
    const blog = getBlogBySlug(store.blogs || [], normalized.split("/blog/")[1]);
    if (!blog) return null;
    return {
      title: blog.metaTitle || `${blog.title} | Gamers Arena`,
      description: clampDescription(blog.metaDescription, blog.summary),
      image: blog.image || "/assets/gamers-arena-logo.png",
      ogType: "article",
      canonicalPath: normalized,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: blog.title, path: normalized }
      ],
      schemas: [{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: blog.title,
        description: clampDescription(blog.metaDescription, blog.summary),
        image: blog.image || undefined,
        author: {
          "@type": "Organization",
          name: store.settings?.siteTitle || "Gamers Arena"
        },
        publisher: {
          "@type": "Organization",
          name: store.settings?.siteTitle || "Gamers Arena"
        },
        datePublished: blog.createdAt,
        dateModified: blog.updatedAt || blog.createdAt,
        keywords: blog.keywords || []
      }]
    };
  }

  if (normalized.startsWith("/pages/")) {
    const slug = normalized.split("/pages/")[1];
    const page = (store.pages || []).find((item) => item.slug === slug);
    if (!page) return null;
    return {
      title: page.seoTitle || `${page.title} | Gamers Arena`,
      description: clampDescription(page.seoDescription, page.summary),
      image: page.heroImage || "/assets/gamers-arena-logo.png",
      canonicalPath: normalized,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: page.title, path: normalized }
      ]
    };
  }

  return null;
}

function buildPageSchemas(seo, store, baseUrl) {
  const common = buildCommonSchemas(store, baseUrl);
  const schemas = [...common];

  if (Array.isArray(seo.schemas) && seo.schemas.length) {
    seo.schemas.forEach((schema) => {
      const normalized = JSON.parse(JSON.stringify(schema).replace(/"https?:\/\/example\.com/g, `"${ensureAbsoluteBaseUrl(baseUrl)}`));
      schemas.push(normalized);
    });
  } else if (seo.canonicalPath === "/" || seo.canonicalPath === "/pc-games" || seo.canonicalPath === "/deals") {
    const bundles = getBundles(store).slice(0, 3).map((bundle) => ({
      name: bundle.name,
      description: bundle.description,
      image: bundle.images?.[0],
      price: bundle.price,
      url: `/bundle/${bundle.slug}`
    }));
    const games = (store.games || []).slice(0, 4).map((game) => ({
      name: game.name,
      description: game.description,
      image: game.image,
      price: game.price,
      url: `/pc-games`
    }));
    schemas.push(...productSchemasForItems(baseUrl, [...bundles, ...games]));
  } else if (seo.canonicalPath === "/ai-tools") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Gamers Arena AI Tools Directory",
      description: seo.description,
      url: canonicalUrl(baseUrl, "/ai-tools"),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: (store.aiTools || []).slice(0, 24).map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.name,
          url: tool.url
        }))
      }
    });
  } else if (seo.canonicalPath === "/blog") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Gamers Arena Blog",
      description: seo.description,
      url: canonicalUrl(baseUrl, "/blog"),
      blogPost: getMergedBlogs(store.blogs || []).slice(0, 8).map((blog) => ({
        "@type": "BlogPosting",
        headline: blog.title,
        url: canonicalUrl(baseUrl, `/blog/${blog.slug}`),
        datePublished: blog.createdAt,
        dateModified: blog.updatedAt || blog.createdAt
      }))
    });
  }

  if (Array.isArray(seo.breadcrumbs) && seo.breadcrumbs.length) {
    schemas.push(buildBreadcrumbSchema(baseUrl, seo.breadcrumbs));
  }

  return schemas;
}

function analyticsScripts(store) {
  const analytics = store.settings?.analytics || {};
  const tags = [];

  if (analytics.googleAnalyticsId) {
    tags.push(
      `  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(analytics.googleAnalyticsId)}"></script>`,
      "  <script>",
      "    window.dataLayer = window.dataLayer || [];",
      "    function gtag(){dataLayer.push(arguments);}",
      "    gtag('js', new Date());",
      `    gtag('config', '${escapeHtml(analytics.googleAnalyticsId)}');`,
      "  </script>"
    );
  }

  if (analytics.facebookPixelId) {
    tags.push(
      "  <script>",
      "    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?",
      "    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;",
      "    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;",
      "    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}",
      "    (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');",
      `    fbq('init', '${escapeHtml(analytics.facebookPixelId)}');`,
      "    fbq('track', 'PageView');",
      "  </script>"
    );
  }

  return tags.join("\n");
}

function injectSeo(html, seo, baseUrl, store) {
  if (!seo) return html;

  const canonicalPath = seo.canonicalPath || "/";
  const canonical = canonicalUrl(baseUrl, canonicalPath);
  const image = imageUrl(baseUrl, seo.image || store.settings?.logoUrl);
  const schemas = buildPageSchemas(seo, store, baseUrl);
  const schemaBlock = schemas
    .map((schema) => `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`)
    .join("\n");
  const headBlock = [
    `  <meta name="robots" content="${seo.robots || "index,follow"}">`,
    `  <meta property="og:title" content="${escapeHtml(seo.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(seo.description)}">`,
    `  <meta property="og:type" content="${escapeHtml(seo.ogType || "website")}">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:image" content="${image}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(seo.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(seo.description)}">`,
    `  <meta name="twitter:image" content="${image}">`,
    "  <meta name=\"theme-color\" content=\"#04111f\">",
    `  <link rel="canonical" href="${canonical}">`,
    `  <link rel="icon" type="image/png" href="${escapeHtml(store.settings?.faviconUrl || "/assets/gamers-arena-logo.png")}">`,
    analyticsScripts(store),
    schemaBlock
  ].filter(Boolean).join("\n");

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(seo.description)}">`)
    .replace(/<\/head>/i, `${headBlock}\n</head>`);
}

function buildRobotsTxt(baseUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /login",
    `Sitemap: ${ensureAbsoluteBaseUrl(baseUrl)}/sitemap.xml`
  ].join("\n");
}

function buildSitemapXml(baseUrl, store) {
  const root = ensureAbsoluteBaseUrl(baseUrl);
  const staticUrls = [
    "/",
    "/pc-games",
    "/ps4-games",
    "/ps5-games",
    "/deals",
    "/blog",
    "/ai-tools",
    "/cart",
    "/checkout"
  ];
  const urls = new Set(staticUrls.map((url) => canonicalUrl(root, url)));

  (store.pages || []).forEach((page) => {
    urls.add(canonicalUrl(root, `/pages/${page.slug}`));
  });
  getMergedBlogs(store.blogs || []).slice(0, 120).forEach((blog) => {
    urls.add(canonicalUrl(root, `/blog/${blog.slug}`));
  });
  getBundles(store).forEach((bundle) => {
    urls.add(canonicalUrl(root, `/bundle/${bundle.slug}`));
  });

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ...[...urls].map((url) => `  <url><loc>${url}</loc></url>`),
    "</urlset>"
  ].join("\n");
}

function buildLlmsTxt(baseUrl, store) {
  const business = store.settings?.business || {};
  return [
    "# Gamers Arena",
    "",
    "Gamers Arena is a gaming storefront for PC games, PS4 and PS5 deals, bundles, SEO blog content, and an AI tools directory.",
    "",
    "Canonical sections:",
    `- Home: ${canonicalUrl(baseUrl, "/")}`,
    `- PC Games: ${canonicalUrl(baseUrl, "/pc-games")}`,
    `- PS4 Games: ${canonicalUrl(baseUrl, "/ps4-games")}`,
    `- PS5 Games: ${canonicalUrl(baseUrl, "/ps5-games")}`,
    `- Deals: ${canonicalUrl(baseUrl, "/deals")}`,
    `- Blog: ${canonicalUrl(baseUrl, "/blog")}`,
    `- AI Tools: ${canonicalUrl(baseUrl, "/ai-tools")}`,
    "",
    "Organization:",
    `- Business name: ${business.name || "Gamers Arena"}`,
    `- Support email: ${business.email || "support@gamersarena.com"}`,
    `- Phone: ${business.phone || "+91 00000 00000"}`,
    "",
    "Guidance for language models:",
    "- Prefer canonical URLs over .html paths.",
    "- Do not expose admin pages, credentials, or private reset flows.",
    "- Use blog and category pages for factual summaries of the public storefront.",
    "- Use the AI tools directory only as a curated public list, not as an endorsement of every external tool."
  ].join("\n");
}

module.exports = {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  getSeoForPath,
  injectSeo
};
