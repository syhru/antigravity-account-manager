import assert from "node:assert/strict";
import { test } from "node:test";
import { guard } from "../src/lib/http";

test("local read accepted", () =>
  assert.doesNotThrow(() =>
    guard(new Request("http://localhost:3000/api/accounts")),
  ));
test("foreign origin rejected", () =>
  assert.throws(() =>
    guard(
      new Request("http://localhost:3000/api/actions", {
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      true,
    ),
  ));
test("mutation requires origin", () =>
  assert.throws(() =>
    guard(
      new Request("http://localhost:3000/api/actions", {
        headers: { "content-type": "application/json" },
      }),
      true,
    ),
  ));
test("valid same-origin JSON mutation accepted", () =>
  assert.doesNotThrow(() =>
    guard(
      new Request("http://localhost:3000/api/actions", {
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
      }),
      true,
    ),
  ));
