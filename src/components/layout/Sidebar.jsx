import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
} from "lucide-react";
import employeeService from "../../services/employeeService";

const Sidebar = ({ collapsed, setCollapsed, isMobile, mobileOpen, setMobileOpen }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  const user = {
    name:     localStorage.getItem("fullName") || "Admin User",
    email:    localStorage.getItem("email")    || "admin@company.com",
    initials: (localStorage.getItem("fullName") || "A").charAt(0).toUpperCase(),
  };

  useEffect(() => {
    const go = async () => {
      try {
        const r = await employeeService.getPendingSubmissions();
        if (r.success) setPendingCount(r.data?.length || 0);
      } catch {}
    };
    go();
    const t = setInterval(go, 30000);
    return () => clearInterval(t);
  }, [location.pathname]);

  const menu = [
    { id: "dashboard", label: "Dashboard",          Icon: LayoutDashboard, path: "/employee/dashboard"  },
    { id: "employees", label: "Employee Management", Icon: Users,           path: "/employee/management" },
    { id: "pending",   label: "Pending Approvals",   Icon: ClipboardList,   path: "/employee/pending",   badge: pendingCount },
    { id: "payments",  label: "Advanced Payments",   Icon: CreditCard,      path: "/employee/payments"   },
    { id: "payroll",   label: "Payroll",             Icon: Wallet,          path: "/employee/payroll"    },
    { id: "reports",   label: "Reports",             Icon: FileText,        path: "/employee/reports"    },
  ];

  const isActive     = (p) => location.pathname === p || location.pathname.startsWith(p);
  const col          = collapsed && !isMobile;
  const handleNav    = (path) => { navigate(path); if (isMobile) setMobileOpen(false); };
  const handleLogout = () => { if (window.confirm("Logout?")) { localStorage.clear(); navigate("/login"); } };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        /* ─── Root ─── */
        .sb {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(175deg, #1d4ed8 0%, #1e3a8a 60%, #172554 100%);
          overflow: hidden;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        /* top-left soft glow */
        .sb::before {
          content: '';
          position: absolute;
          top: -100px; left: -100px;
          width: 320px; height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        /* ─── Header ─── */
        .sb-head {
          position: relative;
          z-index: 1;
          padding: 22px 14px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sb-head.col {
          padding: 18px 0 14px;
          gap: 0;
        }

        /* collapse / close toggle */
        .sb-toggle {
          position: absolute;
          top: 10px; right: 10px;
          width: 28px; height: 28px;
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .18s, border-color .18s;
        }
        .sb-toggle:hover {
          background: rgba(255,255,255,0.18);
          border-color: rgba(255,255,255,0.3);
          color: #fff;
        }

        /* avatar */
        .sb-avatar {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: rgba(255,255,255,0.12);
          border: 1.5px solid rgba(255,255,255,0.25);
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          transition: all .3s;
          position: relative;
        }
        .sb-avatar.col {
          width: 38px; height: 38px;
          border-radius: 10px;
          font-size: 15px;
        }
        /* green pulse dot */
        .sb-avatar::after {
          content: '';
          position: absolute;
          bottom: -3px; right: -3px;
          width: 11px; height: 11px;
          border-radius: 50%;
          background: #4ade80;
          border: 2px solid #1e3a8a;
        }
        .sb-avatar.col::after {
          width: 9px; height: 9px;
          bottom: -2px; right: -2px;
        }

        .sb-name {
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          margin: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          letter-spacing: 0.01em;
        }
        .sb-email {
          color: rgba(191,219,254,0.75);
          font-size: 10.5px;
          margin: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        /* ─── Nav ─── */
        .sb-nav {
          flex: 1;
          padding: 10px 10px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: relative;
          z-index: 1;
        }
        .sb-nav::-webkit-scrollbar { width: 0; }

        /* nav item */
        .sb-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          cursor: pointer;
          background: transparent;
          color: rgba(191,219,254,0.85);
          font-size: 13px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          transition: all .16s ease;
          text-align: left;
          position: relative;
          white-space: nowrap;
        }
        .sb-item.col {
          justify-content: center;
          padding: 9px 0;
        }
        .sb-item:hover:not(.active) {
          background: rgba(255,255,255,0.09);
          color: #fff;
          border-color: rgba(255,255,255,0.08);
        }
        .sb-item.active {
          background: rgba(255,255,255,0.97);
          color: #1d4ed8;
          font-weight: 600;
          box-shadow: 0 2px 12px rgba(0,0,0,0.18);
          border-color: transparent;
        }

        /* icon wrapper */
        .sb-icon {
          width: 28px; height: 28px;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background .16s;
          position: relative;
        }
        .sb-item.active   .sb-icon { background: rgba(29,78,216,0.09); }
        .sb-item:hover:not(.active) .sb-icon { background: rgba(255,255,255,0.09); }
        .sb-item.col .sb-icon { width: 34px; height: 34px; border-radius: 9px; }

        .sb-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }

        /* badge pill */
        .sb-badge {
          padding: 1px 7px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.6;
          flex-shrink: 0;
          box-shadow: 0 1px 5px rgba(239,68,68,0.4);
        }
        /* dot badge (collapsed) */
        .sb-badge-dot {
          position: absolute;
          top: -3px; right: -3px;
          min-width: 15px; height: 15px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 8px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid #1e3a8a;
          padding: 0 3px;
        }

        /* ─── Divider ─── */
        .sb-divider {
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 4px 12px;
          flex-shrink: 0;
          position: relative; z-index: 1;
        }

        /* ─── Footer ─── */
        .sb-foot {
          padding: 8px 10px 14px;
          flex-shrink: 0;
          position: relative; z-index: 1;
        }
        .sb-logout {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(191,219,254,0.75);
          font-size: 13px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all .16s ease;
        }
        .sb-logout.col { justify-content: center; padding: 9px 0; }
        .sb-logout:hover {
          background: rgba(239,68,68,0.15);
          color: #fca5a5;
          border-color: rgba(239,68,68,0.22);
        }
        .sb-logout-icon {
          width: 28px; height: 28px;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background .16s;
        }
        .sb-logout:hover .sb-logout-icon { background: rgba(239,68,68,0.15); }
        .sb-logout.col .sb-logout-icon { width: 34px; height: 34px; border-radius: 9px; }

        /* ─── Tooltip (collapsed) ─── */
        .sb-tw { position: relative; }
        .sb-tw:hover .sb-tip {
          opacity: 1;
          transform: translateX(0) translateY(-50%);
          pointer-events: auto;
        }
        .sb-tip {
          position: absolute;
          left: calc(100% + 10px); top: 50%;
          transform: translateX(-6px) translateY(-50%);
          background: #1e3a8a;
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          font-size: 11.5px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          padding: 5px 11px;
          border-radius: 8px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity .16s, transform .16s;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          z-index: 200;
        }
        .sb-tip::before {
          content: '';
          position: absolute;
          left: -5px; top: 50%;
          transform: translateY(-50%) rotate(45deg);
          width: 8px; height: 8px;
          background: #1e3a8a;
          border-left: 1px solid rgba(255,255,255,0.15);
          border-bottom: 1px solid rgba(255,255,255,0.15);
        }
      `}</style>

      <div className="sb">

        {/* ── Header ── */}
        <div className={`sb-head${col ? " col" : ""}`}>
          <button
            className="sb-toggle"
            onClick={isMobile ? () => setMobileOpen(false) : () => setCollapsed((p) => !p)}
          >
            {isMobile ? <X size={14}/> : col ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
          </button>

          <div className={`sb-avatar${col ? " col" : ""}`}>{user.initials}</div>

          {!col && (
            <>
              <p className="sb-name">{user.name}</p>
              <p className="sb-email">{user.email}</p>
            </>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="sb-nav">
          {menu.map(({ id, label, Icon, path, badge }) => {
            const on = isActive(path);
            return (
              <div key={id} className={col ? "sb-tw" : ""}>
                <button
                  className={`sb-item${col ? " col" : ""}${on ? " active" : ""}`}
                  onClick={() => handleNav(path)}
                >
                  <div className="sb-icon">
                    <Icon size={16} strokeWidth={on ? 2.3 : 1.9} />
                    {col && badge > 0 && (
                      <div className="sb-badge-dot">{badge > 9 ? "9+" : badge}</div>
                    )}
                  </div>
                  {!col && (
                    <>
                      <span className="sb-label">{label}</span>
                      {badge > 0 && (
                        <span className="sb-badge">{badge > 99 ? "99+" : badge}</span>
                      )}
                    </>
                  )}
                </button>
                {col && <div className="sb-tip">{label}{badge > 0 ? ` · ${badge}` : ""}</div>}
              </div>
            );
          })}
        </nav>

        <div className="sb-divider" />

        {/* ── Logout ── */}
        <div className="sb-foot">
          <div className={col ? "sb-tw" : ""}>
            <button className={`sb-logout${col ? " col" : ""}`} onClick={handleLogout}>
              <div className="sb-logout-icon">
                <LogOut size={16} strokeWidth={1.9} />
              </div>
              {!col && <span>Logout</span>}
            </button>
            {col && <div className="sb-tip">Logout</div>}
          </div>
        </div>

      </div>
    </>
  );
};

export default Sidebar;