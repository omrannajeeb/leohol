import express from 'express';
import { auth, adminAuth } from '../middleware/auth.js';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateRelatedProducts,
  searchProducts,
  reorderFeaturedProducts,
  bulkCreateProducts,
  getProductStock,
  uploadProductVideo,
  uploadTempProductVideo
} from '../controllers/productController.js';
import { videoUpload } from '../middleware/videoUpload.js';
import {
  getAllReviews,
  addReview,
  updateReview,
  markReviewHelpful,
  reportReview,
  verifyReview,
  deleteReview
} from '../controllers/reviewController.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/search', searchProducts);
// Place static paths before dynamic ':id' to avoid conflicts
router.get('/:id/stock', getProductStock); // New endpoint for stock levels
router.get('/:id', getProduct);

// Protected routes (admin only)
router.post('/', adminAuth, createProduct);
router.post('/bulk', adminAuth, bulkCreateProducts);
// Put static route before dynamic ones
router.put('/featured/reorder', adminAuth, reorderFeaturedProducts);
router.put('/:id', adminAuth, updateProduct);
router.put('/:id/related', adminAuth, updateRelatedProducts);
router.post('/:id/videos', adminAuth, videoUpload.single('video'), uploadProductVideo);
// Pre-create standalone video upload (returns URL only). Must precede dynamic :id catch for GETs but after other static POSTs.
router.post('/videos/temp', adminAuth, videoUpload.single('video'), uploadTempProductVideo);
router.delete('/:id', adminAuth, deleteProduct);

// Review routes
router.get('/reviews/all', adminAuth, getAllReviews);
router.post('/:id/reviews', auth, addReview);
router.patch('/:id/reviews/:reviewId', auth, updateReview);
router.post('/:id/reviews/:reviewId/helpful', auth, markReviewHelpful);
router.post('/:id/reviews/:reviewId/report', auth, reportReview);
router.put('/:id/reviews/:reviewId/verify', adminAuth, verifyReview);
router.delete('/:id/reviews/:reviewId', auth, deleteReview);

export default router;
