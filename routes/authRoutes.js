import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/register',         register);
router.post('/login',            login);
router.post('/logout',           logout);
router.get ('/me',               authenticateAdmin, getMe);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   resetPassword);

export default router;