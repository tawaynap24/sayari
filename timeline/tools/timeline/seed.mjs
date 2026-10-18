import { createRequire } from "node:module";
import { seedGameTopics } from "./game-catalog.mjs";
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
await seedGameTopics(db);
console.log(
  "Seeded five game topics and covers; existing content and counters preserved. Project: demo-timeline",
);
await db.terminate();
