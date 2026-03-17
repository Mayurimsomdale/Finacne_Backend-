// src/context/PendingCountContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Global context that stores the pending-approval count.
//
// • Sidebar consumes usePendingCount() to render the badge — no prop-drilling.
// • DashboardEmp calls refreshPendingCount() after every approve/reject so the
//   badge snaps to the new value immediately.
// • Polls every 60 s so the badge updates even without user interaction.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import employeeService from '../services/employeeService';

// ── Context shape ─────────────────────────────────────────────────────────────
const PendingCountContext = createContext({
  pendingCount: 0,
  refreshPendingCount: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export const PendingCountProvider = ({ children }) => {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      // employeeService.getPendingCount() always resolves to { success, count }
      // (with an internal fallback — see employeeService.js)
      const res = await employeeService.getPendingCount();
      if (res.success) setPendingCount(res.count ?? 0);
    } catch {
      // Non-critical — badge stays at its previous value on network error
    }
  }, []);

  useEffect(() => {
    // Only start fetching if the user is actually logged in
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) return;

    refreshPendingCount();                                   // immediate fetch
    const id = setInterval(refreshPendingCount, 60_000);    // then every 60 s
    return () => clearInterval(id);
  }, [refreshPendingCount]);

  return (
    <PendingCountContext.Provider value={{ pendingCount, refreshPendingCount }}>
      {children}
    </PendingCountContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const usePendingCount = () => useContext(PendingCountContext);

export default PendingCountContext;