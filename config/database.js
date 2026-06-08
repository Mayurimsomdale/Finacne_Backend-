// config/database.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("NODE_ENV:", process.env.NODE_ENV);

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "FinanceManagement",

  ssl: isProduction ? { rejectUnauthorized: false } : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // Neon needs up to 10s to wake
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// ── Auto-reconnect on idle client errors ─────────────────────────────────────
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle DB client:", err.message);
});

// ── Warm up the pool on startup ───────────────────────────────────────────────
pool
  .query("SELECT 1")
  .then(() => console.log("✅ DB pool warmed up"))
  .catch((err) => console.error("⚠️  DB pool warm-up failed:", err.message));

// ── Query with retry — handles Neon cold-start transient failures ─────────────
// Usage (in any controller):
//   import { queryWithRetry } from "../../config/database.js";
//   const { rows } = await queryWithRetry("SELECT * FROM employees WHERE id = $1", [id]);
export async function queryWithRetry(text, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const isLastAttempt = i === retries - 1;
      const isRetryable =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND" ||
        err.message.includes("Connection terminated") ||
        err.message.includes("connection timeout") ||
        err.message.includes("SSL connection has been closed");

      if (isLastAttempt || !isRetryable) throw err;

      const delay = 1000 * (i + 1); // 1s → 2s backoff
      console.warn(
        `⚠️  DB query failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms… [${err.code || err.message}]`,
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export default pool;
