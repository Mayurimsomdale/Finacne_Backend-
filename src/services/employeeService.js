  // src/services/employeeService.js
  // ============================================================
  // All Employee API calls — matches the PostgreSQL schema exactly.
  // Works with Vite (import.meta.env.VITE_API_URL)
  // ============================================================

  const BASE_URL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    'http://localhost:5000/api';

  // ── Auth token ──────────────────────────────────────────────
  function getAuthToken() {
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    } catch {
      return '';
    }
  }

  // ── Central fetch wrapper ───────────────────────────────────
  // Throws a rich Error object on non-2xx responses.
  // Sets err.expired / err.used for link-validation flows.
  async function apiFetch(endpoint, options = {}) {
    const token      = getAuthToken();
    const isFormData = options.body instanceof FormData;

    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token      ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server error (${response.status}): unexpected response format`);
      }

      const data = await response.json();

      if (!response.ok) {
        const err     = new Error(data.message || `Request failed (${response.status})`);
        err.status    = response.status;
        err.expired   = data.expired || false;
        err.used      = data.used    || false;
        err.response  = { data };  // Add response data for better error handling
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Please check your connection.');
      }
      throw err;
    }
  }

  // ── Build FormData for manual employee add (wizard) ─────────
  // documents = { photo, aadharCard, panCard, bankPassbook }
  //   each = { file: File, preview: string, name: string } | null
  function buildEmployeeFormData(employeeData) {
    const fd = new FormData();

    const scalarFields = [
      'firstName', 'middleName', 'lastName',
      'email', 'phone', 'altPhone',
      'aadhar', 'dob', 'gender',
      'address', 'city', 'state', 'zipCode',
      'employeeId', 'joiningDate', 'department',
      'designation', 'employmentType', 'circle',
      'projectName', 'reportingManager',
      'basicSalary', 'hra', 'otherAllowances',
      'bankName', 'accountNumber', 'ifscCode', 'branch',
      'totalSalary', 'status',
    ];

    scalarFields.forEach(field => {
      const value = employeeData[field];
      if (value !== undefined && value !== null) fd.append(field, String(value));
    });

    const docs = employeeData.documents || {};
    if (docs.photo?.file)        fd.append('photo',        docs.photo.file,        docs.photo.name);
    if (docs.aadharCard?.file)   fd.append('aadharCard',   docs.aadharCard.file,   docs.aadharCard.name);
    if (docs.panCard?.file)      fd.append('panCard',      docs.panCard.file,      docs.panCard.name);
    if (docs.bankPassbook?.file) fd.append('bankPassbook', docs.bankPassbook.file, docs.bankPassbook.name);

    return fd;
  }

  // ============================================================
  // Employee Service
  // ============================================================
  const employeeService = {

    // ════════════════════════════════════════════════════════════════════════════
    // EMPLOYEES (active / inactive — NOT pending)
    // ════════════════════════════════════════════════════════════════════════════

    /** 
     * GET /employees  
     * Returns active + inactive employees (NOT pending submissions)
     * Returns { success, data: [...] }
     */
    getAllEmployees: () => {
      console.log('📡 Fetching all employees...');
      return apiFetch('/employees');
    },

    /** 
     * GET /employees/:id 
     * Get single employee by ID
     */
    getEmployee: (id) => {
      console.log(`📡 Fetching employee ${id}...`);
      return apiFetch(`/employees/${id}`);
    },

    /**
     * POST /employees
     * Manual add by admin — multipart/form-data with documents.
     * employeeData = { ...formData, documents: { photo, aadharCard, panCard, bankPassbook } }
     */
    addEmployee: (employeeData) => {
      console.log('📡 Adding new employee...');
      const fd = buildEmployeeFormData(employeeData);
      return apiFetch('/employees', { method: 'POST', body: fd });
    },

    /**
     * PUT /employees/:id
     * Update employee information
     */
    updateEmployee: (id, employeeData) => {
      console.log(`📡 Updating employee ${id}...`);
      return apiFetch(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(employeeData),
      });
    },

    /**
     * PATCH /employees/:id/status
     * status: 'active' | 'inactive' | 'pending' | 'rejected'
     */
    updateStatus: (id, status, rejection_reason = '') => {
      console.log(`📡 Updating employee ${id} status to ${status}...`);
      return apiFetch(`/employees/${id}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status, rejection_reason }),
      });
    },

    /** 
     * DELETE /employees/:id  
     * Soft-delete (sets status = 'inactive') 
     */
    deleteEmployee: (id) => {
      console.log(`📡 Deleting employee ${id}...`);
      return apiFetch(`/employees/${id}`, { method: 'DELETE' });
    },

    // ════════════════════════════════════════════════════════════════════════════
    // REGISTRATION LINKS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * POST /registration-links
     * Generates a UUID one-time registration link (no email required).
     * Returns { success, data: { linkId, expiresAt, registrationUrl } }
     */
    generateRegistrationLink: (data = {}) => {
      console.log('📡 Generating registration link...');
      return apiFetch('/registration-links', { 
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    /**
     * GET /registration-links/:linkId/validate
     * Validates if a registration link is still valid (not used, not expired)
     * Returns { success, valid, data: { linkId } }
     * Throws with err.expired or err.used on 410 responses.
     */
    validateLink: (linkId) => {
      console.log(`📡 Validating registration link ${linkId}...`);
      return apiFetch(`/registration-links/${linkId}/validate`);
    },

    /**
     * GET /registration-links
     * Fetches all recent registration links (for admin dashboard)
     * Returns { success, data: [ { id, link_id, status, created_at, expires_at, is_used, used_at, ... } ] }
     */
    getRecentRegistrationLinks: () => {
      console.log('📡 Fetching recent registration links...');
      return apiFetch('/registration-links');
    },

    // ════════════════════════════════════════════════════════════════════════════
    // SELF-REGISTRATION (public — employee fills the form)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * POST /registrations
     * Employee submits the 4-step registration form.
     * Creates a record in `employees` with status = 'pending'.
     * Inserts documents into `employee_documents`.
     * Marks the link as used in `registration_links`.
     *
     * @param {object} registrationData  — all form scalar fields
     * @param {object} documents         — { aadharCard: File, idPhoto: File, bankPassbook: File, panCard: File|null }
     * @returns {Promise} { success, data: { id }, message }
     */
    submitRegistration: (registrationData, documents) => {
      console.log('📡 Submitting registration form...');
      const fd = new FormData();

      // Append all scalar fields
      Object.entries(registrationData).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });

      // Append document files (raw File objects from the form)
      if (documents) {
        Object.entries(documents).forEach(([k, file]) => {
          if (file) {
            console.log(`  📎 Attaching document: ${k}`);
            fd.append(k, file, file.name);
          }
        });
      }

      return apiFetch('/registrations', { method: 'POST', body: fd });
    },

    // ════════════════════════════════════════════════════════════════════════════
    // ADMIN — PENDING APPROVAL FLOW
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * GET /registrations/pending
     * Returns all employees with status = 'pending', each with their documents.
     * 
     * IMPORTANT: Backend returns documents with camelCase field names:
     * - aadharCard_url
     * - idPhoto_url
     * - bankPassbook_url
     * - panCard_url
     * 
     * Returns { 
     *   success: true, 
     *   data: [
     *     {
     *       id, first_name, last_name, email, phone, ...,
     *       status: 'pending',
     *       aadharCard_url: '/uploads/...',
     *       idPhoto_url: '/uploads/...',
     *       bankPassbook_url: '/uploads/...',
     *       panCard_url: '/uploads/...',
     *       documents: [...]
     *     }
     *   ]
     * }
     */
    getPendingSubmissions: async () => {
      console.log('📡 Fetching pending submissions...');
      try {
        const response = await apiFetch('/registrations/pending');
        console.log(`📊 Found ${response.data?.length || 0} pending submissions`);
        return response;
      } catch (error) {
        console.error('❌ Error fetching pending submissions:', error);
        throw error;
      }
    },

    /**
     * POST /registrations/:id/approve
     * Approves the pending employee:
     *   - Sets status = 'active'
     *   - Assigns auto-generated employee_id (EMP001, EMP002, …)
     *   - Sets approved_by / approved_at
     * 
     * After approval, employee appears in main employee list (GET /employees)
     * 
     * Returns { 
     *   success: true, 
     *   message: 'Employee approved and added to the system with ID EMP001',
     *   data: { employeeId: 'EMP001' } 
     * }
     */
    approveSubmission: async (submissionId) => {
      console.log(`✅ Approving submission ${submissionId}...`);
      try {
        const response = await apiFetch(`/registrations/${submissionId}/approve`, { 
          method: 'POST' 
        });
        console.log(`✅ Approved successfully: ${response.data?.employeeId}`);
        return response;
      } catch (error) {
        console.error(`❌ Error approving submission ${submissionId}:`, error);
        throw error;
      }
    },

    /**
     * POST /registrations/:id/reject
     * Rejects the pending employee:
     *   - Deletes the employee record from database
     *   - Deletes all associated documents (cascade)
     *   - Removes uploaded files from disk
     * 
     * Employee will NEVER appear in the system after rejection.
     * 
     * Returns { 
     *   success: true, 
     *   message: 'Registration rejected. The application has been removed from the system.' 
     * }
     *
     * @param {number|string} submissionId - The employee.id to reject
     * @param {string}        reason       - Optional rejection reason
     */
    rejectSubmission: async (submissionId, reason = '') => {
      console.log(`❌ Rejecting submission ${submissionId}...`);
      try {
        const response = await apiFetch(`/registrations/${submissionId}/reject`, {
          method: 'POST',
          body:   JSON.stringify({ rejection_reason: reason }),
        });
        console.log(`❌ Rejected successfully`);
        return response;
      } catch (error) {
        console.error(`❌ Error rejecting submission ${submissionId}:`, error);
        throw error;
      }
    },

    // ════════════════════════════════════════════════════════════════════════════
    // UTILITY / STATS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Get count of pending submissions (for badge display)
     * This is a convenience method that fetches pending submissions and returns count
     */
    getPendingCount: async () => {
      try {
        const response = await apiFetch('/registrations/pending');
        return response.data?.length || 0;
      } catch (error) {
        console.error('❌ Error fetching pending count:', error);
        return 0;
      }
    },

  };

  export default employeeService;