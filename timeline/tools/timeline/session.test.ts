import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SESSION_MAX_AGE_MS, sessionDeadline, sessionIsCurrent }: typeof import("../../functions/src/domain/session") = require("../../functions/lib/domain/session.js");
test("session idle period is exactly three days", () => {
  assert.equal(SESSION_MAX_AGE_MS, 259200000);
});
test("legacy/new login bootstrap expires at the exact three-day boundary", () => {
  const authTime = 1700000000, deadline = sessionDeadline(authTime)!;
  assert.equal(sessionIsCurrent(authTime, deadline - 1), true);
  assert.equal(sessionIsCurrent(authTime, deadline), false);
});
test("session policy rejects missing, malformed and far-future authentication times", () => {
  for (const value of [null, undefined, "1700000000", -1, 1.5, Number.MAX_SAFE_INTEGER])
    assert.equal(sessionDeadline(value), null);
  assert.equal(sessionIsCurrent(1700000061, 1700000000000), false);
});
