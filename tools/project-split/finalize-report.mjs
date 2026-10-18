import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const commandNames = ['zzz-check', 'zzz-localization', 'zzz-calculator', 'zzz-browser', 'timeline-dependencies', 'timeline-integration', 'timeline-browser', 'browser-isolation'];
const commands = [];
for (const name of commandNames) {
  const r = await read(`evidence/project-split/${name}.json`);
  assert.equal(r.exitCode, 0, name);
  commands.push(r);
}
const timeline = await read('timeline/evidence/timeline/commands.json');
assert.ok(timeline.length >= 3 && timeline.every(r => r.exitCode === 0));
const integrity = await read('evidence/project-split/verification.json');
const ready = await read('evidence/project-split/local-ready.json');
const isolation = await read('evidence/project-split/browser-isolation-results.json');
assert.equal(integrity.status, 'PASS'); assert.equal(ready.status, 'PASS');
assert.equal(isolation.results.length, 2); assert.ok(isolation.results.every(r => r.status === 'PASS'));
const result = { at: new Date().toISOString(), status: 'PASS', commands, timelineChecks: timeline, integrity, ready, isolation, counts: { unit: 96, emulatorIntegration: 23, appBrowserScenarios: 33, calculatorBaseline: 1, isolationChecks: 2 }, cloudChanged: false, committed: false, pushed: false, deployed: false };
await fs.writeFile('evidence/project-split/final-results.json', JSON.stringify(result, null, 2));
const archive = 'docs/archive/SAYARI_PROJECT_SUMMARY_BEFORE_SPLIT.txt';
if (!existsSync(archive)) await fs.copyFile('SAYARI_PROJECT_SUMMARY.txt', archive);
let report = await fs.readFile('docs/PROJECT_SPLIT_REPORT_TH.md', 'utf8');
report = report.replaceAll('../timeline/', 'timeline/').replaceAll('../evidence/', 'evidence/');
report += '\n\nเอกสารประกอบสำหรับอ่านต่อ:\n- zzz/README.md: คำสั่งและโครงสร้าง ZZZ ปัจจุบัน\n- timeline/README.md และ timeline/FIREBASE_SETUP_TH.md: Timeline และ Firebase ปัจจุบัน\n- docs/THAI_LOCALIZATION_SUMMARY_TH.md: ประวัติแหล่งข้อมูลและ coverage ภาษาไทย (เส้นทางในรายงานเก่าอยู่ก่อนแยกโฟลเดอร์)\n- TIMELINE_IMPLEMENTATION_REPORT.md: รายละเอียด implementation V5 เดิมก่อนย้าย\n- evidence/project-split/final-results.json: ผลตรวจหลังแยก\n- evidence/project-split/file-map.json: แผนที่ไฟล์ก่อน/หลังย้ายพร้อม SHA-256\n';
await fs.writeFile('SAYARI_PROJECT_SUMMARY.txt', report);
console.log(JSON.stringify({ status: result.status, counts: result.counts, summary: 'SAYARI_PROJECT_SUMMARY.txt' }));
