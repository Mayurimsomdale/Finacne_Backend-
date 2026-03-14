// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Collect startup errors — reported at /api/debug
const startupErrors = [];

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.url.includes('/auth/')) {
    const b = { ...req.body };
    if (b.password) b.password = '[REDACTED]';
    console.log('Body:', b);
  }
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// ROUTE LOADER HELPER
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
      stack: err.stack
    });
    // Keep endpoint alive with a helpful 503
    app.use(mountPath, (_req, res) =>
      res.status(503).json({
        success: false,
        message: `${label} failed to load`,
        error: err.message,
        tip: `Open http://localhost:${PORT}/api/debug for full diagnosis`
      })
    );
  }
}

// ============================================================
// ROUTES
// ⚠️  ORDER MATTERS:
//    employeeRoutes contains /export/template and /export/data
//    declared BEFORE /:id inside the router — so no separate
//    export router is needed.
// ============================================================
await loadRoute('./routes/employeeMng/authRoutes.js',             '/api/auth',               'authRoutes');
await loadRoute('./routes/employeeMng/employeeRoutes.js',         '/api/employees',          'employeeRoutes');
await loadRoute('./routes/employeeMng/registrationRoutes.js',     '/api/registrations',      'registrationRoutes');
await loadRoute('./routes/employeeMng/registrationLinkRoutes.js', '/api/registration-links', 'registrationLinkRoutes');
await loadRoute('./routes/adminRoutes.js',                        '/api/admin',              'adminRoutes');

// ============================================================
// DIAGNOSTIC ENDPOINTS
// ============================================================
app.get('/', (_req, res) =>
  res.json({
    message: 'Employee Management System API',
    status: startupErrors.length === 0 ? 'healthy' : '⚠️ running with errors',
    debug: `http://localhost:${PORT}/api/debug`,
    startupErrors: startupErrors.length
  })
);

app.get('/api/health', async (_req, res) => {
  let dbOk = false, dbErr = null;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (e) {
    dbErr = e.message;
  }
  res.json({
    success: true,
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbOk ? 'connected' : 'FAILED',
    dbError: dbErr,
    startupErrors: startupErrors.length,
    routes: {
      auth:           '/api/auth',
      employees:      '/api/employees',
      exportData:     '/api/employees/export/data',
      exportTemplate: '/api/employees/export/template',
      registrations:  '/api/registrations',
      links:          '/api/registration-links',
      admin:          '/api/admin'
    }
  });
});

