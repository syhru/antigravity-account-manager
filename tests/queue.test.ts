import assert from "node:assert/strict";
import { test } from "node:test";
import { quotaOf, reconcile } from "../src/lib/queue";

test("active goes last; standby order survives sync and new accounts precede active", () => {
  const rows = [
    { id: "a", active: true },
    { id: "b", active: false },
    { id: "c", active: false },
  ];
  assert.deepEqual(reconcile(["b", "a"], rows), ["b", "c", "a"]);
});
test("weekly-only quota is supported without overriding five-hour zero", () => {
  assert.equal(quotaOf({ usage: { weekly: { remaining_percent: 100 } } }), 100);
  assert.equal(
    quotaOf({
      usage: {
        five_hour: { remaining_percent: 0 },
        weekly: { remaining_percent: 100 },
      },
    }),
    0,
  );
  assert.equal(
    quotaOf({
      usage_error: "refresh_failed",
      usage: { weekly: { remaining_percent: 100 } },
    }),
    null,
  );
});
test("quota unavailable is null, not fabricated full quota", () => {
  assert.equal(quotaOf({}), null);
  assert.equal(
    quotaOf({ usage: { five_hour: { remaining_percent: 42 } } }),
    42,
  );
});
