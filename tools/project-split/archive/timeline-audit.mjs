import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const baseline = JSON.parse(fs.readFileSync("evidence/timeline/baseline.json", "utf8"));
const allowed = new Set(["src/routes/route.tsx", "src/routes/routeList.tsx", "src/views/timeline/index.tsx"]);
const protectedFiles = Object.entries(baseline.hashes).filter(([file]) => !allowed.has(file));
const changedProtected = protectedFiles.filter(([file, digest]) => hash(file) !== digest).map(([file]) => file);
assert.deepEqual(changedProtected, []);
const kit = "_handoff/SAYARI_TIMELINE_CODEX_V5_20261018";
const manifest = fs.readFileSync(`${kit}/SHA256_MANIFEST.txt`, "utf8").split(/\r?\n/).filter((line) => /^[a-f0-9]{64} /.test(line));
const changedKit = manifest.filter((line) => hash(path.join(kit, line.slice(66))) !== line.slice(0, 64));
assert.deepEqual(changedKit, []);
assert.equal(git("rev-parse", "HEAD"), baseline.head, "HEAD changed during implementation");
const files = [...new Set([
  ...git("diff", "--name-only").split(/\r?\n/),
  ...git("ls-files", "--others", "--exclude-standard").split(/\r?\n/),
])].filter((file) => file && file !== "evidence/timeline/final-audit.json").sort();
const report = {
  at: new Date().toISOString(),
  branch: git("branch", "--show-current"),
  head: git("rev-parse", "HEAD"),
  remote: git("remote", "get-url", "origin"),
  status: git("status", "--short"),
  protectedOriginalFiles: protectedFiles.length,
  changedProtected,
  kitFilesVerified: manifest.length,
  changedKit,
  emulatorProject: "demo-sayari-timeline",
  productionProjectUntouched: JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default,
  files: files.map((file) => ({ file, bytes: fs.statSync(file).size, sha256: hash(file) })),
};
fs.writeFileSync("evidence/timeline/final-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ head: report.head, protectedOriginalFiles: report.protectedOriginalFiles, kitFilesVerified: report.kitFilesVerified, changedProtected, changedKit, changedOrNewFiles: files.length }));
