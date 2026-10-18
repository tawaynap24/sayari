import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { presenceContributions, presenceInput, PRESENCE_LEASE_MS }: typeof import("../../functions/src/presence") = require("../../functions/lib/presence.js");
const connection = (personKey: string, expiresAt = 1001, closed = false) => ({ personKey, expiresAt, closed, sequence: 1 });
test("presence deduplicates guest tabs in one browser", () => {
  assert.deepEqual(presenceContributions({ a: connection("g_browser"), b: connection("g_browser", 2000) }, 1000), { g_browser: 2000 });
});
test("presence signed-in tabs suppress the browser's old guest tab", () => {
  assert.deepEqual(presenceContributions({ a: connection("g_browser"), b: connection("m_account") }, 1000), { m_account: 1001 });
});
test("presence treats the exact expiry boundary as offline", () => {
  assert.deepEqual(presenceContributions({ a: connection("m_account", 1000), b: connection("g_browser", 2000) }, 1000), { g_browser: 2000 });
});
test("closed tabs cannot remain in online contributions", () => {
  assert.deepEqual(presenceContributions({ a: connection("m_account", 2000, true) }, 1000), {});
});
test("presence payload rejects forged UID, count and malformed identifiers", () => {
  const input = { visitorKey: "a".repeat(64), connectionId: "12345678-1234-4234-9234-123456789abc", sequence: 1, action: "heartbeat" };
  assert.ok(presenceInput.safeParse(input).success);
  for (const invalid of [{ ...input, uid: "admin" }, { ...input, total: 999 }, { ...input, visitorKey: "guess" }, { ...input, sequence: -1 }])
    assert.equal(presenceInput.safeParse(invalid).success, false);
  assert.equal(PRESENCE_LEASE_MS, 120000);
});
