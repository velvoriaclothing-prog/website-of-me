function buildSitemap(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc></url>
  <url><loc>${baseUrl}/ai-tools.html</loc></url>
  <url><loc>${baseUrl}/game/elden-ring</loc></url>
  <url><loc>${baseUrl}/product/keyboard</loc></url>
</urlset>`;
}

function buildRobots(baseUrl) {
  return `User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`;
}

module.exports = {
  buildSitemap,
  buildRobots
};