app.get('/api/debug', async (_req, res) => {
  let dbOk = false, dbErr = null, dbTables = [];
  try {
    await pool.query('SELECT 1');
    dbOk = true;
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('employees','employee_documents','admin_users','registration_links')
      ORDER BY table_name
    `);
    dbTables = rows.map(r => r.table_name);
  } catch (e) {
    dbErr = e.message;
  }

  const requiredTables = ['admin_users', 'employee_documents', 'employees', 'registration_links'];
  const missingTables  = requiredTables.filter(t => !dbTables.includes(t));

  const pkgChecks = {};
  for (const pkg of ['multer', 'pg', 'express', 'cors', 'dotenv', 'uuid', 'exceljs']) {
    try {
      await import(pkg);
      pkgChecks[pkg] = '✅';
    } catch (e) {
      pkgChecks[pkg] = `❌ missing — run: npm install ${pkg}`;
    }
  }

  const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingEnv  = requiredEnv.filter(k => !process.env[k]);

  const allOk = dbOk && missingTables.length === 0 && missingEnv.length === 0 && startupErrors.length === 0;

  res.status(allOk ? 200 : 503).json({
    overall: allOk ? '✅ All systems OK' : '❌ Problems found — fix items below',
    routeMountPoints: {
      'POST /api/auth/login':                      'authRoutes',
      'GET  /api/employees':                       'employeeRoutes — list all',
      'GET  /api/employees/export/data':           'employeeRoutes — export Excel',
      'GET  /api/employees/export/template':       'employeeRoutes — download template',
      'GET  /api/employees/pending-count':         'employeeRoutes — pending badge count',
      'POST /api/registration-links':              'linkRoutes ← generate link',
      'GET  /api/registration-links/:id/validate': 'linkRoutes ← validate link',
      'POST /api/registrations':                   'registrationRoutes ← submit form',
      'GET  /api/registrations/pending':           'registrationRoutes ← admin pending list',
      'POST /api/registrations/:id/approve':       'registrationRoutes ← approve',
      'POST /api/registrations/:id/reject':        'registrationRoutes ← reject'
    },
    routeStartupErrors: startupErrors.length === 0
      ? '✅ All routes loaded OK'
      : startupErrors.map(e => ({
          mountPath: e.route,
          '❌ error': e.error,
          stack: e.stack?.split('\n').slice(0, 4).join(' | ')
        })),
    database: {
      status:        dbOk ? '✅ Connected' : '❌ FAILED',
      error:         dbErr,
      tablesFound:   dbTables,
      tablesMissing: missingTables.length ? missingTables : '✅ none',
      fix: missingTables.length
        ? `Run schema.sql: psql -U postgres -d ${process.env.DB_NAME || 'employee_db'} -f schema.sql`
        : null
    },
    packages: pkgChecks,
    environment: {
      NODE_ENV:    process.env.NODE_ENV || '(not set)',
      PORT:        process.env.PORT     || '5000 (default)',
      DB_HOST:     process.env.DB_HOST  || '❌ MISSING',
      DB_PORT:     process.env.DB_PORT  || '❌ MISSING',
      DB_NAME:     process.env.DB_NAME  || '❌ MISSING',
      DB_USER:     process.env.DB_USER  || '❌ MISSING',
      DB_PASSWORD: process.env.DB_PASSWORD ? '✅ set' : '❌ MISSING',
      missing:     missingEnv.length ? missingEnv : '✅ all set'
    },
    actionItems: allOk
      ? ['🎉 Nothing to fix!']
      : [
          !dbOk                && `Fix DB connection: ${dbErr}`,
          missingEnv.length    && `Add to .env: ${missingEnv.join(', ')}`,
          missingTables.length && `Run schema.sql to create: ${missingTables.join(', ')}`,
          startupErrors.length && `Fix route errors: ${startupErrors.map(e => e.route).join(', ')}`
        ].filter(Boolean)
  });
});

// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File size must be less than 5MB' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE')
    return res.status(400).json({ success: false, message: `Unexpected file field: ${err.field}` });

  console.error('🔴 Express error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// 404 catch-all
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    tip: `Open http://localhost:${PORT}/api/debug to see all mounted routes`
  });
});

// ============================================================
// DB CONNECTION CHECK ON STARTUP
// ============================================================
pool.query('SELECT NOW() as t', (err, result) => {
  if (err) {
    console.error('❌ Database connection FAILED:', err.message);
    startupErrors.push({ route: 'database', error: err.message });
  } else {
    console.log('✅ Database connected at', result.rows[0].t);
  }
});

pool.on('error', err => console.error('❌ DB pool error:', err.message));

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Employee Management System API');
  console.log('='.repeat(60));
  console.log(`✅ Server:        http://localhost:${PORT}`);
  console.log(`🔍 Debug:         http://localhost:${PORT}/api/debug`);
  console.log(`🏥 Health:        http://localhost:${PORT}/api/health`);
  console.log(`🔗 Generate link: POST /api/registration-links`);
  console.log(`📋 Submit form:   POST /api/registrations`);
  console.log(`⏳ Pending:       GET  /api/registrations/pending`);
  console.log(`👥 Employees:     GET  /api/employees`);
  console.log(`📤 Export data:   GET  /api/employees/export/data`);
  console.log(`📄 Template:      GET  /api/employees/export/template`);
  console.log(`📂 Uploads:       http://localhost:${PORT}/uploads`);
  if (startupErrors.length > 0) {
    console.log('');
    console.log('⚠️  STARTUP PROBLEMS — open /api/debug for details:');
    startupErrors.forEach(e => console.error(`  ❌ ${e.route}: ${e.error}`));
  }
  console.log('='.repeat(60));
});

// ============================================================
// PROCESS EVENTS
// ============================================================
process.on('SIGTERM', () => pool.end(() => process.exit(0)));
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down');
  pool.end(() => process.exit(0));
});

process.on('uncaughtException', err => {
  console.error('🔴 Uncaught Exception:', err.message, err.stack);
  startupErrors.push({ route: 'runtime:uncaughtException', error: err.message });
});

process.on('unhandledRejection', reason => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('🔴 Unhandled Rejection:', msg);
  startupErrors.push({ route: 'runtime:unhandledRejection', error: msg });
});

export default app;