const crypto = require("crypto");

const COOKIE_NAME = "ga_sid";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-session-secret";
const secureCookie = process.env.NODE_ENV === "production";

function buildCookie(value, maxAge) {
  const parts = [`${COOKIE_NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (secureCookie) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      const key = part.slice(0, index);
      const value = decodeURIComponent(part.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function makeSid() {
  return crypto.randomBytes(24).toString("hex");
}

function createGuestSession() {
  const sid = makeSid();
  return {
    ownerKey: `guest-${sid.slice(0, 10)}`,
    userId: null,
    name: "Guest",
    contact: "",
    isAdmin: false
  };
}

function normalizeSession(value) {
  const ownerKey = String(value?.ownerKey || "").trim();
  if (!ownerKey) return null;

  return {
    ownerKey,
    userId: value?.userId ? String(value.userId) : null,
    name: String(value?.name || "Guest"),
    contact: String(value?.contact || ""),
    isAdmin: Boolean(value?.isAdmin)
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(payload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return normalizeSession(session);
  } catch (_error) {
    return null;
  }
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  return decodeSession(token);
}

function attachSession(req, res) {
  const current = getSession(req);
  if (current) {
    req.session = current;
    return current;
  }

  const session = createGuestSession();
  res.setHeader("Set-Cookie", buildCookie(encodeSession(session)));
  req.session = session;
  return req.session;
}

function setSession(req, res, value) {
  const attached = attachSession(req, res);
  const session = normalizeSession({
    ownerKey: value.ownerKey || attached.ownerKey,
    userId: value.userId || null,
    name: value.name || "Guest",
    contact: value.contact || "",
    isAdmin: Boolean(value.isAdmin)
  }) || attached;
  req.session = session;
  res.setHeader("Set-Cookie", buildCookie(encodeSession(session)));
  return req.session;
}

function clearSession(req, res) {
  res.setHeader("Set-Cookie", buildCookie("", 0));
  req.session = null;
}

function sessionFromSocket(handshake) {
  const token = parseCookies(handshake.headers.cookie || "")[COOKIE_NAME];
  return decodeSession(token);
}

module.exports = {
  COOKIE_NAME,
  attachSession,
  clearSession,
  getSession,
  parseCookies,
  sessionFromSocket,
  setSession
};
