const { list, del } = require('@vercel/blob');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Image storage is not configured yet. Enable Vercel Blob storage for this project.',
      });
    }

    if (req.method === 'GET') {
      const items = [];
      let cursor;
      do {
        const page = await list({ prefix: 'uploads/', cursor, limit: 100 });
        items.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);

      items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const media = items.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }));
      return res.status(200).json(media);
    }

    if (req.method === 'DELETE') {
      const { url } = req.query || {};
      if (!url) return res.status(400).json({ error: 'url is required' });
      await del(url);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
