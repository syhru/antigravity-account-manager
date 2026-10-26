export interface CliRow {
  id: string;
  email?: string;
  alias?: string;
  active: boolean;
  plan?: string;
  usage_error?: string;
  usage?: {
    five_hour?: { remaining_percent: number };
    weekly?: { remaining_percent: number };
    stale?: boolean;
  };
}
export function reconcile(
  previous: string[],
  rows: Pick<CliRow, "id" | "active">[],
): string[] {
  const ids = new Set(rows.map((r) => r.id));
  const active = rows.find((r) => r.active)?.id;
  return [
    ...previous.filter((id) => ids.has(id) && id !== active),
    ...rows
      .filter((r) => !previous.includes(r.id) && r.id !== active)
      .map((r) => r.id),
    ...(active ? [active] : []),
  ];
}
export function quotaOf(
  row: Pick<CliRow, "usage" | "usage_error">,
): number | null {
  if (row.usage_error || row.usage?.stale) return null;
  const value =
    row.usage?.five_hour?.remaining_percent ??
    row.usage?.weekly?.remaining_percent;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null;
}
