// =============================================================================
// FILE: routes/Reports/reportsRoutes.js
// Mount at: /api/reports  (add to server.js)
// =============================================================================
import { Router } from 'express';
import {
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport,
  getDepartmentReport,
  getYearSummary,
} from '../../controllers/Reports/reportsController.js';

const router = Router();

// GET /api/reports/monthly?year=2026
router.get('/monthly',    getMonthlyReport);

// GET /api/reports/quarterly?year=2026
router.get('/quarterly',  getQuarterlyReport);

// GET /api/reports/yearly?startYear=2021
router.get('/yearly',     getYearlyReport);

// GET /api/reports/department?year=2026
router.get('/department', getDepartmentReport);

// GET /api/reports/summary?year=2026
router.get('/summary',    getYearSummary);

export default router;