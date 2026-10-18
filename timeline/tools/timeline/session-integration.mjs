import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocFromServer, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
const { SessionService } = require("./lib/session.js");
const { SESSION_MAX_AGE_MS } = require("./lib/domain/session.js");
const projectId = "demo-timeline";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw Error("Emulator-only tests");
Object.assign(process.env, { GCLOUD_PROJECT: projectId, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" });
initializeApp({ projectId });
const db = getFirestore(), runId = randomUUID();
let now = Date.now();
const service = new SessionService(db, () => now);
const uid = `session_${runId}`, authTime = Math.floor(now / 1000), token = { uid, auth_time: authTime };
const results = [];
async function run(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); console.error(`FAIL ${name}: ${e.stack}`); }
}
try {
  await run("initial login receives three days and returning renews from server time", async () => {
    const first = await service.renew(token);
    assert.equal(first.expiresAt, now + SESSION_MAX_AGE_MS);
    now += 2 * 86400000;
    const next = await service.renew(token);
    assert.equal(next.expiresAt, now + SESSION_MAX_AGE_MS);
    assert.ok(next.expiresAt > first.expiresAt);
  });
  await run("active rolling session survives beyond original authentication age", async () => {
    now += 2 * 86400000;
    await service.require(token);
    assert.equal((await service.renew(token)).expiresAt, now + SESSION_MAX_AGE_MS);
  });
  await run("three idle days expire exactly and an old refreshed token cannot renew", async () => {
    now += SESSION_MAX_AGE_MS;
    await assert.rejects(() => service.require(token), e => e.code === "unauthenticated");
    await assert.rejects(() => service.renew(token), e => e.code === "unauthenticated");
    const fresh = { uid, auth_time: Math.floor(now / 1000) };
    await service.renew(fresh); await service.require(fresh);
  });
  await run("Firestore and Storage grant fresh lease and reject expired lease or counter tampering", async () => {
    const env = await initializeTestEnvironment({ projectId,
      firestore: { host: "127.0.0.1", port: 8080, rules: await fs.readFile("firestore.rules", "utf8") },
      storage: { host: "127.0.0.1", port: 9199, rules: await fs.readFile("storage.rules", "utf8") },
    });
    const started = Math.floor(Date.now() / 1000), owner = `rules_${runId}`;
    const leaseRef = db.doc(`users/${owner}/authSessions/${started}`);
    await db.doc(`users/${owner}`).set({ displayName: "Test" });
    await leaseRef.set({ expiresAt: Date.now() + SESSION_MAX_AGE_MS });
    const topicId = `session_rules_${runId}`;
    const context = env.authenticatedContext(owner, { auth_time: started });
    try {
      const client = context.firestore();
      await assertSucceeds(getDoc(doc(client, `users/${owner}`)));
      await assertFails(setDoc(doc(client, leaseRef.path), { expiresAt: Date.now() + 999999999999 }));
      for (const [id, expired] of [[`fresh_${runId}`, false], [`expired_${runId}`, true]]) {
        await db.doc(`media/${id}`).set({ ownerUid: owner, topicId, draftId: "fixture", status: "staging", sizeBytes: 3, mimeType: "image/png", interestExpiresAt: Date.now() + 604800000 });
        const upload = () => uploadBytes(ref(context.storage(`gs://${projectId}.appspot.com`), `staging/${owner}/fixture/${id}`), new Uint8Array([1, 2, 3]), { contentType: "image/png" });
        if (!expired) await assertSucceeds(upload());
        else { await leaseRef.update({ expiresAt: Date.now() - 1 }); await assertFails(upload()); }
      }
      const expiredClient = env.authenticatedContext(owner, { auth_time: started }).firestore();
      await assertFails(getDocFromServer(doc(expiredClient, `users/${owner}`)));
      await assertSucceeds(getDoc(doc(client, leaseRef.path)));
    } finally { await env.cleanup(); }
  });
  await run("real callable requires lease bootstrap, renews it, and refuses revival after idle expiry", async () => {
    const signup = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `session-${runId}@example.test`, password: "Test-local-12345", returnSecureToken: true }) });
    const account = await signup.json(); assert.ok(account.idToken);
    const claims = JSON.parse(Buffer.from(account.idToken.split(".")[1], "base64url").toString());
    const call = async (name, data) => {
      const res = await fetch(`http://127.0.0.1:5001/demo-timeline/asia-southeast1/${name}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.idToken}` }, body: JSON.stringify({ data }) });
      return { status: res.status, body: await res.json() };
    };
    assert.equal((await call("timelineApi", {})).status, 401);
    assert.equal((await call("timelineSession", { action: "renew" })).status, 200);
    assert.equal((await call("timelineApi", {})).status, 400);
    await db.doc(`users/${account.localId}/authSessions/${claims.auth_time}`).update({ expiresAt: Date.now() - 1 });
    assert.equal((await call("timelineApi", {})).status, 401);
    assert.equal((await call("timelineSession", { action: "renew" })).status, 401);
  });
} finally {
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/session-integration.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  await db.terminate();
}
console.log(`${results.filter(r => r.status === "PASS").length}/${results.length} session integration scenarios PASS`);
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
