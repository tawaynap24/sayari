import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const baseline = JSON.parse(await fs.readFile('evidence/project-split/baseline.json', 'utf8'));
const special = {
  'tools/timeline/preservation.mjs': 'zzz/tools/calculator/preservation.mjs',
  'tools/timeline/audit.mjs': 'tools/project-split/archive/timeline-audit.mjs',
  'tools/nanoka/scripts/delivery-report.mjs': 'tools/project-split/archive/nanoka-delivery-report.mjs',
  'tools/localization/report.mjs': 'tools/project-split/archive/localization-report.mjs',
};
const locate = file => special[file] || (/^(src\/features\/timeline|src\/views\/timeline|functions|tools\/timeline)\//.test(file) ? `timeline/${file}` : /^(src|public|tools\/(?:nanoka|localization))\//.test(file) ? `zzz/${file}` : file);
const files = Object.entries(baseline.hashes), records = [];
let next = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < files.length) {
    const [from, before] = files[next++], to = locate(from);
    const bytes = await fs.readFile(to);
    const after = crypto.createHash('sha256').update(bytes).digest('hex');
    records.push({ from, to, bytes: bytes.length, contentChanged: before !== after, before, after });
  }
}));
records.sort((a,b) => a.from.localeCompare(b.from));
await fs.writeFile('evidence/project-split/file-map.json', JSON.stringify({ at: new Date().toISOString(), total: records.length, preserved: records.filter(r => !r.contentChanged).length, files: records }, null, 2));
console.log(JSON.stringify({ total: records.length, preserved: records.filter(r => !r.contentChanged).length, edited: records.filter(r => r.contentChanged).map(r => r.to) }, null, 2));
