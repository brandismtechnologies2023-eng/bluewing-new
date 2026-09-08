const { signSession, setSessionCookie } = require('./_lib/auth');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel project environment variables.' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { username, password } = body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = signSession(username);
    setSessionCookie(res, token);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(401).json({ error: 'Invalid username or password' });
};
