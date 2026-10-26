import assert from "node:assert/strict";
import { test } from "node:test";
import { auditEntry, auditEvents } from "../src/lib/audit-events";

test("audit uses fixed messages without input secrets", () => {
  for (const event of Object.keys(
    auditEvents,
  ) as (keyof typeof auditEvents)[]) {
    const entry = auditEntry(event);
    assert.ok(["INFO", "WARNING", "ERROR"].includes(entry.level));
    assert.doesNotMatch(entry.message, /https?:|Bearer |ya29\.|1\/\//);
  }
});
