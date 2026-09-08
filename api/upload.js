const { put } = require('@vercel/blob');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAuth(req, res)) return;

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { filename, dataBase64, contentType } = body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ error: 'filename and dataBase64 are required' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Image storage is not configured yet. Enable Vercel Blob storage for this project.',
      });
    }

    const base64Data = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const blob = await put(key, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
};
