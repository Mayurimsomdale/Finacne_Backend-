// =============================================================================
// FILE: controllers/Payroll/payrollController.js
//
// CHANGES IN THIS VERSION:
//   1. employerPfFromBasic: 12% → 13%  (total PF is now 25% of basic)
//   2. medical_allowance removed from all salary computations
//   3. gratuity added at 4.81% of basic — auto-calculated, storable override
//   4. grossFull = basic + hra + other_allowances  (no medical)
//   5. gratuity is included in total_deduction (deducted from net salary)
//   6. All upsert/init queries updated for the new column set
//   ✅ FIX: uan_number added to getPayrollData SELECT + mapped to uanNo in response
//   ✅ FIX: uanNo added to getEmployeePayroll employee response object
// =============================================================================
import pool from '../../config/database.js';

function round2(n) { return Math.round((n || 0) * 100) / 100; }

function paginationMeta(total, page, limit) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

function getAdminName(req) {
  return (
    req.admin?.full_name ||
    req.admin?.fullName  ||
    req.admin?.name      ||
    req.admin?.username  ||
    'Admin'
  );
}

function ptFromGenderAndGross(forMonth, gender, grossFull) {
  const isFemale = /female|woman|f/i.test(gender || '');
  if (isFemale && (Number(grossFull) || 0) <= 25000) return 0;
  return /february/i.test(forMonth || '') ? 300 : 200;
}

function pfFromBasic(basic) {
  return Math.round((Number(basic) || 0) * 0.12);
}

// CHANGED: 12% → 13%
function employerPfFromBasic(basic) {
  return Math.round((Number(basic) || 0) * 0.13);
}

// NEW: gratuity at 4.81% of basic
function gratuityFromBasic(basic) {
  return Math.round((Number(basic) || 0) * 0.0481 * 100) / 100;
}

function getDaysInMonth(forMonth) {
  if (!forMonth) return 30;
  const MONTHS = {
    january: 1, february: 2, march: 3,     april: 4,
    may: 5,     june: 6,     july: 7,       august: 8,
    september: 9, october: 10, november: 11, december: 12,
  };
  const parts    = forMonth.trim().toLowerCase().split(/\s+/);
  const monthNum = MONTHS[parts[0]];
  const year     = parseInt(parts[1], 10);
  if (!monthNum || isNaN(year)) return 30;
  return new Date(year, monthNum, 0).getDate();
}

function resolveOverride(savedValue, autoCalcValue) {
  return (savedValue != null && savedValue !== '')
    ? Number(savedValue)
    : autoCalcValue;
}

// =============================================================================
// computeNet
//   REMOVED: medical_allowance
//   ADDED:   gratuity (4.81% of basic, deducted from net)
//   CHANGED: employer PF is now 13%, so total PF = 12% + 13% = 25%
//   grossFull = basic + hra + other_allowances
// =============================================================================
function computeNet({
  basic, hra, other_allowances,
  pf_deduction, pt, tds, other_deduction,
  performance_pay,
  advance_deduction, advance_addition,
  p_days, month_days,
  for_month,
  gender,
  pf_override,
  pt_override,
  employer_pf_override,
  employer_pf_deduction,
  gratuity_override,
  gratuity: gratuityInput,
}) {
  const totalDays   = Number(month_days) || 30;
  const presentDays = p_days != null ? Number(p_days) : totalDays;
  const ratio       = totalDays > 0 ? presentDays / totalDays : 1;

  const basicAmt     = Number(basic)             || 0;
  const hraAmt       = Number(hra)               || 0;
  const orgAllowAmt  = Number(other_allowances)  || 0;
  const perfPayAmt   = Number(performance_pay)   || 0;
  const tdsAmt       = Number(tds)               || 0;
  const otherDedAmt  = Number(other_deduction)   || 0;
  const advDedAmt    = Number(advance_deduction) || 0;
  const advAddAmt    = Number(advance_addition)  || 0;

  // CHANGED: no medical_allowance in grossFull
  const grossFull   = basicAmt + hraAmt + orgAllowAmt;
  const grossEarned = grossFull * ratio;
  const perfEarned  = perfPayAmt * ratio;

  const empPfAmt = (pf_override && pf_deduction != null && pf_deduction !== '')
    ? Number(pf_deduction)
    : pfFromBasic(basicAmt);

  // CHANGED: 13% employer share
  const employerPfAmt = (employer_pf_override && employer_pf_deduction != null && employer_pf_deduction !== '')
    ? Number(employer_pf_deduction)
    : employerPfFromBasic(basicAmt);

  const totalPfAmt = empPfAmt + employerPfAmt;

  const ptAmt = (pt_override && pt != null && pt !== '')
    ? Number(pt)
    : ptFromGenderAndGross(for_month, gender, grossFull);

  // NEW: gratuity
  const gratuityAmt = (gratuity_override && gratuityInput != null && gratuityInput !== '')
    ? Number(gratuityInput)
    : gratuityFromBasic(basicAmt);

  // gratuity included in standard deductions
  const stdDeduction   = empPfAmt + employerPfAmt + ptAmt + tdsAmt + otherDedAmt + gratuityAmt;
  const totalDeduction = stdDeduction + advDedAmt;

  const netSalary    = grossEarned - totalDeduction + advAddAmt;
  const totalEarning = netSalary + perfEarned;

  return {
    gross_full:               round2(grossFull),
    gross_earned:             round2(grossEarned),
    perf_earned:              round2(perfEarned),
    pf_deduction:             round2(empPfAmt),
    employer_pf_contribution: round2(employerPfAmt),
    total_pf_deduction:       round2(totalPfAmt),
    pt:                       round2(ptAmt),
    tds:                      round2(tdsAmt),
    other_deduction:          round2(otherDedAmt),
    gratuity:                 round2(gratuityAmt),
    advance_deduction:        round2(advDedAmt),
    advance_addition:         round2(advAddAmt),
    total_deduction:          round2(totalDeduction),
    net_salary:               round2(netSalary),
    total_earning:            round2(totalEarning),
  };
}

