import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const baseline = JSON.parse(await fs.readFile('evidence/project-split/baseline.json', 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const protectedEntries = Object.entries(baseline.hashes).filter(([file]) =>
  file.startsWith('public/') || file.startsWith('functions/src/') ||
  file.startsWith('src/features/nanoka/') || file.startsWith('src/views/games/zenless-zone-zero/') && !file.endsWith('database/index.tsx') ||
  file.startsWith('_handoff/') || file.startsWith('SAYARI_NANOKA_ZZZ_CODEX_KIT_20261018/'));
const relocated = file => file.startsWith('functions/') ? `timeline/${file}` : /^(public|src)\//.test(file) ? `zzz/${file}` : file;
const changed = [];
let next = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < protectedEntries.length) {
    const [file, digest] = protectedEntries[next++];
    if (hash(await fs.readFile(relocated(file))) !== digest) changed.push(file);
  }
}));
assert.deepEqual(changed, [], 'Protected data, calculator, backend, or original specification changed');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseline.head);
const zzz = JSON.parse(await fs.readFile('zzz/package.json', 'utf8'));
const lock = JSON.parse(await fs.readFile('zzz/package-lock.json', 'utf8'));
assert.equal(zzz.name, 'zzz');
assert.ok(!JSON.stringify(lock).match(/firebase/i), 'ZZZ lockfile must not include Firebase');
for (const file of ['firebase.json', '.firebaserc', 'firestore.rules', 'firestore.indexes.json', 'storage.rules', '.env.emulator']) {
  assert.ok(existsSync(`timeline/${file}`), `Timeline owns ${file}`);
  assert.ok(!existsSync(file) && !existsSync(`zzz/${file}`), `No shared Firebase config: ${file}`);
}
const firebase = JSON.parse(await fs.readFile('timeline/firebase.json', 'utf8'));
assert.ok(!JSON.stringify(firebase).match(/zenless|nanoka|localization/i));
assert.equal(JSON.parse(await fs.readFile('timeline/.firebaserc', 'utf8')).projects.default, 'sayari-81b58');
const vectors = await fs.readFile('timeline/tests/fixtures/vectors.v5.json');
assert.equal(hash(vectors), baseline.hashes['_handoff/SAYARI_TIMELINE_CODEX_V5_20261018/tests/vectors.v5.json']);
const result = { at: new Date().toISOString(), status: 'PASS', protectedFiles: protectedEntries.length, unchangedPublicDataFiles: protectedEntries.filter(([p]) => p.startsWith('public/')).length, changed, head: baseline.head, firebaseOwner: 'timeline', firebaseProject: 'sayari-81b58', zzzFirebaseDependencies: 0, originalVectorsPreserved: true };
await fs.writeFile('evidence/project-split/verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
