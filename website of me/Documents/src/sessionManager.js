const crypto = require("crypto");

const COOKIE_NAME = "ga_sid";
const sessions = new Map();

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

function getSession(req) {
  const sid = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!sid) return null;
  return sessions.get(sid) ? { sid, ...sessions.get(sid) } : null;
}

function attachSession(req, res) {
  const current = getSession(req);
  if (current) {
    req.session = current;
    return current;
  }

  const sid = makeSid();
  const session = {
    ownerKey: `guest-${sid.slice(0, 10)}`,
    userId: null,
    name: "Guest",
    contact: "",
    isAdmin: false
  };
  sessions.set(sid, session);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${sid}; Path=/; HttpOnly; SameSite=Lax`);
  req.session = { sid, ...session };
  return req.session;
}

function setSession(req, res, value) {
  const attached = attachSession(req, res);
  const session = {
    ownerKey: value.ownerKey,
    userId: value.userId || null,
    name: value.name || "Guest",
    contact: value.contact || "",
    isAdmin: Boolean(value.isAdmin)
  };
  sessions.set(attached.sid, session);
  req.session = { sid: attached.sid, ...session };
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${attached.sid}; Path=/; HttpOnly; SameSite=Lax`);
  return req.session;
}

function clearSession(req, res) {
  const current = getSession(req);
  if (current) sessions.delete(current.sid);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
  req.session = null;
}

function sessionFromSocket(handshake) {
  const sid = parseCookies(handshake.headers.cookie || "")[COOKIE_NAME];
  if (!sid) return null;
  const session = sessions.get(sid);
  return session ? { sid, ...session } : null;
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
