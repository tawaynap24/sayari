import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = 'evidence/project-split/baseline.json';
if (fs.existsSync(output)) throw Error('Baseline already exists');
const hashes = {};
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'lib'].includes(item.name)) continue;
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) walk(file);
    else hashes[file] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
}
for (const dir of ['src', 'public', 'functions', 'tools/nanoka', 'tools/localization', 'tools/timeline', '_handoff', 'SAYARI_NANOKA_ZZZ_CODEX_KIT_20261018']) walk(dir);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }), hashes }, null, 2));
console.log(`Saved ${Object.keys(hashes).length} hashes`);
