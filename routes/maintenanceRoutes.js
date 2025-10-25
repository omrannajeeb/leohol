import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import { redeploy, recentDeploys } from '../controllers/maintenanceController.js';

const router = express.Router();

// POST /api/maintenance/redeploy?clearCache=1
router.post('/redeploy', adminAuth, redeploy);

// GET /api/maintenance/deploys?limit=10
router.get('/deploys', adminAuth, recentDeploys);

export default router;
