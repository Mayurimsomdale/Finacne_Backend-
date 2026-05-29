import express from 'express';
import {
  login,
  register,
  getProfile,
  updateProfile,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login',            login);
router.post('/register',         register);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   resetPassword);

router.use(authenticateAdmin);
router.get ('/profile',  getProfile);
router.put ('/profile',  updateProfile);
router.post('/logout',   logout);

export default router;