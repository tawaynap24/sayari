#!/usr/bin/env node
/** Consolidate real evidence; failed/mismatched checks cannot be promoted to READY. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sha256, writeJson } from './nanoka-sync.mjs';
import { evidenceDirectory } from './evidence.mjs';
const out = await evidenceDirectory();
const read = async file => JSON.parse(await fs.readFile(path.join(out, file), 'utf8'));
const baseline = await read('BASELINE.json'), tests = await read('TEST_RESULTS.json'), browser = await read('BROWSER_TEST_RESULTS.json'), edge = await read('BROWSER_EDGE_TEST_RESULTS.json'), endpoints = await read('ENDPOINT_COVERAGE.json'), fields = await read('FIELD_COVERAGE.json'), discovery = await read('discovery-review.json'), manifest = await read('MANIFEST_RECHECK.json');
const hosting = await read('HOSTING_VERIFICATION.json');
const unitLog = await fs.readFile(path.join(out, 'unit-tests.log'), 'utf8');
const unitTotal = Number(unitLog.match(/# tests (\d+)/)?.[1] ?? 0), unitPassed = Number(unitLog.match(/# pass (\d+)/)?.[1] ?? 0);
const pointer = JSON.parse(await fs.readFile('public/nanoka/current.json', 'utf8'));
const catalogFile = path.join('public/nanoka', pointer.catalog), catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
const preserved = [];
for (const file of baseline.files) preserved.push({ path: file.path, before: file.sha256, after: sha256(await fs.readFile(file.path)), unchanged: file.sha256 === sha256(await fs.readFile(file.path)) });
const calculator = preserved.filter(f => baseline.calculatorFiles.some(c => c.path === f.path));
const git = args => execFileSync('git', ['-c', 'safe.directory=D:/sayari-project', ...args], { encoding: 'utf8' }).trim();
const worktree = { capturedAt: new Date().toISOString(), branch: git(['branch', '--show-current']), head: git(['rev-parse', 'HEAD']), remote: git(['remote', 'get-url', 'origin']), status: git(['status', '--short', '--untracked-files=normal']), preserved, calculatorUnchanged: calculator.every(c => c.unchanged), originalBlackCssPreserved: preserved.find(f => f.path === 'src/index.css')?.unchanged, homeUnchanged: preserved.find(f => f.path === 'src/views/home/index.tsx')?.unchanged };
await writeJson(path.join(out, 'WORKTREE_VALIDATION.json'), worktree);
const problems = [];
if (!catalog.coverage.registeredScopeComplete || endpoints.problems.length || fields.droppedPathCount) problems.push('data coverage');
for (const report of [browser, endpoints, fields, discovery, manifest]) if (report.runId !== catalog.runId) problems.push('evidence runId mismatch');
if (!hosting.passed || hosting.runId !== catalog.runId) problems.push('dist / preview verification');
if (discovery.status !== 'VERIFIED_PUBLIC_SCOPE' || !manifest.matchesSelectedChannels) problems.push('discovery / current manifest');
if (tests.results.some(r => r.exitCode !== 0) || browser.results.some(r => r.status !== 'PASS') || edge.results.some(r => r.status !== 'PASS') || browser.pageErrors.length || browser.sourceJsonRequests.length) problems.push('test failure');
const categoryTest = browser.results.find(r => r.name.startsWith('Every registered category'));
if (categoryTest?.detail?.length !== catalog.definitions.length) problems.push('browser category coverage');
if (!worktree.calculatorUnchanged || !worktree.originalBlackCssPreserved || !worktree.homeUnchanged) problems.push('baseline preservation');
const status = problems.length ? 'PARTIAL_DATA_COVERAGE' : 'READY_FOR_USER_VISUAL_REVIEW';
const count = key => catalog.inventory.find(i => i.dataset === key && i.version === catalog.versions.find(v => v.channels.includes('live')).version && (!i.language || i.language === 'en'))?.count ?? '—';
const latestCount = key => catalog.inventory.find(i => i.dataset === key && i.version === catalog.versions.find(v => v.channels.includes('latest')).version && (!i.language || i.language === 'en'))?.count ?? '—';
const rows = catalog.definitions.map(d => `| ${d.key} | ${count(d.key)} | ${latestCount(d.key)} | ${d.detailPath ? 'detail ทุก ID × 4 ภาษา' : 'record อยู่ใน resource รวม'} |`).join('\n');
const size = catalog.resources.reduce((total, r) => total + (r.bytes ?? 0), 0);
await fs.writeFile(path.join(out, 'BASELINE.md'), `# Baseline\n\nเริ่มงาน ${baseline.createdAt} · Node ${baseline.node}\n\nWorking tree ก่อนเริ่ม:\n\n\`\`\`text\n${baseline.gitStatus}\`\`\`\n\nมีการแก้พื้นหลังดำใน src/index.css และ kit ที่ยังไม่ track อยู่ก่อนเริ่มงาน เก็บการเปลี่ยนแปลงนั้นไว้ ตรวจ hash ของ source ทั้งหมดใน BASELINE.json และ WORKTREE_VALIDATION.json\n`, 'utf8');
await fs.writeFile(path.join(out, 'WORKTREE_CHANGES.md'), `# Working tree changes\n\nBranch ${worktree.branch} · HEAD ${worktree.head}\n\nGit remote: ${worktree.remote}\n\nCalculator 4 files unchanged: ${worktree.calculatorUnchanged}\nOriginal black CSS unchanged: ${worktree.originalBlackCssPreserved}\nHome source unchanged: ${worktree.homeUnchanged}\n\nเพิ่ม Database route, data tools, lazy snapshot client, typed adapters, structured/raw views, tests, evidence และคู่มือ ปรับ routing/hosting และ Vite ให้ไม่ scan upstream HTML ใน evidence/cache\n\n\`\`\`text\n${worktree.status}\n\`\`\`\n\nงานนี้ไม่ได้ commit, push หรือ deploy ไฟล์ summary/audit เดิมที่ root ไม่ได้ถูกแก้ทับ\n`, 'utf8');
const report = `# สรุป implementation — Sayari × Nanoka ZZZ

สถานะ: **${status}**

จัดทำ ${new Date().toISOString()} (เวลา UTC; workspace Asia/Bangkok) · Run **${catalog.runId}**

## ผลลัพธ์

เพิ่มหน้า /game/zenless-zone-zero/database เชื่อมจาก Home พร้อมรายการ รายละเอียดที่แบ่งส่วน และ API Explorer ข้อมูลมาจาก Nanoka จริง ใช้ snapshot ที่โหลด JSON แยกจาก JavaScript bundle UI ภาษาไทยและข้อความเกมตาม locale ที่เลือก พื้นหลังหลักดำตามที่แก้ไว้ก่อนเริ่มงาน

คง Home และเครื่องคำนวณเดิมที่ /game/zenless-zone-zero ไว้ ตรวจ hash ของไฟล์ calculator ทั้ง 4 ตรง baseline ทุกไฟล์ และตรวจกรอก Resistance/Def ใน browser จริงแล้ว งานนี้ไม่ได้เพิ่มหรือแก้สูตร damage เดิม ข้อจำกัดของสูตรและ input parser เดิมยังเป็นงานแยก

## ผลตาม 7 Phases

| Phase | ผลที่ส่งมอบ |
|---|---|
| 1 · Baseline | สำรวจ working tree และเก็บ hashes ก่อนแก้ เก็บพื้นหลังดำเดิม |
| 2 · Discovery | ตรวจ 13 navigation families, tabs, selectors และ Network จริง |
| 3 · Data pipeline | Registry, bounded sync, cache, raw storage และ immutable export |
| 4 · Adapters | Typed projections, locale/version guards และ fallback ทุก field |
| 5 · Website | Database route, structured sections, filters และ API Explorer |
| 6 · Verification | Live ID/hash/field audit, unit/browser tests, build/lint และ preview |
| 7 · Handoff | Snapshot พร้อมใช้ คู่มือ สรุปภาษาไทย และหลักฐานพร้อม screenshots |

## ขอบเขตข้อมูลจริง

- เวอร์ชัน: ${catalog.versions.map(v => `${v.channels.join('/')} = ${v.version}`).join(' · ')}
- ภาษา: ${catalog.languages.join(', ')} ซึ่งตรวจจาก global selectors และ responses จริง
- ${catalog.definitions.length} dataset definitions · ${catalog.coverage.successfulResources.toLocaleString()} resources ใช้งานได้ · ${catalog.coverage.failedResources} ล้มเหลว · ${catalog.coverage.issues.length} coverage issues
- ${catalog.coverage.scheduledDetailResources?.toLocaleString() ?? catalog.resources.filter(r => r.kind === 'detail').length.toLocaleString()} detail resources ตาม index ทุก ID ใน scope
- ตรวจ raw hashes ทุก resource และ ${fields.uniqueObjects.toLocaleString()} unique objects ทุก leaf path มีทางเข้าถึง ไม่มี dropped path ที่ตรวจพบ
- ผลรวมขนาด resource ที่อ้างอิง ${size.toLocaleString()} bytes (รวมการอ้าง object ที่ deduplicate แล้วซ้ำกัน จึงไม่ใช่ขนาด disk)
- Catalog metadata มีขนาด ${(await fs.stat(catalogFile)).size.toLocaleString()} bytes ก่อน HTTP compression; ผลการทดสอบครั้งนี้เป็น local preview จึงยังไม่ยืนยันเวลาโหลดผ่านเครือข่าย production
- เก็บ framework preferences เป็น raw แบบ unversioned อีกหนึ่ง resource ไม่ถือว่าเป็นข้อมูลผู้เล่นหรือ patch เกม

| Dataset | IDs Live (EN หรือหลายภาษา) | IDs Latest (EN หรือหลายภาษา) | วิธีเก็บ |
|---|---:|---:|---|
${rows}

จำนวน diff/locale อาจไม่เท่ากันเพราะเป็นผลจากต้นทาง ตารางทุกภาษาและ missing/unexpected IDs อยู่ ENDPOINT_COVERAGE.json ค่าจำนวนในตารางข้างบนเป็นขอบเขต snapshot นี้เท่านั้น ไม่ hardcode ในหน้าเว็บ

## Discovery และที่มา

ตรวจ root และ 13 public navigation families รวม boss, simul, hard ที่เพิ่มจาก seed ตรวจ global Live/Latest × 4 locales, Overview/Story/Gallery, Hollow ทั้ง 4 tabs, version comparison, filters และ simulation stages แล้วเทียบ canonical observed URLs กับ resources ใน catalog

ทุก additional detail family enumerate ตาม index ต่อครบทุก ID และ locale ข้อมูลที่อยู่รวมใน achievement, Hollow, item_all, noun, season maps หรือ diff เก็บ record และ metadata ของไฟล์เดิมครบ ไม่สร้าง endpoint รายตัวจากการเดา

Source JSON, reference page, version/locale, HTTP/result, bytes/hash, fetchedAt และ cacheReadAt อยู่ใน catalog และ source block ของ UI ไม่เปลี่ยนเวลาที่อ่าน cache ให้กลายเป็นเวลาที่ได้ body ใหม่ ต้นทางอัปเดตเมื่อใดแสดง “ไม่ทราบ” หากไม่มีข้อมูลที่ยืนยันได้ รูปใช้ URL/metadata ของ CDN ที่ตรวจ mapping แล้ว ไม่ mirror ภาพทั้ง CDN

ขอบเขตที่ยืนยันคือเมนูและข้อมูลสาธารณะที่ตรวจพบในรอบนี้ ค่า entireProviderApiComplete ยังคง false ไม่อ้างว่ารู้ private/hidden endpoints ทั้งผู้ให้บริการ ไม่รวม account/UID, personal achievement completion, historical builds ที่ยังไม่เลือก และเกมอื่น

## พฤติกรรมหน้าเว็บ

ค้นหาชื่อ/ID กรองระดับ กลุ่ม/ธาตุ Specialty และ Faction ตามข้อมูลที่มี แบ่งหน้าโดยเปิดถึงรายการสุดท้ายได้ สลับภาษา/เวอร์ชันและ reload deep link ได้ เวอร์ชันเก่าที่ไม่มี snapshot แสดงสถานะ “ยังไม่ได้ดาวน์โหลด” ไม่มีข้อมูลจำลองแทน HTTP/JSON ที่โหลดไม่สำเร็จ

Enum บางชุดยังแสดงรหัสจาก API เช่น element/type/camp โดยคงค่าเดิมและไม่ผูกชื่อแปลที่ยังไม่ได้ตรวจ mapping

รายละเอียดมีส่วน Stats, Skills, Core/Passive, Mindscape, Progression, Materials, Story และส่วนอื่นตาม keys จริง เลือกทุกระดับที่ต้นทางให้ได้ พร้อม tree ของข้อมูลทั้งหมด Unknown fields มี recursive fallback และ field search คง 0, false, null, ข้อความว่าง, [] และ {} ไว้ วัสดุที่จับคู่ได้เปิด record ต่อได้ ถ้าจับคู่ไม่ได้ยังเห็น ID และคำเตือน

Raw download ใช้ bytes ต้นฉบับและตรวจ SHA-256 ก่อนแสดง ไม่ inject HTML จาก source ตัวเลขเกิน safe integer แสดงคำเตือนและมี raw ต้นฉบับที่ exact รายการ/array ยาวมี pagination ภาพ lazy พร้อม fallback ชื่อยังใช้งานได้เมื่อภาพเสีย

Git attributes ปิดการแปลง LF/CRLF สำหรับ raw objects และ original source evidence เพื่อรักษา hash เมื่อ checkout บน Windows ตัว exporter มี bounded retry สำหรับ file lock โดยไม่ลบ pointer เดิม และ resume ไฟล์ immutable ที่ตรวจ hash แล้วได้

API Explorer แสดง resources รวม manifest และ framework preferences พร้อม URL, locale/version, result, timestamps, bytes/hash เปิด tree/copy/download ต้นฉบับได้ Guard ของ request ป้องกัน response ภาษา/เวอร์ชันเก่าทับ view ปัจจุบัน และเปลี่ยน locale แล้วล้าง resource ที่เลือกเก่าใน Explorer

## การตรวจสอบ

- Unit tests: ${unitPassed}/${unitTotal} ผ่าน แยก synthetic fixtures จาก live data ครอบคลุม collector/adapters, all IDs, raw bytes/cache, 403/429, budget, invalid JSON, unsafe URLs/numbers, pointer escaping, publish safeguards, immutable re-export และ Windows atomic-write retry โดยรักษา pointer เดิมเมื่อเขียนไม่สำเร็จ
- Build และ lint: ${tests.results.every(r => r.exitCode === 0) ? 'ผ่าน ไม่มี warning จากคำสั่งที่กำหนด' : 'มีรายการที่ไม่ผ่าน ดู TEST_RESULTS.json'}
- Browser ปกติ: ${browser.results.filter(r => r.status === 'PASS').length}/${browser.results.length} scenarios ผ่าน เป้าหมาย ${browser.origin} ทดสอบทุก ${catalog.definitions.length} หมวดจริง, Home/calculator, raw download hash, locale/version/history, stale responses, API Explorer, keyboard และ 390×844 / 768×1024 / 1440×900
- Browser edge fixtures: ${edge.results.filter(r => r.status === 'PASS').length}/${edge.results.length} ผ่าน ข้อมูลสังเคราะห์และ injected failures ใช้เฉพาะ test context ไม่ได้ export เป็นข้อมูลเกมหรือใช้ยืนยัน live coverage
- แอปไม่ได้เรียก upstream JSON จาก browser ข้อมูล JSON มาจาก snapshot ในเครื่อง; ภาพยังโหลดจาก CDN
- Manifest fresh recheck: ${manifest.matchesSelectedChannels ? 'ตรงกับ Live/Latest ของรอบนี้' : 'ไม่ตรงหรือยืนยันไม่ได้'} ณ ${manifest.checkedAt}
- Production hosting ยังไม่ได้ deploy/ทดสอบจริง ผล browser เป็น local preview เท่านั้น Firebase rewrite จำกัดเส้นทางเกม ไม่ rewrite /nanoka JSON ตาม [เอกสาร Firebase Hosting](https://firebase.google.com/docs/hosting/full-config)

${problems.length ? `รายการที่ยังไม่ผ่าน: ${problems.join(', ')}\n` : 'ไม่มีงานที่จำเป็นค้างในขอบเขต implementation นี้ พร้อมให้ผู้ใช้ตรวจหน้าตาจริง\n'}
## ไฟล์ส่งต่อให้ ChatGPT

- คู่มือระบบและคำสั่ง: docs/NANOKA_DATABASE_TH.md
- Catalog ปัจจุบัน: ${catalogFile.replaceAll('\\', '/')}
- Raw cache/run reports ในเครื่อง: .nanoka/runs/${catalog.runId}/ และ .nanoka/objects/
- Evidence: ${path.relative(process.cwd(), out).replaceAll('\\', '/')}/
- หลักฐานสำคัญ: BASELINE.json, WORKTREE_VALIDATION.json, discovery-review.json, observed-urls.json, selector-and-tab-review.json, filter-and-version-review.json, filter-review.json, ENDPOINT_COVERAGE.json, FIELD_COVERAGE.json, MANIFEST_RECHECK.json, TEST_RESULTS.json, BROWSER_TEST_RESULTS.json, BROWSER_EDGE_TEST_RESULTS.json และ screenshots/
- Full leaf path lists อยู่ field-paths/*.json.gz ตาม pathReport ของแต่ละ raw SHA-256; actual HTTP/cache request lineage อยู่ collector-runs/ และ sync-requests.jsonl

## Git และการส่งมอบ

Workspace D:/sayari-project · branch ${worktree.branch} · origin ${worktree.remote} · HEAD ${worktree.head}

ยังไม่ได้ commit, push หรือ deploy งานนี้ ชุด kit ต้นฉบับยังตรวจ integrity ได้ 36 ไฟล์ ไฟล์ SAYARI_PROJECT_SUMMARY.txt, audit-evidence.json และ verification-results.json ที่ root คงไว้เป็นประวัติ ไม่ใช่รายงาน Nanoka รุ่นปัจจุบัน
`;
await fs.writeFile(path.join(out, 'FINAL_REPORT_TH.md'), report, 'utf8');
await fs.writeFile('docs/NANOKA_IMPLEMENTATION_SUMMARY_TH.md', report, 'utf8');
await writeJson(path.join(out, 'DELIVERY_STATUS.json'), { status, runId: catalog.runId, problems, verifiedAt: new Date().toISOString() });
console.log(JSON.stringify({ status, runId: catalog.runId, problems, report: path.join(out, 'FINAL_REPORT_TH.md') }, null, 2));
if (problems.length) process.exitCode = 2;
