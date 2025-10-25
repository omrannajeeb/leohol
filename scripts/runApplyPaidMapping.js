import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import dbManager from '../services/dbManager.js';
import { applyPaidMappingToAllCompanies } from './applyPaidMapping.js';

// Load env from project/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  try {
    console.log('[PaidMapping] Connecting to database...');
    await dbManager.connectWithRetry();
    console.log('[PaidMapping] Applying mapping to all companies...');
    const res = await applyPaidMappingToAllCompanies();
    console.log(`[PaidMapping] Updated: ${res.updated} / ${res.total} companies`);
  } catch (e) {
    console.error('[PaidMapping] Error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch {}
  }
}

await main();
