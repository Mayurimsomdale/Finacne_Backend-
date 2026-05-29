// FILE: setupDatabase.js
// Matches: complete_schema.sql (18 tables, canonical schema)

import pool from './config/database.js';

// ── Helper ───────────────────────────────────────────────────────────────────
async function run(label, sql, client) {
  try {
    await client.query(sql);
    console.log(`   ✔ ${label}`);
  } catch (err) {
    console.error(`   ✘ ${label} FAILED: ${err.message}`);
    throw err;
  }
}

// ── Safety pause ─────────────────────────────────────────────────────────────
async function safetyCheck() {
  console.log('\n' + '='.repeat(60));
  console.log('   DATABASE SETUP SCRIPT');
  console.log('='.repeat(60));
  console.log(`   NODE_ENV  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB_HOST   : ${process.env.DB_HOST  || 'localhost'}`);
  console.log(`   DB_NAME   : ${process.env.DB_NAME  || 'FinanceManagement'}`);
  console.log(`   DB_USER   : ${process.env.DB_USER  || 'postgres'}`);
  console.log('='.repeat(60));
  console.log('   Starting in 3 seconds... Press Ctrl+C to cancel\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

// ============================================================
// MAIN
// ============================================================
async function setupDatabase() {
  await safetyCheck();

  const client = await pool.connect();

  try {
    console.log('▶ Starting database setup...\n');

    const { rows } = await client.query('SELECT current_database() AS db, NOW() AS time');
    console.log(`   Connected to : ${rows[0].db}`);
    console.log(`   Server time  : ${rows[0].time}\n`);

    await client.query('BEGIN');

    // ────────────────────────────────────────────────────────
    // TRIGGER FUNCTION
    // ────────────────────────────────────────────────────────
    console.log('▶ Creating trigger function...');
    await run('update_updated_at_column()', `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `, client);

    // ────────────────────────────────────────────────────────
    // TABLES
    // ────────────────────────────────────────────────────────
    console.log('\n▶ Creating tables...');

    // ── 1. admins ─────────────────────────────────────────────
    // NOTE: Table is "admins" (NOT "admin_users") and the password
    // column is "password" (NOT "password_hash") — matches all
    // Node.js controllers that query: SELECT * FROM admins WHERE ...
    await run('TABLE: admins', `
      CREATE TABLE IF NOT EXISTS admins (
        id            SERIAL        PRIMARY KEY,
        username      VARCHAR(100)  UNIQUE NOT NULL,
        email         VARCHAR(255)  UNIQUE NOT NULL,
        password      VARCHAR(255)  NOT NULL,
        full_name     VARCHAR(255)  NOT NULL,
        role          VARCHAR(50)   DEFAULT 'admin',
        is_active     BOOLEAN       DEFAULT true,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        last_login    TIMESTAMP
      );
    `, client);

    await run('TRIGGER: admins', `
      DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
      CREATE TRIGGER update_admins_updated_at
        BEFORE UPDATE ON admins
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 2. registration_links ─────────────────────────────────
    await run('TABLE: registration_links', `
      CREATE TABLE IF NOT EXISTS registration_links (
        id                   SERIAL        PRIMARY KEY,
        link_id              VARCHAR(255)  UNIQUE NOT NULL,
        employee_email       VARCHAR(255)  NOT NULL DEFAULT '',
        status               VARCHAR(20)   DEFAULT 'active',
        expires_at           TIMESTAMP     NOT NULL,
        is_used              BOOLEAN       DEFAULT false,
        used_at              TIMESTAMP,
        created_by           INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
        is_rejoin            BOOLEAN       DEFAULT false,
        prefill_employee_id  INTEGER,
        multi_use            BOOLEAN       NOT NULL DEFAULT false,
        use_count            INTEGER       NOT NULL DEFAULT 0,
        created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    await run('TRIGGER: registration_links', `
      DROP TRIGGER IF EXISTS update_registration_links_updated_at ON registration_links;
      CREATE TRIGGER update_registration_links_updated_at
        BEFORE UPDATE ON registration_links
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 3. employees ──────────────────────────────────────────
    // email is NOT UNIQUE — same person may re-register with new email
    // aadhar_number IS the unique business identifier
    // status values: pending | pending_rejoin | active | inactive | rejected | blacklisted
    await run('TABLE: employees', `
      CREATE TABLE IF NOT EXISTS employees (
        id                          SERIAL        PRIMARY KEY,
        employee_id                 VARCHAR(50)   UNIQUE,
        registration_link_id        INTEGER       REFERENCES registration_links(id) ON DELETE SET NULL,

        first_name                  VARCHAR(100)  NOT NULL,
        father_husband_name         VARCHAR(100),
        middle_name                 VARCHAR(100),
        last_name                   VARCHAR(100)  NOT NULL,
        email                       VARCHAR(255)  NOT NULL,
        phone                       VARCHAR(20)   NOT NULL,
        alt_phone                   VARCHAR(20),
        date_of_birth               DATE          NOT NULL,
        gender                      VARCHAR(20)   NOT NULL,
        marital_status              VARCHAR(20),
        educational_qualification   VARCHAR(255),
        blood_group                 VARCHAR(10),

        pan_number                  VARCHAR(20),
        name_on_pan                 VARCHAR(255),
        aadhar_number               VARCHAR(20)   UNIQUE,
        name_on_aadhar              VARCHAR(255),
        uan_number                  VARCHAR(12)   DEFAULT NULL,

        family_member_name          VARCHAR(255),
        family_contact_no           VARCHAR(20),
        family_working_status       VARCHAR(50),
        family_employer_name        VARCHAR(255),
        family_employer_contact     VARCHAR(20),

        emergency_contact_name      VARCHAR(255),
        emergency_contact_no        VARCHAR(20),
        emergency_contact_address   TEXT,
        emergency_contact_relation  VARCHAR(50),

        permanent_address           TEXT,
        permanent_phone             VARCHAR(20),
        permanent_landmark          VARCHAR(255),
        permanent_lat_long          VARCHAR(100),

        local_same_as_permanent     BOOLEAN       DEFAULT false,
        local_address               TEXT,
        local_phone                 VARCHAR(20),
        local_landmark              VARCHAR(255),
        local_lat_long              VARCHAR(100),

        ref1_name                   VARCHAR(255),
        ref1_designation            VARCHAR(255),
        ref1_organization           VARCHAR(255),
        ref1_address                TEXT,
        ref1_city_state_pin         VARCHAR(255),
        ref1_contact_no             VARCHAR(20),
        ref1_email                  VARCHAR(255),

        ref2_name                   VARCHAR(255),
        ref2_designation            VARCHAR(255),
        ref2_organization           VARCHAR(255),
        ref2_address                TEXT,
        ref2_city_state_pin         VARCHAR(255),
        ref2_contact_no             VARCHAR(20),
        ref2_email                  VARCHAR(255),

        ref3_name                   VARCHAR(255),
        ref3_designation            VARCHAR(255),
        ref3_organization           VARCHAR(255),
        ref3_address                TEXT,
        ref3_city_state_pin         VARCHAR(255),
        ref3_contact_no             VARCHAR(20),
        ref3_email                  VARCHAR(255),

        address                     TEXT          DEFAULT '',
        city                        VARCHAR(100)  DEFAULT '',
        state                       VARCHAR(100)  DEFAULT '',
        zip_code                    VARCHAR(20)   DEFAULT '',

        department                  VARCHAR(100)  NOT NULL,
        position                    VARCHAR(255)  NOT NULL,
        circle                      VARCHAR(100),
        project_name                VARCHAR(255),
        joining_date                DATE          NOT NULL,
        reporting_manager           VARCHAR(255),
        employment_type             VARCHAR(50)   NOT NULL,

        bank_name                   VARCHAR(255)  NOT NULL,
        account_number              VARCHAR(100)  NOT NULL,
        ifsc_code                   VARCHAR(20)   NOT NULL,
        account_holder_name         VARCHAR(255)  NOT NULL,
        bank_branch                 VARCHAR(255),

        basic_salary                NUMERIC(12,2) DEFAULT 0,
        hra                         NUMERIC(12,2) DEFAULT 0,
        other_allowances            NUMERIC(12,2) DEFAULT 0,

        status                      VARCHAR(50)   DEFAULT 'pending',
        approved_by                 INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
        approved_at                 TIMESTAMP,
        rejection_reason            TEXT,
        rejected_by                 INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
        rejected_at                 TIMESTAMP,

        resubmit_token              VARCHAR(128)  UNIQUE,
        resubmit_expires_at         TIMESTAMP,

        rejoin_requested_at         TIMESTAMP,
        previous_employee_id        VARCHAR(50),
        rejoin_snapshot             JSONB,
        rejoin_invite_sent_at       TIMESTAMP,
        active_rejoin_link_id       VARCHAR(255),

        docs_submitted              BOOLEAN       DEFAULT false,
        docs_submitted_at           TIMESTAMP,
        active_doc_upload_token     VARCHAR(128),

        created_at                  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at                  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    await run('TRIGGER: employees', `
      DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
      CREATE TRIGGER update_employees_updated_at
        BEFORE UPDATE ON employees
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // Wire deferred FK: registration_links → employees
    await run('FK: registration_links.prefill_employee_id → employees', `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_reg_links_prefill_employee'
        ) THEN
          ALTER TABLE registration_links
            ADD CONSTRAINT fk_reg_links_prefill_employee
            FOREIGN KEY (prefill_employee_id)
            REFERENCES employees(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `, client);

    // ── 4. employee_documents ─────────────────────────────────
    await run('TABLE: employee_documents', `
      CREATE TABLE IF NOT EXISTS employee_documents (
        id            SERIAL        PRIMARY KEY,
        employee_id   INTEGER       NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        document_type VARCHAR(50)   NOT NULL,
        file_path     VARCHAR(500)  NOT NULL,
        file_name     VARCHAR(255)  NOT NULL,
        file_size     INTEGER,
        mime_type     VARCHAR(100),
        uploaded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 5. employee_status_history ────────────────────────────
    // ON DELETE RESTRICT — history is NEVER auto-deleted
    await run('TABLE: employee_status_history', `
      CREATE TABLE IF NOT EXISTS employee_status_history (
        id              SERIAL        PRIMARY KEY,
        employee_id     INTEGER       NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        from_status     VARCHAR(50),
        to_status       VARCHAR(50)   NOT NULL,
        changed_by      INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
        changed_by_name VARCHAR(255)  DEFAULT 'System',
        reason          TEXT,
        metadata        JSONB,
        created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 6. employee_doc_upload_tokens ─────────────────────────
    await run('TABLE: employee_doc_upload_tokens', `
      CREATE TABLE IF NOT EXISTS employee_doc_upload_tokens (
        id              SERIAL        PRIMARY KEY,
        token           VARCHAR(128)  UNIQUE NOT NULL,
        employee_id     INTEGER       NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        employee_emp_id VARCHAR(50),
        expires_at      TIMESTAMP     NOT NULL,
        is_used         BOOLEAN       DEFAULT false,
        used_at         TIMESTAMP,
        created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 7. employee_submitted_docs ────────────────────────────
    await run('TABLE: employee_submitted_docs', `
      CREATE TABLE IF NOT EXISTS employee_submitted_docs (
        id               SERIAL        PRIMARY KEY,
        employee_id      INTEGER       NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        upload_token_id  INTEGER       REFERENCES employee_doc_upload_tokens(id) ON DELETE SET NULL,
        document_type    VARCHAR(50)   NOT NULL
          CHECK (document_type IN ('signed_kye','bgv_form','email_screenshot','other')),
        file_path        VARCHAR(500)  NOT NULL,
        file_name        VARCHAR(255)  NOT NULL,
        file_size        INTEGER,
        mime_type        VARCHAR(100),
        notes            TEXT,
        reviewed         BOOLEAN       DEFAULT false,
        reviewed_by      VARCHAR(255),
        reviewed_at      TIMESTAMP,
        rejection_reason TEXT,
        status           VARCHAR(20)   DEFAULT 'pending',
        uploaded_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_esd_status CHECK (status IN ('pending','accepted','rejected'))
      );
    `, client);

    // ── 8. employee_hr_uploaded_docs ──────────────────────────
    await run('TABLE: employee_hr_uploaded_docs', `
      CREATE TABLE IF NOT EXISTS employee_hr_uploaded_docs (
        id            SERIAL        PRIMARY KEY,
        employee_id   INTEGER       NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        document_type VARCHAR(50)   NOT NULL
          CHECK (document_type IN ('bgv_form','email_screenshot','other')),
        file_path     VARCHAR(500)  NOT NULL,
        file_name     VARCHAR(255)  NOT NULL,
        file_size     INTEGER,
        mime_type     VARCHAR(100),
        uploaded_by   VARCHAR(255)  DEFAULT 'HR',
        uploaded_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 9. advance_payment_types ──────────────────────────────
    await run('TABLE: advance_payment_types', `
      CREATE TABLE IF NOT EXISTS advance_payment_types (
        id          SERIAL        PRIMARY KEY,
        key         VARCHAR(50)   UNIQUE NOT NULL,
        label       VARCHAR(100)  NOT NULL,
        short_label VARCHAR(50)   NOT NULL,
        description TEXT,
        color       VARCHAR(20)   DEFAULT '#6366f1',
        is_active   BOOLEAN       DEFAULT true,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    await run('TRIGGER: advance_payment_types', `
      DROP TRIGGER IF EXISTS trg_advance_types_updated_at ON advance_payment_types;
      CREATE TRIGGER trg_advance_types_updated_at
        BEFORE UPDATE ON advance_payment_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 10. advance_payment_requests ──────────────────────────
    await run('TABLE: advance_payment_requests', `
      CREATE TABLE IF NOT EXISTS advance_payment_requests (
        id                   SERIAL        PRIMARY KEY,
        request_code         VARCHAR(30)   UNIQUE NOT NULL,
        payment_type_key     VARCHAR(50)   NOT NULL REFERENCES advance_payment_types(key) ON DELETE RESTRICT,
        emp_id               VARCHAR(50)   NOT NULL,
        emp_name             VARCHAR(255)  NOT NULL,
        emp_dept             VARCHAR(100)  NOT NULL,
        emp_email            VARCHAR(255),
        employee_db_id       INTEGER       REFERENCES employees(id) ON DELETE SET NULL,
        amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        reason               TEXT          NOT NULL,
        to_emp_id            VARCHAR(50),
        to_emp_name          VARCHAR(255),
        to_emp_dept          VARCHAR(100),
        to_employee_db_id    INTEGER       REFERENCES employees(id) ON DELETE SET NULL,
        vendor_name          VARCHAR(255),
        vendor_ref           VARCHAR(100),
        to_vendor_name       VARCHAR(255),
        to_vendor_gst        VARCHAR(50),
        to_vendor_ref        VARCHAR(100),
        approver_name        VARCHAR(255),
        approver_id          VARCHAR(100),
        approver_designation VARCHAR(255),
        status               VARCHAR(20)   DEFAULT 'pending'
          CHECK (status IN ('pending','approved','rejected','cancelled')),
        reviewed_by          INTEGER,
        reviewed_by_name     VARCHAR(255),
        reviewed_at          TIMESTAMP,
        rejection_reason     TEXT,
        adjusted_in          VARCHAR(50),
        submitted_via_link   VARCHAR(255),
        original_request_id  INTEGER       REFERENCES advance_payment_requests(id) ON DELETE SET NULL,
        request_date         DATE          DEFAULT CURRENT_DATE,
        created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // NOTE: reviewed_by, advance_payment_history.changed_by, and
    // advance_payment_links.created_by are plain INTEGER (no FK) —
    // dropping those FKs prevents 500 errors when admin rows are deleted.
    await run('TRIGGER: advance_payment_requests', `
      DROP TRIGGER IF EXISTS trg_advance_requests_updated_at ON advance_payment_requests;
      CREATE TRIGGER trg_advance_requests_updated_at
        BEFORE UPDATE ON advance_payment_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 11. advance_payment_attachments ───────────────────────
    await run('TABLE: advance_payment_attachments', `
      CREATE TABLE IF NOT EXISTS advance_payment_attachments (
        id              SERIAL        PRIMARY KEY,
        request_id      INTEGER       NOT NULL REFERENCES advance_payment_requests(id) ON DELETE CASCADE,
        attachment_role VARCHAR(30)   NOT NULL DEFAULT 'proof'
          CHECK (attachment_role IN ('screenshot','proof','receipt')),
        file_name       VARCHAR(255)  NOT NULL,
        file_path       VARCHAR(500)  NOT NULL,
        file_size       INTEGER,
        mime_type       VARCHAR(100),
        uploaded_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 12. advance_payment_links ─────────────────────────────
    // created_by is plain INTEGER — no FK (intentional, avoids cascade issues)
    await run('TABLE: advance_payment_links', `
      CREATE TABLE IF NOT EXISTS advance_payment_links (
        id               SERIAL        PRIMARY KEY,
        token            VARCHAR(100)  UNIQUE NOT NULL,
        payment_type_key VARCHAR(50)   NOT NULL REFERENCES advance_payment_types(key) ON DELETE RESTRICT,
        employee_email   VARCHAR(255)  DEFAULT '',
        expires_at       TIMESTAMP     NOT NULL,
        is_used          BOOLEAN       DEFAULT false,
        used_at          TIMESTAMP,
        created_by       INTEGER,
        created_by_name  VARCHAR(255),
        multi_use        BOOLEAN       NOT NULL DEFAULT false,
        use_count        INTEGER       NOT NULL DEFAULT 0,
        created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    await run('TRIGGER: advance_payment_links', `
      DROP TRIGGER IF EXISTS trg_advance_links_updated_at ON advance_payment_links;
      CREATE TRIGGER trg_advance_links_updated_at
        BEFORE UPDATE ON advance_payment_links
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 13. advance_payment_history ───────────────────────────
    // ON DELETE RESTRICT — history is never silently wiped
    // changed_by is plain INTEGER — no FK (intentional)
    await run('TABLE: advance_payment_history', `
      CREATE TABLE IF NOT EXISTS advance_payment_history (
        id              SERIAL        PRIMARY KEY,
        request_id      INTEGER       NOT NULL REFERENCES advance_payment_requests(id) ON DELETE RESTRICT,
        from_status     VARCHAR(20),
        to_status       VARCHAR(20)   NOT NULL,
        changed_by      INTEGER,
        changed_by_name VARCHAR(255)  DEFAULT 'System',
        reason          TEXT,
        metadata        JSONB,
        created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 14. advance_payment_deductions ────────────────────────
    await run('TABLE: advance_payment_deductions', `
      CREATE TABLE IF NOT EXISTS advance_payment_deductions (
        id             SERIAL        PRIMARY KEY,
        request_id     INTEGER       NOT NULL REFERENCES advance_payment_requests(id) ON DELETE CASCADE,
        month_label    VARCHAR(30)   NOT NULL,
        deduction_date DATE,
        amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        status         VARCHAR(20)   DEFAULT 'upcoming'
          CHECK (status IN ('upcoming','done','skipped')),
        processed_at   TIMESTAMP,
        note           TEXT,
        created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    await run('TRIGGER: advance_payment_deductions', `
      DROP TRIGGER IF EXISTS trg_advance_deductions_updated_at ON advance_payment_deductions;
      CREATE TRIGGER trg_advance_deductions_updated_at
        BEFORE UPDATE ON advance_payment_deductions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 15. advance_payment_resubmit_tokens ───────────────────
    await run('TABLE: advance_payment_resubmit_tokens', `
      CREATE TABLE IF NOT EXISTS advance_payment_resubmit_tokens (
        id                  SERIAL        PRIMARY KEY,
        token               VARCHAR(128)  UNIQUE NOT NULL,
        original_request_id INTEGER       NOT NULL REFERENCES advance_payment_requests(id) ON DELETE CASCADE,
        employee_email      VARCHAR(255),
        expires_at          TIMESTAMP     NOT NULL,
        is_used             BOOLEAN       DEFAULT false,
        used_at             TIMESTAMP,
        created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 16. payroll_records ───────────────────────────────────
    await run('TABLE: payroll_records', `
      CREATE TABLE IF NOT EXISTS payroll_records (
        id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id              INTEGER       NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        for_month                VARCHAR(30)   NOT NULL,
        basic                    NUMERIC(12,2) DEFAULT 0,
        hra                      NUMERIC(12,2) DEFAULT 0,
        other_allowances         NUMERIC(12,2) DEFAULT 0,
        medical_allowance        NUMERIC(12,2) DEFAULT 0,
        performance_pay          NUMERIC(12,2) DEFAULT 0,
        pf_deduction             NUMERIC(12,2) DEFAULT 0,
        employer_pf_contribution NUMERIC(12,2) DEFAULT 0,
        pt                       NUMERIC(12,2) DEFAULT 0,
        tds                      NUMERIC(12,2) DEFAULT 0,
        other_deduction          NUMERIC(12,2) DEFAULT 0,
        gratuity                 NUMERIC(12,2) DEFAULT 0,
        advance_deduction        NUMERIC(12,2) DEFAULT 0,
        advance_addition         NUMERIC(12,2) DEFAULT 0,
        p_days                   NUMERIC(5,2),
        month_days               INTEGER       DEFAULT 30,
        gross_full               NUMERIC(12,2) DEFAULT 0,
        gross_earned             NUMERIC(12,2) DEFAULT 0,
        total_deduction          NUMERIC(12,2) DEFAULT 0,
        net_salary               NUMERIC(12,2) DEFAULT 0,
        total_earning            NUMERIC(12,2) DEFAULT 0,
        status                   VARCHAR(20)   DEFAULT 'Pending'
          CHECK (status IN ('Pending','Paid','Cancelled')),
        paid_at                  TIMESTAMP,
        paid_by_name             VARCHAR(255),
        created_by_name          VARCHAR(255)  DEFAULT 'System',
        notes                    TEXT,
        created_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at               TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (employee_id, for_month)
      );
    `, client);

    await run('TRIGGER: payroll_records', `
      DROP TRIGGER IF EXISTS trg_payroll_records_updated_at ON payroll_records;
      CREATE TRIGGER trg_payroll_records_updated_at
        BEFORE UPDATE ON payroll_records
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `, client);

    // ── 17. payroll_advance_effects ───────────────────────────
    await run('TABLE: payroll_advance_effects', `
      CREATE TABLE IF NOT EXISTS payroll_advance_effects (
        id               SERIAL        PRIMARY KEY,
        payroll_id       UUID          NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
        request_id       INTEGER       NOT NULL REFERENCES advance_payment_requests(id) ON DELETE RESTRICT,
        deduction_id     INTEGER       REFERENCES advance_payment_deductions(id) ON DELETE SET NULL,
        employee_id      INTEGER       NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        for_month        VARCHAR(30)   NOT NULL,
        effect_type      VARCHAR(20)   NOT NULL CHECK (effect_type IN ('deduction','addition')),
        amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        payment_type_key VARCHAR(50)   NOT NULL,
        request_code     VARCHAR(30)   NOT NULL,
        reason           TEXT,
        status           VARCHAR(20)   DEFAULT 'upcoming'
          CHECK (status IN ('upcoming','done','skipped')),
        processed_at     TIMESTAMP,
        created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ── 18. password_reset_tokens ─────────────────────────────
    // Stores SHA-256 hashes of 6-digit OTPs — raw OTP is NEVER stored.
    // FK references admins(id) — NOT the old "admin_users" name.
    await run('TABLE: password_reset_tokens', `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          SERIAL        PRIMARY KEY,
        admin_id    INTEGER       NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        token_hash  VARCHAR(64)   NOT NULL,
        expires_at  TIMESTAMP     NOT NULL,
        is_used     BOOLEAN       DEFAULT false,
        used_at     TIMESTAMP,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );
    `, client);

    // ────────────────────────────────────────────────────────
    // INDEXES
    // ────────────────────────────────────────────────────────
    console.log('\n▶ Creating indexes...');

    const indexes = [
      // registration_links
      ['idx_registration_links_link_id',  `CREATE INDEX IF NOT EXISTS idx_registration_links_link_id  ON registration_links(link_id)`],
      ['idx_registration_links_email',    `CREATE INDEX IF NOT EXISTS idx_registration_links_email    ON registration_links(employee_email)`],
      ['idx_registration_links_status',   `CREATE INDEX IF NOT EXISTS idx_registration_links_status   ON registration_links(status)`],
      ['idx_reg_links_rejoin',            `CREATE INDEX IF NOT EXISTS idx_reg_links_rejoin ON registration_links(is_rejoin, is_used, expires_at) WHERE is_rejoin = true`],

      // employees
      ['idx_employees_email',             `CREATE INDEX IF NOT EXISTS idx_employees_email       ON employees(email)`],
      ['idx_employees_aadhar',            `CREATE INDEX IF NOT EXISTS idx_employees_aadhar      ON employees(aadhar_number)`],
      ['idx_employees_status',            `CREATE INDEX IF NOT EXISTS idx_employees_status      ON employees(status)`],
      ['idx_employees_department',        `CREATE INDEX IF NOT EXISTS idx_employees_department  ON employees(department)`],
      ['idx_employees_employee_id',       `CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id)`],
      ['idx_employees_uan',               `CREATE INDEX IF NOT EXISTS idx_employees_uan ON employees(uan_number) WHERE uan_number IS NOT NULL`],
      ['idx_employees_resubmit_token',    `CREATE INDEX IF NOT EXISTS idx_employees_resubmit_token ON employees(resubmit_token) WHERE resubmit_token IS NOT NULL`],
      ['idx_employees_pending_queue',     `CREATE INDEX IF NOT EXISTS idx_employees_pending_queue ON employees(status) WHERE status IN ('pending', 'pending_rejoin')`],
      ['idx_employees_active_rejoin_link',`CREATE INDEX IF NOT EXISTS idx_employees_active_rejoin_link ON employees(active_rejoin_link_id) WHERE active_rejoin_link_id IS NOT NULL`],

      // employee_documents
      ['idx_employee_documents_emp_id',   `CREATE INDEX IF NOT EXISTS idx_employee_documents_emp_id ON employee_documents(employee_id)`],

      // employee_status_history
      ['idx_emp_status_history_emp_id',   `CREATE INDEX IF NOT EXISTS idx_emp_status_history_emp_id   ON employee_status_history(employee_id)`],
      ['idx_emp_status_history_created',  `CREATE INDEX IF NOT EXISTS idx_emp_status_history_created  ON employee_status_history(created_at DESC)`],
      ['idx_emp_status_history_to_status',`CREATE INDEX IF NOT EXISTS idx_emp_status_history_to_status ON employee_status_history(to_status)`],

      // employee_doc_upload_tokens
      ['idx_edut_token',                  `CREATE INDEX IF NOT EXISTS idx_edut_token    ON employee_doc_upload_tokens(token)`],
      ['idx_edut_employee',               `CREATE INDEX IF NOT EXISTS idx_edut_employee ON employee_doc_upload_tokens(employee_id)`],
      ['idx_edut_active',                 `CREATE INDEX IF NOT EXISTS idx_edut_active ON employee_doc_upload_tokens(is_used, expires_at) WHERE is_used = false`],

      // employee_submitted_docs
      ['idx_esd_employee_id',             `CREATE INDEX IF NOT EXISTS idx_esd_employee_id   ON employee_submitted_docs(employee_id)`],
      ['idx_esd_document_type',           `CREATE INDEX IF NOT EXISTS idx_esd_document_type ON employee_submitted_docs(document_type)`],
      ['idx_esd_status',                  `CREATE INDEX IF NOT EXISTS idx_esd_status         ON employee_submitted_docs(status)`],
      ['idx_esd_emp_status',              `CREATE INDEX IF NOT EXISTS idx_esd_emp_status     ON employee_submitted_docs(employee_id, status)`],
      ['idx_esd_reviewed',                `CREATE INDEX IF NOT EXISTS idx_esd_reviewed ON employee_submitted_docs(reviewed) WHERE reviewed = false`],

      // employee_hr_uploaded_docs
      ['idx_ehud_employee_id',            `CREATE INDEX IF NOT EXISTS idx_ehud_employee_id   ON employee_hr_uploaded_docs(employee_id)`],
      ['idx_ehud_document_type',          `CREATE INDEX IF NOT EXISTS idx_ehud_document_type ON employee_hr_uploaded_docs(document_type)`],

      // advance_payment_requests
      ['idx_apr_status',                  `CREATE INDEX IF NOT EXISTS idx_apr_status         ON advance_payment_requests(status)`],
      ['idx_apr_emp_id',                  `CREATE INDEX IF NOT EXISTS idx_apr_emp_id         ON advance_payment_requests(emp_id)`],
      ['idx_apr_payment_type',            `CREATE INDEX IF NOT EXISTS idx_apr_payment_type   ON advance_payment_requests(payment_type_key)`],
      ['idx_apr_request_date',            `CREATE INDEX IF NOT EXISTS idx_apr_request_date   ON advance_payment_requests(request_date DESC)`],
      ['idx_apr_employee_db_id',          `CREATE INDEX IF NOT EXISTS idx_apr_employee_db_id ON advance_payment_requests(employee_db_id)`],
      ['idx_apr_pending',                 `CREATE INDEX IF NOT EXISTS idx_apr_pending ON advance_payment_requests(status) WHERE status = 'pending'`],
      ['idx_apr_original_request',        `CREATE INDEX IF NOT EXISTS idx_apr_original_request ON advance_payment_requests(original_request_id) WHERE original_request_id IS NOT NULL`],

      // advance_payment_attachments
      ['idx_apa_request_id',              `CREATE INDEX IF NOT EXISTS idx_apa_request_id ON advance_payment_attachments(request_id)`],
      ['idx_apa_role',                    `CREATE INDEX IF NOT EXISTS idx_apa_role       ON advance_payment_attachments(attachment_role)`],

      // advance_payment_links
      ['idx_apl_token',                   `CREATE INDEX IF NOT EXISTS idx_apl_token  ON advance_payment_links(token)`],
      ['idx_apl_active',                  `CREATE INDEX IF NOT EXISTS idx_apl_active ON advance_payment_links(is_used, expires_at) WHERE is_used = false`],

      // advance_payment_history
      ['idx_aph_request_id',              `CREATE INDEX IF NOT EXISTS idx_aph_request_id ON advance_payment_history(request_id)`],
      ['idx_aph_created',                 `CREATE INDEX IF NOT EXISTS idx_aph_created    ON advance_payment_history(created_at DESC)`],

      // advance_payment_deductions
      ['idx_apd_request_id',              `CREATE INDEX IF NOT EXISTS idx_apd_request_id ON advance_payment_deductions(request_id)`],
      ['idx_apd_status',                  `CREATE INDEX IF NOT EXISTS idx_apd_status     ON advance_payment_deductions(status)`],
      ['idx_apd_upcoming',                `CREATE INDEX IF NOT EXISTS idx_apd_upcoming ON advance_payment_deductions(status) WHERE status = 'upcoming'`],

      // advance_payment_resubmit_tokens
      ['idx_aprt_token',                  `CREATE INDEX IF NOT EXISTS idx_aprt_token            ON advance_payment_resubmit_tokens(token)`],
      ['idx_aprt_original_request',       `CREATE INDEX IF NOT EXISTS idx_aprt_original_request ON advance_payment_resubmit_tokens(original_request_id)`],
      ['idx_aprt_active',                 `CREATE INDEX IF NOT EXISTS idx_aprt_active ON advance_payment_resubmit_tokens(is_used, expires_at) WHERE is_used = false`],

      // payroll_records
      ['idx_pr_employee_id',              `CREATE INDEX IF NOT EXISTS idx_pr_employee_id  ON payroll_records(employee_id)`],
      ['idx_pr_for_month',                `CREATE INDEX IF NOT EXISTS idx_pr_for_month    ON payroll_records(for_month)`],
      ['idx_pr_status',                   `CREATE INDEX IF NOT EXISTS idx_pr_status       ON payroll_records(status)`],
      ['idx_pr_month_status',             `CREATE INDEX IF NOT EXISTS idx_pr_month_status ON payroll_records(for_month, status)`],

      // payroll_advance_effects
      ['idx_pae_payroll_id',              `CREATE INDEX IF NOT EXISTS idx_pae_payroll_id  ON payroll_advance_effects(payroll_id)`],
      ['idx_pae_request_id',              `CREATE INDEX IF NOT EXISTS idx_pae_request_id  ON payroll_advance_effects(request_id)`],
      ['idx_pae_employee_id',             `CREATE INDEX IF NOT EXISTS idx_pae_employee_id ON payroll_advance_effects(employee_id)`],
      ['idx_pae_for_month',               `CREATE INDEX IF NOT EXISTS idx_pae_for_month   ON payroll_advance_effects(for_month)`],
      ['idx_pae_status',                  `CREATE INDEX IF NOT EXISTS idx_pae_status      ON payroll_advance_effects(status)`],

      // password_reset_tokens
      ['idx_prt_admin_id',                `CREATE INDEX IF NOT EXISTS idx_prt_admin_id ON password_reset_tokens(admin_id)`],
      ['idx_prt_active',                  `CREATE INDEX IF NOT EXISTS idx_prt_active ON password_reset_tokens(is_used, expires_at) WHERE is_used = false`],
    ];

    for (const [label, sql] of indexes) {
      await run(`INDEX: ${label}`, sql, client);
    }

    // ────────────────────────────────────────────────────────
    // VIEW
    // ────────────────────────────────────────────────────────
    console.log('\n▶ Creating views...');
    await run('VIEW: employee_doc_review_summary', `
      CREATE OR REPLACE VIEW employee_doc_review_summary AS
      SELECT
        e.id                                                          AS employee_id,
        e.employee_id                                                 AS emp_public_id,
        e.first_name, e.last_name, e.email,
        e.department, e.position,
        e.docs_submitted, e.docs_submitted_at,
        COUNT(d.id)                                                   AS total_docs,
        COUNT(d.id) FILTER (WHERE d.status = 'accepted')              AS accepted_docs,
        COUNT(d.id) FILTER (WHERE d.status = 'rejected')              AS rejected_docs,
        COUNT(d.id) FILTER (WHERE d.status = 'pending')               AS pending_docs,
        BOOL_AND(d.status = 'accepted')                               AS all_accepted,
        MAX(d.reviewed_at)                                            AS last_reviewed_at
      FROM employees e
      LEFT JOIN employee_submitted_docs d ON d.employee_id = e.id
      WHERE e.docs_submitted = true
      GROUP BY
        e.id, e.employee_id, e.first_name, e.last_name,
        e.email, e.department, e.position,
        e.docs_submitted, e.docs_submitted_at;
    `, client);

    // ────────────────────────────────────────────────────────
    // SEED DATA
    // ────────────────────────────────────────────────────────
    console.log('\n▶ Seeding data...');
    await run('SEED: advance_payment_types', `
      INSERT INTO advance_payment_types (key, label, short_label, description, color)
      VALUES
        ('org_to_emp',    'Organization → Employee', 'Org → Emp',    'Company disburses funds directly to an employee',           '#6366f1'),
        ('emp_to_emp',    'Employee → Employee',     'Emp → Emp',    'One employee transfers an advance to another employee',     '#0ea5e9'),
        ('other',         'Other / External',        'External',     'Payment to an external vendor, contractor, or third-party', '#f59e0b'),
        ('org_to_vendor', 'Organization → Vendor',   'Org → Vendor', 'Company pays an advance directly to an external vendor',   '#10b981')
      ON CONFLICT (key) DO NOTHING;
    `, client);

    // ────────────────────────────────────────────────────────
    // BACKFILL — Status History
    // Safe to re-run; WHERE NOT EXISTS guard prevents duplicates
    // ────────────────────────────────────────────────────────
    await run('BACKFILL: employee_status_history', `
      INSERT INTO employee_status_history
        (employee_id, from_status, to_status, changed_by_name, reason, metadata, created_at)
      SELECT
        e.id,
        NULL,
        e.status,
        'System (backfill)',
        'Initial status — employee joined',
        jsonb_build_object('employee_id', e.employee_id, 'department', e.department),
        COALESCE(e.joining_date::timestamp, e.created_at, NOW())
      FROM employees e
      WHERE NOT EXISTS (
        SELECT 1 FROM employee_status_history h WHERE h.employee_id = e.id
      );
    `, client);

    // ────────────────────────────────────────────────────────
    // COMMIT
    // ────────────────────────────────────────────────────────
    await client.query('COMMIT');
    console.log('\n✔ COMMIT — all changes saved.\n');

    // ────────────────────────────────────────────────────────
    // VERIFY
    // ────────────────────────────────────────────────────────
    console.log('▶ Verifying table row counts:\n');
    const tables = [
      'admins',
      'registration_links',
      'employees',
      'employee_documents',
      'employee_status_history',
      'employee_doc_upload_tokens',
      'employee_submitted_docs',
      'employee_hr_uploaded_docs',
      'advance_payment_types',
      'advance_payment_requests',
      'advance_payment_attachments',
      'advance_payment_links',
      'advance_payment_history',
      'advance_payment_deductions',
      'advance_payment_resubmit_tokens',
      'payroll_records',
      'payroll_advance_effects',
      'password_reset_tokens',       // ← table 18, was missing in old script
    ];

    let allGood = true;
    for (const table of tables) {
      try {
        const r = await client.query(`SELECT COUNT(*) AS cnt FROM ${table}`);
        console.log(`   ${table.padEnd(42)} ${r.rows[0].cnt} rows`);
      } catch (err) {
        console.error(`   ✘ ${table.padEnd(42)} MISSING — ${err.message}`);
        allGood = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allGood) {
      console.log('  ✔ Database setup COMPLETE — all 18 tables ready!');
    } else {
      console.log('  ⚠  Setup finished with some errors — check above');
    }
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✘ Setup FAILED — rolled back all changes');
    console.error('  Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();