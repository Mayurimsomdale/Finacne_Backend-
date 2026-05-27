import express from 'express';
import { login, register, getProfile, updateProfile, logout } from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login',    login);
router.post('/register', register);

router.use(authenticateAdmin);
router.get('/profile',  getProfile);
router.put('/profile',  updateProfile);
router.post('/logout',  logout);

export default router;