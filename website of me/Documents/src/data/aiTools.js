const categories = [
  "Writing", "Image", "Video", "Audio", "Coding", "SEO", "Research", "Design",
  "Automation", "Productivity", "Marketing", "Sales", "Analytics", "Education"
];
const prefixes = ["Nova", "Pixel", "Prompt", "Neural", "Arena", "Quantum", "Turbo", "Vision", "Craft", "Signal", "Hyper", "Vector", "Zenith", "Echo", "Orbit"];
const suffixes = ["Writer", "Forge", "Pilot", "Studio", "Flow", "Scout", "Stack", "Builder", "Copilot", "Lens", "Pulse", "Core", "Deck", "Grid", "Hub"];

const aiTools = [];
let counter = 1;

categories.forEach((category, categoryIndex) => {
  for (let i = 0; i < 16; i += 1) {
    const name = `${prefixes[(categoryIndex + i) % prefixes.length]} ${suffixes[(i + categoryIndex * 2) % suffixes.length]}`;
    aiTools.push({
      id: `tool-${counter}`,
      name,
      category,
      description: `${name} helps teams with ${category.toLowerCase()} workflows, cleaner automation, and faster production output.`,
      url: `https://example.com/tools/${counter}`
    });
    counter += 1;
  }
});

module.exports = {
  aiTools
};
