import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";

const Header = ({ user, onToggle }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  return (
    <header
      style={{
        height: "64px",
        minHeight: "64px",
        flexShrink: 0,
        width: "100%",
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 24px",
        zIndex: 100,
        boxSizing: "border-box",
      }}
    >
      {/* ── Left ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 14,
        }}
      >
        {/* Hamburger */}
        <button
          onClick={onToggle}
          style={{
            padding: 8,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Menu size={isMobile ? 18 : 20} color="#475569" />
        </button>

        {/* Logo */}
        <img
          src="/assets/Insta_LOGO.png"
          alt="logo"
          style={{
            height: isMobile ? 28 : 36,
            width: isMobile ? 28 : 36,
            borderRadius: "50%",
            objectFit: "contain",
            border: "1px solid #e2e8f0",
            padding: isMobile ? 3 : 4,
            flexShrink: 0,
          }}
        />

        {/* Title */}
        <h1
          style={{
            fontSize: isMobile ? 13 : 18,
            fontWeight: 700,
            margin: 0,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#2563eb" }}>Insta ICT</span>
          {!isMobile && (
            <>
              {" "}
              <span style={{ color: "#eab308" }}>Solutions</span>
            </>
          )}
        </h1>
      </div>

      {/* ── Right ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: isMobile ? 30 : 36,
            height: isMobile ? 30 : 36,
            borderRadius: "50%",
            background: "#2563eb",
            color: "#fff",
            fontSize: isMobile ? 12 : 14,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {user?.initials}
        </div>

        {/* Name — hidden on mobile */}
        {!isMobile && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#334155",
              whiteSpace: "nowrap",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user?.name}
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
