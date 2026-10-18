import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { cleanupTopicFixtures, findTopicFixtures } from "./fixtures.mjs";

if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-timeline")
  throw Error("Fixture cleanup is emulator-only");
Object.assign(process.env, {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
});
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
initializeApp({ projectId: "demo-timeline", storageBucket: "demo-timeline.appspot.com" });
const db = getFirestore();
try {
  const fixtures = await findTopicFixtures(db);
  const execute = process.argv.includes("--execute");
  const report = {
    project: "demo-timeline", dryRun: !execute,
    topics: fixtures.map(d => ({ path: d.ref.path, ...d.data() })),
  };
  if (execute) {
    // Preserve the exact selected topic metadata before removing synthetic content.
    await fs.mkdir(".timeline/fixture-cleanup", { recursive: true });
    await fs.writeFile(`.timeline/fixture-cleanup/${Date.now()}.json`, JSON.stringify(report, null, 2));
    report.cleaned = await cleanupTopicFixtures(db, fixtures.map(d => d.id), getStorage().bucket());
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.terminate();
}
