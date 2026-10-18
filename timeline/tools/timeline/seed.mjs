import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (
  process.env.GCLOUD_PROJECT &&
  process.env.GCLOUD_PROJECT !== "demo-timeline"
)
  throw Error("Seed is emulator-only.");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
initializeApp({ projectId: "demo-timeline" });
const db = getFirestore();
await db
  .doc("categories/games")
  .set({ id: "games", displayNameTh: "เกม", order: 1 });
await db
  .doc("categories/general")
  .set({ id: "general", displayNameTh: "เรื่องราวทั่วไป", order: 2 });
for (const [id, name, categoryId] of [
  ["zenless-zone-zero", "Zenless Zone Zero", "games"],
  ["genshin-impact", "Genshin Impact", "games"],
  ["community", "เรื่องราวของชุมชน", "general"],
]) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`topics/${id}`),
      snap = await tx.get(ref);
    if (snap.exists) return;
    tx.create(ref, {
      id,
      slug: id,
      categoryId,
      displayNames: { "th-TH": name, "en-US": name },
      descriptionTh: "พื้นที่รวบรวมเรื่องราวและแหล่งอ้างอิงจากชุมชน",
      calendar: { id: `${id}-symbolic` },
      publishedCount: 0,
    });
    tx.create(db.doc(`topicStats/${id}`), {
      interestCount: 0,
      graphVersion: 0,
    });
  });
}
console.log(
  "Seeded empty topic metadata only; no story content. Project: demo-timeline",
);
await db.terminate();
