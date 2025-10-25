import { triggerDeploy, listDeploys } from '../services/renderApi.js';

export const redeploy = async (req, res) => {
  try {
    const clearCache = !['0', 'false', 'no', 'off'].includes(String(req.query.clearCache || '1').toLowerCase());
    const result = await triggerDeploy({ clearCache });
    return res.json({ ok: true, clearCache, deploy: result });
  } catch (e) {
    console.error('[maintenance][redeploy] error:', e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};

export const recentDeploys = async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '10'), 10);
    const data = await listDeploys({ limit: isNaN(limit) ? 10 : limit });
    return res.json({ ok: true, data });
  } catch (e) {
    console.error('[maintenance][recentDeploys] error:', e);
    return res.status(500).json({ ok: false, message: e.message });
  }
};
