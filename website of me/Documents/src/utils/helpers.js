function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function currency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function scoreBestChoice(product) {
  const ratingScore = Number(product.rating || 0) * 20;
  const priceScore = product.price > 0 ? Math.max(0, 100 - product.price / 1000) : 0;
  return Math.round(ratingScore + priceScore);
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

module.exports = {
  slugify,
  currency,
  scoreBestChoice,
  uniqueBy
};
