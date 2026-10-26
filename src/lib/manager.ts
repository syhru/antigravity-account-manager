import { recordAudit } from "./audit";
import { runCli } from "./cli";
import { initialize, pool } from "./db";
import { type CliRow, quotaOf, reconcile } from "./queue";

const globalState = globalThis as unknown as {
  managerLock?: Promise<unknown>;
  quotaFailureState?: string;
};
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const before = globalState.managerLock ?? Promise.resolve();
  const next = before.catch(() => {}).then(fn);
  globalState.managerLock = next.catch(() => {});
  return next;
}
export async function snapshot() {
  await initialize();
  const result = await runCli(["list"]);
  const rows = (result.accounts as CliRow[]).filter((r) => r.id);
  const previous = (await pool.query("SELECT * FROM manager_state WHERE id=1"))
    .rows[0];
  const queue = reconcile(previous.queue, rows);
  const active = rows.find((r) => r.active)?.id ?? null;
  await pool.query(
    `UPDATE manager_state SET queue=$1::jsonb, active_id=$2, session_ends_at=NULL WHERE id=1`,
    [JSON.stringify(queue), active],
  );
  const switches = (
    await pool.query(
      "SELECT account_id, max(switched_at) AS last FROM switch_history GROUP BY account_id",
    )
  ).rows;
  const accounts = queue.map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error("Antrean tidak konsisten. Muat ulang daftar.");
    return {
      id,
      email: row.email || row.alias || id,
      alias: row.alias || "",
      isActive: row.active,
      quota: quotaOf(row),
      quotaWindow: row.usage?.five_hour
        ? "five_hour"
        : row.usage?.weekly
          ? "weekly"
          : null,
      plan: row.plan || null,
      usageError: row.usage_error || (row.usage?.stale ? "stale" : null),
      lastSwitch:
        switches.find((s) => s.account_id === id)?.last?.toISOString() ?? null,
    };
  });
  const failures = accounts
    .filter((a) => a.usageError || a.quota === null)
    .map((a) => a.id)
    .sort()
    .join(",");
  if (globalState.quotaFailureState !== failures) {
    if (failures) await recordAudit("quota_failed");
    else if (globalState.quotaFailureState)
      await recordAudit("quota_recovered");
    globalState.quotaFailureState = failures;
  }
  const quotas = accounts.flatMap((a) => (a.quota === null ? [] : [a.quota]));
  if (quotas.length) {
    await pool.query(
      `INSERT INTO quota_history(value) SELECT $1 WHERE NOT EXISTS(SELECT 1 FROM quota_history WHERE recorded_at>now()-interval '1 minute')`,
      [quotas.reduce((a, b) => a + b, 0) / quotas.length],
    );
  }
  await pool.query(
    `DELETE FROM quota_history WHERE id NOT IN(SELECT id FROM quota_history ORDER BY id DESC LIMIT 100)`,
  );
  const history = (
    await pool.query(
      "SELECT value FROM (SELECT id,value FROM quota_history ORDER BY id DESC LIMIT 20) h ORDER BY id",
    )
  ).rows.map((r) => Number(r.value));
  return {
    accounts,
    history,
    warning: accounts.some((a) => a.usageError)
      ? "Sebagian kuota tidak tersedia. Jika refresh_failed, login ulang akun melalui OAuth."
      : "",
  };
}
export async function perform(action: string, id?: string) {
  return exclusive(async () => {
    const current = await snapshot();
    if (action === "restart") {
      await recordAudit("action_restart");
      return {
        ...current,
        warning:
          "Simulasi muat ulang dashboard selesai. Proses Antigravity tidak dihentikan.",
      };
    }
    const target =
      action === "rotate"
        ? current.accounts[0]
        : current.accounts.find((a) => a.id === id);
    if (!target) throw new Error("Akun tidak ditemukan.");
    if (action === "switch" || action === "rotate") {
      await runCli(["switch", target.id, "--target", "cli"]);
      await pool.query("INSERT INTO switch_history(account_id) VALUES($1)", [
        target.id,
      ]);
    } else if (action === "delete") {
      if (target.isActive) {
        const next = current.accounts.filter((a) => a.id !== target.id).at(-1);
        if (next) {
          await runCli(["switch", next.id, "--target", "cli"]);
          await pool.query(
            "INSERT INTO switch_history(account_id) VALUES($1)",
            [next.id],
          );
        }
      }
      await runCli([
        "remove",
        target.id,
        "--yes",
        ...(target.isActive && current.accounts.length === 1
          ? ["--logout"]
          : []),
      ]);
    } else throw new Error("Aksi tidak dikenal.");
    await recordAudit(
      action === "delete"
        ? "action_delete"
        : action === "rotate"
          ? "action_rotate"
          : "action_switch",
    );
    return snapshot();
  });
}
