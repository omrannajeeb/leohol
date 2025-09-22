import express from 'express';
import { adminAuth } from '../middleware/auth.js';
import {
  getShippingZones,
  getShippingZone,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  getShippingRates,
  getShippingRate,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
  calculateShippingFee,
} from '../controllers/shippingController.js';

const router = express.Router();

// Shipping Zone Routes
router.route('/zones')
  .get(getShippingZones) // Get all shipping zones
  .post(adminAuth, createShippingZone); // Admin-only: Create a new shipping zone

router.route('/zones/:id')
  .get(getShippingZone) // Get a single shipping zone by ID
  .put(adminAuth, updateShippingZone) // Admin-only: Update a shipping zone by ID
  .delete(adminAuth, deleteShippingZone); // Admin-only: Delete a shipping zone by ID

// Shipping Rate Routes
router.route('/rates')
  .get(getShippingRates) // Get all shipping rates
  .post(adminAuth, createShippingRate); // Admin-only: Create a new shipping rate

router.route('/rates/:id')
  .get(getShippingRate) // Get a single shipping rate by ID
  .put(adminAuth, updateShippingRate) // Admin-only: Update a shipping rate by ID
  .delete(adminAuth, deleteShippingRate); // Admin-only: Delete a shipping rate by ID

// Shipping Fee Calculation Route
router.post('/calculate', async (req, res) => {
  try {
    const { weight, dimensions, zoneId, rateId } = req.body;

    if (!weight || !dimensions || !zoneId || !rateId) {
      return res.status(400).json({ message: 'Missing required fields for shipping fee calculation' });
    }

    // Call the controller function to calculate shipping fee
    const fee = await calculateShippingFee(weight, dimensions, zoneId, rateId);
    
    if (!fee) {
      return res.status(404).json({ message: 'Shipping fee calculation failed' });
    }

    res.json({ shippingFee: fee });
  } catch (error) {
    console.error('Error calculating shipping fee:', error);
    res.status(500).json({ message: 'Error calculating shipping fee' });
  }
});

export default router;
