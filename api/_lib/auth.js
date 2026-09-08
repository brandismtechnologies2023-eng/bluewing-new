const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'bluewing-fallback-secret-change-me-738483';
const COOKIE_NAME = 'bw_admin_session';

function signSession(username) {
  return jwt.sign({ u: username }, SECRET, { expiresIn: '7d' });
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function isAuthed(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    jwt.verify(token, SECRET);
    return true;
  } catch (e) {
    return false;
  }
}

function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

function setSessionCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

module.exports = {
  signSession,
  isAuthed,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};
