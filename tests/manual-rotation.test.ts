import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/app/page.tsx", "utf8");
test("refresh interval is 30 seconds", () => assert.match(page, /30000/));
test("countdown and expiry-triggered rotation removed", () => {
  assert.doesNotMatch(
    page,
    /expiryAttempted|Sisa Waktu Sesi|remaining === 0|sessionEndsAt/,
  );
});
test("last successful refresh is visible", () =>
  assert.match(page, /Terakhir diperbarui/));
