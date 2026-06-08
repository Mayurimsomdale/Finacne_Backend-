// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./config/database.js";

// ── Import UPLOADS_ROOT from the middleware so server.js and multer
//    ALWAYS use the exact same folder path ─────────────────────────────────────
import { UPLOADS_ROOT } from "./middleware/Advancepayment.js";

// ── FIX: Import uploadsCorsMw so the PDF generator can fetch images
//    without hitting "SecurityError: tainted canvas" or "Failed to fetch"
import { uploadsCorsMw } from "./middleware/employeeMng/employeeDocMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const startupErrors = [];

// ============================================================
// CORS CONFIGURATION (Consolidated Whitelist)
// ============================================================
const allowedOrigins = [
  process.env.FRONTEND_URL, // from .env  e.g. https://finance.instagrp.com
  "http://localhost:3000", // local dev
  "http://localhost:5173", // vite dev
].filter(Boolean); // removes undefined if env var missing

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// ============================================================
// STATIC FILE SERVING — uses the SAME root as multer
// ============================================================
console.log("🖼️  [server] express.static serving from:", UPLOADS_ROOT);

app.use("/uploads", uploadsCorsMw);

app.use(
  "/uploads",
  (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    next();
  },
  express.static(UPLOADS_ROOT, {
    fallthrough: false,
  }),
);

app.use("/uploads", (err, req, res, _next) => {
  if (err.status === 404 || err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      message: `File not found: ${req.originalUrl}`,
      tip: "Check that the file was uploaded successfully and the path is correct",
      servedFrom: UPLOADS_ROOT,
    });
  }
  res.status(500).json({ success: false, message: err.message });
});

// ============================================================
// ROUTE LOADER
// ============================================================
async function loadRoute(importPath, mountPath, label) {
  try {
    const { default: router } = await import(importPath);
    app.use(mountPath, router);
    console.log(`✅ ${label} → ${mountPath}`);
  } catch (err) {
    console.error(`❌ ${label} FAILED:`, err.message);
    console.error(err.stack);
    startupErrors.push({
      route: mountPath,
      label,
      error: err.message,
      stack: err.stack,
    });
    app.use(mountPath, (_req, res) =>
      res.status(503).json({
        success: false,
        message: `${label} failed to load`,
        error: err.message,
        tip: `Open http://localhost:${PORT}/api/debug for full diagnosis`,
      }),
    );
  }
}

// ============================================================
// ROUTES
// ============================================================

// ── Employee Management ───────────────────────────────────────────────────────
await loadRoute("./routes/authRoutes.js", "/api/auth", "authRoutes");
await loadRoute(
  "./routes/employeeMng/employeeRoutes.js",
  "/api/employees",
  "employeeRoutes",
);
await loadRoute(
  "./routes/employeeMng/registrationLinkRoutes.js",
  "/api/registration-links",
  "registrationLinkRoutes",
);
await loadRoute(
  "./routes/employeeMng/registrationRoutes.js",
  "/api/registrations",
  "registrationRoutes",
);
await loadRoute("./routes/adminRoutes.js", "/api/admin", "adminRoutes");

// ── Advance Payment ───────────────────────────────────────────────────────────
await loadRoute(
  "./routes/AdvancePayment/advancePaymentRoutes.js",
  "/api/advance-payment",
  "advancePaymentRoutes",
);

// ── Payroll ───────────────────────────────────────────────────────────────────
await loadRoute(
  "./routes/payroll/payrollRoutes.js",
  "/api/payroll",
  "payrollRoutes",
);

// ── Reports ───────────────────────────────────────────────────────────────────
await loadRoute(
  "./routes/Reports/ReportRoute.js",
  "/api/reports",
  "reportsRoutes",
);

// ── Employee Doc Upload ───────────────────────────────────────────────────────
await loadRoute(
  "./routes/employeeMng/employeeDocUploadRoutes.js",
  "/api/employee-docs",
  "employeeDocUploadRoutes",
);

