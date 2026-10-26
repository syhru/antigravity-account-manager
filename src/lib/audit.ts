import { type AuditEvent, auditEntry } from "./audit-events";
import { pool } from "./db";
export async function ensureAudit() {
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
    id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL, event text NOT NULL, message text NOT NULL)`);
}
// Only catalogued messages are accepted: no raw exceptions, OAuth data, or CLI output.
export async function recordAudit(event: AuditEvent) {
  try {
    await ensureAudit();
    const entry = auditEntry(event);
    await pool.query(
      `WITH inserted AS (
      INSERT INTO activity_logs(level,event,message) VALUES($1,$2,$3)
      RETURNING id::text, created_at AS "createdAt",level,event,message)
      SELECT pg_notify('am_activity', row_to_json(inserted)::text) FROM inserted`,
      [entry.level, entry.event, entry.message],
    );
  } catch {
    console.error(
      "Log Aktivitas: penyimpanan gagal; kejadian tidak tersimpan:",
      event,
    );
  }
}
