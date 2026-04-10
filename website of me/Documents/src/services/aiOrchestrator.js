const { providers } = require("./aiProviders");

async function runWithFallback(task, fallbackFactory) {
  for (const provider of providers) {
    try {
      const result = await provider.generate(task);
      return {
        ok: true,
        provider: result.provider,
        data: result.text
      };
    } catch {}
  }

  return {
    ok: true,
    provider: "Local Fallback",
    data: fallbackFactory()
  };
}

function deriveGameCategory(name) {
  const value = String(name).toLowerCase();
  if (/(forza|racing|speed|f1|wrc)/.test(value)) return "Racing";
  if (/(valorant|counter|call of duty|battlefield|shooter|fps)/.test(value)) return "Shooter";
  if (/(ring|baldur|witcher|rpg|starfield|fantasy)/.test(value)) return "RPG";
  if (/(low|lite|minecraft|terraria)/.test(value)) return "Low-end PC";
  if (/(coming|upcoming|ii|future|2026|2027)/.test(value)) return "Upcoming";
  return "Action";
}

function deriveTags(name, category) {
  return [
    category.toLowerCase(),
    "gaming",
    "pc games",
    `${String(name).toLowerCase()} guide`
  ];
}

async function generateGameData(gameName) {
  const category = deriveGameCategory(gameName);
  const ai = await runWithFallback(
    { prompt: `Generate metadata for game ${gameName}` },
    () => `${gameName} is a ${category} title on Gamers Arena with AI-generated discovery copy.`
  );

  return {
    name: gameName,
    genre: category,
    description: ai.data,
    releaseDate: category === "Upcoming" ? "2026-09-15" : "2024-05-14",
    tags: deriveTags(gameName, category),
    category,
    metaTitle: `${gameName} review, requirements and guide | Gamers Arena`,
    metaDescription: `Explore ${gameName} on Gamers Arena with AI-generated description, category, release date, and SEO-ready insights.`,
    keywords: [gameName.toLowerCase(), category.toLowerCase(), "gamers arena", "game guide"],
    systemRequirements: {
      minimum: ["8 GB RAM", "GTX 1050 / RX 560", "50 GB free storage"],
      recommended: ["16 GB RAM", "RTX 2060 / RX 6600", "SSD recommended"]
    },
    provider: ai.provider
  };
}

async function parseProductQuery(query) {
  const normalized = String(query || "").toLowerCase();
  const productType = ["keyboard", "mouse", "headset", "cpu", "gpu", "laptop"].find((item) => normalized.includes(item)) || "";
  const amountMatch = normalized.match(/under\s+(\d+)/);
  const budget = amountMatch ? Number(amountMatch[1]) : null;

  const ai = await runWithFallback(
    { prompt: `Parse marketplace search query: ${query}` },
    () => `productType=${productType || "all"};budget=${budget || "none"}`
  );

  return {
    productType,
    budget,
    provider: ai.provider
  };
}

async function genericContent(kind, topic) {
  const ai = await runWithFallback(
    { prompt: `Generate ${kind} for ${topic}` },
    () => `${kind} generated locally for ${topic}`
  );

  return {
    title: `${topic} | ${kind === "blog" ? "Expert AI Blog" : "Gaming News Update"} | Gamers Arena`,
    metaDescription: `Gamers Arena ${kind} about ${topic} with SEO-friendly structure, FAQs, and internal linking ideas.`,
    keywords: [topic.toLowerCase(), `ai ${kind}`, "gamers arena", "gaming"],
    content: `${ai.data}\n\nFAQ:\n1. Why does this matter?\nBecause players want faster, clearer guidance.\n2. How does Gamers Arena help?\nIt combines discovery, AI, and marketplace insights in one platform.`,
    faq: [
      { question: `What is this ${kind} about?`, answer: `It covers ${topic} with AI-supported structure and player-first context.` },
      { question: "How is this optimized?", answer: "It includes metadata, keywords, FAQs, and internal linking suggestions." }
    ],
    internalLinks: ["/", "/ai-tools.html", "/products/keyboard"],
    provider: ai.provider
  };
}

async function chatReply(message) {
  const ai = await runWithFallback(
    { prompt: `Reply to gamer assistant message: ${message}` },
    () => `Gamers Arena AI suggests focusing on value, performance, and compatibility for: ${message}`
  );
  return {
    reply: ai.data,
    provider: ai.provider
  };
}

module.exports = {
  generateGameData,
  parseProductQuery,
  genericContent,
  chatReply
};