// ============================================================
// DIAGNOSTIC ENDPOINTS
// ============================================================
app.get("/", (_req, res) =>
  res.json({
    message: "Employee Management System API",
    status: startupErrors.length === 0 ? "healthy" : "⚠️ running with errors",
    debug: `http://localhost:${PORT}/api/debug`,
    startupErrors: startupErrors.length,
  }),
);

app.get("/api/health", async (_req, res) => {
  let dbOk = false,
    dbErr = null;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch (e) {
    dbErr = e.message;
  }
  res.json({
    success: true,
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbOk ? "connected" : "FAILED",
    dbError: dbErr,
    startupErrors: startupErrors.length,
    uploadsDir: UPLOADS_ROOT,
  });
});

app.get("/api/debug", async (_req, res) => {
  let dbOk = false,
    dbErr = null,
    dbTables = [];
  try {
    await pool.query("SELECT 1");
    dbOk = true;
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'employees','employee_documents','admin_users','registration_links',
        'advance_payment_types','advance_payment_requests',
        'advance_payment_attachments','advance_payment_links',
        'advance_payment_history','advance_payment_deductions',
        'payroll_records','payroll_advance_effects'
      )
      ORDER BY table_name
    `);
    dbTables = rows.map((r) => r.table_name);
  } catch (e) {
    dbErr = e.message;
  }

  let newColumnsOk = false,
    missingCols = [];
  try {
    const { rows: cols } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'employees' AND column_name IN (
        'father_husband_name','marital_status','blood_group',
        'pan_number','aadhar_number','family_member_name',
        'emergency_contact_name','permanent_address','local_address',
        'ref1_name','ref2_name','ref3_name'
      )
    `);
    const found = cols.map((r) => r.column_name);
    const required = [
      "father_husband_name",
      "marital_status",
      "blood_group",
      "pan_number",
      "aadhar_number",
      "family_member_name",
      "emergency_contact_name",
      "permanent_address",
      "local_address",
      "ref1_name",
      "ref2_name",
      "ref3_name",
    ];
    missingCols = required.filter((c) => !found.includes(c));
    newColumnsOk = missingCols.length === 0;
  } catch (_) {}

  const requiredTables = [
    "admin_users",
    "employee_documents",
    "employees",
    "registration_links",
    "advance_payment_types",
    "advance_payment_requests",
    "advance_payment_attachments",
    "advance_payment_links",
    "advance_payment_history",
    "advance_payment_deductions",
    "payroll_records",
    "payroll_advance_effects",
  ];
  const missingTables = requiredTables.filter((t) => !dbTables.includes(t));

  const pkgChecks = {};
  for (const pkg of [
    "multer",
    "pg",
    "express",
    "cors",
    "dotenv",
    "uuid",
    "exceljs",
  ]) {
    try {
      await import(pkg);
      pkgChecks[pkg] = "✅";
    } catch (e) {
      pkgChecks[pkg] = `❌ missing — run: npm install ${pkg}`;
    }
  }

  const requiredEnv = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
  ];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);

  const allOk =
    dbOk &&
    missingTables.length === 0 &&
    missingEnv.length === 0 &&
    startupErrors.length === 0 &&
    newColumnsOk;

  res.status(allOk ? 200 : 503).json({
    overall: allOk
      ? "✅ All systems OK"
      : "❌ Problems found — fix items below",
    uploadsDirectory: UPLOADS_ROOT,
    routeStartupErrors:
      startupErrors.length === 0
        ? "✅ All routes loaded OK"
        : startupErrors.map((e) => ({
            mountPath: e.route,
            "❌ error": e.error,
          })),
    database: {
      status: dbOk ? "✅ Connected" : "❌ FAILED",
      error: dbErr,
      tablesFound: dbTables,
      tablesMissing: missingTables.length ? missingTables : "✅ none",
      newColumns: newColumnsOk
        ? "✅ all present"
        : `❌ missing: ${missingCols.join(", ")}`,
    },
    packages: pkgChecks,
    environment: {
      NODE_ENV: process.env.NODE_ENV || "(not set)",
      PORT: process.env.PORT || "5000 (default)",
      FRONTEND_URL:
        process.env.FRONTEND_URL ||
        "⚠️  MISSING — CORS will block production requests",
      DB_HOST: process.env.DB_HOST || "⚠️  MISSING",
      DB_PORT: process.env.DB_PORT || "⚠️  MISSING",
      DB_NAME: process.env.DB_NAME || "⚠️  MISSING",
      DB_USER: process.env.DB_USER || "⚠️  MISSING",
      DB_PASSWORD: process.env.DB_PASSWORD ? "✅ set" : "⚠️  MISSING",
      missing: missingEnv.length ? missingEnv : "✅ all set",
    },
    actionItems: allOk
      ? ["✅ Nothing to fix!"]
      : [
          !dbOk && `Fix DB: ${dbErr}`,
          missingEnv.length && `Add to .env: ${missingEnv.join(", ")}`,
          missingTables.length &&
            `Run schema files — missing tables: ${missingTables.join(", ")}`,
          missingCols.length &&
            `Run MIGRATION in schema.sql — missing columns: ${missingCols.join(", ")}`,
          startupErrors.length &&
            `Fix route errors: ${startupErrors.map((e) => e.route).join(", ")}`,
        ].filter(Boolean),
  });
});

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE")
    return res
      .status(400)
      .json({ success: false, message: "File size must be less than 5MB" });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res
      .status(400)
      .json({ success: false, message: `Unexpected file field: ${err.field}` });
  console.error("❌ Express error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    tip: `Open http://localhost:${PORT}/api/debug to see all mounted routes`,
  });
});

