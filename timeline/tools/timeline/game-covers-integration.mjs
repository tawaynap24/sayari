import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-timeline") throw Error("Emulator-only tests");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
const { GameCoverService, COVER_REFRESH_MS, COVER_SCHEMA_VERSION } = require("./lib/gameCovers.js");
initializeApp({ projectId: "demo-timeline" });
const db = getFirestore(), id = randomUUID(), document = `maintenance/cover-test-${id}`, raceDoc = `maintenance/cover-race-${id}`;
let now = Date.now(), revision = "patch1", calls = 0, failKuro = false;
const request = async input => {
  calls++; const url = String(input);
  if (url.includes("kurogame.com") && failKuro) throw Error("provider unavailable");
  let body;
  const time = "Update Time: 2026/09/01 06:00 (UTC+8)";
  if (url.includes("getContentList")) body = { retcode: 0, data: { list: [{ sTitle: "Version 3.2 Update Details", dtStartTime: "2026-09-01 07:00:00", sContent: time,
    sExt: JSON.stringify(Object.fromEntries(["banner", "news-poster", "news-banner"].map(key => [key, [{ url: `https://fastcdn.hoyoverse.com/${revision}-${key}.webp` }]]))) }] } };
  else if (url.includes("MainMenu")) body = { article: [{ articleId: 1, articleTitle: "Patch Notes for Version 3.7", startTime: "2026-09-01 07:00:00" }] };
  else if (url.includes("/article/")) body = { articleId: 1, articleTitle: "Patch Notes for Version 3.7", startTime: "2026-09-01 07:00:00", articleContent: `${time}<img src="https://hw-media-cdn-mingchao.kurogame.com/${revision}.webp">` };
  else if (url.includes("/bulletin/")) body = { code: 0, data: { cid: "1", title: "[Ink] Version Update Notes", cover: `https://gl-utils-public.hg-cdn.com/${revision}.webp`, data: time } };
  else if (url.includes("/bulletin?")) body = { code: 0, data: { list: [{ cid: "1", title: "[Ink] Version Update Notes", displayTime: Date.parse("2026-09-01T00:00:00Z") / 1000 }] } };
  else body = { proxy_rsps: [{ get_latest_game_rsp: { version: "1.6.4" } }] };
  await new Promise(resolve => setTimeout(resolve, 20));
  return new Response(JSON.stringify(body));
};
const service = new GameCoverService(db, () => now, request, document), results = [];
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
let previous;
try {
  await check("first refresh stores five covers and a fifteen-minute expiry in Firestore", async () => {
    previous = await service.current(); assert.equal(Object.keys(previous.covers).length, 5);
    assert.equal(previous.schemaVersion, COVER_SCHEMA_VERSION);
    assert.equal(previous.nextCheckAt, now + COVER_REFRESH_MS); assert.equal(calls, 8);
  });
  await check("fresh cache does not repeatedly call upstream APIs", async () => {
    now += COVER_REFRESH_MS - 1; assert.deepEqual(await service.current(), previous); assert.equal(calls, 8);
  });
  await check("a new patch replaces all source image URLs after cache expiry without code changes", async () => {
    now += 2; revision = "patch2"; const next = await service.current();
    for (const cover of Object.values(next.covers)) { assert.ok(cover.url.includes("patch2")); assert.equal(cover.updatedAt, now); }
    previous = next;
  });
  await check("provider failure keeps its last successful image and retries after one minute", async () => {
    now += COVER_REFRESH_MS; failKuro = true; revision = "patch3";
    const next = await service.current();
    assert.equal(next.covers["wuthering-waves"].url, previous.covers["wuthering-waves"].url);
    assert.ok(next.covers["genshin-impact"].url.includes("patch3"));
    assert.deepEqual(next.failedProviders, ["wuthering-waves"]); assert.equal(next.nextCheckAt, now + 60000);
  });
  await check("concurrent cold requests share a refresh lease rather than multiplying upstream calls", async () => {
    calls = 0; failKuro = false;
    const race = new GameCoverService(db, () => now, request, raceDoc);
    await Promise.all(Array.from({ length: 8 }, () => race.current()));
    assert.equal(calls, 8); assert.equal(Object.keys((await race.current()).covers).length, 5);
  });
  await check("an older cache schema refreshes immediately even before its old expiry", async () => {
    calls = 0;
    await db.doc(document).set({ ...previous, schemaVersion: 0, nextCheckAt: now + COVER_REFRESH_MS });
    assert.equal((await service.current()).schemaVersion, COVER_SCHEMA_VERSION);
    assert.equal(calls, 8);
  });
  await check("real local HTTP function returns five released patch images, versions and maintenance times", async () => {
    const r = await fetch("http://127.0.0.1:5001/demo-timeline/asia-southeast1/timelineGameCovers", { signal: AbortSignal.timeout(45000) });
    assert.equal(r.status, 200); const live = await r.json();
    assert.equal(Object.keys(live.covers).length, 5); assert.deepEqual(live.failedProviders, []);
    assert.equal(live.schemaVersion, COVER_SCHEMA_VERSION);
    for (const cover of Object.values(live.covers)) {
      assert.ok(cover.version && cover.patchUpdatedAt > 0 && cover.patchUpdatedAt <= Date.now());
      assert.equal(cover.patchTimeKind, "maintenance-start");
    }
    await fs.mkdir("evidence/timeline", { recursive: true });
    await fs.writeFile("evidence/timeline/game-covers-live.json", JSON.stringify({ at: new Date().toISOString(), ...live }, null, 2));
  });
} finally {
  await db.doc(document).delete(); await db.doc(raceDoc).delete(); await db.terminate();
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/game-covers-integration.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
}
