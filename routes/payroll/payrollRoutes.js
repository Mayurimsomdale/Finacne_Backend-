  // =============================================================================
  // FILE: routes/payroll/payrollRoutes.js
  //
  // CRITICAL ORDER RULE:
  //   Static paths (/stats, /advance-summary, /record, /init-month, /pay-bulk)
  //   MUST be declared BEFORE dynamic params (/:employeeId, /:id/pay).
  //   Express matches routes top-to-bottom — if /:employeeId is first, it will
  //   swallow every static path and return a 404 from getEmployeePayroll.
  // =============================================================================
  import { Router } from 'express';
  import { authenticateAdmin as verifyToken } from '../../middleware/auth.js';

  import {
    getPayrollData,
    getEmployeePayroll,
    upsertPayrollRecord,
    markPaid,
    markPaidBulk,
    initMonth,
    getPayrollStats,
    getAdvanceSummary,
  } from '../../controllers/Payroll/payrollController.js';

  const router = Router();

  // ── 1. Static GET routes (must come before dynamic :params) ───────────────────

  // GET /api/payroll
  //   ?month=April+2026 &status=Pending &search= &dept= &page=1 &limit=100
  //
  // Returns all active employees with their computed payroll for the month,
  // including advance deductions and additions pulled from advance_payment_deductions.
  router.get('/', verifyToken, getPayrollData);

  // GET /api/payroll/stats
  //   Returns aggregated payroll stats per month (last 12 months).
  router.get('/stats', verifyToken, getPayrollStats);

  // GET /api/payroll/advance-summary?month=April+2026
  //   Returns the full advance effect breakdown for a month — useful for HR
  //   to preview what deductions/additions will appear in payroll.
  router.get('/advance-summary', verifyToken, getAdvanceSummary);

  // ── 2. Static POST routes ─────────────────────────────────────────────────────

  // POST /api/payroll/record
  //   Body: { employee_id, for_month, basic?, hra?, other_allowances?,
  //           medical_allowance?, performance_pay?,
  //           pf_deduction?, pt?, tds?, other_deduction?,
  //           p_days?, month_days?, notes? }
  //
  //   Upserts (creates or updates) a payroll record for the employee+month.
  //   Automatically re-fetches advance effects for that month and updates
  //   advance_deduction and advance_addition columns.
  //   Returns the saved record with all server-computed values (gross_earned,
  //   net_salary, etc.) so the frontend can update its state without re-fetching.
  router.post('/record', verifyToken, upsertPayrollRecord);

  // POST /api/payroll/init-month
  //   Body: { for_month }
  //
  //   Idempotent — creates payroll_records for ALL active employees if they
  //   don't already exist, or updates advance columns for records that do exist.
  //   Call this once at the start of each payroll cycle.
  router.post('/init-month', verifyToken, initMonth);

  // POST /api/payroll/pay-bulk
  //   Body: { record_ids: [uuid, ...], for_month }
  //
  //   Marks multiple records as Paid in one call.
  //   Also marks related advance_payment_deductions rows as 'done'.
  router.post('/pay-bulk', verifyToken, markPaidBulk);

  // ── 3. Dynamic param routes (MUST come AFTER all static paths) ────────────────

  // GET /api/payroll/:employeeId?month=April+2026
  //   Returns detailed payroll + advance breakdown for a single employee.
  //   employeeId can be the integer DB id OR the business id (e.g. "EMP012").
  router.get('/:employeeId', verifyToken, getEmployeePayroll);

  // POST /api/payroll/:id/pay
  //   Marks one payroll record as Paid.
  //   Also marks all advance_payment_deductions for that employee+month as 'done'
  //   and sets payroll_advance_effects.status = 'done'.
  router.post('/:id/pay', verifyToken, markPaid);

  export default router;