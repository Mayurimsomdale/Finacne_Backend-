// =============================================================================
// FILE: controllers/Reports/reportsController.js
//
// Column reference (from PayrollTable.jsx → computePayslip + handleEditSave):
//
//   payroll_records columns used here:
//     basic                    → basicPay
//     hra                      → hra
//     other_allowances         → orgAllowance       ("Org Allowance" in UI)
//     performance_pay          → performancePay
//     pf_deduction             → pfDeduction        (employee share 12%)
//     employer_pf_contribution → employerPf         (employer share 13%)
//     pt                       → ptDeduction        (column is "pt", NOT "pt_deduction")
//     tds                      → tdsDeduction       (column is "tds", NOT "tds_deduction")
//     gratuity                 → gratuity           (4.81% of basic)
//     other_deduction          → otherDeduction
//     advance_deduction        → advanceDeduction
//     advance_addition         → advanceAddition
//     gross_full               → totalPayroll       (basic + hra + other_allowances)
//     gross_earned             → grossEarned        (gross_full × p_days/month_days)
//     total_deduction          → totalDeductions    (pf_emp + pf_co + pt + gratuity
//                                                    + tds + other_deduction + advance_deduction)
//     net_salary               → netPayroll
//     total_earning            → totalEarning       (net_salary + perf_pay × ratio)
//
//   advance data source:
//     advance_payment_deductions (apd)  joined to
//     advance_payment_requests   (apr)  — NOT advance_payments table
//
// =============================================================================
import pool from '../../config/database.js';

function round2(n) { return Math.round((n || 0) * 100) / 100; }

