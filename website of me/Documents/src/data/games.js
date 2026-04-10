const { slugify } = require("../utils/helpers");

const categoryMap = {
  Action: [
    "Elden Ring", "Grand Theft Auto V", "Palworld", "Sekiro: Shadows Die Twice", "Ghost of Tsushima Director's Cut",
    "God of War", "Marvel's Spider-Man Remastered", "Assassin's Creed Mirage", "Dragon's Dogma 2", "Alan Wake 2",
    "Dying Light 2", "Remnant II", "Black Myth: Wukong", "Warhammer 40,000: Space Marine 2", "Dead Island 2",
    "Control", "Hitman World of Assassination", "The Last of Us Part I"
  ],
  Racing: [
    "Forza Horizon 5", "Need for Speed Unbound", "Assetto Corsa Competizione", "F1 24", "EA Sports WRC",
    "The Crew Motorfest", "Forza Motorsport", "DiRT Rally 2.0", "Hot Wheels Unleashed 2", "Trackmania",
    "CarX Drift Racing Online", "MotoGP 24", "Ride 5", "Wreckfest", "Gran Turismo 7", "Test Drive Unlimited Solar Crown"
  ],
  RPG: [
    "Cyberpunk 2077", "Baldur's Gate 3", "Starfield", "The Witcher 3", "Diablo IV",
    "Persona 3 Reload", "Like a Dragon: Infinite Wealth", "Metaphor: ReFantazio", "Dragon Age: The Veilguard", "Avowed",
    "Final Fantasy XVI", "Kingdom Come: Deliverance II", "Mass Effect Legendary Edition", "Fallout 4", "ELEX II",
    "Path of Exile 2", "No Rest for the Wicked", "GreedFall II"
  ],
  Shooter: [
    "Counter-Strike 2", "Valorant", "Call of Duty: Modern Warfare III", "Battlefield 2042", "Helldivers 2",
    "Apex Legends", "PUBG: Battlegrounds", "Rainbow Six Siege", "Ready or Not", "Destiny 2",
    "Warframe", "DOOM Eternal", "Halo Infinite", "Overwatch 2", "The Finals", "Escape from Tarkov",
    "S.T.A.L.K.E.R. 2", "XDefiant"
  ],
  "Low-end PC": [
    "Minecraft", "Terraria", "Stardew Valley", "Hollow Knight", "Celeste",
    "Dead Cells", "Cuphead", "Undertale", "Project Zomboid", "Don't Starve Together",
    "Among Us", "League of Legends", "Brawlhalla", "Portal 2", "Left 4 Dead 2",
    "Age of Empires II: Definitive Edition", "RimWorld", "Factorio"
  ],
  Upcoming: [
    "Hades II", "Assassin's Creed Shadows", "The Elder Scrolls VI", "GTA VI", "Kingdom Hearts IV",
    "Marvel's Wolverine", "Death Stranding 2", "Judas", "Perfect Dark", "Fable",
    "State of Decay 3", "Little Nightmares III", "The Wolf Among Us 2", "Exodus", "Clockwork Revolution",
    "Vampire: The Masquerade - Bloodlines 2", "Metal Gear Solid Delta", "Monster Hunter Wilds"
  ]
};

const tagMap = {
  Action: ["combat", "single-player", "adventure"],
  Racing: ["cars", "speed", "competitive"],
  RPG: ["story", "builds", "progression"],
  Shooter: ["fps", "multiplayer", "aim"],
  "Low-end PC": ["lightweight", "budget", "smooth"],
  Upcoming: ["wishlist", "release-watch", "hype"]
};

const releaseYears = {
  Action: 2024,
  Racing: 2023,
  RPG: 2024,
  Shooter: 2023,
  "Low-end PC": 2019,
  Upcoming: 2026
};

const allGames = Object.entries(categoryMap).flatMap(([category, names], categoryIndex) =>
  names.map((name, index) => {
    const year = category === "Upcoming" ? releaseYears[category] + Math.floor(index / 6) : releaseYears[category] - (index % 4);
    const month = String((index % 12) + 1).padStart(2, "0");
    const day = String(((index * 2) % 27) + 1).padStart(2, "0");
    return {
      id: `game-${categoryIndex + 1}-${index + 1}`,
      slug: slugify(name),
      name,
      category,
      releaseDate: `${year}-${month}-${day}`,
      tags: [...tagMap[category], slugify(name).split("-")[0]],
      image: `https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80&sig=${categoryIndex * 100 + index + 1}`,
      description: `${name} is featured on Gamers Arena with curated discovery data, category insights, SEO metadata, and a clean buyer-friendly overview.`,
      seo: {
        metaTitle: `${name} review, requirements, tips and release info | Gamers Arena`,
        metaDescription: `Discover ${name} on Gamers Arena with release details, category fit, system requirements, and player-friendly guidance.`,
        keywords: [name.toLowerCase(), category.toLowerCase(), "gamers arena", "pc gaming"]
      },
      systemRequirements: {
        minimum: category === "Low-end PC"
          ? ["4 GB RAM", "Integrated graphics or GTX 750 Ti", "20 GB storage"]
          : ["8 GB RAM", "GTX 1050 / RX 560", "50 GB storage"],
        recommended: category === "Upcoming"
          ? ["16 GB RAM", "RTX 3060 / RX 6700 XT", "SSD storage"]
          : ["16 GB RAM", "RTX 2060 / RX 6600", "SSD storage"]
      }
    };
  })
);

const bundles = [
  {
    id: "bundle-1",
    slug: "arena-action-pack",
    name: "Arena Action Pack",
    gameNames: ["Elden Ring", "Grand Theft Auto V", "Ghost of Tsushima Director's Cut"],
    price: 2499,
    image: allGames.find((game) => game.name === "Elden Ring").image,
    description: "A high-value action bundle built for players who want cinematic combat, open worlds, and premium replay value."
  },
  {
    id: "bundle-2",
    slug: "fps-champion-stack",
    name: "FPS Champion Stack",
    gameNames: ["Counter-Strike 2", "Valorant", "Call of Duty: Modern Warfare III"],
    price: 2999,
    image: allGames.find((game) => game.name === "Counter-Strike 2").image,
    description: "A competitive bundle for tactical, arcade, and multiplayer shooter fans."
  },
  {
    id: "bundle-3",
    slug: "budget-legend-bundle",
    name: "Budget Legend Bundle",
    gameNames: ["Minecraft", "Terraria", "Stardew Valley"],
    price: 1499,
    image: allGames.find((game) => game.name === "Minecraft").image,
    description: "A lighter-spec bundle for players who want hundreds of hours of gameplay on modest hardware."
  }
];

module.exports = {
  games: allGames,
  bundles
};
