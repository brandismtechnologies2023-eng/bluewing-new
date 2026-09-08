const { put } = require('@vercel/blob');
const { sendMail } = require('./_lib/mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_FIELDS = {
  'project-enquiry': ['name', 'email', 'interest'],
  'vendor-registration': ['company', 'name', 'email', 'phone', 'category', 'city'],
};

const LABELS = {
  name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', interest: 'Interest',
  message: 'Message', category: 'Category of supply', city: 'City / state', gst: 'GST number',
  years: 'Years in business', website: 'Website / catalogue',
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const formType = body.formType === 'vendor-registration' ? 'vendor-registration' : 'project-enquiry';
    const required = REQUIRED_FIELDS[formType];

    for (const field of required) {
      if (!body[field] || !String(body[field]).trim()) {
        return res.status(400).json({ error: `${LABELS[field] || field} is required` });
      }
    }
    if (!EMAIL_RE.test(String(body.email || '').trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      formType,
      submittedAt: new Date().toISOString(),
      fields: {},
    };
    Object.keys(LABELS).forEach((key) => {
      if (body[key] !== undefined) entry.fields[key] = String(body[key]).trim();
    });

    let emailError = null;
    if (process.env.SMTP_HOST) {
      try {
        const rows = Object.entries(entry.fields)
          .filter(([, v]) => v)
          .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#56687A;font-weight:600">${esc(LABELS[k] || k)}</td><td style="padding:6px 12px">${esc(v)}</td></tr>`)
          .join('');
        const title = formType === 'vendor-registration' ? 'New vendor registration' : 'New project enquiry';
        await sendMail({
          subject: `${title} — ${entry.fields.name || entry.fields.company || 'BlueWing website'}`,
          html: `<h2>${title}</h2><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`,
          replyTo: entry.fields.email,
        });
      } catch (err) {
        emailError = err.message;
      }
    }
    entry.emailError = emailError;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(`submissions/${formType}/${entry.id}.json`, JSON.stringify(entry, null, 2), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
};