// ─── build ['January 2026', 'February 2026', …] for a given year ─────────────
function monthLabelsForYear(year) {
  const names = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  return names.map(m => `${m} ${year}`);
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


// =============================================================================
// GET /api/reports/monthly?year=2026
// =============================================================================
export async function getMonthlyReport(req, res) {
  try {
    const year   = parseInt(req.query.year) || new Date().getFullYear();
    const months = monthLabelsForYear(year);

    // ── Payroll aggregates per month ──────────────────────────────────────────
    const { rows: prRows } = await pool.query(
      `SELECT
         for_month,
         COUNT(*)::int                                                           AS employees_paid,

         -- Earnings
         COALESCE(SUM(basic),             0)::numeric                           AS basic_pay,
         COALESCE(SUM(hra),               0)::numeric                           AS hra,
         COALESCE(SUM(other_allowances),  0)::numeric                           AS org_allowance,
         COALESCE(SUM(performance_pay),   0)::numeric                           AS performance_pay,
         COALESCE(SUM(gross_full),        0)::numeric                           AS total_payroll,
         COALESCE(SUM(gross_earned),      0)::numeric                           AS gross_earned,
         COALESCE(SUM(total_earning),     0)::numeric                           AS total_earning,

         -- Individual deductions (exact column names from the DB / PayrollTable)
         COALESCE(SUM(pf_deduction),                          0)::numeric       AS pf_deduction,
         COALESCE(SUM(COALESCE(employer_pf_contribution, 0)), 0)::numeric       AS employer_pf,
         -- combined PF: employee 12% + employer 13% = 25%
         COALESCE(SUM(pf_deduction)
           + SUM(COALESCE(employer_pf_contribution, 0)),       0)::numeric      AS total_pf,
         COALESCE(SUM(pt),                                    0)::numeric       AS pt_deduction,
         COALESCE(SUM(COALESCE(gratuity, 0)),                 0)::numeric       AS gratuity,
         COALESCE(SUM(tds),                                   0)::numeric       AS tds_deduction,
         COALESCE(SUM(other_deduction),                       0)::numeric       AS other_deduction,
         COALESCE(SUM(advance_deduction),                     0)::numeric       AS advance_deduction,
         COALESCE(SUM(advance_addition),                      0)::numeric       AS advance_addition,

         -- total_deduction is the server-persisted sum (pf_emp+pf_co+pt+gratuity+tds+other+adv_ded)
         COALESCE(SUM(total_deduction),                       0)::numeric       AS total_deductions,
         COALESCE(SUM(net_salary),                            0)::numeric       AS net_payroll

       FROM payroll_records
       WHERE status = 'Paid'
         AND for_month = ANY($1::text[])
       GROUP BY for_month`,
      [months]
    );

    // ── Advance aggregates per month ──────────────────────────────────────────
    const { rows: advRows } = await pool.query(
      `SELECT
         apd.month_label,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status IN ('upcoming','done')), 0)::numeric  AS advance_issued,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'done'),               0)::numeric  AS advance_recovered,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'upcoming'),           0)::numeric  AS advance_pending,
         COUNT(DISTINCT apr.id)::int                                                              AS advance_count
       FROM advance_payment_deductions apd
       JOIN advance_payment_requests apr
         ON apr.id = apd.request_id AND apr.status = 'approved'
       WHERE apd.month_label = ANY($1::text[])
       GROUP BY apd.month_label`,
      [months]
    );

    const prMap  = Object.fromEntries(prRows.map(r  => [r.for_month,   r]));
    const advMap = Object.fromEntries(advRows.map(r => [r.month_label, r]));

    const data = months.map((label, i) => {
      const pr  = prMap[label]  || {};
      const adv = advMap[label] || {};
      return {
        // Axis / meta
        month:             MONTH_SHORT[i],
        monthLabel:        label,
        index:             i,

        // Earnings
        totalPayroll:      round2(+pr.total_payroll    || 0),
        basicPay:          round2(+pr.basic_pay        || 0),
        hra:               round2(+pr.hra              || 0),
        orgAllowance:      round2(+pr.org_allowance    || 0),
        performancePay:    round2(+pr.performance_pay  || 0),
        grossEarned:       round2(+pr.gross_earned     || 0),
        totalEarning:      round2(+pr.total_earning    || 0),

        // Deductions — every field the frontend column-maps (ReportsPage PAYROLL_COLS) reference
        pfDeduction:       round2(+pr.pf_deduction     || 0),   // employee share 12%
        employerPf:        round2(+pr.employer_pf      || 0),   // employer share 13%
        totalPf:           round2(+pr.total_pf         || 0),   // combined 25%
        ptDeduction:       round2(+pr.pt_deduction     || 0),
        gratuity:          round2(+pr.gratuity         || 0),
        tdsDeduction:      round2(+pr.tds_deduction    || 0),
        otherDeduction:    round2(+pr.other_deduction  || 0),
        advanceDeduction:  round2(+pr.advance_deduction|| 0),
        advanceAddition:   round2(+pr.advance_addition || 0),
        totalDeductions:   round2(+pr.total_deductions || 0),   // server-persisted total

        // Net
        netPayroll:        round2(+pr.net_payroll      || 0),
        employeesPaid:     parseInt(pr.employees_paid)  || 0,

        // Advance (from advance_payment_deductions)
        advanceIssued:     round2(+adv.advance_issued    || 0),
        advanceRecovered:  round2(+adv.advance_recovered || 0),
        advancePending:    round2(+adv.advance_pending   || 0),
        advanceCount:      parseInt(adv.advance_count)   || 0,
      };
    });

    res.json({ success: true, data, year });
  } catch (err) {
    console.error('getMonthlyReport:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}


// =============================================================================
// GET /api/reports/quarterly?year=2026
// =============================================================================
export async function getQuarterlyReport(req, res) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const quarters = [
      { label: 'Q1 (Jan-Mar)', shortLabel: 'Q1', months: [`January ${year}`,`February ${year}`,`March ${year}`] },
      { label: 'Q2 (Apr-Jun)', shortLabel: 'Q2', months: [`April ${year}`,`May ${year}`,`June ${year}`] },
      { label: 'Q3 (Jul-Sep)', shortLabel: 'Q3', months: [`July ${year}`,`August ${year}`,`September ${year}`] },
      { label: 'Q4 (Oct-Dec)', shortLabel: 'Q4', months: [`October ${year}`,`November ${year}`,`December ${year}`] },
    ];
    const allMonths = quarters.flatMap(q => q.months);

    // ── Payroll ───────────────────────────────────────────────────────────────
    const { rows: prRows } = await pool.query(
      `SELECT
         for_month,
         COALESCE(SUM(gross_full),                            0)::numeric  AS total_payroll,
         COALESCE(SUM(net_salary),                            0)::numeric  AS net_payroll,
         COALESCE(SUM(total_deduction),                       0)::numeric  AS total_deductions,
         COALESCE(SUM(performance_pay),                       0)::numeric  AS performance_pay,
         COUNT(*)::int                                                      AS employees_paid,
         COALESCE(SUM(pf_deduction),                          0)::numeric  AS pf_deduction,
         COALESCE(SUM(COALESCE(employer_pf_contribution, 0)), 0)::numeric  AS employer_pf,
         COALESCE(SUM(pt),                                    0)::numeric  AS pt_deduction,
         COALESCE(SUM(COALESCE(gratuity, 0)),                 0)::numeric  AS gratuity,
         COALESCE(SUM(tds),                                   0)::numeric  AS tds_deduction,
         COALESCE(SUM(other_deduction),                       0)::numeric  AS other_deduction,
         COALESCE(SUM(advance_deduction),                     0)::numeric  AS advance_deduction,
         COALESCE(SUM(advance_addition),                      0)::numeric  AS advance_addition
       FROM payroll_records
       WHERE status = 'Paid' AND for_month = ANY($1::text[])
       GROUP BY for_month`,
      [allMonths]
    );

    // ── Advance ───────────────────────────────────────────────────────────────
    const { rows: advRows } = await pool.query(
      `SELECT
         apd.month_label,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status IN ('upcoming','done')), 0)::numeric  AS issued,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'done'),               0)::numeric  AS recovered,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'upcoming'),           0)::numeric  AS pending
       FROM advance_payment_deductions apd
       JOIN advance_payment_requests apr ON apr.id = apd.request_id AND apr.status = 'approved'
       WHERE apd.month_label = ANY($1::text[])
       GROUP BY apd.month_label`,
      [allMonths]
    );

    const prMap  = Object.fromEntries(prRows.map(r  => [r.for_month,   r]));
    const advMap = Object.fromEntries(advRows.map(r => [r.month_label, r]));

    const data = quarters.map(q => {
      let tp=0, np=0, td=0, pp=0, ep=0,
          pf=0, epf=0, pt=0, grat=0, tds=0, od=0, ad=0, aa=0,
          ai=0, ar=0, ap=0;

      q.months.forEach(m => {
        const pr  = prMap[m]  || {};
        const adv = advMap[m] || {};
        tp   += +pr.total_payroll    || 0;
        np   += +pr.net_payroll      || 0;
        td   += +pr.total_deductions || 0;
        pp   += +pr.performance_pay  || 0;
        ep   += parseInt(pr.employees_paid) || 0;
        pf   += +pr.pf_deduction     || 0;
        epf  += +pr.employer_pf      || 0;
        pt   += +pr.pt_deduction     || 0;
        grat += +pr.gratuity         || 0;
        tds  += +pr.tds_deduction    || 0;
        od   += +pr.other_deduction  || 0;
        ad   += +pr.advance_deduction|| 0;
        aa   += +pr.advance_addition || 0;
        ai   += +adv.issued    || 0;
        ar   += +adv.recovered || 0;
        ap   += +adv.pending   || 0;
      });

      return {
        quarter:          q.label,
        shortLabel:       q.shortLabel,
        totalPayroll:     round2(tp),
        netPayroll:       round2(np),
        totalDeductions:  round2(td),
        performancePay:   round2(pp),
        employeesPaid:    ep,
        // Full deduction breakdown
        pfDeduction:      round2(pf),
        employerPf:       round2(epf),
        totalPf:          round2(pf + epf),
        ptDeduction:      round2(pt),
        gratuity:         round2(grat),
        tdsDeduction:     round2(tds),
        otherDeduction:   round2(od),
        advanceDeduction: round2(ad),
        advanceAddition:  round2(aa),
        // Advance
        advanceIssued:    round2(ai),
        advanceRecovered: round2(ar),
        advancePending:   round2(ap),
      };
    });

    res.json({ success: true, data, year });
  } catch (err) {
    console.error('getQuarterlyReport:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}


// =============================================================================
// GET /api/reports/yearly?startYear=2021
// =============================================================================
export async function getYearlyReport(req, res) {
  try {
    const startYear = parseInt(req.query.startYear) || 2021;
    const endYear   = new Date().getFullYear();

    // SUBSTRING extracts the trailing 4-digit year from 'April 2026' format
    const { rows: prRows } = await pool.query(
      `SELECT
         SUBSTRING(for_month FROM '\\d{4}$')                              AS year,
         COALESCE(SUM(gross_full),                            0)::numeric  AS total_payroll,
         COALESCE(SUM(net_salary),                            0)::numeric  AS net_payroll,
         COALESCE(SUM(total_deduction),                       0)::numeric  AS total_deductions,
         COALESCE(SUM(performance_pay),                       0)::numeric  AS performance_pay,
         COUNT(DISTINCT employee_id)::int                                   AS avg_employees,
         COALESCE(SUM(pf_deduction),                          0)::numeric  AS pf_deduction,
         COALESCE(SUM(COALESCE(employer_pf_contribution, 0)), 0)::numeric  AS employer_pf,
         COALESCE(SUM(pt),                                    0)::numeric  AS pt_deduction,
         COALESCE(SUM(COALESCE(gratuity, 0)),                 0)::numeric  AS gratuity,
         COALESCE(SUM(tds),                                   0)::numeric  AS tds_deduction,
         COALESCE(SUM(other_deduction),                       0)::numeric  AS other_deduction,
         COALESCE(SUM(advance_deduction),                     0)::numeric  AS advance_deduction,
         COALESCE(SUM(advance_addition),                      0)::numeric  AS advance_addition
       FROM payroll_records
       WHERE status = 'Paid'
         AND CAST(SUBSTRING(for_month FROM '\\d{4}$') AS INT) BETWEEN $1 AND $2
       GROUP BY SUBSTRING(for_month FROM '\\d{4}$')`,
      [startYear, endYear]
    );

    const { rows: advRows } = await pool.query(
      `SELECT
         SUBSTRING(apd.month_label FROM '\\d{4}$')                        AS year,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status IN ('upcoming','done')), 0)::numeric  AS issued,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'done'),               0)::numeric  AS recovered,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'upcoming'),           0)::numeric  AS pending
       FROM advance_payment_deductions apd
       JOIN advance_payment_requests apr ON apr.id = apd.request_id AND apr.status = 'approved'
       WHERE CAST(SUBSTRING(apd.month_label FROM '\\d{4}$') AS INT) BETWEEN $1 AND $2
       GROUP BY SUBSTRING(apd.month_label FROM '\\d{4}$')`,
      [startYear, endYear]
    );

    const prMap  = Object.fromEntries(prRows.map(r  => [r.year, r]));
    const advMap = Object.fromEntries(advRows.map(r => [r.year, r]));

    const data = [];
    for (let y = startYear; y <= endYear; y++) {
      const yr  = String(y);
      const pr  = prMap[yr]  || {};
      const adv = advMap[yr] || {};
      const pf  = +pr.pf_deduction || 0;
      const epf = +pr.employer_pf  || 0;
      data.push({
        year:             yr,
        totalPayroll:     round2(+pr.total_payroll    || 0),
        netPayroll:       round2(+pr.net_payroll      || 0),
        totalDeductions:  round2(+pr.total_deductions || 0),
        performancePay:   round2(+pr.performance_pay  || 0),
        avgEmployees:     parseInt(pr.avg_employees)   || 0,
        // Full deduction breakdown
        pfDeduction:      round2(pf),
        employerPf:       round2(epf),
        totalPf:          round2(pf + epf),
        ptDeduction:      round2(+pr.pt_deduction    || 0),
        gratuity:         round2(+pr.gratuity        || 0),
        tdsDeduction:     round2(+pr.tds_deduction   || 0),
        otherDeduction:   round2(+pr.other_deduction || 0),
        advanceDeduction: round2(+pr.advance_deduction || 0),
        advanceAddition:  round2(+pr.advance_addition  || 0),
        // Advance
        advanceIssued:    round2(+adv.issued    || 0),
        advanceRecovered: round2(+adv.recovered || 0),
        advancePending:   round2(+adv.pending   || 0),
      });
    }

    res.json({ success: true, data, startYear, endYear });
  } catch (err) {
    console.error('getYearlyReport:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}


// =============================================================================
// GET /api/reports/department?year=2026
// =============================================================================
export async function getDepartmentReport(req, res) {
  try {
    const year   = parseInt(req.query.year) || new Date().getFullYear();
    const months = monthLabelsForYear(year);

    const { rows } = await pool.query(
      `SELECT
         e.department                                                        AS dept,
         COUNT(DISTINCT e.id)::int                                           AS headcount,
         COALESCE(SUM(pr.net_salary),                 0)::numeric            AS payroll,
         COALESCE(SUM(pr.advance_deduction),          0)::numeric            AS advances,
         -- pfTotal = employee PF + employer PF (full PF burden per department)
         COALESCE(SUM(pr.pf_deduction)
           + SUM(COALESCE(pr.employer_pf_contribution, 0)), 0)::numeric      AS pf_total
       FROM employees e
       LEFT JOIN payroll_records pr
         ON  pr.employee_id = e.id
         AND pr.status      = 'Paid'
         AND pr.for_month   = ANY($1::text[])
       WHERE e.status NOT IN ('pending','pending_rejoin','inactive','Inactive','Blacklist','Blacklisted')
         AND e.department IS NOT NULL
         AND e.department <> ''
       GROUP BY e.department
       ORDER BY payroll DESC`,
      [months]
    );

    const data = rows.map(r => ({
      dept:      r.dept      || 'Unknown',
      headcount: parseInt(r.headcount) || 0,
      payroll:   round2(+r.payroll  || 0),
      advances:  round2(+r.advances || 0),
      pfTotal:   round2(+r.pf_total || 0),
    }));

    res.json({ success: true, data, year });
  } catch (err) {
    console.error('getDepartmentReport:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}


// =============================================================================
// GET /api/reports/summary?year=2026
//
// KPI totals consumed by useReportData → data.totals:
//   payroll, net, deduct, advance, recovered, pending
// Extra breakdown fields are returned for future KPI card expansion.
// =============================================================================
export async function getYearSummary(req, res) {
  try {
    const year   = parseInt(req.query.year) || new Date().getFullYear();
    const months = monthLabelsForYear(year);

    // ── Payroll totals ────────────────────────────────────────────────────────
    const { rows: pr } = await pool.query(
      `SELECT
         COALESCE(SUM(gross_full),        0)::numeric  AS payroll,
         COALESCE(SUM(net_salary),        0)::numeric  AS net,
         -- full deduction = total_deduction (server-persisted, includes gratuity + both PF)
         COALESCE(SUM(total_deduction),   0)::numeric  AS deduct,
         COALESCE(SUM(advance_deduction), 0)::numeric  AS adv_ded,
         COALESCE(SUM(advance_addition),  0)::numeric  AS adv_add,
         -- individual deduction breakdown
         COALESCE(SUM(pf_deduction),                          0)::numeric  AS pf_emp,
         COALESCE(SUM(COALESCE(employer_pf_contribution, 0)), 0)::numeric  AS pf_co,
         COALESCE(SUM(pt),                                    0)::numeric  AS pt_total,
         COALESCE(SUM(COALESCE(gratuity, 0)),                 0)::numeric  AS gratuity_total,
         COALESCE(SUM(tds),                                   0)::numeric  AS tds_total,
         COALESCE(SUM(other_deduction),                       0)::numeric  AS other_ded_total
       FROM payroll_records
       WHERE status = 'Paid' AND for_month = ANY($1::text[])`,
      [months]
    );

    // ── Advance totals ────────────────────────────────────────────────────────
    const { rows: adv } = await pool.query(
      `SELECT
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status IN ('upcoming','done')), 0)::numeric  AS advance,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'done'),               0)::numeric  AS recovered,
         COALESCE(SUM(apd.amount) FILTER (WHERE apd.status = 'upcoming'),           0)::numeric  AS pending
       FROM advance_payment_deductions apd
       JOIN advance_payment_requests apr ON apr.id = apd.request_id AND apr.status = 'approved'
       WHERE apd.month_label = ANY($1::text[])`,
      [months]
    );

    const p = pr[0]  || {};
    const a = adv[0] || {};

    res.json({
      success: true,
      data: {
        // ── Required by useReportData → data.totals ──
        payroll:     round2(+p.payroll   || 0),   // gross_full sum (KPI: "Total Payroll")
        net:         round2(+p.net       || 0),   // net_salary sum (KPI: "Net Payroll")
        deduct:      round2(+p.deduct    || 0),   // total_deduction sum (KPI: "Total Deductions")
        advance:     round2(+a.advance   || 0),   // KPI: "Advance Issued"
        recovered:   round2(+a.recovered || 0),   // KPI: "Advance Recovered"
        pending:     round2(+a.pending   || 0),   // KPI: "Advance Pending"

        // ── Deduction breakdown (available for future KPI expansion) ──
        pfEmployee:  round2(+p.pf_emp         || 0),   // emp share 12%
        pfEmployer:  round2(+p.pf_co          || 0),   // co share 13%
        pfTotal:     round2((+p.pf_emp || 0) + (+p.pf_co || 0)),  // combined 25%
        ptTotal:     round2(+p.pt_total       || 0),
        gratuity:    round2(+p.gratuity_total || 0),
        tdsTotal:    round2(+p.tds_total      || 0),
        otherDed:    round2(+p.other_ded_total|| 0),
        advDed:      round2(+p.adv_ded        || 0),
        advAdd:      round2(+p.adv_add        || 0),
      },
      year,
    });
  } catch (err) {
    console.error('getYearSummary:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}