/** Private operator utility. Dry-run by default; never grants itself credentials. */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp, applicationDefault } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore"),
  { getAuth } = require("firebase-admin/auth"),
  { getStorage } = require("firebase-admin/storage");
const args = process.argv.slice(2);
const value = (k) => args[args.indexOf(k) + 1];
const project = args.includes("--project") ? value("--project") : null;
if (!project)
  throw Error(
    "Explicit --project is required. No default production project is used.",
  );
const action = args[0],
  execute = args.includes("--execute"),
  reason = args.includes("--reason") ? value("--reason") : "";
if (!["claim", "restrict-story", "seed-topics"].includes(action))
  throw Error(
    'Usage: admin.mjs claim|restrict-story|seed-topics --project ID [--uid UID | --story ID] --reason "..." [--execute]',
  );
if (project.startsWith("demo-"))
  Object.assign(process.env, {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  });
else if (
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
)
  throw Error(
    "Unset emulator variables before explicitly using a real project.",
  );
if (execute && reason.trim().length < 3)
  throw Error("--reason is required for writes");
initializeApp({
  projectId: project,
  ...(!project.startsWith("demo-") ? { credential: applicationDefault() } : {}),
  storageBucket: args.includes("--bucket")
    ? value("--bucket")
    : `${project}.appspot.com`,
});
const db = getFirestore();
try {
  if (action === "claim") {
    const uid = value("--uid");
    if (!args.includes("--uid") || !uid) throw Error("--uid required");
    const user = await getAuth().getUser(uid);
    const enabled = !args.includes("--revoke");
    console.log(
      JSON.stringify({
        dryRun: !execute,
        project,
        action,
        uid,
        timelineModerator: enabled,
      }),
    );
    if (execute) {
      await getAuth().setCustomUserClaims(uid, {
        ...user.customClaims,
        timelineModerator: enabled,
      });
      await db
        .collection("auditLog")
        .add({
          actorUid: "private-admin-cli",
          action: "setModeratorClaim",
          uid,
          enabled,
          reason,
          at: Date.now(),
        });
    }
  } else if (action === "seed-topics") {
    const topics = [
      ["zenless-zone-zero", "Zenless Zone Zero"],
      ["genshin-impact", "Genshin Impact"],
    ];
    console.log(
      JSON.stringify({
        dryRun: !execute,
        project,
        action,
        topics: topics.map(([id]) => id),
        stories: 0,
      }),
    );
    if (execute) {
      await db
        .doc("categories/games")
        .set({ id: "games", displayNameTh: "เกม", order: 1 }, { merge: true });
      for (const [id, name] of topics)
        await db.runTransaction(async (tx) => {
          const d = await tx.get(db.doc(`topics/${id}`));
          if (d.exists) return;
          tx.create(d.ref, {
            id,
            slug: id,
            categoryId: "games",
            displayNames: { "th-TH": name, "en-US": name },
            descriptionTh: "พื้นที่เรื่องราวและแหล่งอ้างอิงจากชุมชน",
            calendar: { id: `${id}-symbolic` },
            publishedCount: 0,
          });
          tx.create(db.doc(`topicStats/${id}`), {
            interestCount: 0,
            graphVersion: 0,
          });
        });
      await db
        .collection("auditLog")
        .add({
          actorUid: "private-admin-cli",
          action: "seedTopicMetadata",
          reason,
          at: Date.now(),
        });
    }
  } else {
    const id = value("--story");
    if (!args.includes("--story") || !id || id.includes("/"))
      throw Error("--story ID required");
    const s = await db.doc(`stories/${id}`).get();
    if (!s.exists) throw Error("Story not found");
    console.log(
      JSON.stringify({
        dryRun: !execute,
        project,
        action,
        storyId: id,
        reason,
        scope:
          "Hide public/history; block member archive/media; close/restrict requests. No ordinary history deletion.",
      }),
    );
    if (execute) {
      const audit = db.doc(`auditLog/restriction_${randomUUID()}`);
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(s.ref);
        const story = fresh.data();
        tx.update(s.ref, {
          status: "hidden",
          restricted: true,
          activeEditRequestId: null,
          activeHideRequestId: null,
        });
        tx.delete(db.doc(`publicStories/${id}`));
        if (story.status === "published")
          tx.update(db.doc(`topics/${story.topicId}`), {
            publishedCount:
              require("firebase-admin/firestore").FieldValue.increment(-1),
          });
        tx.create(audit, {
          actorUid: "private-admin-cli",
          action: "emergencyRestriction",
          storyId: id,
          reason,
          at: Date.now(),
          status: "restricting-requests",
        });
      });
      let cursor;
      do {
        let q = db
          .collection("requests")
          .where("storyId", "==", id)
          .orderBy("__name__")
          .limit(100);
        if (cursor) q = q.startAfter(cursor);
        const docs = await q.get();
        if (docs.empty) break;
        const batch = db.batch();
        for (const d of docs.docs)
          batch.update(d.ref, {
            restricted: true,
            ...(d.get("status") === "pending"
              ? {
                  status: "cancelled",
                  settledAt: Date.now(),
                  reason: "จำกัดการเข้าถึงโดยผู้ดูแล",
                }
              : {}),
          });
        await batch.commit();
        cursor = docs.docs.at(-1);
        if (docs.size < 100) break;
      } while (true);
      // Storage bytes retained privately for the legal review; proxy refuses even original owner.
      await audit.update({ status: "complete", completedAt: Date.now() });
    }
  }
} finally {
  await db.terminate();
}
