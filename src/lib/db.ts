import { Pool } from "pg";

const state = globalThis as unknown as { amPool?: Pool };
export const pool =
  state.amPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
if (!state.amPool)
  pool.on("error", () => {
    console.error(
      "PostgreSQL: koneksi idle terputus; periksa database dan Log Aktivitas setelah tersambung kembali.",
    );
  });
state.amPool = pool;
export async function initialize() {
  await pool.query(`CREATE TABLE IF NOT EXISTS manager_state (id integer PRIMARY KEY CHECK(id=1), queue jsonb NOT NULL DEFAULT '[]', active_id text, session_ends_at timestamptz);
 INSERT INTO manager_state(id) VALUES(1) ON CONFLICT DO NOTHING;
 CREATE TABLE IF NOT EXISTS switch_history (id bigserial PRIMARY KEY, account_id text NOT NULL, switched_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS quota_history (id bigserial PRIMARY KEY, value double precision NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());`);
}
