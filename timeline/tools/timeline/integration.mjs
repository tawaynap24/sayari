import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { cleanupTopicFixtures } from "./fixtures.mjs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
await fs.mkdir("evidence/timeline", { recursive: true });
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore"),
  { getAuth } = require("firebase-admin/auth"),
  { getStorage } = require("firebase-admin/storage");
const { TimelineService } = require("./lib/service.js"),
  { prepareUpload, finalizeUpload, readMedia } = require("./lib/media.js");
const projectId = "demo-timeline";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)
  throw Error("Tests refuse non-demo projects");
Object.assign(process.env, {
  GCLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
});
initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore();
let now = Date.now();
const svc = new TimelineService(db, () => now);
const env = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: "127.0.0.1",
    port: 8080,
    rules: await fs.readFile("firestore.rules", "utf8"),
  },
  storage: {
    host: "127.0.0.1",
    port: 9199,
    rules: await fs.readFile("storage.rules", "utf8"),
  },
});
const results = [];
let n = 0;
const fixtureTopics = [];
const runId = Date.now().toString(36);
const actor = (i) => ({
  uid: `test_${runId}_u${i}`,
  label: `บัญชีทดสอบ ${i}`,
  privileged: false,
});
const owner = actor(0);
const mockAuthTime = Math.floor(Date.now() / 1000);
await Promise.all([owner.uid, actor(1).uid, actor(99).uid].map(uid =>
  db.doc(`users/${uid}/authSessions/${mockAuthTime}`).set({ expiresAt: Date.now() + 259200000 }),
));
const call = (a, action, data, operationId = randomUUID()) =>
  svc.run(a, { action, data, operationId });
const content = (
  title = "เรื่องทดสอบ A",
  time = { type: "exact", at: { year: "10", precision: "year" } },
) => ({
  titleTh: title,
  summaryTh: "ข้อมูลสังเคราะห์ใน Emulator เท่านั้น",
  bodyTh: "เรื่องราวสมมติสำหรับทดสอบระบบ ไม่ใช่เนื้อหาอย่างเป็นทางการ",
  time,
  namedEntityIds: [],
  sources: [],
  media: [],
  gameVersion: "test",
  locale: "th-TH",
});
async function topic(count) {
  const id = `test_${runId}_${++n}`;
  fixtureTopics.push(id);
  let batch = db.batch();
  batch.set(db.doc(`topics/${id}`), {
    id,
    slug: id,
    categoryId: "test",
    displayNames: { "th-TH": "หัวข้อทดสอบ" },
    descriptionTh: "SYNTHETIC EMULATOR ONLY",
    calendar: { id: "symbolic-test" },
    publishedCount: 0,
  });
  batch.set(db.doc(`topicStats/${id}`), {
    interestCount: count,
    graphVersion: 0,
  });
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
    batch.set(db.doc(`topics/${id}/interests/${actor(i).uid}`), {
      uid: actor(i).uid,
      followedAt: now,
    });
  }
  await batch.commit();
  return id;
}
const request = async (id) => (await db.doc(`requests/${id}`).get()).data();
const story = async (id) => (await db.doc(`stories/${id}`).get()).data();
const create = (t, c = content()) =>
  call(owner, "createStory", { topicId: t, content: c });
