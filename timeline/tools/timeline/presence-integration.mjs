import { createRequire } from "node:module";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc } from "firebase/firestore";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { PresenceService, PRESENCE_LEASE_MS } = require("./lib/presence.js");
const projectId = "demo-timeline";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw Error("Emulator-only tests");
Object.assign(process.env, { GCLOUD_PROJECT: projectId, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" });
initializeApp({ projectId });
const db = getFirestore();
const runId = randomUUID().replaceAll("-", "");
const prefix = `testPresence_${runId}_`;
let now = Date.now();
const service = new PresenceService(db, () => now, prefix);
const key = () => randomBytes(32).toString("hex");
const request = (visitorKey, connectionId = randomUUID(), sequence = 1, action = "heartbeat") => ({ visitorKey, connectionId, sequence, action });
const stats = async () => {
  const s = (await db.doc(`${prefix}siteStats/online`).get()).data();
  return { total: s?.total || 0, signedIn: s?.signedIn || 0 };
};
const expect = async (total, signedIn) => assert.deepEqual(await stats(), { total, signedIn });
const results = [];
const run = async (name, callback) => {
  try { await callback(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: "FAIL", error: error.stack }); console.error(`FAIL ${name}: ${error.stack}`); }
};
const a = key(), b = key(), tab1 = randomUUID(), tab2 = randomUUID(), tab3 = randomUUID();
try {
  await run("guest tabs deduplicate and a second browser adds one visitor", async () => {
    await service.update(null, request(a, tab1));
    await service.update(null, request(a, tab2));
    await expect(1, 0);
    await service.update(null, request(b, tab3));
    await expect(2, 0);
  });
  await run("login replaces the browser guest contribution without double counting", async () => {
    await service.update("account", request(a, tab1, 2));
    await expect(2, 1);
    await service.update("account", request(a, tab2, 2));
    await expect(2, 1);
  });
  await run("one account across browsers counts once, closing one tab keeps it online", async () => {
    await service.update("account", request(b, tab3, 2));
    await expect(1, 1);
    await service.update("account", request(a, tab1, 3, "leave"));
    await expect(1, 1);
    await service.update("account", request(a, tab2, 3, "leave"));
    await expect(1, 1);
  });
  await run("logout becomes a guest and a delayed heartbeat cannot restore a closed tab", async () => {
    await service.update(null, request(b, tab3, 3));
    await expect(1, 0);
    await service.update("account", request(a, tab1, 2));
    await service.update("account", request(a, tab1, 4));
    await expect(1, 0);
  });
  await run("leave before initial heartbeat remains closed and duplicate leave is idempotent", async () => {
    const c = key(), tab = randomUUID();
    await service.update(null, request(c, tab, 2, "leave"));
    await service.update(null, request(c, tab, 1));
    await service.update(null, request(c, tab, 2, "leave"));
    await expect(1, 0);
  });
  await run("server clock expiry handles a lost connection at the exact lease boundary", async () => {
    now += PRESENCE_LEASE_MS;
    await service.expireStale();
    await expect(0, 0);
    assert.equal(await service.expireStale(), 0);
  });
  await run("concurrent guest arrivals and duplicate heartbeats preserve exact counters", async () => {
    const clients = Array.from({ length: 10 }, () => request(key()));
    await Promise.all(clients.map(data => service.update(null, data)));
    await expect(10, 0);
    await Promise.all(clients.map(data => service.update(null, { ...data, sequence: 2 })));
    await expect(10, 0);
    now += PRESENCE_LEASE_MS;
    await service.expireStale();
    await expect(0, 0);
  });
  await run("public aggregate is readable; visitor records, identities and client writes are private", async () => {
    const environment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules: await fs.readFile("firestore.rules", "utf8") } });
    try {
      const guest = environment.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(guest, "siteStats/online")));
      await assertFails(getDocs(collection(guest, "siteStats")));
      for (const path of ["siteStats/online", "presenceVisitors/secret", "presencePeople/secret"]) {
        await assertFails(setDoc(doc(guest, path), { total: 999 }));
        if (!path.startsWith("siteStats")) await assertFails(getDoc(doc(guest, path)));
      }
    } finally { await environment.cleanup(); }
  });
  await run("callable rejects forged identities and derives member identity from verified Auth", async () => {
    const url = "http://127.0.0.1:5001/demo-timeline/asia-southeast1/timelinePresence";
    const fake = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...request(key()), uid: "spoofed" } }) });
    assert.equal(fake.status, 400);
    const signup = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `presence-${runId}@example.test`, password: "Local-test-12345", returnSecureToken: true }) });
    const account = await signup.json(); assert.ok(account.idToken);
    const lease = await fetch("http://127.0.0.1:5001/demo-timeline/asia-southeast1/timelineSession", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.idToken}` },
      body: JSON.stringify({ data: { action: "renew" } }),
    });
    assert.equal(lease.status, 200, await lease.text());
    const client = request(key());
    const call = async action => {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.idToken}` }, body: JSON.stringify({ data: { ...client, action, sequence: action === "leave" ? 2 : 1 } }) });
      assert.equal(response.status, 200, await response.text());
    };
    try {
      await call("heartbeat");
      const visitorId = createHash("sha256").update(client.visitorKey).digest("hex");
      const person = createHash("sha256").update(account.localId).digest("hex");
      const value = (await db.doc(`presenceVisitors/${visitorId}`).get()).data();
      assert.deepEqual(value.identityKeys, [`m_${person}`]);
    } finally { await call("leave"); }
  });
} finally {
  await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/presence-integration.json", JSON.stringify({ at: new Date().toISOString(), projectId, results }, null, 2));
  await db.terminate();
}
if (results.some(r => r.status !== "PASS")) process.exitCode = 1;
console.log(`${results.filter(r => r.status === "PASS").length}/${results.length} presence integration scenarios PASS`);
