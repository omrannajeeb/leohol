import express from 'express';
import PageLayout from '../models/PageLayout.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Get current layout sections
router.get('/', async (req, res) => {
  try {
    const doc = await PageLayout.getOrCreate();
    res.json({ sections: doc.sections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Replace all sections (admin only)
router.put('/', adminAuth, async (req, res) => {
  try {
    const { sections } = req.body || {};
    if (!Array.isArray(sections)) {
      return res.status(400).json({ message: 'Invalid payload: sections must be an array' });
    }

    const doc = await PageLayout.getOrCreate();
    doc.sections = sections;
    doc.markModified('sections');
    await doc.save();

    // Optionally broadcast change to clients (if using websockets)
    try {
      const broadcast = req.app.get('broadcastToClients');
      if (typeof broadcast === 'function') {
        broadcast({ type: 'layout_updated', data: { sections } });
      }
    } catch {}

    res.json({ sections: doc.sections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
