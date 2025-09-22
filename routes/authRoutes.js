import express from 'express';
import { login, register, getCurrentUser, promoteToAdmin, isAdmin } from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', auth, getCurrentUser);
router.get('/is-admin', auth, isAdmin);
// Bootstrap/recovery: promote a user to admin.
// Requires ADMIN_SETUP_TOKEN env or absence of existing admin users.
router.post('/promote', promoteToAdmin);

export default router;
