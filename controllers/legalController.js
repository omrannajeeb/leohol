import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import LegalPageView from '../models/LegalPageView.js';

// POST /api/legal/view { page: 'privacy' | 'terms' }
export const recordLegalView = asyncHandler(async (req, res) => {
  const { page } = req.body || {};
  if (!['privacy', 'terms'].includes(page)) {
    return res.status(400).json({ message: 'Invalid page' });
  }
  // Lightweight hashing of IP+UA (NOT reversible, not PII storage) for basic dedupe if needed later.
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const ua = (req.headers['user-agent'] || '').slice(0, 300);
  const hash = crypto.createHash('sha256').update(ip + '|' + ua).digest('hex').slice(0, 32);
  await LegalPageView.create({ page, ipHash: hash, userAgent: ua });
  res.json({ ok: true });
});

// GET /api/legal/stats?page=privacy
export const getLegalStats = asyncHandler(async (req, res) => {
  const { page } = req.query;
  const match = page && ['privacy', 'terms'].includes(page) ? { page } : {};
  const total = await LegalPageView.countDocuments(match);
  const last24h = await LegalPageView.countDocuments({
    ...match,
    createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
  });
  res.json({ total, last24h });
});