async function vote(id, i, choice = "yes", round) {
  const r = await request(id);
  return call(actor(i), "castVote", {
    requestId: id,
    roundId: round || r.currentVoteRoundId,
    choice,
  });
}
async function approve(id, start = 1) {
  const r = await request(id);
  for (let i = start; i < start + r.requiredVotes; i++) await vote(id, i);
}
async function run(name, fn) {
  if (process.argv.includes("--restriction") && !name.startsWith("private operator")) return;
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", ms: Date.now() - start, detail });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({
      name,
      status: "FAIL",
      ms: Date.now() - start,
      error: e.stack,
    });
    console.error(`FAIL ${name}\n${e.stack}`);
  }
  await fs.writeFile(
    process.argv.includes("--restriction")
      ? "evidence/timeline/integration-restriction.json"
      : "evidence/timeline/integration.json",
    JSON.stringify(
      { projectId, runId, at: new Date().toISOString(), results },
      null,
      2,
    ),
  );
}
try {
  await run(
    "atomic duplicate follows increment one UID exactly once",
    async () => {
      const t = await topic(1);
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          call(actor(77), "followTopic", { topicId: t }),
        ),
      );
      assert.ok(responses.every((r) => r.followed));
      assert.equal(
        (await db.doc(`topicStats/${t}`).get()).get("interestCount"),
        2,
      );
    },
  );
  await run(
    "CREATE at49 publishes once with immutable revision; retry idempotent",
    async () => {
      const t = await topic(49),
        id = randomUUID(),
        payload = { topicId: t, content: content() };
      const [a, b] = await Promise.all([
        call(owner, "createStory", payload, id),
        call(owner, "createStory", payload, id),
      ]);
      assert.deepEqual(a, b);
      assert.equal(a.status, "published");
      assert.equal(
        (await db.doc(`topics/${t}`).get()).get("publishedCount"),
        1,
      );
      assert.equal(
        (await db.collection(`stories/${a.storyId}/revisions`).get()).size,
        1,
      );
      assert.ok((await db.doc(`publicStories/${a.storyId}`).get()).exists);
      await assert.rejects(() =>
        call(
          owner,
          "createStory",
          { ...payload, content: content("changed") },
          id,
        ),
      );
    },
  );
  await run(
    "CREATE at50 snapshot5, own/nonfollower denied and immediate threshold",
    async () => {
      const t = await topic(50),
        a = await create(t),
        r = await request(a.requestId);
      assert.equal(r.requiredVotes, 5);
      assert.equal(r.interestSnapshot, 50);
      assert.equal(
        (await db.doc(`publicStories/${a.storyId}`).get()).exists,
        false,
      );
      await assert.rejects(() => vote(a.requestId, 0), /ตนเอง/);
      await assert.rejects(() => vote(a.requestId, 100), /สนใจ/);
      await call(actor(100), "followTopic", { topicId: t });
      await vote(a.requestId, 100);
      for (let i = 1; i <= 4; i++) await vote(a.requestId, i);
      assert.equal((await request(a.requestId)).status, "approved");
      assert.equal((await request(a.requestId)).interestSnapshot, 50);
      assert.ok((await db.doc(`publicStories/${a.storyId}`).get()).exists);
    },
  );
  await run(
    "concurrent sameUID votes, real switch, repeat same choice keeps idle clock",
    async () => {
      const t = await topic(50),
        a = await create(t);
      await Promise.all(Array.from({ length: 5 }, () => vote(a.requestId, 1)));
      let r = await request(a.requestId);
      assert.equal(r.yesCount, 1);
      const at = r.lastVoteChangedAt;
      now += 1000;
      await vote(a.requestId, 1);
      assert.equal((await request(a.requestId)).lastVoteChangedAt, at);
      await vote(a.requestId, 1, "no");
      r = await request(a.requestId);
      assert.equal(r.yesCount, 0);
      assert.equal(r.noCount, 1);
      assert.equal(r.lastVoteChangedAt, now);
    },
  );
  await run(
    "parallel threshold crossing publishes exactly one revision",
    async () => {
      const t = await topic(50),
        a = await create(t);
      for (let i = 1; i < 5; i++) await vote(a.requestId, i);
      const results = await Promise.allSettled([
        vote(a.requestId, 5),
        vote(a.requestId, 6),
        vote(a.requestId, 7),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await db.collection(`stories/${a.storyId}/revisions`).get()).size,
        1,
      );
      assert.equal(
        (await db.doc(`topics/${t}`).get()).get("publishedCount"),
        1,
      );
    },
  );
  await run(
    "pending edit archives votes and resnapshots N/time; stale votes denied",
    async () => {
      const t = await topic(50),
        a = await create(t);
      await vote(a.requestId, 1);
      const old = await request(a.requestId);
      await call(actor(51), "followTopic", { topicId: t });
      now += 1000;
      await call(owner, "updatePendingRequest", {
        requestId: a.requestId,
        roundId: old.currentVoteRoundId,
        content: content("เรื่องทดสอบแก้ไข"),
      });
      const r = await request(a.requestId);
      assert.equal(r.interestSnapshot, 51);
      assert.equal(r.requiredVotes, 6);
      assert.equal(r.yesCount, 0);
      assert.equal(r.expiresAt, now + 72 * 3600000);
      assert.notEqual(r.currentVoteRoundId, old.currentVoteRoundId);
      assert.ok(
        (
          await db
            .doc(
              `requests/${r.id}/voteRounds/${old.currentVoteRoundId}/votes/${actor(1).uid}`,
            )
            .get()
        ).exists,
      );
      await assert.rejects(() => vote(r.id, 2, "yes", old.currentVoteRoundId));
      await call(owner, "cancelPendingRequest", {
        requestId: r.id,
        roundId: r.currentVoteRoundId,
      });
      assert.equal((await request(r.id)).status, "cancelled");
    },
  );
  await run(
    "concurrent EDIT lock, approval history, original author may vote another proposer",
    async () => {
      const t = await topic(10),
        a = await create(t);
      const payload = {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        content: content("เรื่องแก้ไข"),
      };
      const outcomes = await Promise.allSettled([
        call(actor(1), "proposeEdit", payload),
        call(actor(2), "proposeEdit", payload),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      const id = outcomes.find((r) => r.status === "fulfilled").value.requestId;
      await vote(id, 0);
      for (let i = 3; i <= 6; i++) await vote(id, i);
      assert.equal((await story(a.storyId)).revisionNumber, 2);
      assert.equal(
        (await db.doc(`stories/${a.storyId}/revisions/v1`).get()).get(
          "titleTh",
        ),
        "เรื่องทดสอบ A",
      );
      assert.equal(
        (await db.doc(`publicStories/${a.storyId}`).get()).get("titleTh"),
        "เรื่องแก้ไข",
      );
      assert.equal((await story(a.storyId)).activeEditRequestId, null);
    },
  );
  await run(
    "HIDE approval cancels pending EDIT; history/public projection denied to guest",
    async () => {
      const t = await topic(10),
        a = await create(t);
      const e = await call(owner, "proposeEdit", {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        content: content("edit must never revive"),
      });
      const h = await call(owner, "proposeHide", {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        reason: "ทดสอบซ่อน",
      });
      await approve(h.requestId);
      assert.equal((await story(a.storyId)).status, "hidden");
      assert.equal((await request(e.requestId)).status, "cancelled");
      await assert.rejects(() => vote(e.requestId, 1));
      assert.equal(
        (await db.doc(`publicStories/${a.storyId}`).get()).exists,
        false,
      );
      assert.ok(
        (await db.doc(`stories/${a.storyId}/revisions/v1`).get()).exists,
      );
      await assertFails(
        getDoc(
          doc(
            env.unauthenticatedContext().firestore(),
            `publicStories/${a.storyId}/history/v1`,
          ),
        ),
      );
    },
  );
  await run(
    "EDIT approved first preserves active HIDE targeting current version",
    async () => {
      const t = await topic(10),
        a = await create(t);
      const h = await call(owner, "proposeHide", {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          reason: "ทดสอบซ่อน",
        }),
        e = await call(owner, "proposeEdit", {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          content: content("version2"),
        });
      await approve(e.requestId);
      assert.equal((await story(a.storyId)).activeHideRequestId, h.requestId);
      await approve(h.requestId);
      assert.equal((await story(a.storyId)).status, "hidden");
    },
  );
  await run(
    "negative HIDE leaves published; fresh round snapshots current interest",
    async () => {
      const t = await topic(10),
        a = await create(t),
        d = {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          reason: "ทดสอบซ่อน",
        };
      const h = await call(owner, "proposeHide", d);
      for (let i = 1; i <= 5; i++) await vote(h.requestId, i, "no");
      assert.equal((await request(h.requestId)).status, "rejected");
      assert.equal((await story(a.storyId)).status, "published");
      await call(actor(99), "followTopic", { topicId: t });
      const h2 = await call(owner, "proposeHide", d),
        r = await request(h2.requestId);
      assert.equal(r.interestSnapshot, 11);
      assert.equal(r.yesCount, 0);
      assert.equal(r.noCount, 0);
    },
  );
  await run(
    "exact expiry commits terminal and releases lock before denied vote",
    async () => {
      const t = await topic(10),
        a = await create(t),
        e = await call(owner, "proposeEdit", {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          content: content("timeout"),
        });
      now = (await request(e.requestId)).expiresAt;
      await assert.rejects(() => vote(e.requestId, 1), /หมดอายุ/);
      assert.equal((await request(e.requestId)).status, "expired");
      assert.equal((await story(a.storyId)).activeEditRequestId, null);
    },
  );
  await run(
    "CREATE grace72h, later real vote extends to94h, bounded idempotent sweeper",
    async () => {
      const t = await topic(50),
        a = await create(t),
        r = await request(a.requestId);
      now = r.submittedAt + 24 * 3600000;
      await svc.expireDueRequests();
      assert.equal((await request(r.id)).status, "pending");
      now = r.submittedAt + 70 * 3600000;
      await vote(r.id, 1);
      assert.equal(
        (await request(r.id)).expiresAt,
        r.submittedAt + 94 * 3600000,
      );
      now = r.submittedAt + 94 * 3600000;
      // Previous browser/integration runs can leave more than one 100-row
      // batch due. Exercise bounded progress without assuming an empty DB.
      for (let batch = 0; batch < 100; batch++) {
        const changed = await svc.expireDueRequests();
        assert.ok(changed <= 100);
        if ((await request(r.id)).status === "expired" || changed === 0) break;
      }
      assert.equal((await request(r.id)).status, "expired");
      await svc.expireDueRequests();
      assert.equal(
        (
          await db
            .collection("auditLog")
            .where("objectId", "==", r.id)
            .where("action", "==", "expire")
            .get()
        ).size,
        1,
      );
    },
  );
  await run(
    "stale and missing EDIT locks recover transactionally",
    async () => {
      const t = await topic(10),
        a = await create(t);
      await db
        .doc(`stories/${a.storyId}`)
        .update({ activeEditRequestId: "missing" });
      const e = await call(owner, "proposeEdit", {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        content: content("stale1"),
      });
      now = (await request(e.requestId)).expiresAt;
      const e2 = await call(actor(1), "proposeEdit", {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        content: content("stale2"),
      });
      assert.equal((await request(e.requestId)).status, "expired");
      assert.equal((await story(a.storyId)).activeEditRequestId, e2.requestId);
    },
  );
  await run(
    "server rejects self/cross-topic/hidden anchors and approval cycles",
    async () => {
      const t = await topic(10),
        other = await topic(10),
        a = await create(t),
        b = await create(
          t,
          content("B", {
            type: "relative",
            anchorEventId: a.storyId,
            relation: "after",
          }),
        );
      await assert.rejects(
        () =>
          create(
            other,
            content("cross", {
              type: "relative",
              anchorEventId: a.storyId,
              relation: "after",
            }),
          ),
        /อ้างอิง/,
      );
      await assert.rejects(
        () =>
          call(owner, "proposeEdit", {
            topicId: t,
            storyId: a.storyId,
            baseRevisionId: "v1",
            content: content("A cycle", {
              type: "relative",
              anchorEventId: b.storyId,
              relation: "after",
            }),
          }),
        /วงจร/,
      );
      await assert.rejects(
        () =>
          call(owner, "proposeEdit", {
            topicId: t,
            storyId: a.storyId,
            baseRevisionId: "v1",
            content: content("self", {
              type: "relative",
              anchorEventId: a.storyId,
              relation: "after",
            }),
          }),
        /วงจร/,
      );
    },
  );
  await run(
    "guest approved-only reads and all direct authority writes denied",
    async () => {
      const t = await topic(50),
        a = await create(t),
        guest = env.unauthenticatedContext().firestore(),
        member = env.authenticatedContext(actor(1).uid, { auth_time: mockAuthTime }).firestore(),
        stranger = env.authenticatedContext(actor(99).uid, { auth_time: mockAuthTime }).firestore();
      await assertSucceeds(getDoc(doc(guest, `topics/${t}`)));
      await assertFails(getDoc(doc(guest, `requests/${a.requestId}`)));
      await assertFails(getDoc(doc(stranger, `requests/${a.requestId}`)));
      await assertSucceeds(getDoc(doc(member, `requests/${a.requestId}`)));
      await assertFails(
        getDocs(
          query(collection(guest, "requests"), where("topicId", "==", t)),
        ),
      );
      await assertFails(getDoc(doc(guest, `topicStats/${t}`)));
      for (const path of [
        `topics/${t}`,
        `topicStats/${t}`,
        `stories/${a.storyId}`,
        `requests/${a.requestId}`,
        `publicStories/${a.storyId}`,
        `users/${actor(1).uid}`,
        `topics/${t}/interests/${actor(1).uid}`,
        `auditLog/fake`,
      ])
        await assertFails(
          setDoc(doc(member, path), {
            role: "admin",
            status: "approved",
            yesCount: 100,
            interestCount: 500,
          }),
        );
      await assertFails(
        setDoc(
          doc(
            member,
            `requests/${a.requestId}/voteRounds/r/votes/${actor(1).uid}`,
          ),
          { choice: "yes" },
        ),
      );
      await assertFails(
        getDoc(
          doc(
            member,
            `requests/${a.requestId}/voteRounds/r/votes/${owner.uid}`,
          ),
        ),
      );
    },
  );
  await run(
    "privilege checked server-side and audited; normal actor cannot bypass",
    async () => {
      const t = await topic(50),
        a = await create(t);
      await assert.rejects(
        () =>
          call(owner, "privilegedPublish", {
            storyId: a.storyId,
            reason: "ทดสอบผู้ดูแล",
          }),
        /สิทธิ์/,
      );
      await call({ ...owner, privileged: true }, "privilegedPublish", {
        storyId: a.storyId,
        reason: "ทดสอบเผยแพร่ผู้ดูแล",
      });
      assert.equal((await story(a.storyId)).status, "published");
      await call({ ...owner, privileged: true }, "privilegedHide", {
        storyId: a.storyId,
        reason: "ทดสอบลบการเข้าถึงเนื้อหา",
      });
      assert.equal((await story(a.storyId)).status, "hidden");
      assert.ok(
        (
          await db
            .collection("auditLog")
            .where("objectId", "==", a.storyId)
            .where("action", "==", "privilegedHide")
            .get()
        ).size,
      );
    },
  );
  await run(
    "Auth email/password + real callable JWT/unauthenticated/anonymous/nonfollow gates",
    async () => {
      const email = `http-${runId}@example.test`,
        password = "Test-only-12345";
      const signup = await fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      assert.equal(signup.status, 200);
      const user = await signup.json();
      const lease = await fetch(`http://127.0.0.1:5001/${projectId}/asia-southeast1/timelineSession`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.idToken}` },
        body: JSON.stringify({ data: { action: "renew" } }),
      });
      assert.equal(lease.status, 200, await lease.text());
      const t = await topic(1);
      async function http(data, token = user.idToken) {
        const res = await fetch(
          `http://127.0.0.1:5001/${projectId}/asia-southeast1/timelineApi`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              data: { ...data, operationId: randomUUID() },
            }),
          },
        );
        return { status: res.status, body: await res.json() };
      }
      assert.equal(
        (await http({ action: "followTopic", data: { topicId: t } }, null))
          .status,
        401,
      );
      const anonymousSignup = await fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnSecureToken: true }),
        },
      );
      assert.equal(anonymousSignup.status, 200);
      const anonymous = await anonymousSignup.json();
      assert.equal(
        (await http({ action: "followTopic", data: { topicId: t } }, anonymous.idToken)).status,
        401,
      );
      assert.equal(
        (
          await http({
            action: "createStory",
            data: { topicId: t, content: content() },
          })
        ).status,
        403,
      );
      assert.equal(
        (await http({ action: "followTopic", data: { topicId: t } })).status,
        200,
      );
      const r = await http({
        action: "createStory",
        data: { topicId: t, content: content("HTTP real") },
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.status, "published");
      assert.equal(
        (await getAuth().getUser(user.localId)).emailVerified,
        false,
      );
    },
  );
  await run(
    "Storage rules byte cap, private staging, finalize magic, ownership and hide revokes proxy",
    async () => {
      const t = await topic(10);
      const image = Buffer.alloc(5000000);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);
      const prep = await prepareUpload(db, owner, {
        topicId: t,
        draftId: "fixture",
        name: "fixture.png",
        mimeType: "image/png",
        sizeBytes: image.length,
      });
      const store = env
        .authenticatedContext(owner.uid, { auth_time: mockAuthTime })
        .storage("gs://demo-timeline.appspot.com");
      await assertSucceeds(
        uploadBytes(ref(store, prep.path), image, { contentType: "image/png" }),
      );
      await assertFails(
        uploadBytes(ref(store, prep.path), image, { contentType: "image/png" }),
      );
      await assertFails(
        getBytes(
          ref(
            env
              .unauthenticatedContext()
              .storage("gs://demo-timeline.appspot.com"),
            prep.path,
          ),
        ),
      );
      const ready = await finalizeUpload(db, owner, { mediaId: prep.id });
      assert.equal(ready.kind, "image");
      await assert.rejects(() => readMedia(db, prep.id));
      const a = await create(t, {
        ...content("media"),
        media: [{ id: prep.id, kind: "image", altTextTh: "ภาพทดสอบ" }],
      });
      assert.equal((await readMedia(db, prep.id)).isPublic, true);
      await assert.rejects(() =>
        call(actor(1), "createStory", {
          topicId: t,
          content: {
            ...content("stolen"),
            media: [{ id: prep.id, kind: "image" }],
          },
        }),
      );
      await call({ ...owner, privileged: true }, "privilegedHide", {
        storyId: a.storyId,
        reason: "ทดสอบสื่อซ่อน",
      });
      await assert.rejects(() => readMedia(db, prep.id));
      const too = await prepareUpload(db, owner, {
        topicId: t,
        draftId: "fixture",
        name: "cap.png",
        mimeType: "image/png",
        sizeBytes: 5000000,
      });
      await assertFails(
        uploadBytes(ref(store, too.path), Buffer.alloc(5000001), {
          contentType: "image/png",
        }),
      );
      const spoof = await prepareUpload(db, owner, {
        topicId: t,
        draftId: "fixture",
        name: "spoof.png",
        mimeType: "image/png",
        sizeBytes: 6,
      });
      await assertSucceeds(
        uploadBytes(ref(store, spoof.path), Buffer.from("<html>"), {
          contentType: "image/png",
        }),
      );
      await assert.rejects(
        () => finalizeUpload(db, owner, { mediaId: spoof.id }),
        /เนื้อหาไฟล์/,
      );
      await assert.rejects(() =>
        prepareUpload(db, owner, {
          topicId: t,
          draftId: "fixture",
          name: "x.svg",
          mimeType: "image/svg+xml",
          sizeBytes: 4,
        }),
      );
      const blob = (await db.doc(`media/${prep.id}`).get()).get(
        "validatedPath",
      );
      const [meta] = await getStorage().bucket().file(blob).getMetadata();
      assert.ok(!meta.metadata?.firebaseStorageDownloadTokens);
    },
  );
  await run(
    "backend rejects unsafe references, unknown fields/count spoof and cross-topic entities",
    async () => {
      const t = await topic(10),
        t2 = await topic(10);
      const entity = await call(owner, "saveEntity", {
        topicId: t2,
        kind: "character",
        names: { "th-TH": "ทดสอบ" },
        aliases: {},
      });
      await assert.rejects(() =>
        create(t, { ...content(), namedEntityIds: [entity.entityId] }),
      );
      await assert.rejects(() =>
        create(t, {
          ...content(),
          sources: [
            {
              id: "bad",
              kind: "web",
              title: "evil",
              url: "javascript:alert(1)",
            },
          ],
        }),
      );
      await assert.rejects(() =>
        call(owner, "createStory", {
          topicId: t,
          content: content(),
          interestCount: 0,
          status: "approved",
        }),
      );
    },
  );
  await run(
    "1001 actual memberships cap CREATE at100 and exactly100 votes publish",
    async () => {
      const t = await topic(1001),
        a = await create(t);
      assert.equal((await request(a.requestId)).requiredVotes, 100);
      for (let i = 1; i <= 99; i++) await vote(a.requestId, i);
      assert.equal((await request(a.requestId)).status, "pending");
      await vote(a.requestId, 100);
      assert.equal((await request(a.requestId)).status, "approved");
      assert.equal((await request(a.requestId)).yesCount, 100);
    },
  );
  await run(
    "simultaneous EDIT/HIDE threshold race never resurrects story",
    async () => {
      const t = await topic(10),
        a = await create(t);
      const e = await call(owner, "proposeEdit", {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          content: content("race edit"),
        }),
        h = await call(owner, "proposeHide", {
          topicId: t,
          storyId: a.storyId,
          baseRevisionId: "v1",
          reason: "race hide",
        });
      for (let i = 1; i <= 4; i++) {
        await vote(e.requestId, i);
        await vote(h.requestId, i);
      }
      await Promise.allSettled([vote(e.requestId, 5), vote(h.requestId, 6)]);
      assert.equal((await story(a.storyId)).status, "hidden");
      assert.equal(
        (await db.doc(`publicStories/${a.storyId}`).get()).exists,
        false,
      );
      assert.ok(
        ["approved", "cancelled"].includes((await request(e.requestId)).status),
      );
    },
  );
  await run(
    "private operator restriction denies even member archive and pending reads",
    async () => {
      const t = await topic(10),
        a = await create(t);
      const e = await call(owner, "proposeEdit", {
        topicId: t,
        storyId: a.storyId,
        baseRevisionId: "v1",
        content: content("restrict test"),
      });
      // DOCX plaintext lives in metadata as well as behind the media proxy.
      // Verify that emergency restriction revokes both read surfaces.
      const mediaId = `restricted_doc_${runId}`;
      await db.doc(`media/${mediaId}`).set({
        id: mediaId, ownerUid: owner.uid, topicId: t, storyId: a.storyId,
        status: "ready", kind: "docx", docText: "Synthetic private document",
      });
      const uploader = env.authenticatedContext(owner.uid, { auth_time: mockAuthTime }).firestore();
      await assertSucceeds(getDoc(doc(uploader, `media/${mediaId}`)));
      assert.equal((await readMedia(db, mediaId, owner.uid)).m.docText, "Synthetic private document");
      execFileSync(
        process.execPath,
        [
          "tools/timeline/admin.mjs",
          "restrict-story",
          "--project",
          projectId,
          "--story",
          a.storyId,
          "--reason",
          "Synthetic legal restriction test",
          "--execute",
        ],
        { encoding: "utf8", timeout: 30000 },
      );
      const member = env.authenticatedContext(actor(1).uid, { auth_time: mockAuthTime }).firestore();
      await assertFails(
        getDoc(doc(member, `stories/${a.storyId}/revisions/v1`)),
      );
      await assertFails(getDoc(doc(member, `requests/${e.requestId}`)));
      await assertFails(getDoc(doc(uploader, `media/${mediaId}`)));
      await assert.rejects(() => readMedia(db, mediaId, owner.uid), /จำกัดการเข้าถึง/);
      assert.equal((await story(a.storyId)).restricted, true);
    },
  );
  await run(
    "exported scheduled handler executes against Emulator, cleanup retries harmless",
    async () => {
      const t = await topic(50),
        a = await create(t);
      await db
        .doc(`requests/${a.requestId}`)
        .update({ expiresAt: Date.now() - 1 });
      execFileSync(process.execPath, ["tools/timeline/scheduled-check.mjs"], {
        encoding: "utf8",
        timeout: 30000,
      });
      assert.equal((await request(a.requestId)).status, "expired");
    },
  );
} finally {
  try {
    await env.cleanup();
  } finally {
    try {
      const cleaned = await cleanupTopicFixtures(db, fixtureTopics, getStorage().bucket());
      assert.equal(cleaned.length, fixtureTopics.length, "Every test topic must be cleaned");
      console.log(`PASS cleaned ${cleaned.length} synthetic topic fixtures`);
    } finally {
      await db.terminate();
    }
  }
}
console.log(
  `${results.filter((r) => r.status === "PASS").length}/${results.length} emulator scenarios PASS`,
);
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
