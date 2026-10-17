# สรุป implementation — Sayari × Nanoka ZZZ

สถานะ: **READY_FOR_USER_VISUAL_REVIEW**

จัดทำ 2026-10-17T19:03:58.712Z (เวลา UTC; workspace Asia/Bangkok) · Run **2026-10-17T18-43-20-900Z-a22a7754**

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

- เวอร์ชัน: live = 3.2 · latest = 3.3.12+19629936
- ภาษา: en, ja, ko, zh ซึ่งตรวจจาก global selectors และ responses จริง
- 20 dataset definitions · 5,396 resources ใช้งานได้ · 0 ล้มเหลว · 0 coverage issues
- 5,288 detail resources ตาม index ทุก ID ใน scope
- ตรวจ raw hashes ทุก resource และ 3,428 unique objects ทุก leaf path มีทางเข้าถึง ไม่มี dropped path ที่ตรวจพบ
- ผลรวมขนาด resource ที่อ้างอิง 209,916,119 bytes (รวมการอ้าง object ที่ deduplicate แล้วซ้ำกัน จึงไม่ใช่ขนาด disk)
- Catalog metadata มีขนาด 12,436,718 bytes ก่อน HTTP compression; ผลการทดสอบครั้งนี้เป็น local preview จึงยังไม่ยืนยันเวลาโหลดผ่านเครือข่าย production
- เก็บ framework preferences เป็น raw แบบ unversioned อีกหนึ่ง resource ไม่ถือว่าเป็นข้อมูลผู้เล่นหรือ patch เกม

| Dataset | IDs Live (EN หรือหลายภาษา) | IDs Latest (EN หรือหลายภาษา) | วิธีเก็บ |
|---|---:|---:|---|
| character | 60 | 62 | detail ทุก ID × 4 ภาษา |
| weapon | 100 | 103 | detail ทุก ID × 4 ภาษา |
| bangboo | 42 | 42 | detail ทุก ID × 4 ภาษา |
| equipment | 30 | 30 | detail ทุก ID × 4 ภาษา |
| item | 5860 | 5983 | record อยู่ใน resource รวม |
| monster | 306 | 314 | detail ทุก ID × 4 ภาษา |
| achievement | 815 | 831 | record อยู่ใน resource รวม |
| shiyu | 62 | 65 | detail ทุก ID × 4 ภาษา |
| boss | 47 | 50 | detail ทุก ID × 4 ภาษา |
| simul | 3 | 3 | detail ทุก ID × 4 ภาษา |
| hard | 1 | 2 | detail ทุก ID × 4 ภาษา |
| hollow_card | 74 | 74 | record อยู่ใน resource รวม |
| hollow_tpp | 91 | 97 | record อยู่ใน resource รวม |
| hollow_gg | 68 | 68 | record อยู่ใน resource รวม |
| hollow_resonium | 260 | 262 | record อยู่ใน resource รวม |
| item_all | 5860 | 5983 | record อยู่ใน resource รวม |
| noun | 75 | 141 | record อยู่ใน resource รวม |
| shiyu_versions | 20 | 20 | record อยู่ใน resource รวม |
| boss_versions | 15 | 15 | record อยู่ใน resource รวม |
| diff | 65 | 2 | record อยู่ใน resource รวม |

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

- Unit tests: 34/34 ผ่าน แยก synthetic fixtures จาก live data ครอบคลุม collector/adapters, all IDs, raw bytes/cache, 403/429, budget, invalid JSON, unsafe URLs/numbers, pointer escaping, publish safeguards, immutable re-export และ Windows atomic-write retry โดยรักษา pointer เดิมเมื่อเขียนไม่สำเร็จ
- Build และ lint: ผ่าน ไม่มี warning จากคำสั่งที่กำหนด
- Browser ปกติ: 11/11 scenarios ผ่าน เป้าหมาย http://127.0.0.1:4173 ทดสอบทุก 20 หมวดจริง, Home/calculator, raw download hash, locale/version/history, stale responses, API Explorer, keyboard และ 390×844 / 768×1024 / 1440×900
- Browser edge fixtures: 9/9 ผ่าน ข้อมูลสังเคราะห์และ injected failures ใช้เฉพาะ test context ไม่ได้ export เป็นข้อมูลเกมหรือใช้ยืนยัน live coverage
- แอปไม่ได้เรียก upstream JSON จาก browser ข้อมูล JSON มาจาก snapshot ในเครื่อง; ภาพยังโหลดจาก CDN
- Manifest fresh recheck: ตรงกับ Live/Latest ของรอบนี้ ณ 2026-10-17T18:44:25.278Z
- Production hosting ยังไม่ได้ deploy/ทดสอบจริง ผล browser เป็น local preview เท่านั้น Firebase rewrite จำกัดเส้นทางเกม ไม่ rewrite /nanoka JSON ตาม [เอกสาร Firebase Hosting](https://firebase.google.com/docs/hosting/full-config)

ไม่มีงานที่จำเป็นค้างในขอบเขต implementation นี้ พร้อมให้ผู้ใช้ตรวจหน้าตาจริง

## ไฟล์ส่งต่อให้ ChatGPT

- คู่มือระบบและคำสั่ง: docs/NANOKA_DATABASE_TH.md
- Catalog ปัจจุบัน: public/nanoka/snapshots/2026-10-17T18-43-20-900Z-a22a7754/catalog.json
- Raw cache/run reports ในเครื่อง: .nanoka/runs/2026-10-17T18-43-20-900Z-a22a7754/ และ .nanoka/objects/
- Evidence: evidence/nanoka-zzz/2026-10-17T17-52-25-351Z/
- หลักฐานสำคัญ: BASELINE.json, WORKTREE_VALIDATION.json, discovery-review.json, observed-urls.json, selector-and-tab-review.json, filter-and-version-review.json, filter-review.json, ENDPOINT_COVERAGE.json, FIELD_COVERAGE.json, MANIFEST_RECHECK.json, TEST_RESULTS.json, BROWSER_TEST_RESULTS.json, BROWSER_EDGE_TEST_RESULTS.json และ screenshots/
- Full leaf path lists อยู่ field-paths/*.json.gz ตาม pathReport ของแต่ละ raw SHA-256; actual HTTP/cache request lineage อยู่ collector-runs/ และ sync-requests.jsonl

## Git และการส่งมอบ

Workspace D:/sayari-project · branch main · origin https://github.com/tawaynap24/sayari.git · HEAD 161dd6972cbc411f3b4c55860b63f8c5c8b4428b

ยังไม่ได้ commit, push หรือ deploy งานนี้ ชุด kit ต้นฉบับยังตรวจ integrity ได้ 36 ไฟล์ ไฟล์ SAYARI_PROJECT_SUMMARY.txt, audit-evidence.json และ verification-results.json ที่ root คงไว้เป็นประวัติ ไม่ใช่รายงาน Nanoka รุ่นปัจจุบัน
