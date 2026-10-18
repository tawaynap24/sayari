import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const mode = process.argv[2] || "start";
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "functions/tsconfig.json"],
  { stdio: "inherit" },
);
const cli = path.resolve("node_modules/firebase-tools/lib/bin/firebase.js");
if (!fs.existsSync(cli))
  throw Error("Run npm install first (Firebase CLI is pinned locally).");
fs.mkdirSync(".timeline/firebase-cache", { recursive: true });
const env = {
  ...process.env,
  CI: "true",
  DEBUG: "",
  FUNCTIONS_DISCOVERY_TIMEOUT: "60",
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
  FIREBASE_EMULATORS_PATH: path.resolve(".timeline/firebase-cache"),
};
const args = [
  cli,
  mode === "test" ? "emulators:exec" : "emulators:start",
  "--project",
  "demo-timeline",
  "--only",
  "auth,firestore,functions,storage,hosting",
  "--log-verbosity",
  "INFO",
];
if (mode === "test") args.push("node tools/timeline/integration.mjs");
const child = spawn(process.execPath, args, { env, stdio: "inherit" });
const worker =
  mode === "start"
    ? spawn(process.execPath, ["tools/timeline/sweep.mjs", "--watch"], {
        env,
        stdio: "inherit",
      })
    : null;
child.on("exit", (code) => {
  worker?.kill();
  process.exitCode = code ?? 1;
});
