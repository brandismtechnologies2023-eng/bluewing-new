const OWNER = process.env.GITHUB_OWNER || 'brandismtechnologies2023-eng';
const REPO = process.env.GITHUB_REPO || 'bluewing-new';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = 'https://api.github.com';

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured on the server');
  return {
    Authorization: `token ${token}`,
    'User-Agent': 'bluewing-admin-panel',
    Accept: 'application/vnd.github+json',
  };
}

// Reads a JSON file from the repo. Returns { data, sha }. If missing, returns { data: fallback, sha: null }.
async function readJson(path, fallback) {
  const res = await fetch(
    `${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: headers() }
  );
  if (res.status === 404) return { data: fallback, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: json.sha };
}

// Writes a JSON file back to the repo (creates or updates).
async function writeJson(path, data, message) {
  const { sha } = await readJson(path, null).catch(() => ({ sha: null }));
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  return res.json();
}

module.exports = { readJson, writeJson };