// =============================================================================
// buildAdvanceEffects
// =============================================================================
async function buildAdvanceEffects(client, empDbId, empBizId, forMonth) {
  const { rows: requests } = await client.query(
    `SELECT
      apr.id, apr.request_code, apr.payment_type_key,
      apr.employee_db_id, apr.emp_id,
      apr.to_employee_db_id, apr.to_emp_id,
      apr.reason, apr.amount,
      apd.id         AS deduction_id,
      apd.amount     AS emi_amount,
      apd.status     AS deduction_status
    FROM advance_payment_requests apr
    JOIN advance_payment_deductions apd
      ON apd.request_id = apr.id
      AND apd.month_label = $1
      AND apd.status IN ('upcoming', 'done')
    WHERE apr.status = 'approved'
      AND (
        apr.employee_db_id      = $2 OR apr.emp_id      = $3
        OR apr.to_employee_db_id = $2 OR apr.to_emp_id   = $3
      )`,
    [forMonth, empDbId, empBizId]
  );

  const effects = [];

  for (const r of requests) {
    const emiAmt        = Number(r.emi_amount);
    const key           = r.payment_type_key;
    const isBeneficiary = r.employee_db_id    === empDbId || r.emp_id    === empBizId;
    const isRecipient   = r.to_employee_db_id === empDbId || r.to_emp_id === empBizId;

    if (key === 'org_to_emp') {
      if (isBeneficiary)
        effects.push({ effect_type: 'deduction', amount: emiAmt, deduction_status: r.deduction_status, ...meta(r) });
    } else if (key === 'emp_to_emp') {
      if (isBeneficiary && !isRecipient)
        effects.push({ effect_type: 'addition',  amount: emiAmt, deduction_status: r.deduction_status, ...meta(r) });
      else if (isRecipient && !isBeneficiary)
        effects.push({ effect_type: 'deduction', amount: emiAmt, deduction_status: r.deduction_status, ...meta(r) });
      else if (isBeneficiary && isRecipient)
        effects.push({ effect_type: 'deduction', amount: emiAmt, deduction_status: r.deduction_status, ...meta(r) });
    } else if (key === 'other') {
      if (isBeneficiary)
        effects.push({ effect_type: 'addition',  amount: emiAmt, deduction_status: r.deduction_status, ...meta(r) });
    }
  }

  const totalDeduction = effects
    .filter(e => e.effect_type === 'deduction' && e.deduction_status === 'upcoming')
    .reduce((s, e) => s + e.amount, 0);
  const totalAddition = effects
    .filter(e => e.effect_type === 'addition' && e.deduction_status === 'upcoming')
    .reduce((s, e) => s + e.amount, 0);

  return {
    totalDeduction: round2(totalDeduction),
    totalAddition:  round2(totalAddition),
    effects,
  };
}

function meta(r) {
  return {
    request_id:       r.id,
    deduction_id:     r.deduction_id,
    request_code:     r.request_code,
    payment_type_key: r.payment_type_key,
    reason:           r.reason,
  };
}


