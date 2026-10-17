# SAYARI ZZZ — Thai Localization Summary สำหรับส่งต่อให้ ChatGPT

ตรวจเมื่อ 2026-10-17T20:11:58.864Z · สถานะ COMPLETE_LOCAL_IMPLEMENTATION_VERIFIED

## ผลที่ส่งมอบ

เพิ่มภาษาไทยจาก ZenlessData ลงใน Database เดิมแล้ว ค่าเริ่มต้นเป็น th-TH โดยไม่เปลี่ยนตามภาษาของ Browser เลือก English (en-US) จากปุ่มตั้งค่ามุมล่างขวาได้ทันทีและจำค่าด้วย localStorage คีย์ sayari.locale การเปลี่ยนภาษาจาก Settings ปรับชื่อ/รายละเอียดและ URL ของ Database โดยไม่ reload เอกสาร

Nanoka ยังคงเป็นแหล่งข้อมูลหลักทั้งหมด รวม Stats, Growth, Skill Multipliers, Scaling และ Raw JSON ภาษาไทยเป็น string overlay ที่มีหลักฐาน ID/foreign-key join และคีย์ข้อความใน FileCfg เท่านั้น ไม่มีการสร้างคำแปลเกมเองหรือเปลี่ยนสูตร Calculator

Live มีคำแปลอย่างน้อยบางส่วนใน 13 จาก 20 หมวด เอเจนต์ทั้ง 60 รายการมีข้อความที่จับคู่ได้ แต่ไม่ได้หมายความว่าทุกฟิลด์แปลครบ หมวดตัวละครจับคู่ข้อความได้ 88.5% ส่วน Latest 3.3.12+19629936 ใช้ภาษาอังกฤษ เพราะชุด ZenlessData ที่ตรวจได้เป็น 3.2.0

## ข้อมูลต้นทางและเวอร์ชัน

