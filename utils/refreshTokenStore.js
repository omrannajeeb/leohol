// Persistent refresh token store backed by MongoDB (via Mongoose)
// Stores hashed token values to avoid leaking raw tokens if DB is compromised.
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';

function hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function saveRefreshToken(token, userId, ttlMs) {
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  // Upsert to allow reissuing same token rarely (not typical), else simply create new
  await RefreshToken.findOneAndUpdate(
    { tokenHash },
    { tokenHash, userId, expiresAt, revokedAt: null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function consumeRefreshToken(token) {
  const tokenHash = hash(token);
  const doc = await RefreshToken.findOne({ tokenHash });
  if (!doc) return null;
  if (doc.revokedAt) return null;
  if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) return null;
  return { userId: doc.userId, exp: doc.expiresAt?.getTime() || 0 };
}

export async function revokeToken(token) {
  const tokenHash = hash(token);
  await RefreshToken.updateOne({ tokenHash }, { $set: { revokedAt: new Date() } });
}

export async function revokeUserTokens(userId) {
  await RefreshToken.updateMany({ userId }, { $set: { revokedAt: new Date() } });
}

export function cleanupExpired() {
  // No-op: TTL index on expiresAt handles cleanup automatically
}

export default {
  saveRefreshToken,
  consumeRefreshToken,
  revokeToken,
  revokeUserTokens
};
