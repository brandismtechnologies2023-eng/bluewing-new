const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'bluewing-fallback-secret-change-me-738483';
const COOKIE_NAME = 'bw_admin_session';

const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours, renewed on activity

function signSession(username) {
  return jwt.sign({ u: username }, SECRET, { expiresIn: SESSION_MAX_AGE });
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

function isAuthed(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return false;
    const payload = jwt.verify(token, SECRET);
    if (res) {
      // Sliding expiration: any authenticated activity renews the 24h window.
      // If the device sits idle for 24h with no requests, the token expires
      // and the next request fails verification, forcing a re-login.
      setSessionCookie(res, signSession(payload.u));
    }
    return true;
  } catch (e) {
    return false;
  }
}

function requireAuth(req, res) {
  if (!isAuthed(req, res)) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
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