- Project: D:\sayari-project
- Game Data: [Nanoka ZZZ](https://zzz.nanoka.cc/) · snapshot 2026-10-17T18-43-20-900Z-a22a7754
- Localization: [ZenlessData — Dimbreath](https://git.mero.moe/dimbreath/ZenlessData) · pinned revision [462563ec0f8ffc7493f6e2a46f64f8b34ea2d547](https://git.mero.moe/dimbreath/ZenlessData/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547)
- Repository/FileCfg: CNPRODWin3.2.0_R19437730_S19159270_D19437730
- Base TH/EN และ Login: OSPRODWin3.2.0_R18779629_S18779629_D18761130
- TH/EN Overwrite: CNPRODWin3.2.0_R19159270_S19159270_D19159270
- ตรวจ last-change revision ของไฟล์จาก [directory ที่ pin commit แล้ว](https://git.mero.moe/dimbreath/ZenlessData/src/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap) และตรวจทุกไฟล์ด้วยขนาด, UTF-8, JSON schema, SHA-256 และ Git blob SHA-1
- การยอมรับ Live 3.2 ไม่ได้อาศัยเลขเวอร์ชันใกล้กันเพียงอย่างเดียว: ต้องมี ID join และข้อความอังกฤษตรงกันต่อฟิลด์ด้วย จึงใช้ OS base + CN overwrite ได้เฉพาะข้อความที่ผ่านการตรวจ

| ไฟล์ | HTTP | Bytes | UTF-8 / Schema | เวอร์ชัน / แหล่ง |
|---|---:|---:|---|---|
| [TextMap/TextMap_THTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_THTemplateTb.json) | 200 | 93,352,352 | ผ่าน / string dictionary | OSPROD 3.2.0 |
| [TextMap/TextMap_THOverwriteTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_THOverwriteTemplateTb.json) | 200 | 1,670,989 | ผ่าน / string dictionary | CNPROD 3.2.0 |
| [TextMap/TextMap_Login_THTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_Login_THTemplateTb.json) | 200 | 119,391 | ผ่าน / string dictionary | OSPROD 3.2.0 |
| [TextMap/TextMap_ENTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_ENTemplateTb.json) | 200 | 48,112,035 | ผ่าน / string dictionary | OSPROD 3.2.0 |
| [TextMap/TextMap_ENOverwriteTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_ENOverwriteTemplateTb.json) | 200 | 794,359 | ผ่าน / string dictionary | CNPROD 3.2.0 |
| [TextMap/TextMap_Login_ENTemplateTb.json](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/TextMap/TextMap_Login_ENTemplateTb.json) | 200 | 66,684 | ผ่าน / string dictionary | อยู่ใน pinned revision; EN Login ไม่ใช้กับ gameplay |

โหลดแหล่งจริง 29 ไฟล์ รวม 155.20 MB ในขั้นตอน sync เท่านั้น โดยเป็น TextMap 6 ไฟล์ และ FileCfg 23 ตาราง Login TextMap ถูกตรวจสอบแต่ไม่รวมเข้าคีย์ gameplay เพราะหน้า Database ไม่ต้องใช้ข้อความ Login รายละเอียด URL, fetchedAt, source revision, encoding, headers และ hashes อยู่ใน [source-report.json](../evidence/localization-th/source-report.json) และ [HTTP probe](../evidence/localization-th/http-probe.json)

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

ชุดปัจจุบันมี 514 resource overlays, 41,216 ข้อความ รวม 25.30 MB ก่อนบีบอัด หรือประมาณ 3.37 MB เมื่อ gzip แยกไฟล์ ตัวเลขนี้เป็นทั้งชุด ไม่ใช่ payload เริ่มต้น ไฟล์ใหญ่ที่สุด 7.76 MB เป็นรายละเอียดไอเทมรวมและโหลดเมื่อเปิดหมวดนั้นเท่านั้น

manifest และ chunks เป็น content-addressed; current.json เป็น pointer ที่เปลี่ยนแบบ atomic หลัง validation ทั้งหมดผ่าน หาก fetch/schema/hash/mapping ไม่ผ่าน จะไม่เขียนทับ pointer ของชุดที่ตรวจแล้ว Metadata ผูกกับ Nanoka runId, dataset, resource hash และเวอร์ชัน ถ้าไม่ตรงจะใช้ English fallback

## ความครอบคลุม Live 3.2

| หมวด | ข้อความที่นับ | จับคู่ TH สำเร็จ | English fallback | ไม่มีข้อความ | TH % |
|---|---:|---:|---:|---:|---:|
| Agents | 12,435 | 11,011 | 1,118 | 306 | 88.5% |
| W-Engines | 2,100 | 1,700 | 400 | 0 | 81.0% |
| Bangboo | 5,779 | 4,478 | 1,301 | 0 | 77.5% |
| Drive Discs | 210 | 210 | 0 | 0 | 100.0% |
| Materials / Items | 5,860 | 5,522 | 270 | 68 | 94.2% |
| Enemies | 1,836 | 1,583 | 241 | 12 | 86.2% |
| Achievements | 1,630 | 1,630 | 0 | 0 | 100.0% |
| Shiyu Defense | 4,913 | 0 | 4,608 | 305 | 0.0% |
| Deadly Assault | 2,168 | 0 | 1,649 | 519 | 0.0% |
| Threshold Simulation | 1,162 | 0 | 1,088 | 74 | 0.0% |
| Annihilation Simulacrum | 144 | 0 | 108 | 36 | 0.0% |
| Hollow Cards | 148 | 147 | 1 | 0 | 99.3% |
| Tactical Prisms | 364 | 363 | 1 | 0 | 99.7% |
| Hollow Gear | 206 | 135 | 71 | 0 | 65.5% |
| Resonia | 520 | 520 | 0 | 0 | 100.0% |
| Items: full descriptions | 17,580 | 13,732 | 949 | 2,899 | 78.1% |
| Game terminology | 300 | 185 | 76 | 39 | 61.7% |
| Shiyu seasons | 0 | 0 | 0 | 0 | N/A |
| Deadly Assault seasons | 0 | 0 | 0 | 0 | N/A |
| Version changelog | 65 | 0 | 65 | 0 | 0.0% |

รวม 57,420 text occurrences: TH mapping 41,216, English fallback 11,946, missing 4,258 หรือ 71.8% เมื่อรวมทุกหมวด

**วิธีนับ:** นับ string leaf ที่เป็นชื่อ/คำอธิบาย/เรื่องราว/ป้ายข้อมูลใน English index และ detail แยก resource และเวอร์ชัน ข้อความที่ซ้ำใน index/detail/ระดับสกิลนับซ้ำ ไม่รวมภาพ code name tags format ตัวเลขล้วน calculation directives คำสั่งไอคอนล้วน และ branch ภาษาต้นฉบับอื่น ค่า TH mapping หมายถึงข้อความจาก TH TextMap ที่ตรวจจับคู่แล้ว จึงรวมชื่อเฉพาะหรือคำอังกฤษที่แหล่งไทยตั้งใจเก็บไว้ด้วย จำนวนที่มีอักษรไทยจริงแยกเป็น thaiScriptOccurrences ใน JSON; N/A คือไม่มี eligible text ในหมวด metadata นั้น

รายการที่จับคู่ไม่ได้ทุกตำแหน่ง พร้อม dataset, version, ID, JSON Pointer, resource hash และเหตุผล อยู่ [unmapped.json.gz](../evidence/localization-th/unmapped.json.gz) รายงานตัวเลขที่เครื่องอ่านได้อยู่ [coverage.json](../evidence/localization-th/coverage.json)

## Latest: ยังไม่มีชุดภาษาไทยเวอร์ชันตรงกัน

| หมวด | ข้อความที่นับ | จับคู่ TH สำเร็จ | English fallback | ไม่มีข้อความ | TH % |
|---|---:|---:|---:|---:|---:|
| Agents | 12,854 | 0 | 12,534 | 320 | 0.0% |
| W-Engines | 2,163 | 0 | 2,163 | 0 | 0.0% |
| Bangboo | 5,779 | 0 | 5,779 | 0 | 0.0% |
| Drive Discs | 210 | 0 | 210 | 0 | 0.0% |
| Materials / Items | 5,983 | 0 | 5,916 | 67 | 0.0% |
| Enemies | 1,884 | 0 | 1,884 | 0 | 0.0% |
| Achievements | 1,662 | 0 | 1,662 | 0 | 0.0% |
| Shiyu Defense | 5,166 | 0 | 4,831 | 335 | 0.0% |
| Deadly Assault | 2,338 | 0 | 1,784 | 554 | 0.0% |
| Threshold Simulation | 1,162 | 0 | 1,088 | 74 | 0.0% |
| Annihilation Simulacrum | 276 | 0 | 204 | 72 | 0.0% |
| Hollow Cards | 148 | 0 | 148 | 0 | 0.0% |
| Tactical Prisms | 388 | 0 | 388 | 0 | 0.0% |
| Hollow Gear | 206 | 0 | 206 | 0 | 0.0% |
| Resonia | 524 | 0 | 524 | 0 | 0.0% |
| Items: full descriptions | 17,949 | 0 | 14,963 | 2,986 | 0.0% |
| Game terminology | 564 | 0 | 466 | 98 | 0.0% |
| Shiyu seasons | 0 | 0 | 0 | 0 | N/A |
| Deadly Assault seasons | 0 | 0 | 0 | 0 | N/A |
| Version changelog | 2 | 0 | 2 | 0 | 0.0% |

Shiyu Defense, Deadly Assault, Threshold Simulation, Annihilation Simulacrum และ changelog ยังไม่มี join ที่ตรวจยืนยันสำหรับข้อความของหมวดนั้น จึงใช้ Nanoka English ส่วน seasons สองหมวดเป็น metadata ที่ไม่มี eligible text ในรอบนี้ ไม่อ้างว่าต้นทางไม่มีภาษาไทย เพียงยังไม่มี mapping ที่ผ่านการตรวจใน implementation นี้

## UI / ความปลอดภัยของข้อความ

รักษาหน้า Database เดิม เพิ่ม Settings และสถานะภาษา/ที่มา/English fallback ในรายการกับรายละเอียด พร้อมลิงก์ Nanoka และไฟล์ TH ที่ pin revision แล้ว ค่า Game Version, Source Revision, เวลา source commit และเวลาที่ fetch แยกกัน

รองรับข้อความหลายบรรทัด, {0}/{1}, color/bold/italic/underline/size tags และ game input icons ผ่าน parser ที่ allowlist สีเป็น hex และจำกัดขนาด/ความลึก ไม่ใช้ dangerouslySetInnerHTML; unknown HTML เป็น escaped literal text ข้อความต้นฉบับและค่าที่ใช้คำนวณยังคงเดิม

## ผลตรวจและทดสอบ

- Build: PASS · Lint: PASS
- Localization unit tests: 11/11 PASS (synthetic edge cases แยกชัดเจน)
- Nanoka regression unit tests: 34/34 PASS
- Browser: 20/20 PASS; agent/partial fallback, skills, Mindscape, W-Engine, Disc, Bangboo, items, enemies/achievements, Settings/persistence, version switch/new agent, Raw hash, source references, mobile 390/768/1440, API Explorer และ Calculator
- การจำลอง HTTP 503 และ chunk เสียเป็นการทดสอบ failure transport โดยใช้ Nanoka snapshot จริง ไม่ใช่ mock game data และไม่อ้างเป็นการทดสอบ upstream outage จริง
- Real-source verification: 514 overlays และ 41,216 FileCfg/key proofs ผ่านทุกตำแหน่ง ตรวจ numeric leaves ก่อน/หลัง transformer จริง 422,532 ค่า เปลี่ยน 0 ค่า pipeline inventory ตรวจพบ numeric leaves ทั้ง English scope 1,012,057 ค่า
- ไฟล์ Calculator 4 ไฟล์และ src/index.css มี SHA-256 ตรงกับ baseline ก่อนงานนี้
- Browser ไม่ร้องขอ TextMap เต็มหรือ JSON ต้นทาง Nanoka/ZenlessData โดยตรง โหลดเฉพาะ local snapshots/chunks
- Production build / local preview: PASS; ไม่มี commit, push หรือ deploy

หลักฐานอยู่ [evidence/localization-th](../evidence/localization-th): browser-results.json, screenshots, real-data-verification.json, http-probe.json, build.log, lint.log, unit-tests.log, nanoka-regression-tests.log และ production-preview.json

## คำสั่งดูแล / อัปเดตแพตช์

```powershell
npm.cmd run localization:sync
npm.cmd run localization:verify
npm.cmd run localization:test
npm.cmd run nanoka:test
npm.cmd run build
npm.cmd run lint
npm.cmd run localization:browser
```

ใช้ node tools/localization/sync.mjs --revision <full-40-character-commit> เพื่อ pin revision หรือ npm.cmd run localization:build เพื่อสร้างใหม่จาก cache ที่ผ่าน hash validation โดยไม่เรียก upstream อัปเดต Nanoka snapshot ตามคู่มือเดิมก่อน sync localization หาก Nanoka runId เปลี่ยน

หลัง sync ขณะเปิด Vite dev อยู่ ให้ restart dev server เพื่อให้ Vite สแกนไฟล์ public ที่เพิ่มใหม่ (watcher ไม่ติดตาม generated snapshots จำนวนมาก) ปุ่มโหลด snapshot บน Database ล้าง translation cache และโหลด pointer ใหม่เมื่อ server พร้อมแล้ว Production ต้อง build ใหม่ก่อน preview/deploy

การเพิ่ม entity/คีย์ใหม่ใน schema ที่รองรับทำงานอัตโนมัติจาก ID ถ้า upstream เปลี่ยนชื่อฟิลด์ obfuscated หรือรูปแบบไฟล์ สคริปต์จะปฏิเสธชุดใหม่และคงชุดเดิม ต้องตรวจ adapter ใหม่ก่อนใช้ ห้ามแก้เลขเวอร์ชันหรือ JSON ด้วยมือเพื่อบังคับให้ผ่าน

## เครดิตและขอบเขตสิทธิ์

ขอบคุณ Nanoka ZZZ, Dimbreath และ Mero ตาม [README ของ ZenlessData](https://git.mero.moe/dimbreath/ZenlessData/raw/commit/462563ec0f8ffc7493f6e2a46f64f8b34ea2d547/README.md) ตรวจ root ของ revision นี้แล้วไม่พบไฟล์ LICENSE แยก จึงไม่อ้างว่าการเข้าถึง public JSON เป็นใบอนุญาตแจกจ่ายแบบไม่จำกัด ข้อความและทรัพย์สินของเกมเป็นของเจ้าของสิทธิ์ Sayari เป็นเว็บไซต์อิสระ ไม่ใช่ผลิตภัณฑ์ทางการของ HoYoverse/Nanoka/ZenlessData

## ไฟล์ implementation หลัก

- src/features/localization/: settings/context, client/cache, immutable string overlay, formatting parser, source/fallback UI
- src/features/nanoka/: ใช้ reading layer ที่รองรับ game formatting และ source-ID fallback โดยเก็บ Raw เดิม
- src/views/games/zenless-zone-zero/database/index.tsx: ต่อ translation hooks เข้ารายการ รายละเอียด วัสดุ และการเปลี่ยนภาษา
- tools/localization/{source,mapping,sync,verify,report}.mjs: source acquisition → version validation → ID/key mapping → publish → audit/report
- public/localization/: เฉพาะ manifest, pointer และ optimized overlay chunks
- firebase.json: cache headers แยก mutable pointer กับ immutable localization objects; ยังไม่ deploy
