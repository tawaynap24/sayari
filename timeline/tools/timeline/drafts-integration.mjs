import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { ref, uploadBytes } from "firebase/storage";
import { cleanupTopicFixtures, assertFixtureEmulator } from "./fixtures.mjs";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore"), { getStorage } = require("firebase-admin/storage");
const { TimelineService } = require("./lib/service.js"), { prepareUpload, finalizeUpload, readMedia } = require("./lib/media.js");
Object.assign(process.env, { GCLOUD_PROJECT: "demo-timeline", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" });
initializeApp({ projectId: "demo-timeline", storageBucket: "demo-timeline.appspot.com" });
const db = getFirestore(), bucket = getStorage().bucket(), runId = Date.now().toString(36), topicId = `browser-${runId}draftapi`;
assertFixtureEmulator(db);
const who = { uid: `draft_api_${runId}`, label: "Draft test", privileged: false }, svc = new TimelineService(db), results = [];
const authTime = Math.floor(Date.now() / 1000);
const env = await initializeTestEnvironment({ projectId: "demo-timeline", firestore: { host: "127.0.0.1", port: 8080, rules: await fs.readFile("firestore.rules", "utf8") }, storage: { host: "127.0.0.1", port: 9199, rules: await fs.readFile("storage.rules", "utf8") } });
const store = env.authenticatedContext(who.uid, { auth_time: authTime }).storage("gs://demo-timeline.appspot.com");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF7sAAAAASUVORK5CYII=", "base64");
const data = { topicId, draftId: "draft_fixture", uploadId: "file_0", name: "draft.png", mimeType: "image/png", sizeBytes: png.length };
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); console.error(`FAIL ${name}: ${e.stack}`); }
}
try {
  await db.doc(`topics/${topicId}`).set({ id: topicId, slug: topicId, categoryId: "test", displayNames: { "th-TH": "Draft API" }, descriptionTh: "SYNTHETIC — Emulator only", calendar: { id: "browser-symbolic" }, publishedCount: 0, interestCount: 0 });
  await svc.run(who, { action: "followTopic", operationId: randomUUID(), data: { topicId } });
  await db.doc(`users/${who.uid}/authSessions/${authTime}`).set({ expiresAt: Date.now() + 259200000 });
  await check("parallel prepare retries reuse one descriptor and one upload-rate slot", async () => {
    const prepared = await Promise.all(Array.from({ length: 3 }, () => prepareUpload(db, who, data)));
    assert.equal(new Set(prepared.map(p => p.id)).size, 1);
    assert.equal((await db.doc(`uploadLimits/${who.uid}`).get()).get("count"), 1);
    assert.equal(prepared[0].status, "staging"); assert.equal(prepared[0].uploaded, false);
    await assert.rejects(() => prepareUpload(db, who, { ...data, name: "different.png" }), e => e.code === "failed-precondition");
  });
  await check("recovery detects uploaded bytes and a lost finalization response without duplicate files", async () => {
    const first = await prepareUpload(db, who, data);
    await assertSucceeds(uploadBytes(ref(store, first.path), png, { contentType: "image/png" }));
    const resumed = await prepareUpload(db, who, data); assert.equal(resumed.uploaded, true);
    const ready = await finalizeUpload(db, who, { mediaId: first.id }); assert.equal(ready.kind, "image");
    const recovered = await prepareUpload(db, who, data); assert.equal(recovered.status, "ready"); assert.equal(recovered.id, first.id);
    assert.equal((await db.collection("media").where("topicId", "==", topicId).get()).size, 1);
    assert.equal((await db.doc(`uploadLimits/${who.uid}`).get()).get("count"), 1);
  });
  await check("an orphaned draft can start a fresh upload generation after server cleanup", async () => {
    const old = await prepareUpload(db, who, data), descriptor = db.doc(`media/${old.id}`), saved = (await descriptor.get()).data();
    assert.equal(saved.ownerUid, who.uid); assert.equal(saved.topicId, topicId);
    for (const path of [saved.path, saved.validatedPath].filter(Boolean)) await bucket.file(path).delete({ ignoreNotFound: true });
    await descriptor.update({ status: "deleted", deletedAt: Date.now() });
    assert.equal((await prepareUpload(db, who, data)).status, "expired");
    const next = await prepareUpload(db, who, { ...data, uploadId: "file_1" }); assert.notEqual(next.id, old.id);
    await assertSucceeds(uploadBytes(ref(store, next.path), png, { contentType: "image/png" }));
    assert.equal((await finalizeUpload(db, who, { mediaId: next.id })).kind, "image");
  });
  await check("DOCX is denied at prepare, Storage and finalize while existing published metadata remains readable", async () => {
    const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await assert.rejects(() => prepareUpload(db, who, { ...data, uploadId: "word", name: "draft.docx", mimeType }));
    await assert.rejects(() => prepareUpload(db, who, { ...data, uploadId: "spoof", name: "draft.docx" }));
    const id = `legacy_docx_${runId}`, path = `staging/${who.uid}/draft_fixture/${id}`;
    await db.doc(`media/${id}`).set({ id, topicId, ownerUid: who.uid, draftId: "draft_fixture", name: "legacy.docx", path, kind: "docx", mimeType, sizeBytes: 3, status: "staging", interestExpiresAt: Date.now() + 604800000 });
    await assertFails(uploadBytes(ref(store, path), new Uint8Array([1, 2, 3]), { contentType: mimeType }));
    await assert.rejects(() => finalizeUpload(db, who, { mediaId: id }), e => e.code === "invalid-argument");
    await db.doc(`media/${id}`).update({ status: "ready", docText: "Legacy text" });
    assert.equal((await readMedia(db, id, who.uid)).m.docText, "Legacy text");
  });
} finally {
  await cleanupTopicFixtures(db, [topicId], bucket);
  await db.recursiveDelete(db.doc(`users/${who.uid}`)); await db.doc(`writeLimits/${who.uid}`).delete(); await db.doc(`uploadLimits/${who.uid}`).delete();
  const audits = await db.collection("auditLog").where("actorUid", "==", who.uid).get(); for (const audit of audits.docs) await audit.ref.delete();
  await fs.mkdir("evidence/timeline", { recursive: true }); await fs.writeFile("evidence/timeline/drafts-integration.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  await env.cleanup(); await db.terminate();
}
console.log(`${results.filter(r => r.status === "PASS").length}/${results.length} draft integration scenarios PASS`);
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
