const { handleUpload } = require('@vercel/blob/client');
const { requireAuth } = require('./_lib/auth');

// Handles the token-request handshake for direct browser-to-Blob uploads.
// Used for large files (videos) that would otherwise exceed the serverless
// function's request body size limit if sent as base64 through /api/upload.
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'image/*'],
          addRandomSuffix: true,
          maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
        };
      },
      onUploadCompleted: async () => {},
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
};
