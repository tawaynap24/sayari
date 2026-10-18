/** Private operator utility. Dry-run by default; never grants itself credentials. */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { gameCatalog, seedGameTopics } from "./game-catalog.mjs";
import { findTimelineUpdates, applyTimelineUpdates } from "./timeline-updates.mjs";
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
if (!["claim", "restrict-story", "seed-topics", "backfill-timeline-updates"].includes(action))
  throw Error(
    'Usage: admin.mjs claim|restrict-story|seed-topics|backfill-timeline-updates --project ID [--uid UID | --story ID] --reason "..." [--execute]',
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
    console.log(
      JSON.stringify({
        dryRun: !execute,
        project,
        action,
        topics: gameCatalog.map(game => game.id),
        stories: 0,
      }),
    );
    if (execute) {
      await seedGameTopics(db);
      await db
        .collection("auditLog")
        .add({
          actorUid: "private-admin-cli",
          action: "seedTopicMetadata",
          reason,
          at: Date.now(),
        });
    }
  } else if (action === "backfill-timeline-updates") {
    const changes = await findTimelineUpdates(db);
    console.log(JSON.stringify({ dryRun: !execute, project, action, changes }));
    if (execute) {
      await applyTimelineUpdates(db, changes);
      await db.collection("auditLog").add({ actorUid: "private-admin-cli", action, reason, at: Date.now(), topics: changes.length });
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
        const now = Date.now();
        tx.update(s.ref, {
          status: "hidden",
          restricted: true,
          ...(story.status === "published" ? { hiddenAt: now } : {}),
          activeEditRequestId: null,
          activeHideRequestId: null,
        });
        tx.delete(db.doc(`publicStories/${id}`));
        if (story.status === "published")
          tx.update(db.doc(`topics/${story.topicId}`), {
            timelineUpdatedAt: now,
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
