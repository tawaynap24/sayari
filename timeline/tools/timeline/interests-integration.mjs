import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { cleanupTopicFixtures } from "./fixtures.mjs";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { TimelineService } = require("./lib/service.js");
const { InterestService } = require("./lib/interests.js");
const { prepareUpload, finalizeUpload, readMedia } = require("./lib/media.js");
const { INTEREST_MAX_AGE_MS: WEEK } = require("./lib/domain/interest.js");
const projectId = "demo-timeline";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw Error("Emulator-only tests");
Object.assign(process.env, { GCLOUD_PROJECT: projectId, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" });
initializeApp({ projectId });
const db = getFirestore(), runId = Date.now().toString(36), topics = [], uids = new Set(), authUids = [], results = [];
let now = Date.now();
const svc = new TimelineService(db, () => now), interests = svc.interests;
const actor = i => { const uid = `interest_${runId}_${i}`; uids.add(uid); return { uid, label: `Test ${i}`, privileged: false }; };
const call = (who, action, data) => svc.run(who, { action, data, operationId: randomUUID() });
const member = (topic, who) => db.doc(`topics/${topic}/interests/${who.uid}`);
const reverse = (topic, who) => db.doc(`users/${who.uid}/followedTopics/${topic}`);
const content = { titleTh: "Synthetic interest test", summaryTh: "", bodyTh: "Emulator fixture only", time: { type: "unknown", noteTh: "" }, namedEntityIds: [], sources: [], media: [], gameVersion: "test", locale: "th-TH" };
async function topic() {
  const id = `test_${runId}_${topics.length + 1}`; topics.push(id);
  await db.doc(`topics/${id}`).set({ id, slug: id, categoryId: "test", displayNames: { "th-TH": "หัวข้อทดสอบ" }, descriptionTh: "SYNTHETIC EMULATOR ONLY", calendar: { id: "symbolic-test" }, publishedCount: 0, interestCount: 0 });
  await db.doc(`topicStats/${id}`).set({ interestCount: 0, graphVersion: 0 });
  return id;
}
async function counts(id, expected) {
  assert.equal((await db.doc(`topicStats/${id}`).get()).get("interestCount"), expected);
  const publicTopic = await db.doc(`topics/${id}`).get();
  assert.equal(publicTopic.get("interestCount"), expected);
}
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); console.error(`FAIL ${name}: ${e.stack}`); }
}
const env = await initializeTestEnvironment({ projectId,
  firestore: { host: "127.0.0.1", port: 8080, rules: await fs.readFile("firestore.rules", "utf8") },
  storage: { host: "127.0.0.1", port: 9199, rules: await fs.readFile("storage.rules", "utf8") },
});
try {
  await check("only the visited topic renews; exact seven-day removal deletes both memberships and updates both counts", async () => {
    now = Date.now();
    const a = await topic(), b = await topic(), who = actor(0), start = now;
    await call(who, "followTopic", { topicId: a }); await call(who, "followTopic", { topicId: b });
    now += 6 * 86400000;
    const renewed = await interests.visit(who.uid, a);
    assert.equal(renewed.expiresAt, now + WEEK);
    assert.equal((await member(b, who).get()).get("expiresAt"), start + WEEK);
    now = start + WEEK - 1;
    assert.equal(await interests.expireMember(b, who.uid), false);
    now++;
    assert.equal(await interests.expireMember(b, who.uid), true);
    assert.equal(await interests.expireMember(b, who.uid), false);
    assert.equal((await reverse(b, who).get()).exists, false);
    assert.equal((await member(a, who).get()).exists, true);
    await counts(a, 1); await counts(b, 0);
    assert.equal((await db.doc(`topics/${b}`).get()).get("timelineUpdatedAt"), undefined);
    assert.equal((await interests.visit(who.uid, b)).followed, false);
    await counts(b, 0);
    await Promise.all(Array.from({ length: 4 }, () => call(who, "followTopic", { topicId: b })));
    await counts(b, 1);
    assert.equal((await member(b, who).get()).get("followedAt"), now);
  });
  await check("stale sweep candidates recheck renewed leases; expiry and explicit re-follow cannot double count", async () => {
    now = Date.now();
    const id = await topic(), who = actor(1);
    await call(who, "followTopic", { topicId: id });
    now += WEEK - 1;
    await interests.visit(who.uid, id);
    now++;
    assert.equal(await interests.expireMember(id, who.uid), false);
    const renewed = (await member(id, who).get()).get("lastActiveAt");
    await interests.visit(who.uid, id);
    assert.equal((await member(id, who).get()).get("lastActiveAt"), renewed);
    now += WEEK;
    await Promise.all([interests.expireMember(id, who.uid), call(who, "followTopic", { topicId: id })]);
    await counts(id, 1);
    assert.equal((await member(id, who).get()).get("expiresAt"), now + WEEK);
  });
  await check("concurrent and repeated expiration decrements once per account and never below zero", async () => {
    now = Date.now();
    const id = await topic(), a = actor(2), b = actor(3);
    await call(a, "followTopic", { topicId: id }); await call(b, "followTopic", { topicId: id });
    now += WEEK;
    const removed = await Promise.all([interests.expireMember(id, a.uid), interests.expireMember(id, a.uid), interests.expireMember(id, b.uid)]);
    assert.equal(removed.filter(Boolean).length, 2);
    await counts(id, 0);
  });
  await check("expired members cannot create or vote before cleanup; existing vote-round snapshots and votes remain unchanged", async () => {
    now = Date.now();
    const id = await topic(), owner = actor(4), voter = actor(5);
    await call(owner, "followTopic", { topicId: id }); await call(voter, "followTopic", { topicId: id });
    // Synthetic aggregate models a 50-account community; no real topic is changed.
    await db.doc(`topicStats/${id}`).update({ interestCount: 50 });
    await db.doc(`topics/${id}`).update({ interestCount: 50 });
    const created = await call(owner, "createStory", { topicId: id, content });
    const requestRef = db.doc(`requests/${created.requestId}`), request = (await requestRef.get()).data();
    await call(voter, "castVote", { requestId: created.requestId, roundId: request.currentVoteRoundId, choice: "yes" });
    await member(id, voter).update({ expiresAt: now });
    await assert.rejects(() => call(voter, "createStory", { topicId: id, content }), e => e.code === "permission-denied");
    await assert.rejects(() => call(voter, "castVote", { requestId: created.requestId, roundId: request.currentVoteRoundId, choice: "no" }), e => e.code === "permission-denied");
    await interests.expireMember(id, voter.uid);
    const after = (await requestRef.get()).data();
    assert.equal(after.requiredVotes, request.requiredVotes); assert.equal(after.interestSnapshot, 50); assert.equal(after.yesCount, 1);
    assert.equal((await db.doc(`topics/${id}`).get()).get("timelineUpdatedAt"), undefined);
    await counts(id, 49);
  });
  await check("rules and media deny expired membership immediately; own lease remains readable and public content stays public", async () => {
    now = Date.now();
    const id = await topic(), who = actor(6), owner = actor(7), started = Math.floor(now / 1000);
    await call(who, "followTopic", { topicId: id }); await call(owner, "followTopic", { topicId: id });
    await db.doc(`users/${who.uid}/authSessions/${started}`).set({ expiresAt: now + 259200000 });
    const client = env.authenticatedContext(who.uid, { auth_time: started }).firestore();
    await assertSucceeds(getDocFromServer(doc(client, `topicStats/${id}`)));
    await assertFails(setDoc(doc(client, member(id, who).path), { expiresAt: now + 999999999999 }));
    await member(id, who).update({ expiresAt: Date.now() - 1 });
    const expired = env.authenticatedContext(who.uid, { auth_time: started });
    const expiredClient = expired.firestore();
    await assertFails(getDocFromServer(doc(expiredClient, `topicStats/${id}`)));
    await assertSucceeds(getDocFromServer(doc(expiredClient, member(id, who).path)));
    await assertSucceeds(getDocFromServer(doc(env.unauthenticatedContext().firestore(), `topics/${id}`)));
    const mediaId = `interest_media_${runId}`, storyId = `interest_story_${runId}`;
    const media = db.doc(`media/${mediaId}`), story = db.doc(`stories/${storyId}`);
    try {
      await media.set({ ownerUid: who.uid, topicId: id, draftId: "fixture", status: "staging", sizeBytes: 3, mimeType: "image/png", interestExpiresAt: Date.now() - 1 });
      await assertFails(uploadBytes(ref(expired.storage(`gs://${projectId}.appspot.com`), `staging/${who.uid}/fixture/${mediaId}`), new Uint8Array([1, 2, 3]), { contentType: "image/png" }));
      await assert.rejects(() => prepareUpload(db, who, { topicId: id, draftId: "fixture", name: "test.png", mimeType: "image/png", sizeBytes: 3 }), e => e.code === "permission-denied");
      await assert.rejects(() => finalizeUpload(db, who, { mediaId }), e => e.code === "permission-denied");
      await story.set({ topicId: id, restricted: false });
      await media.update({ status: "ready", ownerUid: owner.uid, storyId });
      await assert.rejects(() => readMedia(db, mediaId, who.uid), e => e.code === "permission-denied");
      await assert.doesNotReject(() => readMedia(db, mediaId, owner.uid));
    } finally { await media.delete(); await story.delete(); }
  });
  await check("scheduled query removes due leases and leaves future leases alone", async () => {
    now = Date.now();
    const id = await topic(), a = actor(8), b = actor(9);
    await call(a, "followTopic", { topicId: id }); await call(b, "followTopic", { topicId: id });
    await member(id, a).update({ expiresAt: Date.now() - 1 });
    const realtime = new InterestService(db);
    assert.ok(await realtime.expireStale() >= 1);
    assert.equal((await member(id, a).get()).exists, false);
    assert.equal((await member(id, b).get()).exists, true);
    await counts(id, 1);
  });
  await check("legacy migration resumes by page, grants seven days once, and preserves existing active deadlines", async () => {
    // Separate demo namespace isolates the migration checkpoint from the running site.
    const migrationProject = `demo-interest-${runId}`;
    const app = initializeApp({ projectId: migrationProject }, migrationProject), isolated = getFirestore(app);
    let migrationNow = Date.now();
    const migration = new InterestService(isolated, () => migrationNow), checkpoint = isolated.doc("maintenance/interestActivityV1");
    try {
      for (const uid of ["a", "b", "c"]) await isolated.doc(`topics/fixture/interests/${uid}`).set({ uid, followedAt: 1, ...(uid === "c" ? { lastActiveAt: migrationNow, expiresAt: migrationNow + 2 * WEEK } : {}) });
      assert.deepEqual(await migration.migrateLegacyPage(1), { initialized: 1, complete: false });
      const first = (await isolated.doc("topics/fixture/interests/a").get()).data();
      assert.equal(first.followedAt, 1); assert.equal(first.expiresAt, migrationNow + WEEK);
      migrationNow += 86400000;
      assert.deepEqual(await migration.migrateLegacyPage(1), { initialized: 1, complete: false });
      assert.deepEqual(await migration.migrateLegacyPage(2), { initialized: 0, complete: true });
      assert.deepEqual(await migration.migrateLegacyPage(), { initialized: 0, complete: true });
      assert.equal((await isolated.doc("topics/fixture/interests/a").get()).get("expiresAt"), first.expiresAt);
      assert.equal((await isolated.doc("topics/fixture/interests/c").get()).get("expiresAt"), migrationNow - 86400000 + 2 * WEEK);
      assert.equal((await isolated.doc("users/b/followedTopics/fixture").get()).get("expiresAt"), migrationNow + WEEK);
    } finally {
      for (const uid of ["a", "b", "c"]) await isolated.recursiveDelete(isolated.doc(`users/${uid}`));
      await isolated.recursiveDelete(isolated.doc("topics/fixture")); await checkpoint.delete();
      await isolated.terminate(); await deleteApp(app);
    }
  });
  await check("real activity callable requires login/session, validates input, renews one topic and never silently re-follows", async () => {
    now = Date.now(); const id = await topic();
    const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `interest-${runId}@example.test`, password: "Local-test-12345", returnSecureToken: true }) });
    const account = await signup.json(); assert.ok(account.idToken); authUids.push(account.localId); uids.add(account.localId);
    const who = { uid: account.localId, label: "Synthetic", privileged: false };
    const http = async (name, data, token = account.idToken) => {
      const response = await fetch(`http://127.0.0.1:5001/${projectId}/asia-southeast1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data }) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await http("timelineTopicActivity", { topicId: id }, null)).status, 401);
    assert.equal((await http("timelineTopicActivity", { topicId: id })).status, 401);
    assert.equal((await http("timelineSession", { action: "renew" })).status, 200);
    assert.equal((await http("timelineTopicActivity", { topicId: id, lastActiveAt: now })).status, 400);
    assert.equal((await http("timelineTopicActivity", { topicId: id })).body.result.followed, false);
    await call(who, "followTopic", { topicId: id });
    await member(id, who).update({ lastActiveAt: now - 3600000, expiresAt: now + WEEK - 3600000 });
    assert.equal((await http("timelineTopicActivity", { topicId: id })).body.result.followed, true);
    assert.ok((await member(id, who).get()).get("lastActiveAt") >= now);
    await member(id, who).update({ expiresAt: Date.now() - 1 });
    assert.equal((await http("timelineTopicActivity", { topicId: id })).body.result.followed, false);
    assert.equal((await member(id, who).get()).exists, false); await counts(id, 0);
    assert.equal((await http("timelineTopicActivity", { topicId: id })).body.result.followed, false);
    await counts(id, 0);
  });
} finally {
  await cleanupTopicFixtures(db, topics);
  for (const uid of uids) {
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db.doc(`writeLimits/${uid}`).delete(); await db.doc(`uploadLimits/${uid}`).delete();
    const audits = await db.collection("auditLog").where("actorUid", "==", uid).get();
    for (const audit of audits.docs) await audit.ref.delete();
  }
  for (const uid of authUids) await getAuth().deleteUser(uid);
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/interests-integration.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  await env.cleanup(); await db.terminate();
}
console.log(`${results.filter(r => r.status === "PASS").length}/${results.length} interest integration scenarios PASS`);
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
