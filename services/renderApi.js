// Utilities to interact with the Render API from the server
// Requires env vars:
// - RENDER_API_KEY: a Render API key with access to this service
// - RENDER_SERVICE_ID: the Render service ID (e.g., srv-xxxxxxxxxxxxxxxxxxxx)

const RENDER_API_BASE = 'https://api.render.com/v1';

function boolEnv(value, def = false) {
  if (value === undefined || value === null || value === '') return def;
  const s = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(s);
}

export async function triggerDeploy({ clearCache = true } = {}) {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;

  if (!apiKey) {
    throw new Error('RENDER_API_KEY is not set');
  }
  if (!serviceId) {
    throw new Error('RENDER_SERVICE_ID is not set');
  }

  const url = `${RENDER_API_BASE}/services/${serviceId}/deploys`;
  const body = { clearCache: Boolean(clearCache) };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Render API deploy failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  return resp.json();
}

export async function listDeploys({ limit = 10 } = {}) {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) {
    throw new Error('RENDER_API_KEY and RENDER_SERVICE_ID are required');
  }
  const url = `${RENDER_API_BASE}/services/${serviceId}/deploys?limit=${encodeURIComponent(limit)}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Render API list deploys failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  return resp.json();
}
