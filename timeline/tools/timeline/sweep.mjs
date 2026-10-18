import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore"),
  { TimelineService } = require("./lib/service.js"),
  { PresenceService } = require("./lib/presence.js"),
  { cleanupOrphans } = require("./lib/media.js");
Object.assign(process.env, {
  GCLOUD_PROJECT: "demo-timeline",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
});
initializeApp({
  projectId: "demo-timeline",
  storageBucket: "demo-timeline.appspot.com",
});
const db = getFirestore();
const service = new TimelineService(db);
const presence = new PresenceService(db);
let busy = false;
let lastMaintenance = 0;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const health = await fetch("http://127.0.0.1:4400/emulators", {
      signal: AbortSignal.timeout(2000),
    });
    if (!health.ok) return;
    const presenceExpired = await presence.expireStale();
    if (Date.now() - lastMaintenance >= 5 * 60 * 1000) {
      console.log("Local scheduled worker", {
        expired: await service.expireDueRequests(),
        mediaRemoved: await cleanupOrphans(db),
        presenceExpired,
      });
      lastMaintenance = Date.now();
    }
  } catch (e) {
    console.log("Local worker waiting for emulator:", e.message);
  } finally {
    busy = false;
  }
}
await tick();
if (process.argv.includes("--watch")) setInterval(tick, 30_000);
else await db.terminate();
