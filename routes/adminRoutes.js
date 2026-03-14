// routes/adminRoutes.js
import express from 'express';
import * as adminController from '../controllers/employeeMng/adminController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', adminController.login);
router.post('/register', adminController.register);  

// Protected routes
router.use(authenticateAdmin);
router.get('/profile', adminController.getProfile);
router.put('/profile', adminController.updateProfile);
router.post('/logout', adminController.logout);

export default router;