// ==============================================================================
// GET /api/payroll
// ==============================================================================
export async function getPayrollData(req, res) {
  try {
    const {
      month,
      status,
      search,
      dept,
      page  = 1,
      limit = 100,
    } = req.query;

    const forMonth = month ||
      new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const correctMonthDays = getDaysInMonth(forMonth);

    const conditions = [
      `e.status NOT IN ('pending','pending_rejoin','inactive','Inactive','Blacklist','Blacklisted')`
    ];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      conditions.push(
        `(e.first_name ILIKE $${i} OR e.last_name ILIKE $${i} OR e.employee_id ILIKE $${i})`
      );
    }
    if (dept && dept !== 'All') {
      params.push(dept);
      conditions.push(`e.department = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    // ✅ FIX: Added e.uan_number to SELECT so it flows through to the payslip
    const { rows: employees } = await pool.query(
      `SELECT
        e.id, e.employee_id,
        e.first_name, e.last_name,
        e.gender,
        e.department, e.position AS designation,
        e.employment_type, e.joining_date, e.circle,
        e.bank_name, e.account_number, e.ifsc_code, e.bank_branch,
        e.aadhar_number, e.pan_number,
        e.uan_number,
        COALESCE(e.basic_salary,     0)::numeric AS basic_default,
        COALESCE(e.hra,              0)::numeric AS hra_default,
        COALESCE(e.other_allowances, 0)::numeric AS other_allowances_default
      FROM employees e
      WHERE ${where}
      ORDER BY e.first_name, e.last_name`,
      params
    );

    if (!employees.length) {
      return res.json({
        success: true,
        data: {
          employees: [],
          summary: { totalEmployees: 0, pending: 0, paid: 0, totalPayroll: 0 },
        },
        forMonth,
        pagination: paginationMeta(0, page, limit),
      });
    }

    const empDbIds = employees.map(e => e.id);

    const { rows: prRows } = await pool.query(
      `SELECT * FROM payroll_records
       WHERE for_month = $1 AND employee_id = ANY($2::int[])`,
      [forMonth, empDbIds]
    );
    const prMap = {};
    prRows.forEach(r => { prMap[r.employee_id] = r; });

    const { rows: advRows } = await pool.query(
      `SELECT
        apr.id             AS request_id,
        apr.request_code,
        apr.payment_type_key,
        apr.employee_db_id AS payer_db_id,
        apr.emp_id         AS payer_biz_id,
        apr.to_employee_db_id AS recipient_db_id,
        apr.to_emp_id      AS recipient_biz_id,
        apr.reason,
        apd.id             AS deduction_id,
        apd.amount         AS emi_amount,
        apd.status         AS deduction_status
      FROM advance_payment_requests apr
      JOIN advance_payment_deductions apd
        ON apd.request_id = apr.id
        AND apd.month_label = $1
        AND apd.status IN ('upcoming', 'done')
      WHERE apr.status = 'approved'
        AND (
          apr.employee_db_id    = ANY($2::int[]) OR
          apr.to_employee_db_id = ANY($2::int[])
        )`,
      [forMonth, empDbIds]
    );

    const advDeductMap   = {};
    const advAdditionMap = {};
    const advCountMap    = {};

    for (const r of advRows) {
      const emi           = Number(r.emi_amount);
      const key           = r.payment_type_key;
      const payerDbId     = r.payer_db_id;
      const recipientDbId = r.recipient_db_id;
      const isLive = r.deduction_status === 'upcoming';

      if (key === 'org_to_emp') {
        if (payerDbId) {
          if (isLive) advDeductMap[payerDbId] = (advDeductMap[payerDbId] || 0) + emi;
          advCountMap[payerDbId] = (advCountMap[payerDbId] || 0) + 1;
        }
      } else if (key === 'emp_to_emp') {
        if (payerDbId && payerDbId !== recipientDbId) {
          if (isLive) advAdditionMap[payerDbId] = (advAdditionMap[payerDbId] || 0) + emi;
          advCountMap[payerDbId] = (advCountMap[payerDbId] || 0) + 1;
        }
        if (recipientDbId && payerDbId !== recipientDbId) {
          if (isLive) advDeductMap[recipientDbId] = (advDeductMap[recipientDbId] || 0) + emi;
          advCountMap[recipientDbId] = (advCountMap[recipientDbId] || 0) + 1;
        }
        if (payerDbId && payerDbId === recipientDbId) {
          if (isLive) advDeductMap[payerDbId] = (advDeductMap[payerDbId] || 0) + emi;
          advCountMap[payerDbId] = (advCountMap[payerDbId] || 0) + 1;
        }
      } else if (key === 'other') {
        if (payerDbId) {
          if (isLive) advAdditionMap[payerDbId] = (advAdditionMap[payerDbId] || 0) + emi;
          advCountMap[payerDbId] = (advCountMap[payerDbId] || 0) + 1;
        }
      }
    }

    const offset         = (parseInt(page) - 1) * parseInt(limit);
    const pagedEmployees = employees.slice(offset, offset + parseInt(limit));

    const rows = pagedEmployees.map(emp => {
      const pr = prMap[emp.id] || {};
      const isPaid = pr.status === 'Paid';

      const advDeduction = isPaid
        ? round2(Number(pr.advance_deduction) || 0)
        : round2(advDeductMap[emp.id]   || 0);
      const advAddition  = isPaid
        ? round2(Number(pr.advance_addition)  || 0)
        : round2(advAdditionMap[emp.id] || 0);
      const advCount     = advCountMap[emp.id] || 0;

      const basicRaw    = Number(pr.basic             ?? emp.basic_default             ?? 0);
      const hraRaw      = Number(pr.hra               ?? emp.hra_default               ?? 0);
      const orgAllowRaw = Number(pr.other_allowances  ?? emp.other_allowances_default  ?? 0);
      const perfRaw     = Number(pr.performance_pay   ?? 0);
      const tdsRaw      = Number(pr.tds               ?? 0);
      const otherDedRaw = Number(pr.other_deduction   ?? 0);
      const pDaysRaw    = pr.p_days != null ? Number(pr.p_days) : null;

      const monthDaysRaw = Number(pr.month_days) > 0
        ? Number(pr.month_days)
        : correctMonthDays;

      const grossFull = basicRaw + hraRaw + orgAllowRaw;

      const pfRaw = pr.id && pr.pf_deduction != null
        ? Number(pr.pf_deduction)
        : pfFromBasic(basicRaw);

      const employerPfRaw = pr.id && pr.employer_pf_contribution != null
        ? Number(pr.employer_pf_contribution)
        : employerPfFromBasic(basicRaw);

      const totalPfRaw = pfRaw + employerPfRaw;

      const ptRaw = pr.id && pr.pt != null
        ? Number(pr.pt)
        : ptFromGenderAndGross(forMonth, emp.gender, grossFull);

      const gratuityRaw = pr.id && pr.gratuity != null
        ? Number(pr.gratuity)
        : gratuityFromBasic(basicRaw);

      const payData = {
        basic:                basicRaw,
        hra:                  hraRaw,
        other_allowances:     orgAllowRaw,
        performance_pay:      perfRaw,
        pf_deduction:         pfRaw,
        employer_pf_deduction: employerPfRaw,
        pt:                   ptRaw,
        tds:                  tdsRaw,
        other_deduction:      otherDedRaw,
        gratuity:             gratuityRaw,
        gratuity_override:    pr.id && pr.gratuity != null,
        advance_deduction:    advDeduction,
        advance_addition:     advAddition,
        p_days:               pDaysRaw,
        month_days:           monthDaysRaw,
        for_month:            forMonth,
        gender:               emp.gender,
        pf_override:          true,
        pt_override:          true,
        employer_pf_override: true,
      };

      const computed = isPaid && pr.net_salary != null ? {
        gross_full:               round2(Number(pr.gross_full)      || 0),
        gross_earned:             round2(Number(pr.gross_earned)    || 0),
        perf_earned:              round2(Number(pr.performance_pay) || 0),
        pf_deduction:             pfRaw,
        employer_pf_contribution: employerPfRaw,
        total_pf_deduction:       totalPfRaw,
        pt:                       ptRaw,
        tds:                      tdsRaw,
        other_deduction:          otherDedRaw,
        gratuity:                 gratuityRaw,
        advance_deduction:        advDeduction,
        advance_addition:         advAddition,
        total_deduction:          round2(Number(pr.total_deduction) || 0),
        net_salary:               round2(Number(pr.net_salary)      || 0),
        total_earning:            round2(Number(pr.total_earning)   || 0),
      } : computeNet(payData);

      return {
        id:              emp.id,
        payrollRecordId: pr.id ?? null,
        employeeId:      emp.employee_id,
        name:            `${emp.first_name} ${emp.last_name}`,
        gender:          emp.gender,
        department:      emp.department,
        designation:     emp.designation,
        employmentType:  emp.employment_type,
        joiningDate:     emp.joining_date,
        currentLocation: emp.circle || '',
        bankName:        emp.bank_name,
        accountNumber:   emp.account_number,
        ifscCode:        emp.ifsc_code,
        // ✅ FIX: all three identity fields now mapped (uan_number was missing)
        aadharNo:        emp.aadhar_number  || '',
        panNo:           emp.pan_number     || '',
        uanNo:           emp.uan_number     || '',
        forMonth,

        basic:                 payData.basic,
        hra:                   payData.hra,
        organisationAllowance: payData.other_allowances,
        performancePay:        payData.performance_pay,

        pfDeduction:              computed.pf_deduction,
        employerPfContribution:   employerPfRaw,
        totalPfContribution:      totalPfRaw,
        totalPfDeduction:         totalPfRaw,

        pt:             computed.pt,
        tds:            payData.tds,
        otherDeduction: payData.other_deduction,
        gratuity:       computed.gratuity,

        advanceDeduction:    advDeduction,
        advanceAddition:     advAddition,
        advancePendingCount: advCount,

        pDays:     pDaysRaw ?? monthDaysRaw,
        aDays:     monthDaysRaw - (pDaysRaw ?? monthDaysRaw),
        monthDays: monthDaysRaw,

        grossSalary:    computed.gross_full,
        grossEarned:    computed.gross_earned,
        totalDeduction: computed.total_deduction,
        netSalary:      computed.net_salary,
        totalEarning:   computed.total_earning,
        perfEarned:     computed.perf_earned,

        status:  pr.status       ?? 'Pending',
        paidAt:  pr.paid_at      ?? null,
        paidBy:  pr.paid_by_name ?? null,
        notes:   pr.notes        ?? null,
      };
    });

    const filtered = status
      ? rows.filter(r => r.status.toLowerCase() === status.toLowerCase())
      : rows;

    const summary = {
      totalEmployees:         employees.length,
      pending:                rows.filter(r => r.status === 'Pending').length,
      paid:                   rows.filter(r => r.status === 'Paid').length,
      totalPayroll:           round2(rows.reduce((s, r) => s + r.netSalary, 0)),
      totalAdvanceDeductions: round2(rows.reduce((s, r) => s + r.advanceDeduction, 0)),
      totalAdvanceAdditions:  round2(rows.reduce((s, r) => s + r.advanceAddition,  0)),
      totalPfDeductions:      round2(rows.reduce((s, r) => s + r.totalPfContribution, 0)),
      totalGratuity:          round2(rows.reduce((s, r) => s + (r.gratuity || 0), 0)),
    };

    res.json({
      success: true,
      data:    { employees: filtered, summary },
      forMonth,
      pagination: paginationMeta(employees.length, parseInt(page), parseInt(limit)),
    });

  } catch (err) {
    console.error('getPayrollData:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payroll data',
      error:   err.message,
    });
  }
}


// ==============================================================================
// GET /api/payroll/:employeeId
// ==============================================================================
export async function getEmployeePayroll(req, res) {
  try {
    const { employeeId } = req.params;
    const forMonth = req.query.month ||
      new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const correctMonthDays = getDaysInMonth(forMonth);

    // ✅ SELECT e.* already includes uan_number — no change needed here
    const { rows: empRows } = await pool.query(
      `SELECT e.*, e.position AS designation FROM employees e
       WHERE e.id::text = $1 OR e.employee_id = $1`,
      [employeeId]
    );
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const emp = empRows[0];

    const { rows: prRows } = await pool.query(
      `SELECT * FROM payroll_records WHERE employee_id = $1 AND for_month = $2`,
      [emp.id, forMonth]
    );
    const pr = prRows[0] || {};
    const isPaid = pr.status === 'Paid';

    const { rows: advDetails } = await pool.query(
      `SELECT
        apr.id AS request_id,
        apr.request_code,
        apr.payment_type_key,
        apt.label AS payment_type_label,
        apr.emp_id, apr.emp_name,
        apr.to_emp_id, apr.to_emp_name,
        apr.reason,
        apr.amount AS total_advance_amount,
        apd.id     AS deduction_id,
        apd.amount AS emi_amount,
        apd.status AS emi_status,
        apd.month_label,
        apd.note
      FROM advance_payment_requests apr
      JOIN advance_payment_deductions apd
        ON apd.request_id = apr.id
        AND apd.month_label = $1
        AND apd.status IN ('upcoming', 'done')
      JOIN advance_payment_types apt
        ON apt.key = apr.payment_type_key
      WHERE apr.status = 'approved'
        AND (
          apr.employee_db_id    = $2 OR apr.emp_id    = $3
          OR apr.to_employee_db_id = $2 OR apr.to_emp_id = $3
        )
      ORDER BY apr.created_at DESC`,
      [forMonth, emp.id, emp.employee_id]
    );

    let totalDeduction = 0;
    let totalAddition  = 0;

    const effectsWithType = advDetails.map(d => {
      const key           = d.payment_type_key;
      const emi           = Number(d.emi_amount);
      const isBeneficiary = d.emp_id    === emp.employee_id;
      const isRecipient   = d.to_emp_id === emp.employee_id;
      let effectType = null;

      if      (key === 'org_to_emp' && isBeneficiary)                effectType = 'deduction';
      else if (key === 'emp_to_emp' && isBeneficiary && !isRecipient) effectType = 'addition';
      else if (key === 'emp_to_emp' && isRecipient && !isBeneficiary) effectType = 'deduction';
      else if (key === 'emp_to_emp' && isBeneficiary && isRecipient)  effectType = 'deduction';
      else if (key === 'other'      && isBeneficiary)                effectType = 'addition';

      if (d.emi_status === 'upcoming') {
        if (effectType === 'deduction') totalDeduction += emi;
        if (effectType === 'addition')  totalAddition  += emi;
      }
      return { ...d, effect_type: effectType };
    });

    const basicRaw  = Number(pr.basic ?? (emp.basic_salary || 0));
    const hraRaw    = Number(pr.hra ?? (emp.hra || 0));
    const orgRaw    = Number(pr.other_allowances ?? (emp.other_allowances || 0));
    const grossFull = basicRaw + hraRaw + orgRaw;

    const pfResolved = pr.id && pr.pf_deduction != null
      ? Number(pr.pf_deduction)
      : pfFromBasic(basicRaw);

    const employerPfResolved = pr.id && pr.employer_pf_contribution != null
      ? Number(pr.employer_pf_contribution)
      : employerPfFromBasic(basicRaw);

    const totalPfResolved = pfResolved + employerPfResolved;

    const ptResolved = pr.id && pr.pt != null
      ? Number(pr.pt)
      : ptFromGenderAndGross(forMonth, emp.gender, grossFull);

    const gratuityResolved = pr.id && pr.gratuity != null
      ? Number(pr.gratuity)
      : gratuityFromBasic(basicRaw);

    const monthDaysResolved = Number(pr.month_days) > 0
      ? Number(pr.month_days)
      : correctMonthDays;

    const advDeductionResolved = isPaid
      ? round2(Number(pr.advance_deduction) || 0)
      : round2(totalDeduction);
    const advAdditionResolved  = isPaid
      ? round2(Number(pr.advance_addition)  || 0)
      : round2(totalAddition);

    const payData = {
      basic:                basicRaw,
      hra:                  hraRaw,
      other_allowances:     orgRaw,
      performance_pay:      Number(pr.performance_pay ?? 0),
      pf_deduction:         pfResolved,
      employer_pf_deduction: employerPfResolved,
      pt:                   ptResolved,
      tds:                  Number(pr.tds              ?? 0),
      other_deduction:      Number(pr.other_deduction  ?? 0),
      gratuity:             gratuityResolved,
      gratuity_override:    pr.id && pr.gratuity != null,
      advance_deduction:    advDeductionResolved,
      advance_addition:     advAdditionResolved,
      p_days:               pr.p_days != null ? Number(pr.p_days) : null,
      month_days:           monthDaysResolved,
      for_month:            forMonth,
      gender:               emp.gender,
      pf_override:          true,
      pt_override:          true,
      employer_pf_override: true,
    };

    const computed = isPaid && pr.net_salary != null ? {
      gross_full:               round2(Number(pr.gross_full)      || 0),
      gross_earned:             round2(Number(pr.gross_earned)    || 0),
      perf_earned:              round2(Number(pr.performance_pay) || 0),
      pf_deduction:             pfResolved,
      employer_pf_contribution: employerPfResolved,
      total_pf_deduction:       totalPfResolved,
      pt:                       ptResolved,
      tds:                      payData.tds,
      other_deduction:          payData.other_deduction,
      gratuity:                 gratuityResolved,
      advance_deduction:        advDeductionResolved,
      advance_addition:         advAdditionResolved,
      total_deduction:          round2(Number(pr.total_deduction) || 0),
      net_salary:               round2(Number(pr.net_salary)      || 0),
      total_earning:            round2(Number(pr.total_earning)   || 0),
    } : computeNet(payData);

    res.json({
      success: true,
      data: {
        employee: {
          id:            emp.id,
          employeeId:    emp.employee_id,
          name:          `${emp.first_name} ${emp.last_name}`,
          gender:        emp.gender,
          department:    emp.department,
          designation:   emp.designation,
          bankName:      emp.bank_name,
          accountNumber: emp.account_number,
          ifscCode:      emp.ifsc_code,
          joiningDate:   emp.joining_date,
          // ✅ FIX: uanNo was missing from this response object
          aadharNo:      emp.aadhar_number || '',
          panNo:         emp.pan_number    || '',
          uanNo:         emp.uan_number    || '',
        },
        payroll: {
          ...payData,
          ...computed,
          employerPfContribution: employerPfResolved,
          totalPfContribution:    totalPfResolved,
          totalPfDeduction:       totalPfResolved,
          gratuity:               computed.gratuity,
          status:          pr.status   ?? 'Pending',
          payrollRecordId: pr.id       ?? null,
          paidAt:          pr.paid_at  ?? null,
        },
        advanceEffects: effectsWithType,
        advanceSummary: {
          totalDeduction: round2(advDeductionResolved),
          totalAddition:  round2(advAdditionResolved),
          netEffect:      round2(advAdditionResolved - advDeductionResolved),
          count:          advDetails.length,
        },
        forMonth,
      },
    });
  } catch (err) {
    console.error('getEmployeePayroll:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch employee payroll' });
  }
}


// ==============================================================================
// POST /api/payroll/record
// ==============================================================================
export async function upsertPayrollRecord(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      employee_id, for_month,
      basic, hra, other_allowances,
      pf_deduction,
      employer_pf_contribution,
      pt, tds, other_deduction,
      performance_pay,
      gratuity,
      p_days, month_days,
      notes,
    } = req.body;

    if (!employee_id || !for_month) {
      return res.status(400).json({
        success: false,
        message: 'employee_id and for_month are required',
      });
    }

    const { rows: empRows } = await client.query(
      `SELECT id, employee_id, gender, basic_salary, hra, other_allowances
       FROM employees WHERE id::text = $1 OR employee_id = $1`,
      [employee_id]
    );
    if (!empRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const emp = empRows[0];

    const { totalDeduction: advDeduct, totalAddition: advAdd } =
      await buildAdvanceEffects(client, emp.id, emp.employee_id, for_month);

    const basicResolved = Number(basic ?? emp.basic_salary ?? 0);
    const hraResolved   = Number(hra   ?? emp.hra          ?? 0);
    const orgResolved   = Number(other_allowances ?? emp.other_allowances ?? 0);
    const grossFull     = basicResolved + hraResolved + orgResolved;

    const pfResolved = (pf_deduction != null && pf_deduction !== '')
      ? Number(pf_deduction)
      : pfFromBasic(basicResolved);

    const employerPfResolved = (employer_pf_contribution != null && employer_pf_contribution !== '')
      ? Number(employer_pf_contribution)
      : employerPfFromBasic(basicResolved);

    const totalPfResolved = pfResolved + employerPfResolved;

    const ptResolved = (pt != null && pt !== '')
      ? Number(pt)
      : ptFromGenderAndGross(for_month, emp.gender, grossFull);

    const gratuityResolved = (gratuity != null && gratuity !== '')
      ? Number(gratuity)
      : gratuityFromBasic(basicResolved);

    const monthDaysResolved = Number(month_days) > 0
      ? Number(month_days)
      : getDaysInMonth(for_month);

    const payData = {
      basic:                basicResolved,
      hra:                  hraResolved,
      other_allowances:     orgResolved,
      performance_pay:      Number(performance_pay ?? 0),
      pf_deduction:         pfResolved,
      employer_pf_deduction: employerPfResolved,
      pt:                   ptResolved,
      tds:                  Number(tds              ?? 0),
      other_deduction:      Number(other_deduction  ?? 0),
      gratuity:             gratuityResolved,
      gratuity_override:    true,
      advance_deduction:    advDeduct,
      advance_addition:     advAdd,
      p_days:               p_days != null ? Number(p_days) : null,
      month_days:           monthDaysResolved,
      for_month,
      gender:               emp.gender,
      pf_override:          true,
      pt_override:          true,
      employer_pf_override: true,
    };

    const computed  = computeNet(payData);
    const adminName = getAdminName(req);

    const { rows } = await client.query(
      `INSERT INTO payroll_records (
        employee_id, for_month,
        basic, hra, other_allowances, performance_pay,
        pf_deduction, employer_pf_contribution,
        pt, tds, other_deduction,
        gratuity,
        advance_deduction, advance_addition,
        p_days, month_days,
        gross_full, gross_earned, total_deduction, net_salary, total_earning,
        status, created_by_name, notes, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,
        'Pending',$22,$23,NOW()
      )
      ON CONFLICT (employee_id, for_month) DO UPDATE SET
        basic                    = EXCLUDED.basic,
        hra                      = EXCLUDED.hra,
        other_allowances         = EXCLUDED.other_allowances,
        performance_pay          = EXCLUDED.performance_pay,
        pf_deduction             = EXCLUDED.pf_deduction,
        employer_pf_contribution = EXCLUDED.employer_pf_contribution,
        pt                       = EXCLUDED.pt,
        tds                      = EXCLUDED.tds,
        other_deduction          = EXCLUDED.other_deduction,
        gratuity                 = EXCLUDED.gratuity,
        advance_deduction        = EXCLUDED.advance_deduction,
        advance_addition         = EXCLUDED.advance_addition,
        p_days                   = EXCLUDED.p_days,
        month_days               = EXCLUDED.month_days,
        gross_full               = EXCLUDED.gross_full,
        gross_earned             = EXCLUDED.gross_earned,
        total_deduction          = EXCLUDED.total_deduction,
        net_salary               = EXCLUDED.net_salary,
        total_earning            = EXCLUDED.total_earning,
        notes                    = COALESCE(EXCLUDED.notes, payroll_records.notes),
        updated_at               = NOW()
      RETURNING *`,
      [
        emp.id, for_month,
        payData.basic, payData.hra, payData.other_allowances,
        payData.performance_pay,
        payData.pf_deduction,
        employerPfResolved,
        payData.pt, payData.tds, payData.other_deduction,
        gratuityResolved,
        payData.advance_deduction, payData.advance_addition,
        payData.p_days, payData.month_days,
        computed.gross_full, computed.gross_earned,
        computed.total_deduction, computed.net_salary, computed.total_earning,
        adminName, notes || null,
      ]
    );

    const record = rows[0];
    await syncAdvanceEffects(client, record.id, emp.id, emp.employee_id, for_month);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payroll record saved',
      data: {
        ...record,
        computed,
        employer_pf_contribution: employerPfResolved,
        total_pf_deduction:       totalPfResolved,
        total_pf_contribution:    totalPfResolved,
        gratuity:                 gratuityResolved,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('upsertPayrollRecord:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to save payroll record',
      error:   err.message,
    });
  } finally {
    client.release();
  }
}

async function syncAdvanceEffects(client, payrollId, empDbId, empBizId, forMonth) {
  const { effects } = await buildAdvanceEffects(client, empDbId, empBizId, forMonth);

  await client.query(
    `DELETE FROM payroll_advance_effects WHERE payroll_id = $1`,
    [payrollId]
  );

  for (const e of effects) {
    await client.query(
      `INSERT INTO payroll_advance_effects
        (payroll_id, request_id, deduction_id, employee_id, for_month,
         effect_type, amount, payment_type_key, request_code, reason, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'upcoming')`,
      [
        payrollId, e.request_id, e.deduction_id, empDbId, forMonth,
        e.effect_type, e.amount, e.payment_type_key, e.request_code, e.reason,
      ]
    );
  }
}


// ==============================================================================
// POST /api/payroll/:id/pay
// ==============================================================================
export async function markPaid(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id }    = req.params;
    const adminName = getAdminName(req);

    const { rows: fetchRows } = await client.query(
      `SELECT * FROM payroll_records WHERE id = $1`,
      [id]
    );
    if (!fetchRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    const pr = fetchRows[0];

    if (pr.status === 'Paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Salary is already marked as paid' });
    }

    const { rows } = await client.query(
      `UPDATE payroll_records
       SET status = 'Paid', paid_at = NOW(), paid_by_name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [adminName, id]
    );

    await client.query(
      `UPDATE advance_payment_deductions apd
       SET status = 'done', processed_at = NOW()
       FROM advance_payment_requests apr
       WHERE apd.request_id       = apr.id
         AND apd.month_label      = $1
         AND apd.status           = 'upcoming'
         AND apr.status           = 'approved'
         AND (
           apr.employee_db_id     = $2
           OR apr.to_employee_db_id = $2
         )`,
      [pr.for_month, pr.employee_id]
    );

    await client.query(
      `UPDATE payroll_advance_effects
       SET status = 'done', processed_at = NOW()
       WHERE payroll_id = $1 AND status = 'upcoming'`,
      [pr.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Salary marked as paid', data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('markPaid:', err.message);
    res.status(500).json({ success: false, message: 'Failed to mark as paid', error: err.message });
  } finally {
    client.release();
  }
}


// ==============================================================================
// POST /api/payroll/pay-bulk
// ==============================================================================
export async function markPaidBulk(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { record_ids, for_month } = req.body;
    if (!Array.isArray(record_ids) || !record_ids.length) {
      return res.status(400).json({ success: false, message: 'record_ids array is required' });
    }

    const adminName = getAdminName(req);

    const { rows } = await client.query(
      `UPDATE payroll_records
       SET status = 'Paid', paid_at = NOW(), paid_by_name = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND status = 'Pending'
       RETURNING *`,
      [adminName, record_ids]
    );

    if (for_month && rows.length) {
      const empIds         = rows.map(r => r.employee_id);
      const paidPayrollIds = rows.map(r => r.id);

      await client.query(
        `UPDATE advance_payment_deductions apd
         SET status = 'done', processed_at = NOW()
         FROM advance_payment_requests apr
         WHERE apd.request_id        = apr.id
           AND apd.month_label       = $1
           AND apd.status            = 'upcoming'
           AND apr.status            = 'approved'
           AND (
             apr.employee_db_id      = ANY($2::int[])
             OR apr.to_employee_db_id = ANY($2::int[])
           )`,
        [for_month, empIds]
      );

      await client.query(
        `UPDATE payroll_advance_effects
         SET status = 'done', processed_at = NOW()
         WHERE payroll_id = ANY($1::uuid[]) AND status = 'upcoming'`,
        [paidPayrollIds]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `${rows.length} salaries marked as paid`,
      data:    rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('markPaidBulk:', err.message);
    res.status(500).json({ success: false, message: 'Bulk pay failed', error: err.message });
  } finally {
    client.release();
  }
}


// ==============================================================================
// POST /api/payroll/init-month
// ==============================================================================
export async function initMonth(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { for_month } = req.body;
    if (!for_month) {
      return res.status(400).json({ success: false, message: 'for_month is required' });
    }

    const adminName        = getAdminName(req);
    const correctMonthDays = getDaysInMonth(for_month);

    const { rows: empRows } = await client.query(
      `SELECT id, employee_id, gender, basic_salary, hra, other_allowances
       FROM employees
       WHERE status NOT IN ('pending','pending_rejoin','inactive','Inactive','Blacklist','Blacklisted')`
    );

    let created = 0;
    let updated = 0;

    for (const emp of empRows) {
      const { rows: existing } = await client.query(
        `SELECT id, pf_deduction, employer_pf_contribution, pt, month_days, gratuity
         FROM payroll_records WHERE employee_id = $1 AND for_month = $2`,
        [emp.id, for_month]
      );

      const { totalDeduction: advDeduct, totalAddition: advAdd } =
        await buildAdvanceEffects(client, emp.id, emp.employee_id, for_month);

      const basicResolved = Number(emp.basic_salary || 0);
      const hraResolved   = Number(emp.hra          || 0);
      const orgResolved   = Number(emp.other_allowances || 0);
      const grossFull     = basicResolved + hraResolved + orgResolved;

      const pfResolved = (existing.length && existing[0].pf_deduction != null)
        ? Number(existing[0].pf_deduction)
        : pfFromBasic(basicResolved);

      const employerPfResolved = (existing.length && existing[0].employer_pf_contribution != null)
        ? Number(existing[0].employer_pf_contribution)
        : employerPfFromBasic(basicResolved);

      const ptResolved = (existing.length && existing[0].pt != null)
        ? Number(existing[0].pt)
        : ptFromGenderAndGross(for_month, emp.gender, grossFull);

      const gratuityResolved = (existing.length && existing[0].gratuity != null)
        ? Number(existing[0].gratuity)
        : gratuityFromBasic(basicResolved);

      const monthDaysResolved = (existing.length && Number(existing[0].month_days) > 0)
        ? Number(existing[0].month_days)
        : correctMonthDays;

      const payData = {
        basic:                basicResolved,
        hra:                  hraResolved,
        other_allowances:     orgResolved,
        performance_pay:      0,
        pf_deduction:         pfResolved,
        employer_pf_deduction: employerPfResolved,
        pt:                   ptResolved,
        tds:                  0,
        other_deduction:      0,
        gratuity:             gratuityResolved,
        gratuity_override:    true,
        advance_deduction:    advDeduct,
        advance_addition:     advAdd,
        p_days:               null,
        month_days:           monthDaysResolved,
        for_month,
        gender:               emp.gender,
        pf_override:          true,
        pt_override:          true,
        employer_pf_override: true,
      };
      const computed = computeNet(payData);

      if (existing.length) {
        await client.query(
          `UPDATE payroll_records SET
            advance_deduction        = $1,
            advance_addition         = $2,
            gross_full               = $3,
            gross_earned             = $4,
            total_deduction          = $5,
            net_salary               = $6,
            total_earning            = $7,
            updated_at               = NOW()
           WHERE employee_id = $8 AND for_month = $9`,
          [
            advDeduct, advAdd,
            computed.gross_full, computed.gross_earned,
            computed.total_deduction, computed.net_salary, computed.total_earning,
            emp.id, for_month,
          ]
        );
        await syncAdvanceEffects(client, existing[0].id, emp.id, emp.employee_id, for_month);
        updated++;
      } else {
        const { rows: inserted } = await client.query(
          `INSERT INTO payroll_records (
            employee_id, for_month,
            basic, hra, other_allowances,
            pf_deduction, employer_pf_contribution, pt,
            gratuity,
            advance_deduction, advance_addition,
            month_days,
            gross_full, gross_earned, total_deduction, net_salary, total_earning,
            status, created_by_name
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,
            'Pending',$18
          ) RETURNING id`,
          [
            emp.id, for_month,
            payData.basic, payData.hra, payData.other_allowances,
            payData.pf_deduction,
            employerPfResolved,
            payData.pt,
            gratuityResolved,
            advDeduct, advAdd,
            monthDaysResolved,
            computed.gross_full, computed.gross_earned,
            computed.total_deduction, computed.net_salary, computed.total_earning,
            adminName,
          ]
        );
        await syncAdvanceEffects(client, inserted[0].id, emp.id, emp.employee_id, for_month);
        created++;
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Month initialized — ${created} created, ${updated} advance totals updated`,
      created,
      updated,
      forMonth: for_month,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('initMonth:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize month',
      error:   err.message,
    });
  } finally {
    client.release();
  }
}


// ==============================================================================
// GET /api/payroll/stats
// ==============================================================================
export async function getPayrollStats(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        for_month,
        COUNT(*)                                               AS total_employees,
        COUNT(*) FILTER (WHERE status = 'Paid')               AS paid,
        COUNT(*) FILTER (WHERE status = 'Pending')            AS pending,
        COALESCE(SUM(net_salary) FILTER (WHERE status='Paid'), 0)    AS total_paid_amount,
        COALESCE(SUM(advance_deduction), 0)                   AS total_advance_deductions,
        COALESCE(SUM(advance_addition),  0)                   AS total_advance_additions,
        COALESCE(SUM(gratuity), 0)                            AS total_gratuity
      FROM payroll_records
      GROUP BY for_month
      ORDER BY MIN(created_at) DESC
      LIMIT 12
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getPayrollStats:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
}


// ==============================================================================
// GET /api/payroll/advance-summary
// ==============================================================================
export async function getAdvanceSummary(req, res) {
  try {
    const forMonth = req.query.month ||
      new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const { rows } = await pool.query(
      `SELECT
        apr.id             AS request_id,
        apr.request_code,
        apr.payment_type_key,
        apt.label          AS payment_type_label,
        apt.color          AS payment_type_color,
        apr.emp_id,        apr.emp_name,   apr.emp_dept,
        apr.employee_db_id,
        apr.to_emp_id,     apr.to_emp_name, apr.to_emp_dept,
        apr.to_employee_db_id,
        apr.amount         AS total_advance_amount,
        apr.reason,
        apr.adjusted_in,
        apd.id             AS deduction_id,
        apd.amount         AS emi_amount,
        apd.status         AS emi_status,
        apd.month_label,
        apd.note,
        CASE apr.payment_type_key
          WHEN 'org_to_emp' THEN
            'Deducted from ' || apr.emp_name || '''s salary'
          WHEN 'emp_to_emp' THEN
            'Added to ' || apr.emp_name ||
            ', Deducted from ' || COALESCE(apr.to_emp_name, 'recipient') || '''s salary'
          WHEN 'other' THEN
            'Added to ' || apr.emp_name || '''s salary (vendor reimbursement)'
          ELSE 'Salary adjustment'
        END AS effect_description
      FROM advance_payment_requests   apr
      JOIN advance_payment_deductions apd ON apd.request_id = apr.id AND apd.month_label = $1
      JOIN advance_payment_types      apt ON apt.key = apr.payment_type_key
      WHERE apr.status = 'approved'
      ORDER BY apt.key, apr.emp_name`,
      [forMonth]
    );

    let totalDeductions = 0;
    let totalAdditions  = 0;

    const enriched = rows.map(r => {
      const emi = Number(r.emi_amount);
      let effectForPayer     = null;
      let effectForRecipient = null;

      if (r.payment_type_key === 'org_to_emp') {
        effectForPayer = 'deduction';
        if (r.emi_status === 'upcoming') totalDeductions += emi;
      } else if (r.payment_type_key === 'emp_to_emp') {
        effectForPayer     = 'addition';
        effectForRecipient = 'deduction';
        if (r.emi_status === 'upcoming') {
          totalAdditions  += emi;
          totalDeductions += emi;
        }
      } else if (r.payment_type_key === 'other') {
        effectForPayer = 'addition';
        if (r.emi_status === 'upcoming') totalAdditions += emi;
      }

      return { ...r, effect_for_payer: effectForPayer, effect_for_recipient: effectForRecipient };
    });

    res.json({
      success: true,
      data:    enriched,
      summary: {
        totalDeductions: round2(totalDeductions),
        totalAdditions:  round2(totalAdditions),
        count:           rows.length,
      },
      forMonth,
    });
  } catch (err) {
    console.error('getAdvanceSummary:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch advance summary' });
  }
}