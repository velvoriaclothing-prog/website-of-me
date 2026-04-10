const { slugify } = require("./store");

const franchiseProfiles = [
  { topic: "Grand Theft Auto", focus: "GTA games", related: ["Grand Theft Auto V", "Grand Theft Auto San Andreas", "Grand Theft Auto Vice City"], keywords: ["gta games", "grand theft auto guide", "best gta game"] },
  { topic: "Red Dead Redemption", focus: "Red Dead games", related: ["Red Dead Redemption 2", "Red Dead Redemption", "open world western games"], keywords: ["red dead redemption", "red dead redemption 2 guide", "western open world game"] },
  { topic: "The Witcher", focus: "The Witcher series", related: ["The Witcher 3 Wild Hunt", "The Witcher 2 Assassins of Kings", "story driven RPGs"], keywords: ["witcher games", "witcher 3 guide", "best witcher game"] },
  { topic: "Cyberpunk 2077", focus: "Cyberpunk 2077", related: ["Night City builds", "story expansion content", "future RPG games"], keywords: ["cyberpunk 2077 guide", "cyberpunk pc tips", "cyberpunk 2077 build guide"] },
  { topic: "Soulslike Games", focus: "soulslike games", related: ["Elden Ring", "Dark Souls III", "Sekiro Shadows Die Twice"], keywords: ["soulslike games", "elden ring guide", "best soulslike game"] },
  { topic: "Assassin's Creed", focus: "Assassin's Creed games", related: ["Assassin's Creed Mirage", "Assassin's Creed Odyssey", "Assassin's Creed Black Flag"], keywords: ["assassins creed games", "best assassins creed", "assassins creed ranking"] },
  { topic: "Far Cry", focus: "Far Cry games", related: ["Far Cry 3", "Far Cry 5", "Far Cry 6"], keywords: ["far cry games", "best far cry game", "far cry order"] },
  { topic: "The Elder Scrolls", focus: "Elder Scrolls games", related: ["Skyrim", "Oblivion", "Morrowind"], keywords: ["elder scrolls guide", "skyrim tips", "best elder scrolls game"] },
  { topic: "Fallout", focus: "Fallout games", related: ["Fallout New Vegas", "Fallout 4", "Fallout 3"], keywords: ["fallout games", "fallout new vegas guide", "best fallout game"] },
  { topic: "Call of Duty", focus: "Call of Duty games", related: ["Black Ops series", "Modern Warfare series", "multiplayer shooters"], keywords: ["call of duty games", "best call of duty", "cod order"] },
  { topic: "Battlefield", focus: "Battlefield games", related: ["Battlefield 1", "Battlefield 4", "Battlefield 2042"], keywords: ["battlefield games", "best battlefield", "battlefield guide"] },
  { topic: "Halo", focus: "Halo games", related: ["Halo Reach", "Halo 3", "Halo Infinite"], keywords: ["halo games", "halo order", "best halo game"] },
  { topic: "Resident Evil", focus: "Resident Evil games", related: ["Resident Evil 4", "Resident Evil Village", "Resident Evil 2"], keywords: ["resident evil games", "resident evil guide", "best resident evil"] },
  { topic: "Hitman", focus: "Hitman games", related: ["Hitman 3", "Blood Money", "stealth sandbox games"], keywords: ["hitman guide", "best hitman game", "hitman trilogy order"] },
  { topic: "God of War", focus: "God of War games", related: ["God of War", "God of War Ragnarok", "action story games"], keywords: ["god of war guide", "god of war ranking", "best god of war game"] },
  { topic: "Spider-Man", focus: "Spider-Man games", related: ["Marvel's Spider-Man Remastered", "Miles Morales", "superhero action games"], keywords: ["spider man games", "spider man pc guide", "best superhero game"] },
  { topic: "Ghost of Tsushima", focus: "Ghost of Tsushima", related: ["Jin Sakai", "open world samurai games", "katana combat"], keywords: ["ghost of tsushima guide", "jin sakai build", "ghost of tsushima tips"] },
  { topic: "Black Myth: Wukong", focus: "Black Myth Wukong", related: ["Sun Wukong", "boss battles", "soulslike action games"], keywords: ["black myth wukong guide", "wukong tips", "black myth wukong pc"] },
  { topic: "Need for Speed", focus: "Need for Speed games", related: ["Most Wanted", "Heat", "Underground 2"], keywords: ["need for speed games", "best nfs game", "need for speed order"] },
  { topic: "Forza", focus: "Forza games", related: ["Forza Horizon 5", "Forza Horizon 4", "Forza Motorsport"], keywords: ["forza guide", "forza horizon tips", "best forza game"] },
  { topic: "Final Fantasy", focus: "Final Fantasy games", related: ["Final Fantasy VII", "Final Fantasy X", "Final Fantasy XVI"], keywords: ["final fantasy guide", "best final fantasy", "final fantasy order"] },
  { topic: "Persona", focus: "Persona games", related: ["Persona 5 Royal", "Persona 4 Golden", "Persona 3 Reload"], keywords: ["persona games", "persona guide", "best persona game"] },
  { topic: "Yakuza and Like a Dragon", focus: "Yakuza games", related: ["Yakuza 0", "Like a Dragon Infinite Wealth", "Judgment"], keywords: ["yakuza guide", "like a dragon order", "best yakuza game"] },
  { topic: "Monster Hunter", focus: "Monster Hunter games", related: ["Monster Hunter World", "Monster Hunter Rise", "action RPG hunting games"], keywords: ["monster hunter guide", "monster hunter world tips", "best monster hunter"] },
  { topic: "Low-End PC Games", focus: "low-end PC games", related: ["Terraria", "Stardew Valley", "Hollow Knight"], keywords: ["low end pc games", "best games for low end pc", "lightweight pc games"] }
];

