const fs = require("fs");
const path = require("path");

const envFilePath = process.env.DOTENV_PATH
  ? path.resolve(process.env.DOTENV_PATH)
  : path.join(__dirname, "..", ".env");

function escapeEnvValue(value) {
  const normalized = String(value ?? "");
  return /^[A-Za-z0-9._:/@+-]+$/.test(normalized)
    ? normalized
    : JSON.stringify(normalized);
}

function upsertEnvValues(values = {}) {
  const entries = Object.entries(values).filter(([key]) => Boolean(key));
  const dir = path.dirname(envFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const existingLines = fs.existsSync(envFilePath)
    ? fs.readFileSync(envFilePath, "utf8").split(/\r?\n/)
    : [];
  const pending = new Map(entries);

  const nextLines = existingLines.map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!pending.has(key)) return line;
    const nextLine = `${key}=${escapeEnvValue(pending.get(key))}`;
    pending.delete(key);
    return nextLine;
  });

  pending.forEach((value, key) => {
    nextLines.push(`${key}=${escapeEnvValue(value)}`);
  });

  const output = `${nextLines.filter((line, index, lines) => !(index === lines.length - 1 && line === "")).join("\n")}\n`;
  fs.writeFileSync(envFilePath, output);

  entries.forEach(([key, value]) => {
    process.env[key] = String(value ?? "");
  });

  return envFilePath;
}

module.exports = {
  envFilePath,
  upsertEnvValues
};
