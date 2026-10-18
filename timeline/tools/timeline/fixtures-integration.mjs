import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { assertFixtureEmulator, cleanupTopicFixtures, isTopicFixture } from "./fixtures.mjs";

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-timeline")
  throw Error("Emulator-only tests");
Object.assign(process.env, {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
});
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
initializeApp({ projectId: "demo-timeline", storageBucket: "demo-timeline.appspot.com" });
const db = getFirestore(), bucket = getStorage().bucket();
const run = randomUUID().replaceAll("-", ""), id = `test_${run}_1`, peer = `test_${run}_2`, mismatch = `test_${run}_3`;
const metadata = key => ({ id: key, slug: key, categoryId: "test", descriptionTh: "SYNTHETIC EMULATOR ONLY", calendar: { id: "symbolic-test" } });
const normal = await db.doc("topics/community").get();
const results = [];
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); console.error(`FAIL ${name}: ${e.message}`); }
}
try {
  await check("cleanup refuses cloud projects, nonlocal endpoints and ordinary topics", async () => {
    assert.throws(() => assertFixtureEmulator({ projectId: "production" }));
    const host = process.env.FIRESTORE_EMULATOR_HOST;
    try {
      process.env.FIRESTORE_EMULATOR_HOST = "example.com:8080";
      assert.throws(() => assertFixtureEmulator(db));
    } finally { process.env.FIRESTORE_EMULATOR_HOST = host; }
    await assert.rejects(() => cleanupTopicFixtures(db, ["community"], bucket));
    assert.equal(isTopicFixture(id, { ...metadata(id), descriptionTh: "Ordinary content" }), false);
    await db.doc(`topics/${mismatch}`).set({ ...metadata(mismatch), descriptionTh: "Ordinary content" });
    await assert.rejects(() => cleanupTopicFixtures(db, [mismatch], bucket));
    assert.equal((await db.doc(`topics/${mismatch}`).get()).exists, true);
  });
  await check("finally removes nested fixture content and media after a test throws", async () => {
    await db.doc(`topics/${id}`).set(metadata(id));
    await db.doc(`topics/${peer}`).set(metadata(peer));
    const paths = [`topics/${id}/interests/fixture`, `topicStats/${id}`, `users/fixture_${run}/followedTopics/${id}`];
    for (const collection of ["publicStories", "stories", "requests", "namedEntities", "abuseReports"])
      paths.push(`${collection}/${run}`, `${collection}/${run}/nested/fixture`);
    for (const path of paths) await db.doc(path).set({ topicId: id });
    const stage = `staging/fixture_${run}/draft/${run}`, validated = `validated/${run}/${"a".repeat(64)}`;
    await db.doc(`media/${run}`).set({ topicId: id, ownerUid: `fixture_${run}`, draftId: "draft", path: stage, validatedPath: validated });
    await bucket.file(stage).save(Buffer.from("test"), { resumable: false });
    await bucket.file(validated).save(Buffer.from("test"), { resumable: false });
    await assert.rejects(async () => {
      try { throw Error("simulated test failure"); }
      finally { assert.deepEqual(await cleanupTopicFixtures(db, [id], bucket), [id]); }
    }, /simulated test failure/);
    for (const path of [...paths, `topics/${id}`, `media/${run}`])
      assert.equal((await db.doc(path).get()).exists, false, path);
    assert.equal((await bucket.file(stage).exists())[0], false);
    assert.equal((await bucket.file(validated).exists())[0], false);
  });
  await check("cleanup preserves another test run and the original community topic", async () => {
    assert.equal((await db.doc(`topics/${peer}`).get()).exists, true);
    assert.deepEqual((await db.doc("topics/community").get()).data(), normal.data());
    assert.deepEqual(await cleanupTopicFixtures(db, [id], bucket), []);
  });
} finally {
  try {
    await cleanupTopicFixtures(db, [id, peer], bucket);
    await db.recursiveDelete(db.doc(`topics/${mismatch}`));
    await db.recursiveDelete(db.doc(`users/fixture_${run}`));
    await fs.mkdir("evidence/timeline", { recursive: true });
    await fs.writeFile("evidence/timeline/fixtures-integration.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  } finally { await db.terminate(); }
}
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
