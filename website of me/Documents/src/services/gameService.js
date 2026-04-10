const { games, bundles } = require("../data/games");
const { slugify } = require("../utils/helpers");
const { generateGameData } = require("./aiOrchestrator");

const gameStore = [...games];
const bundleStore = [...bundles];

async function addGameByName(gameName) {
  const generated = await generateGameData(gameName);
  const item = {
    id: `game-${gameStore.length + 1}`,
    slug: slugify(gameName),
    name: gameName,
    category: generated.category,
    releaseDate: generated.releaseDate,
    tags: generated.tags,
    image: `https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=900&q=80&sig=${gameStore.length + 50}`,
    description: generated.description,
    seo: {
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      keywords: generated.keywords
    },
    systemRequirements: generated.systemRequirements
  };
  gameStore.unshift(item);
  return item;
}

function listGames() {
  return gameStore;
}

function listBundles() {
  return bundleStore.map((bundle) => ({
    ...bundle,
    image: gameStore.find((game) => game.name === bundle.gameNames[0])?.image || bundle.image
  }));
}

function getGame(slug) {
  return gameStore.find((game) => game.slug === slug);
}

module.exports = {
  addGameByName,
  listGames,
  listBundles,
  getGame
};
