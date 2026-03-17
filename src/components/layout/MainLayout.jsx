import React, { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  const user = {
    name:     localStorage.getItem("fullName") || "Admin User",
    email:    localStorage.getItem("email")    || "admin@company.com",
    initials: (localStorage.getItem("fullName") || "A").charAt(0).toUpperCase(),
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleToggle = () => {
    if (isMobile) setMobileOpen(p => !p);
    else setCollapsed(p => !p);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",   /* column = header on top, body row below */
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
    }}>

      {/* ── ROW 1: Header (64px, full width) ── */}
      <Header user={user} onToggle={handleToggle} />

      {/* ── ROW 2: Sidebar + Main (fills remaining height) ── */}
      <div style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
      }}>
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <main style={{
          flex: 1,
          overflowY: "auto",
          background: "#f1f5f9",
          padding: "32px",
        }}>
          {children}
        </main>
      </div>

    </div>
  );
};

export default Layout;
