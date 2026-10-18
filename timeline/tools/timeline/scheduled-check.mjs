import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
Object.assign(process.env, {
  GCLOUD_PROJECT: "demo-timeline",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  FIREBASE_CONFIG: JSON.stringify({
    projectId: "demo-timeline",
    storageBucket: "demo-timeline.appspot.com",
  }),
});
const {
  expireTimelineRequests,
  cleanTimelineMedia,
} = require("./lib/index.js");
await expireTimelineRequests.run({
  scheduleTime: new Date().toISOString(),
  jobName: "emulator-test",
});
await cleanTimelineMedia.run({
  scheduleTime: new Date().toISOString(),
  jobName: "emulator-test",
});
await cleanTimelineMedia.run({
  scheduleTime: new Date().toISOString(),
  jobName: "emulator-test-retry",
});
await require("firebase-admin/firestore").getFirestore().terminate();
console.log(
  "PASS exported schedule handlers (manual local invocation, not Cloud Scheduler deployment)",
);
