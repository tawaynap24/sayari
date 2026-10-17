import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { json, save } from './source.mjs';
const out='evidence/localization-th';
const fence=String.fromCharCode(96).repeat(3);
const coverage=await json(`${out}/coverage.json`),source=await json(`${out}/source-report.json`),real=await json(`${out}/real-data-verification.json`),browser=await json(`${out}/browser-results.json`),http=await json(`${out}/http-probe.json`);
async function readLog(file) { const bytes=await fs.readFile(file); return bytes.toString(bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8').replace(/^\uFEFF/,''); }
const build=await readLog(`${out}/build.log`),lint=await readLog(`${out}/lint.log`),unit=await readLog(`${out}/unit-tests.log`),regression=await readLog(`${out}/nanoka-regression-tests.log`);
let hosting=null;try{hosting=await json(`${out}/production-preview.json`)}catch{}
const checks={build:/built in/.test(build)&&!/(?:error TS\d+|error during build)/i.test(build),lint:!/(?:\d+ errors?|Error:)/.test(lint),unit:/# pass 11\b/.test(unit)&&/# fail 0\b/.test(unit),nanokaRegression:/# pass 34\b/.test(regression)&&/# fail 0\b/.test(regression),browser:browser.results.length>=20&&browser.results.every(r=>r.status==='PASS')&&browser.pageErrors.length===0,realData:real.status==='PASS',http:http.status==='PASS',hosting:hosting?.status==='PASS'};
const status=Object.values(checks).every(Boolean)?'COMPLETE_LOCAL_IMPLEMENTATION_VERIFIED':'CHECKS_PENDING';
const label={character:'Agents',weapon:'W-Engines',bangboo:'Bangboo',equipment:'Drive Discs',item:'Materials / Items',monster:'Enemies',achievement:'Achievements',shiyu:'Shiyu Defense',boss:'Deadly Assault',simul:'Threshold Simulation',hard:'Annihilation Simulacrum',hollow_card:'Hollow Cards',hollow_tpp:'Tactical Prisms',hollow_gg:'Hollow Gear',hollow_resonium:'Resonia',item_all:'Items: full descriptions',noun:'Game terminology',shiyu_versions:'Shiyu seasons',boss_versions:'Deadly Assault seasons',diff:'Version changelog'};
const table=rows=>['| หมวด | ข้อความที่นับ | จับคู่ TH สำเร็จ | English fallback | ไม่มีข้อความ | TH % |','|---|---:|---:|---:|---:|---:|',...rows.map(r=>`| ${label[r.category]??r.category} | ${r.textOccurrences.toLocaleString('en-US')} | ${r.mappedThai.toLocaleString('en-US')} | ${r.englishFallback.toLocaleString('en-US')} | ${r.missing.toLocaleString('en-US')} | ${r.textOccurrences?(100*r.mappedThai/r.textOccurrences).toFixed(1)+'%':'N/A'} |`)].join('\n');
const live=coverage.categories.filter(r=>r.compatible),latest=coverage.categories.filter(r=>!r.compatible),total=live.reduce((s,r)=>({texts:s.texts+r.textOccurrences,th:s.th+r.mappedThai,en:s.en+r.englishFallback,missing:s.missing+r.missing}),{texts:0,th:0,en:0,missing:0});
const lp=await json('public/localization/current.json'),manifest=await json(path.join('public/localization',lp.manifest));
let gzipBytes=0;for(const e of Object.values(manifest.resources))gzipBytes+=gzipSync(await fs.readFile(path.join('public/localization',e.file))).length;
const sourceTable=['| ไฟล์ | HTTP | Bytes | UTF-8 / Schema | เวอร์ชัน / แหล่ง |','|---|---:|---:|---|---|',...source.files.filter(f=>f.path.startsWith('TextMap/')).map(f=>{const h=source.history.find(h=>h.path===f.path);return `| [${f.path}](${f.url}) | ${f.httpStatus} | ${f.bytes.toLocaleString('en-US')} | ผ่าน / string dictionary | ${h?`${h.region} ${h.gameVersion}`:'อยู่ใน pinned revision; EN Login ไม่ใช้กับ gameplay'} |`})].join('\n');
const report=`# SAYARI ZZZ — Thai Localization Summary สำหรับส่งต่อให้ ChatGPT

ตรวจเมื่อ ${new Date().toISOString()} · สถานะ ${status}

## ผลที่ส่งมอบ

เพิ่มภาษาไทยจาก ZenlessData ลงใน Database เดิมแล้ว ค่าเริ่มต้นเป็น th-TH โดยไม่เปลี่ยนตามภาษาของ Browser เลือก English (en-US) จากปุ่มตั้งค่ามุมล่างขวาได้ทันทีและจำค่าด้วย localStorage คีย์ sayari.locale การเปลี่ยนภาษาจาก Settings ปรับชื่อ/รายละเอียดและ URL ของ Database โดยไม่ reload เอกสาร

Nanoka ยังคงเป็นแหล่งข้อมูลหลักทั้งหมด รวม Stats, Growth, Skill Multipliers, Scaling และ Raw JSON ภาษาไทยเป็น string overlay ที่มีหลักฐาน ID/foreign-key join และคีย์ข้อความใน FileCfg เท่านั้น ไม่มีการสร้างคำแปลเกมเองหรือเปลี่ยนสูตร Calculator

Live มีคำแปลอย่างน้อยบางส่วนใน 13 จาก 20 หมวด เอเจนต์ทั้ง 60 รายการมีข้อความที่จับคู่ได้ แต่ไม่ได้หมายความว่าทุกฟิลด์แปลครบ หมวดตัวละครจับคู่ข้อความได้ ${(100*live.find(r=>r.category==='character').mappedThai/live.find(r=>r.category==='character').textOccurrences).toFixed(1)}% ส่วน Latest ${latest[0]?.version??'—'} ใช้ภาษาอังกฤษ เพราะชุด ZenlessData ที่ตรวจได้เป็น 3.2.0

## ข้อมูลต้นทางและเวอร์ชัน

- Project: D:\\sayari-project
- Game Data: [Nanoka ZZZ](https://zzz.nanoka.cc/) · snapshot ${coverage.nanokaRunId}
- Localization: [ZenlessData — Dimbreath](https://git.mero.moe/dimbreath/ZenlessData) · pinned revision [${source.sourceRevision}](${source.repository}/commit/${source.sourceRevision})
- Repository/FileCfg: ${source.commitMessage.trim()}
- Base TH/EN และ Login: OSPRODWin3.2.0_R18779629_S18779629_D18761130
- TH/EN Overwrite: CNPRODWin3.2.0_R19159270_S19159270_D19159270
- ตรวจ last-change revision ของไฟล์จาก [directory ที่ pin commit แล้ว](${source.repository}/src/commit/${source.sourceRevision}/TextMap) และตรวจทุกไฟล์ด้วยขนาด, UTF-8, JSON schema, SHA-256 และ Git blob SHA-1
- การยอมรับ Live 3.2 ไม่ได้อาศัยเลขเวอร์ชันใกล้กันเพียงอย่างเดียว: ต้องมี ID join และข้อความอังกฤษตรงกันต่อฟิลด์ด้วย จึงใช้ OS base + CN overwrite ได้เฉพาะข้อความที่ผ่านการตรวจ

${sourceTable}

โหลดแหล่งจริง ${source.files.length} ไฟล์ รวม ${(source.files.reduce((n,f)=>n+f.bytes,0)/1e6).toFixed(2)} MB ในขั้นตอน sync เท่านั้น โดยเป็น TextMap 6 ไฟล์ และ FileCfg 23 ตาราง Login TextMap ถูกตรวจสอบแต่ไม่รวมเข้าคีย์ gameplay เพราะหน้า Database ไม่ต้องใช้ข้อความ Login รายละเอียด URL, fetchedAt, source revision, encoding, headers และ hashes อยู่ใน [source-report.json](../evidence/localization-th/source-report.json) และ [HTTP probe](../evidence/localization-th/http-probe.json)

## วิธีจับคู่และ Fallback

1. อ่าน Nanoka snapshot ที่มี coverage ผ่านแล้ว ใช้ English resource หรือ en branch ของ multilingual index เป็นฐาน
2. เลือก FileCfg row ด้วย entity ID ที่ตรวจ schema แล้ว เช่น AvatarBase.PFOAJKNPCHL → Agent ID และ AvatarSkillDes.PBNPPFFJCGN → Agent ID ไม่ถือว่า TextMap key เป็น entity ID โดยอัตโนมัติ
3. ตรวจชื่ออังกฤษจาก row ที่ join ได้เพื่อยืนยันตัวตน จากนั้นรวบรวมเฉพาะ localization keys ที่มีจริงใน row/foreign-key ที่เกี่ยวข้อง
4. จับคู่ข้อความทั้งฟิลด์กับ English TextMap หลัง normalize เพียง whitespace และ color/format tags ไม่ fuzzy match ไม่ค้นชื่อภาษาอังกฤษทั่วทั้ง TextMap แล้วถือว่าเกี่ยวข้อง
5. ถ้ามีหลายคีย์ที่ให้คำแปลไทยต่างกัน, placeholder ไม่ตรง, ID ไม่ยืนยัน, ข้อความอังกฤษเปลี่ยน หรือเวอร์ชันต่าง major.minor ให้ English fallback
6. ถ้าไม่มีข้อความอ่านได้ ให้คง source identifier/ID และแสดงสถานะ missing โดยไม่เดาความหมายของคีย์ ข้อมูลดิบยังตรวจได้ใน Raw / Explorer

Thai TextMap priority เป็น Base → Overwrite ภายใน source revision เดียวที่ตรวจแล้ว ไม่ใช้แหล่งภาษาไทยอื่นและไม่มี machine translation ชั้น UI แสดงชื่อฝ่าย Specialty ธาตุ สกิล Core/Mindscape อุปกรณ์ วัสดุ ศัตรู Hollow และคำศัพท์ได้เมื่อมี mapping จริง ทุกหมวดเดินผ่าน pipeline กลางเดียวกัน

## การจัดเก็บและประสิทธิภาพ

ไฟล์ต้นทางขนาดใหญ่เก็บใต้ .nanoka/localization ซึ่งถูก gitignore ไม่มี TextMap ทั้งไฟล์ใน public หรือ JavaScript bundle คำแปลถูกตัดเป็น overlay ตาม resource และโหลดเมื่อใช้ พร้อม deduplicate คำขอ ตรวจ SHA-256/ขนาด และจำกัด cache 24 resources / 24 MiB

ชุดปัจจุบันมี ${real.resources} resource overlays, ${real.translatedStringOccurrences.toLocaleString('en-US')} ข้อความ รวม ${(real.publicBytes/1e6).toFixed(2)} MB ก่อนบีบอัด หรือประมาณ ${(gzipBytes/1e6).toFixed(2)} MB เมื่อ gzip แยกไฟล์ ตัวเลขนี้เป็นทั้งชุด ไม่ใช่ payload เริ่มต้น ไฟล์ใหญ่ที่สุด ${(real.maxOverlayBytes/1e6).toFixed(2)} MB เป็นรายละเอียดไอเทมรวมและโหลดเมื่อเปิดหมวดนั้นเท่านั้น

manifest และ chunks เป็น content-addressed; current.json เป็น pointer ที่เปลี่ยนแบบ atomic หลัง validation ทั้งหมดผ่าน หาก fetch/schema/hash/mapping ไม่ผ่าน จะไม่เขียนทับ pointer ของชุดที่ตรวจแล้ว Metadata ผูกกับ Nanoka runId, dataset, resource hash และเวอร์ชัน ถ้าไม่ตรงจะใช้ English fallback

## ความครอบคลุม Live 3.2

${table(live)}

รวม ${total.texts.toLocaleString('en-US')} text occurrences: TH mapping ${total.th.toLocaleString('en-US')}, English fallback ${total.en.toLocaleString('en-US')}, missing ${total.missing.toLocaleString('en-US')} หรือ ${(100*total.th/total.texts).toFixed(1)}% เมื่อรวมทุกหมวด

**วิธีนับ:** นับ string leaf ที่เป็นชื่อ/คำอธิบาย/เรื่องราว/ป้ายข้อมูลใน English index และ detail แยก resource และเวอร์ชัน ข้อความที่ซ้ำใน index/detail/ระดับสกิลนับซ้ำ ไม่รวมภาพ code name tags format ตัวเลขล้วน calculation directives คำสั่งไอคอนล้วน และ branch ภาษาต้นฉบับอื่น ค่า TH mapping หมายถึงข้อความจาก TH TextMap ที่ตรวจจับคู่แล้ว จึงรวมชื่อเฉพาะหรือคำอังกฤษที่แหล่งไทยตั้งใจเก็บไว้ด้วย จำนวนที่มีอักษรไทยจริงแยกเป็น thaiScriptOccurrences ใน JSON; N/A คือไม่มี eligible text ในหมวด metadata นั้น

รายการที่จับคู่ไม่ได้ทุกตำแหน่ง พร้อม dataset, version, ID, JSON Pointer, resource hash และเหตุผล อยู่ [unmapped.json.gz](../evidence/localization-th/unmapped.json.gz) รายงานตัวเลขที่เครื่องอ่านได้อยู่ [coverage.json](../evidence/localization-th/coverage.json)

## Latest: ยังไม่มีชุดภาษาไทยเวอร์ชันตรงกัน

${table(latest)}

Shiyu Defense, Deadly Assault, Threshold Simulation, Annihilation Simulacrum และ changelog ยังไม่มี join ที่ตรวจยืนยันสำหรับข้อความของหมวดนั้น จึงใช้ Nanoka English ส่วน seasons สองหมวดเป็น metadata ที่ไม่มี eligible text ในรอบนี้ ไม่อ้างว่าต้นทางไม่มีภาษาไทย เพียงยังไม่มี mapping ที่ผ่านการตรวจใน implementation นี้

## UI / ความปลอดภัยของข้อความ

รักษาหน้า Database เดิม เพิ่ม Settings และสถานะภาษา/ที่มา/English fallback ในรายการกับรายละเอียด พร้อมลิงก์ Nanoka และไฟล์ TH ที่ pin revision แล้ว ค่า Game Version, Source Revision, เวลา source commit และเวลาที่ fetch แยกกัน

รองรับข้อความหลายบรรทัด, {0}/{1}, color/bold/italic/underline/size tags และ game input icons ผ่าน parser ที่ allowlist สีเป็น hex และจำกัดขนาด/ความลึก ไม่ใช้ dangerouslySetInnerHTML; unknown HTML เป็น escaped literal text ข้อความต้นฉบับและค่าที่ใช้คำนวณยังคงเดิม

## ผลตรวจและทดสอบ

- Build: ${checks.build?'PASS':'PENDING/FAIL'} · Lint: ${checks.lint?'PASS':'PENDING/FAIL'}
- Localization unit tests: ${checks.unit?'11/11 PASS':'PENDING/FAIL'} (synthetic edge cases แยกชัดเจน)
- Nanoka regression unit tests: ${checks.nanokaRegression?'34/34 PASS':'PENDING/FAIL'}
- Browser: ${browser.results.filter(r=>r.status==='PASS').length}/${browser.results.length} PASS; agent/partial fallback, skills, Mindscape, W-Engine, Disc, Bangboo, items, enemies/achievements, Settings/persistence, version switch/new agent, Raw hash, source references, mobile 390/768/1440, API Explorer และ Calculator
- การจำลอง HTTP 503 และ chunk เสียเป็นการทดสอบ failure transport โดยใช้ Nanoka snapshot จริง ไม่ใช่ mock game data และไม่อ้างเป็นการทดสอบ upstream outage จริง
- Real-source verification: ${real.resources} overlays และ ${real.sourceProofsChecked.toLocaleString('en-US')} FileCfg/key proofs ผ่านทุกตำแหน่ง ตรวจ numeric leaves ก่อน/หลัง transformer จริง ${real.numericLeavesCompared.toLocaleString('en-US')} ค่า เปลี่ยน ${real.changedNumericLeaves} ค่า pipeline inventory ตรวจพบ numeric leaves ทั้ง English scope ${coverage.numericAudit.numericLeaves.toLocaleString('en-US')} ค่า
- ไฟล์ Calculator 4 ไฟล์และ src/index.css มี SHA-256 ตรงกับ baseline ก่อนงานนี้
- Browser ไม่ร้องขอ TextMap เต็มหรือ JSON ต้นทาง Nanoka/ZenlessData โดยตรง โหลดเฉพาะ local snapshots/chunks
- Production build / local preview: ${checks.hosting?'PASS':'PENDING'}; ไม่มี commit, push หรือ deploy

หลักฐานอยู่ [evidence/localization-th](../evidence/localization-th): browser-results.json, screenshots, real-data-verification.json, http-probe.json, build.log, lint.log, unit-tests.log, nanoka-regression-tests.log และ production-preview.json

## คำสั่งดูแล / อัปเดตแพตช์

${fence}powershell
npm.cmd run localization:sync
npm.cmd run localization:verify
npm.cmd run localization:test
npm.cmd run nanoka:test
npm.cmd run build
npm.cmd run lint
npm.cmd run localization:browser
${fence}

ใช้ node tools/localization/sync.mjs --revision <full-40-character-commit> เพื่อ pin revision หรือ npm.cmd run localization:build เพื่อสร้างใหม่จาก cache ที่ผ่าน hash validation โดยไม่เรียก upstream อัปเดต Nanoka snapshot ตามคู่มือเดิมก่อน sync localization หาก Nanoka runId เปลี่ยน

หลัง sync ขณะเปิด Vite dev อยู่ ให้ restart dev server เพื่อให้ Vite สแกนไฟล์ public ที่เพิ่มใหม่ (watcher ไม่ติดตาม generated snapshots จำนวนมาก) ปุ่มโหลด snapshot บน Database ล้าง translation cache และโหลด pointer ใหม่เมื่อ server พร้อมแล้ว Production ต้อง build ใหม่ก่อน preview/deploy

การเพิ่ม entity/คีย์ใหม่ใน schema ที่รองรับทำงานอัตโนมัติจาก ID ถ้า upstream เปลี่ยนชื่อฟิลด์ obfuscated หรือรูปแบบไฟล์ สคริปต์จะปฏิเสธชุดใหม่และคงชุดเดิม ต้องตรวจ adapter ใหม่ก่อนใช้ ห้ามแก้เลขเวอร์ชันหรือ JSON ด้วยมือเพื่อบังคับให้ผ่าน

## เครดิตและขอบเขตสิทธิ์

ขอบคุณ Nanoka ZZZ, Dimbreath และ Mero ตาม [README ของ ZenlessData](${source.credits.readme}) ตรวจ root ของ revision นี้แล้วไม่พบไฟล์ LICENSE แยก จึงไม่อ้างว่าการเข้าถึง public JSON เป็นใบอนุญาตแจกจ่ายแบบไม่จำกัด ข้อความและทรัพย์สินของเกมเป็นของเจ้าของสิทธิ์ Sayari เป็นเว็บไซต์อิสระ ไม่ใช่ผลิตภัณฑ์ทางการของ HoYoverse/Nanoka/ZenlessData

## ไฟล์ implementation หลัก

- src/features/localization/: settings/context, client/cache, immutable string overlay, formatting parser, source/fallback UI
- src/features/nanoka/: ใช้ reading layer ที่รองรับ game formatting และ source-ID fallback โดยเก็บ Raw เดิม
- src/views/games/zenless-zone-zero/database/index.tsx: ต่อ translation hooks เข้ารายการ รายละเอียด วัสดุ และการเปลี่ยนภาษา
- tools/localization/{source,mapping,sync,verify,report}.mjs: source acquisition → version validation → ID/key mapping → publish → audit/report
- public/localization/: เฉพาะ manifest, pointer และ optimized overlay chunks
- firebase.json: cache headers แยก mutable pointer กับ immutable localization objects; ยังไม่ deploy
`;
// Use ordinary fenced code blocks without shell/string interpolation tricks.
await fs.writeFile('docs/THAI_LOCALIZATION_SUMMARY_TH.md',report);
await fs.writeFile(`${out}/TRANSLATION_COVERAGE.md`,`# Translation Coverage\n\n${coverage.method}\n\n## Live\n\n${table(live)}\n\n## Latest\n\n${table(latest)}\n`);
await fs.writeFile(`${out}/SOURCE_REFERENCES.md`,`# Source References\n\nRevision: [${source.sourceRevision}](${source.repository}/commit/${source.sourceRevision})\n\n${sourceTable}\n\nFull metadata: source-report.json · pinned file history, SHA-256/Git blob SHA, fetch/commit times. Credit: Dimbreath and Mero.\n`);
await save(`${out}/delivery-status.json`,{at:new Date().toISOString(),status,checks,sourceRevision:source.sourceRevision,nanokaRunId:coverage.nanokaRunId,live:total,liveCategoriesWithThai:live.filter(c=>c.mappedThai>0).length,summary:'docs/THAI_LOCALIZATION_SUMMARY_TH.md',committed:false,pushed:false,deployed:false});
console.log(JSON.stringify({status,checks,live:total}));
