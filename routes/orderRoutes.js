import express from 'express';
import { auth, adminAuth } from '../middleware/auth.js';
import {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus
} from '../controllers/orderController.js';

const router = express.Router();

// Public routes (guest checkout)
router.post('/', (req, res, next) => {
  console.log('POST /orders route hit');
  next();
}, createOrder);

// Protected routes
router.get('/my-orders', auth, getUserOrders);

// Admin routes
router.get('/all', adminAuth, getAllOrders);
router.put('/:id/status', adminAuth, updateOrderStatus);

export default router;