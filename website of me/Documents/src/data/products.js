const { slugify } = require("../utils/helpers");

const products = [
  { name: "Redragon K617 Keyboard", category: "Keyboard", price: 999, rating: 4.3, features: ["60% layout", "RGB", "Wired"], affiliateUrl: "https://example.com/keyboard-1" },
  { name: "Cosmic Byte CB-GK-18", category: "Keyboard", price: 899, rating: 4.1, features: ["Mechanical feel", "RGB", "Budget"], affiliateUrl: "https://example.com/keyboard-2" },
  { name: "EKSA E900 Headset", category: "Headset", price: 1999, rating: 4.2, features: ["Noise cancelling mic", "7.1 sound", "Comfort fit"], affiliateUrl: "https://example.com/headset-1" },
  { name: "AMD Ryzen 5 5600", category: "CPU", price: 10999, rating: 4.7, features: ["6 cores", "12 threads", "Gaming value"], affiliateUrl: "https://example.com/cpu-1" },
  { name: "Intel Core i5-12400F", category: "CPU", price: 12499, rating: 4.6, features: ["6 cores", "DDR5 support", "Great gaming"], affiliateUrl: "https://example.com/cpu-2" },
  { name: "NVIDIA RTX 3050", category: "GPU", price: 19999, rating: 4.3, features: ["Ray tracing", "DLSS", "1080p gaming"], affiliateUrl: "https://example.com/gpu-1" },
  { name: "AMD RX 6600", category: "GPU", price: 18999, rating: 4.5, features: ["1080p ultra", "8 GB VRAM", "Efficient"], affiliateUrl: "https://example.com/gpu-2" },
  { name: "ASUS TUF F15", category: "Laptop", price: 59990, rating: 4.4, features: ["RTX graphics", "144Hz", "Gaming laptop"], affiliateUrl: "https://example.com/laptop-1" },
  { name: "Lenovo LOQ 15", category: "Laptop", price: 58990, rating: 4.5, features: ["RTX graphics", "IPS panel", "Strong cooling"], affiliateUrl: "https://example.com/laptop-2" },
  { name: "Ant Esports MK3400", category: "Keyboard", price: 1299, rating: 4.0, features: ["Mechanical blue switches", "Full-size", "RGB"], affiliateUrl: "https://example.com/keyboard-3" },
  { name: "JBL Quantum 100", category: "Headset", price: 2499, rating: 4.3, features: ["Detachable mic", "Comfort fit", "Clear audio"], affiliateUrl: "https://example.com/headset-2" },
  { name: "AMD Ryzen 7 7700", category: "CPU", price: 27999, rating: 4.8, features: ["8 cores", "Creator + gaming", "AM5"], affiliateUrl: "https://example.com/cpu-3" },
  { name: "NVIDIA RTX 4060", category: "GPU", price: 29999, rating: 4.6, features: ["DLSS 3", "Ray tracing", "1440p ready"], affiliateUrl: "https://example.com/gpu-3" },
  { name: "Acer Nitro V 15", category: "Laptop", price: 64990, rating: 4.3, features: ["RTX graphics", "High refresh display", "Cooling"], affiliateUrl: "https://example.com/laptop-3" }
].map((product, index) => ({
  id: `product-${index + 1}`,
  slug: slugify(product.name),
  ...product,
  image: `https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=80&sig=${index + 20}`,
  summary: `${product.name} is a ${product.category.toLowerCase()} pick on Gamers Arena for gamers balancing performance, value, and long-term usability.`
}));

const upcomingProducts = [
  {
    id: "upcoming-1",
    name: "HyperNova Wireless Gaming Mouse",
    expectedLaunch: "2026-07-15",
    category: "Mouse",
    summary: "AI trend scan suggests stronger demand for lightweight rechargeable mice with swappable shells."
  },
  {
    id: "upcoming-2",
    name: "Aether RTX 5060 Mini GPU",
    expectedLaunch: "2026-09-01",
    category: "GPU",
    summary: "Compact mid-range GPUs are expected to trend among budget creators and esports players."
  },
  {
    id: "upcoming-3",
    name: "VoltEdge 75 Mechanical Keyboard",
    expectedLaunch: "2026-06-20",
    category: "Keyboard",
    summary: "75 percent wireless RGB keyboards continue trending among low-clutter desk setups."
  }
];

module.exports = {
  products,
  upcomingProducts
};