const articleAngles = [
  {
    category: "Guide",
    title: (profile) => `The Complete ${profile.topic} Guide For New Players In 2026`,
    summary: (profile) => `A full beginner-to-advanced guide that explains where ${profile.focus} fit today, which entries matter most, and how to choose the right game without wasting time or money.`,
    intent: "complete guide"
  },
  {
    category: "Ranking",
    title: (profile) => `${profile.topic} Ranking: Best Games, Best Starting Points, And What To Buy`,
    summary: (profile) => `A long-form ranking and buying guide for ${profile.focus}, with clear recommendations, platform advice, and the smartest order to play them in.`,
    intent: "ranking"
  },
  {
    category: "Buying",
    title: (profile) => `How To Choose The Right ${profile.topic} Game For Your Play Style`,
    summary: (profile) => `A practical decision guide for players who want the right ${profile.focus} entry based on story preference, combat style, pacing, and platform comfort.`,
    intent: "buying guide"
  },
  {
    category: "Performance",
    title: (profile) => `${profile.topic} Tips, PC Performance, And Buying Advice For Smart Players`,
    summary: (profile) => `An SEO-focused long-form article covering ${profile.focus}, performance expectations, platform strategy, and the common mistakes players make before buying.`,
    intent: "performance guide"
  }
];

const sectionTitles = [
  "Why This Topic Still Matters",
  "What New Players Usually Get Wrong",
  "How The Series Or Genre Has Changed",
  "Best Starting Points For Different Players",
  "Story, World Building, And Pacing",
  "Combat, Systems, And Skill Growth",
  "Performance, Settings, And PC Expectations",
  "Value For Money And Content Depth",
  "How To Pick The Right Entry In 2026",
  "Mistakes To Avoid Before You Buy",
  "Practical Recommendations For Gamers Arena Visitors",
  "Long-Term Replay Value And Final Verdict"
];

const generatedMetadata = [];
const generatedContentCache = new Map();

