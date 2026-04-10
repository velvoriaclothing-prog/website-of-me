const { products, upcomingProducts } = require("../data/products");
const { parseProductQuery } = require("./aiOrchestrator");
const { scoreBestChoice } = require("../utils/helpers");

function listProducts() {
  return products;
}

function getProduct(slug) {
  return products.find((product) => product.slug === slug) || null;
}

function listUpcomingProducts() {
  return upcomingProducts;
}

async function searchProducts(query) {
  const parsed = await parseProductQuery(query);
  const results = products.filter((product) => {
    const typeMatch = !parsed.productType || product.category.toLowerCase() === parsed.productType;
    const budgetMatch = !parsed.budget || product.price <= parsed.budget;
    return typeMatch && budgetMatch;
  });

  const enriched = results.map((product) => ({
    ...product,
    bestChoiceScore: scoreBestChoice(product)
  })).sort((a, b) => b.bestChoiceScore - a.bestChoiceScore);

  return {
    query,
    parsed,
    results: enriched
  };
}

function compareProducts(items) {
  const productsToCompare = products.filter((product) => items.includes(product.id) || items.includes(product.slug));
  const bestValue = [...productsToCompare].sort((a, b) => (b.rating / b.price) - (a.rating / a.price))[0] || null;
  const bestPerformance = [...productsToCompare].sort((a, b) => b.rating - a.rating)[0] || null;

  return {
    items: productsToCompare,
    highlights: {
      bestValue: bestValue?.id || null,
      bestPerformance: bestPerformance?.id || null
    }
  };
}

function autoListings() {
  return [
    "best keyboard under 1000",
    "best mouse under 500",
    "best laptop under 60000",
    "best gpu under 20000"
  ];
}

module.exports = {
  listProducts,
  getProduct,
  listUpcomingProducts,
  searchProducts,
  compareProducts,
  autoListings
};
