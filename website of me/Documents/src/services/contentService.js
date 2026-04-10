const { genericContent } = require("./aiOrchestrator");
const { slugify } = require("../utils/helpers");

const contentStore = {
  blogs: [],
  news: []
};

async function generateBlog(topic = "Best gaming setups for budget players") {
  const payload = await genericContent("blog", topic);
  const item = {
    id: `blog-${Date.now()}`,
    slug: slugify(payload.title),
    ...payload,
    type: "blog",
    introduction: `Gamers Arena takes a practical look at ${topic.toLowerCase()} so readers can make better buying and setup decisions.`,
    sections: [
      {
        title: "What matters most",
        body: `When evaluating ${topic.toLowerCase()}, focus on value, long-term performance, and how the setup fits actual play habits rather than specs alone.`
      },
      {
        title: "Smart buyer tips",
        body: "Prioritize reliability, realistic budgets, and upgrade flexibility before chasing flagship features."
      }
    ],
    tips: [
      "Compare long-term value, not only launch price.",
      "Balance accessories with actual game genres and usage patterns.",
      "Use benchmark and compatibility data together."
    ],
    conclusion: "The best gaming picks usually come from matching your budget to your actual use case instead of buying on hype.",
    featuredImage: `https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=80&sig=${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  contentStore.blogs.unshift(item);
  return item;
}

async function generateNews(topic = "Today in PC gaming") {
  const payload = await genericContent("news", topic);
  const item = {
    id: `news-${Date.now()}`,
    slug: slugify(payload.title),
    ...payload,
    type: "news",
    summary: payload.metaDescription,
    featuredImage: `https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80&sig=${Date.now() + 1}`,
    createdAt: new Date().toISOString()
  };
  contentStore.news.unshift(item);
  return item;
}

async function ensureDailyContent() {
  if (contentStore.blogs.length < 3) {
    await generateBlog("Best keyboards under budget for gamers");
    await generateBlog("How AI recommendations improve your next game purchase");
    await generateBlog("Building a clean gaming setup without overspending");
  }
  if (contentStore.news.length < 3) {
    await generateNews("Top trends in PC gaming today");
    await generateNews("Upcoming launches gamers should watch this week");
    await generateNews("The gaming accessory categories buyers are comparing most this week");
  }
}

function getContent() {
  return {
    blogs: contentStore.blogs,
    news: contentStore.news
  };
}

function getBlogBySlug(slug) {
  return contentStore.blogs.find((item) => item.slug === slug) || null;
}

function getNewsBySlug(slug) {
  return contentStore.news.find((item) => item.slug === slug) || null;
}

module.exports = {
  ensureDailyContent,
  generateBlog,
  generateNews,
  getContent,
  getBlogBySlug,
  getNewsBySlug
};