function buildMetadataLibrary() {
  if (generatedMetadata.length) return generatedMetadata;

  let index = 1;
  franchiseProfiles.forEach((profile) => {
    articleAngles.forEach((angle) => {
      const title = angle.title(profile);
      const slug = `${slugify(title)}-${String(index).padStart(3, "0")}`;
      const createdAt = new Date(Date.UTC(2025, 8, (index % 28) + 1, 8, 0, 0)).toISOString();
      generatedMetadata.push({
        id: `seed-blog-${String(index).padStart(3, "0")}`,
        slug,
        title,
        summary: angle.summary(profile),
        content: "",
        htmlContent: "",
        image: "",
        createdAt,
        updatedAt: createdAt,
        topic: profile.topic,
        focus: profile.focus,
        related: profile.related,
        keywords: [...profile.keywords, `${profile.topic.toLowerCase()} ${angle.intent}`, "gamers arena blog"],
        metaTitle: `${title} | Gamers Arena`,
        metaDescription: `${angle.summary(profile).slice(0, 150)} Read the full Gamers Arena guide for practical buying tips, comparisons, and platform advice.`,
        category: angle.category,
        source: "seed",
        editable: false
      });
      index += 1;
    });
  });

  return generatedMetadata;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(text) {
  return stripHtml(text).split(/\s+/).filter(Boolean).length;
}

function makeParagraph(seed, sectionTitle, index) {
  const relatedA = seed.related[index % seed.related.length];
  const relatedB = seed.related[(index + 1) % seed.related.length];
  const keyword = seed.keywords[index % seed.keywords.length];
  return `<p>${seed.topic} stays relevant because players are still looking for a clear way to understand what makes the best entries worth playing, and that is exactly why this ${sectionTitle.toLowerCase()} matters so much on Gamers Arena. When someone searches for ${keyword}, they are usually not looking for vague hype; they want a grounded explanation of gameplay feel, platform comfort, pacing, value, and whether titles like ${relatedA} or ${relatedB} fit the time they actually have. A smart buying decision is rarely about finding the loudest recommendation, because the best result depends on whether a player cares more about story, challenge, progression, world design, technical smoothness, or replay value. In practical terms, that means every strong guide needs to separate emotional nostalgia from present-day usefulness, especially when a series has old classics, modern reboots, and premium editions competing for attention. We also have to account for how PC players behave in 2026, because they compare settings, performance, controller support, community fixes, content density, and whether a game remains fun after the opening five hours. The reason this article goes deep is simple: people buy better when the recommendation feels honest, detailed, and connected to real player priorities rather than generic list writing. If a visitor lands here from search, the goal is to make the next decision easier, faster, and more confident, whether that means starting with ${relatedA}, skipping a weak entry, or holding out for a version with stronger value. That kind of clarity is what helps a gaming site feel trustworthy, which matters as much for SEO as it does for readers who just want solid answers.</p>`;
}

function makeList(seed, sectionTitle, index) {
  const items = [
    `Choose ${seed.related[index % seed.related.length]} if you want the clearest expression of ${seed.focus}.`,
    `Choose ${seed.related[(index + 1) % seed.related.length]} if your priority is stronger pacing and easier onboarding.`,
    `Use Gamers Arena support when you cannot find a title, because niche variants and rare editions often need manual help.`,
    `Pay attention to platform behavior, controller support, and performance expectations before locking in a purchase.`
  ];
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function makeFaq(seed) {
  const faqs = [
    [`What is the best starting point for ${seed.topic}?`, `For most players, the best starting point is whichever entry balances modern comfort with the strongest version of the series identity. That often means beginning with ${seed.related[0]} because it gives new players the clearest sense of why ${seed.focus} remain relevant today.`],
    [`Are older ${seed.topic} games still worth playing?`, `Older entries are absolutely worth playing when they still offer a unique tone, important story context, or mechanical identity that newer games changed or removed. The real question is not age alone, but whether the player is comfortable with the design conventions and pacing of that era.`],
    [`How do I know which ${seed.topic} game fits my play style?`, `Start by identifying what matters most to you: story, combat, challenge, exploration, immersion, or session length. Once you know the priority, it becomes much easier to match the right entry instead of buying the loudest recommendation online.`],
    [`Should I buy a base edition or a deluxe edition?`, `Most players should only move beyond the base edition when the extra content meaningfully extends the core experience rather than just adding cosmetics or light side content. A good purchase is one that improves your first playthrough rather than only your receipt.`],
    [`Can low-end PCs still enjoy parts of ${seed.topic}?`, `In many cases yes, but the answer depends on the exact entry, not the series name alone. Earlier releases, optimized ports, and lower settings can still deliver a strong experience when expectations are set correctly.`],
    [`Why do SEO guides talk so much about value and replayability?`, `Because players do not search only for trailers or names. They search to answer whether a game will be worth the hours, money, and performance cost they are about to commit.`],
    [`What if the game I want is missing from Gamers Arena?`, `Use the Telegram request button and message the exact title. That is the fastest way to ask for missing stock, special editions, or versions that are not yet visible in the catalog.`],
    [`How should I compare ${seed.topic} against other franchises?`, `Compare them by the fantasy they deliver, not by raw popularity. The right choice depends on whether you want stronger role-play, denser systems, cleaner combat, easier onboarding, or a more cinematic experience.`]
  ];

  return `<section class="article-section"><h2>FAQ</h2>${faqs.map(([question, answer]) => `<div class="faq-item"><h3>${question}</h3><p>${answer}</p></div>`).join("")}</section>`;
}

function buildLongFormBlog(seed) {
  if (generatedContentCache.has(seed.slug)) return generatedContentCache.get(seed.slug);

  const parts = [];
  parts.push(`<div class="post-meta-strip"><span class="chip">${seed.category}</span><span class="chip">${seed.topic}</span><span class="chip">SEO Guide</span></div>`);
  parts.push(`<section class="article-section"><p>${seed.summary} This article is intentionally long-form because readers who search for ${seed.topic} usually need more than a short recommendation. They need context, comparison, strategy, and honest expectations before deciding what to buy, what to skip, and what to play first. That is especially true on a real store-oriented website, where trust is built through useful answers, not just lists of names. Throughout this guide, we will compare the strongest entry points, explain the hidden tradeoffs between old and new releases, and connect the advice to practical player goals like value, difficulty, pacing, replayability, and performance. If you are here from search, the aim is simple: help you leave with one clear decision that actually fits the kind of player you are.</p></section>`);

  let sectionIndex = 0;
  sectionTitles.forEach((sectionTitle) => {
    parts.push(`<section class="article-section"><h2>${sectionTitle}</h2>`);
    for (let i = 0; i < 3; i += 1) {
      parts.push(makeParagraph(seed, sectionTitle, sectionIndex));
      sectionIndex += 1;
    }
    parts.push(makeList(seed, sectionTitle, sectionIndex));
    parts.push(`</section>`);
  });

  while (wordCount(parts.join("")) < 10000) {
    const sectionTitle = `Advanced Notes ${Math.floor(sectionIndex / 5)}`;
    parts.push(`<section class="article-section"><h2>${sectionTitle}</h2>`);
    for (let i = 0; i < 4; i += 1) {
      parts.push(makeParagraph(seed, sectionTitle, sectionIndex));
      sectionIndex += 1;
    }
    parts.push(`</section>`);
  }

  parts.push(`<section class="article-section"><h2>Internal Links And Next Steps</h2><p>If you want to turn this research into an actual purchase flow, head back to the <a href="/">Gamers Arena home page</a>, open the store search, and look for the exact title that matches the recommendations in this guide. If the game is missing, use the Telegram request button or the <a href="/chat.html">support page</a> so the team can help you manually. Once you are ready, the <a href="/checkout.html">checkout page</a> keeps the order path simple and direct. You can also open <a href="/blog.html">more Gamers Arena blog guides</a> to compare series, discover better starting points, and build a smarter backlog over time.</p></section>`);
  parts.push(makeFaq(seed));
  parts.push(`<section class="article-section"><h2>Conclusion</h2><p>${seed.topic} remain important because they do more than fill a store list; they represent specific play fantasies, pacing models, and skill demands that different players value for different reasons. The strongest buying decision is not always the newest release or the loudest recommendation. It is the entry that best matches your preferred rhythm, challenge level, story tolerance, and platform expectations. If this guide helped narrow that choice, then it has already done the job good SEO content should do: answer a real question in a way that feels useful enough to act on. Use Gamers Arena to continue the search, compare options, and message support on Telegram if you need a title that is not already listed.</p></section>`);

  const htmlContent = parts.join("");
  const longForm = {
    ...seed,
    htmlContent,
    content: stripHtml(htmlContent),
    wordCount: wordCount(htmlContent),
    readTime: Math.max(1, Math.ceil(wordCount(htmlContent) / 220)),
    editable: false
  };
  generatedContentCache.set(seed.slug, longForm);
  return longForm;
}

function getSeedBlogs() {
  return buildMetadataLibrary().map((blog) => ({
    ...blog,
    readTime: 46,
    wordCount: 10000,
    editable: false
  }));
}

function getMergedBlogs(manualBlogs = []) {
  const manual = (manualBlogs || []).map((blog) => ({
    ...blog,
    editable: true,
    source: "manual",
    keywords: Array.isArray(blog.keywords) ? blog.keywords : [],
    metaTitle: blog.metaTitle || `${blog.title} | Gamers Arena`,
    metaDescription: blog.metaDescription || blog.summary || "",
    category: blog.category || "Manual",
    readTime: blog.readTime || Math.max(1, Math.ceil(wordCount(blog.content || "") / 220)),
    wordCount: blog.wordCount || wordCount(blog.content || "")
  }));
  const taken = new Set(manual.map((blog) => blog.slug));
  const seeded = getSeedBlogs().filter((blog) => !taken.has(blog.slug));
  return [...manual, ...seeded];
}

function getBlogBySlug(manualBlogs = [], slug = "") {
  const manual = (manualBlogs || []).find((blog) => blog.slug === slug);
  if (manual) {
    return {
      ...manual,
      editable: true,
      source: "manual",
      keywords: Array.isArray(manual.keywords) ? manual.keywords : [],
      metaTitle: manual.metaTitle || `${manual.title} | Gamers Arena`,
      metaDescription: manual.metaDescription || manual.summary || "",
      category: manual.category || "Manual",
      wordCount: manual.wordCount || wordCount(manual.content || ""),
      readTime: manual.readTime || Math.max(1, Math.ceil(wordCount(manual.content || "") / 220))
    };
  }

  const seed = buildMetadataLibrary().find((blog) => blog.slug === slug);
  return seed ? buildLongFormBlog(seed) : null;
}

module.exports = {
  getSeedBlogs,
  getMergedBlogs,
  getBlogBySlug
};
