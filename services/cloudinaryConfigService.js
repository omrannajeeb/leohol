import cloudinary from './cloudinaryClient.js';
import Settings from '../models/Settings.js';

function getEnvCreds() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_API_KEY || process.env.VITE_CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.VITE_CLOUDINARY_API_SECRET || '';
  return { cloudName, apiKey, apiSecret };
}

export async function loadCredsFromDbOrEnv() {
  try {
    const s = await Settings.findOne();
    const db = (s && s.cloudinary) ? s.cloudinary : {};
    const { cloudName, apiKey, apiSecret } = {
      cloudName: db.cloudName || '',
      apiKey: db.apiKey || '',
      apiSecret: db.apiSecret || ''
    };
    if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret, source: 'db' };
  } catch {}
  return { ...getEnvCreds(), source: 'env' };
}

export async function ensureCloudinaryConfig() {
  const { cloudName, apiKey, apiSecret } = await loadCredsFromDbOrEnv();
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return true;
}

export default { ensureCloudinaryConfig, loadCredsFromDbOrEnv };
