#!/usr/bin/env node
/** Package the observed source evidence and bind a reviewed scope to one published run. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, writeJson } from './nanoka-sync.mjs';
import { evidenceDirectory } from './evidence.mjs';
const out = await evidenceDirectory();
const pointer = JSON.parse(await fs.readFile('public/nanoka/current.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile(path.join('public/nanoka', pointer.catalog), 'utf8'));
if (!catalog.coverage.registeredScopeComplete) throw new Error('Cannot sign off an incomplete registered scope');
const captures = [];
for (const [directory, target] of [['discovery', 'observed-urls.json'], ['review', 'selector-and-tab-review.json'], ['selector-review', 'filter-and-version-review.json'], ['filter-review', 'filter-review.json']]) {
  const source = `.nanoka/${directory}/observed-urls.json`;
  const data = JSON.parse(await fs.readFile(source, 'utf8'));
  for (const record of data.records) {
    if (!record.file) continue;
    const bytes = await fs.readFile(path.join('.nanoka', directory, record.file));
    if (sha256(bytes) !== record.sha256) throw new Error(`Changed observation body: ${record.url}`);
    record.file = `discovery-bodies/${record.sha256}.json`;
    await fs.mkdir(path.join(out, 'discovery-bodies'), { recursive: true });
    await fs.writeFile(path.join(out, record.file), bytes);
  }
  await writeJson(path.join(out, target), { ...data, originalCapture: source });
  captures.push({ source, target, data });
}
const normalize = value => { const url = new URL(value); return `${url.origin}${decodeURIComponent(url.pathname)}${url.search}`; };
const available = new Set(catalog.resources.map(r => normalize(r.url)));
const observed = captures.flatMap(c => c.data.records);
const unmatched = [...new Set(observed.filter(r => r.isJson && r.status >= 200 && r.status < 300 && !available.has(normalize(r.url))).map(r => r.url))];
const failures = observed.filter(r => [401, 403, 429].includes(r.status));
const main = captures[0].data, review = captures[1].data;
const families = [...new Set(main.allInternalLinks.map(u => new URL(u).pathname.split('/')[1]).filter(Boolean))];
const routes = families.map(family => {
  const url = `https://zzz.nanoka.cc/${family}`;
  const page = main.pageOutcomes.find(p => p.url === url), checked = review.reviews.find(r => r.url === url && r.controls);
  const definitions = catalog.definitions.filter(d => d.referenceList === url);
  return { url, status: page?.status === 200 && checked ? 'VERIFIED' : 'UNRESOLVED', label: checked?.title ?? family, datasets: definitions.map(d => d.key), jsonUrls: [...new Set(observed.filter(r => r.pageUrl === url && r.isJson).map(r => r.url))], evidenceFiles: captures.map(c => c.target), notes: 'Representative detail structure reviewed in browser; every ID and locale/version is enumerated and audited separately in ENDPOINT_COVERAGE.json. Historical versions and personal completion state are outside this scope.' };
});
const selectors = review.reviews.filter(r => r.kind === 'global_selector');
const hollowTabs = review.reviews.find(r => r.url === 'https://zzz.nanoka.cc/hollow')?.tabs ?? [];
const agentTabs = review.reviews.find(r => /\/character\/\d+$/.test(r.url ?? ''))?.tabs ?? [];
const filterActions = captures.slice(2).flatMap(c => c.data.controls);
const problems = [];
if (unmatched.length) problems.push({ type: 'unregistered_observed_json', urls: unmatched });
if (failures.length || main.haltReason) problems.push({ type: 'source_access_failure', failures, haltReason: main.haltReason });
if (routes.some(r => r.status !== 'VERIFIED') || families.length !== 13) problems.push({ type: 'route_scope_changed_requires_review', families });
if (selectors.length !== 8 || hollowTabs.length !== 4 || !['Overview', 'Story', 'Gallery'].every(t => agentTabs.includes(t))) problems.push({ type: 'missing_selector_or_tab_review' });
if (filterActions.filter(c => c.kind === 'stage_selection').length < 4 || filterActions.filter(c => c.kind === 'selected_scope_version_comparison').length < 30) problems.push({ type: 'missing_stage_or_comparison_review' });
const endpointAudit = JSON.parse(await fs.readFile(path.join(out, 'ENDPOINT_COVERAGE.json'), 'utf8'));
if (endpointAudit.runId !== catalog.runId || endpointAudit.problems.length) problems.push({ type: 'endpoint_audit_not_clean_for_this_run' });
const categories = catalog.definitions.map(d => ({ key: d.key, status: problems.length ? 'REVIEW_PENDING' : 'VERIFIED', note: d.detailPath ? 'อ่าน index และ detail ทุก ID ใน Live/Latest × 4 locales พร้อมตรวจ raw hash/field paths' : 'เก็บ record และ metadata ทั้งหมดจาก localized resource; ไม่มีการเดา detail endpoint' }));
const signoff = { schemaVersion: 1, runId: catalog.runId, reviewedAt: new Date().toISOString(), status: problems.length ? 'REVIEW_PENDING' : 'VERIFIED_PUBLIC_SCOPE', entireProviderApiComplete: false, scope: { versions: catalog.versions, languages: catalog.languages, navFamilies: families }, routes, additionalRoutes: ['boss', 'simul', 'hard'], categories, unresolved: problems, notes: ['ตรวจครบขอบเขตเมนูสาธารณะที่พบในรอบนี้ พร้อม index IDs ของ Live/Latest และ 4 ภาษา ไม่ครอบคลุม private/hidden endpoints หรือ historical versions ที่ยังไม่เลือก sync', 'Framework JSON ของค่าตั้งค่าหน้าเว็บเก็บเป็น unversioned raw ใน API Explorer ไม่ตีความเป็นชุดข้อมูลผู้เล่นหรือ patch เกม', 'การตรวจ browser ใช้ตัวอย่างต่อโครงสร้าง ส่วน raw hashes, IDs และ leaf paths ตรวจทุก resource ใน scope; ภาพเก็บ URL/metadata ไม่ mirror ทั้ง CDN'] };
await writeJson(path.join(out, 'discovery-review.json'), signoff);
await writeJson('public/nanoka/discovery.json', signoff);
const runDir = path.join('.nanoka/runs', catalog.runId);
await fs.copyFile(path.join(runDir, 'requests.jsonl'), path.join(out, 'sync-requests.jsonl'));
await fs.copyFile(path.join(runDir, 'plan.json'), path.join(out, 'SYNC_PLAN.json'));
// Cache records retain their original fetchedAt. Keep the actual HTTP runs as lineage evidence.
for (const entry of await fs.readdir('.nanoka/runs', { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^[A-Za-z0-9._-]+$/.test(entry.name)) continue;
  const source = path.join('.nanoka/runs', entry.name), target = path.join(out, 'collector-runs', entry.name);
  await fs.mkdir(target, { recursive: true });
  for (const file of ['coverage.json', 'requests.jsonl']) {
    try { await fs.copyFile(path.join(source, file), path.join(target, file)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
await fs.writeFile(path.join(out, 'SOURCE_DISCOVERY.md'), `# Nanoka public source discovery\n\nRun: ${catalog.runId}\n\nตรวจ root และ 13 navigation families จาก URL จริง ทุกหน้าที่ capture มีผล HTTP ตาม observed-urls.json ตรวจ global selectors 2 channels × 4 locales, Overview/Story/Gallery, Hollow ทั้ง 4 tabs, comparison controls, local category filters และ simulation stage buttons\n\nCanonical endpoint templates อยู่ tools/nanoka/reference/extensions.json แต่ละรายการมี observed URL/page/time ไม่เดา ID; details ทุก ID ตรวจใน ENDPOINT_COVERAGE.json\n\nObserved successful JSON URLs ที่ยังไม่อยู่ใน catalog: ${unmatched.length}\n\nFramework __data.json มี locale, enableBgShadow, dataVersion เป็น UI preferences เก็บ raw โดยไม่ระบุ version/locale ของ resource; game data ใช้ versioned static resources ที่ตรวจพบจริง\n\nขอบเขตไม่รวม personal achievement completion, account/UID, historical builds ที่ไม่ได้เลือก และ binary ทั้ง CDN ไม่ใช้ credentials ของผู้ใช้ และไม่ bypass 401/403/429\n\nหลักฐาน Network ทุกไฟล์อ้าง body ที่ตรวจ SHA-256 แล้วใน discovery-bodies/\n`, 'utf8');
console.log(JSON.stringify({ runId: catalog.runId, status: signoff.status, families: families.length, observedResponses: observed.length, filterActions: filterActions.length, problems }, null, 2));
if (problems.length) process.exitCode = 2;