// ============================================================
// DB CONNECTION CHECK + KEEP-ALIVE (prevents Neon cold-start 504s)
// ============================================================
pool.query("SELECT NOW() as t", (err, result) => {
  if (err) {
    console.error("❌ Database connection FAILED:", err.message);
    startupErrors.push({ route: "database", error: err.message });
  } else {
    console.log("✅ Database connected at", result.rows[0].t);
  }
});

pool.on("error", (err) => console.error("❌ DB pool error:", err.message));

// ── Keep Neon warm — ping every 4 minutes ────────────────────────────────────
// Neon suspends after 5 min of inactivity; this prevents cold-start 504s.
// Safe to leave in production — a lightweight "SELECT 1" every 4 min.
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

setInterval(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("💓 DB keep-alive OK");
  } catch (err) {
    console.error("💔 DB keep-alive failed:", err.message);
  }
}, KEEP_ALIVE_INTERVAL_MS);

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(60));
  console.log("🚀 Employee Management System API");
  console.log("=".repeat(60));
  console.log(`   Server:    http://localhost:${PORT}`);
  console.log(`   Debug:     http://localhost:${PORT}/api/debug`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   Uploads:   http://localhost:${PORT}/uploads/...`);
  console.log(`   From disk: ${UPLOADS_ROOT}`);
  console.log(`   CORS:      ${allowedOrigins.join(", ")}`);
  if (startupErrors.length > 0) {
    console.log("");
    console.log("⚠️  STARTUP PROBLEMS:");
    startupErrors.forEach((e) => console.error(`   ${e.route}: ${e.error}`));
  }
  console.log("=".repeat(60));
});

process.on("SIGTERM", () => pool.end(() => process.exit(0)));
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down");
  pool.end(() => process.exit(0));
});
process.on("uncaughtException", (err) =>
  console.error("❌ Uncaught:", err.message),
);
process.on("unhandledRejection", (reason) =>
  console.error(
    "❌ Unhandled:",
    reason instanceof Error ? reason.message : reason,
  ),
);

export default app;
