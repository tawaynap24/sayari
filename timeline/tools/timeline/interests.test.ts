import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { interestActivity, interestIsCurrent, INTEREST_MAX_AGE_MS }: typeof import("../../functions/src/domain/interest") = require("../../functions/lib/domain/interest.js");

test("topic interest expires at exactly seven days, including the boundary millisecond", () => {
  const start = 1700000000000;
  const interest = interestActivity(start);
  assert.equal(INTEREST_MAX_AGE_MS, 604800000);
  assert.equal(interestIsCurrent(interest, start + 604800000 - 1), true);
  assert.equal(interestIsCurrent(interest, start + 604800000), false);
});

test("renewal rolls the topic deadline from the latest recorded foreground visit", () => {
  const start = 1700000000000;
  const renewed = interestActivity(start + 2 * 86400000);
  assert.equal(renewed.lastActiveAt, start + 2 * 86400000);
  assert.equal(renewed.expiresAt, start + 9 * 86400000);
});

test("missing memberships and malformed deadlines fail closed; legacy memberships await grace migration", () => {
  assert.equal(interestIsCurrent(null, 1000), false);
  for (const expiresAt of [NaN, Infinity, -1, 2.5, null, "9999999"])
    assert.equal(interestIsCurrent({ expiresAt: expiresAt as number }, 1000), false);
  assert.equal(interestIsCurrent({}, 1000), true);
});
