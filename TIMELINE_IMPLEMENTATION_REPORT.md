# CODEX FINAL REPORT — SAYARI TIMELINE V5

**Date/time, timezone:** 18 ตุลาคม 2026, Asia/Bangkok (เวลาที่รันแต่ละคำสั่งอยู่ใน `evidence/timeline/commands.json` เป็น UTC)

**Branch/worktree status before / after:** `main`, HEAD `c8fc5b9e75e7a62eed8bad7efcfeacf7f19df3fe` ไม่เปลี่ยน เริ่มจาก working tree สะอาด หลังทำงานมี source/config/docs/tests/evidence ใหม่และไฟล์แก้ไขที่ยังไม่ commit รายชื่อครบพร้อม SHA-256 อยู่ใน [final-audit.json](evidence/timeline/final-audit.json)

**Git remote:** `origin` → https://github.com/tawaynap24/sayari.git

**Scope:** พัฒนาระบบ Timeline V5 ที่เชื่อม Firebase จริงใน Emulator ครบเส้นทางหลัก ตั้งแต่สมัครสมาชิก ติดตามหัวข้อ ส่งเรื่องพร้อมสื่อ โหวต แก้ไขเวอร์ชัน ซ่อน และหมดอายุ รักษา ZZZ Calculator, Nanoka และภาษาไทยเดิม

**Build/deployment:** LOCAL ONLY — ไม่มี reset/clean/commit/push/deploy และไม่ได้เปลี่ยน Firebase Console/Billing `.firebaserc` ยังชี้ `sayari-81b58`; การทดสอบใช้ `demo-sayari-timeline` เท่านั้น

อ่านชุดส่งมอบ V5 ทั้งหมดและใช้กฎ USER-CONFIRMED เป็นหลัก โค้ดที่เพิ่มเป็น implementation ของแอป ไม่ได้ใช้ reference contracts เป็น backend จำลอง รายงานนี้ใช้โครงสร้าง `templates/CODEX_FINAL_REPORT.md` จากชุดส่งมอบ

## 1. Status per feature

คำว่า **DONE** ในตารางหมายถึง implement และตรวจในเครื่องตามหลักฐานที่ระบุ การเปิดบริการจริงบน cloud อยู่ในหัวข้อ 5 และไม่ได้ถือว่าทดสอบผ่านแล้ว

| Feature | Status | Evidence / URL / File |
|---|---|---|
| Topic/category navigation | DONE | `/timeline`, `/timeline/:topicSlug`; schema ไม่ผูกกับเกมเดียว; seed เฉพาะหมวด/หัวข้อว่าง |
| Auth email/password | DONE | Auth Emulator + callable JWT; สมัคร/เข้า/ออกจริงผ่าน browser; reset password มี UI/API แต่ยังไม่ได้ทดสอบส่งอีเมลจริง |
| Guest approved-only view / member follow gate | DONE | Guest ไม่ query คำขอ/จำนวนผู้สนใจ; สมาชิกที่ยังไม่ follow ไม่เห็น timeline; browser และ rules tests |
| Interest snapshot/threshold/cap | DONE | Transaction นับหนึ่ง UID ครั้งเดียว; CREATE 49/50, ผู้ติดตามจริง 1001 และ 100 คะแนน; V5 vectors |
| New story create/auto publish | DONE | ต่ำกว่า 50 เผยแพร่ทันที; ตั้งแต่ 50 สร้าง CREATE request; projection เขียนใน transaction |
| Pending author edit/reset/cancel | DONE | รีเซ็ตทั้ง round, snapshot/threshold/clock ใหม่, archive คะแนนเก่า, ป้องกัน stale round; มี checkbox ยืนยัน |
| YES/NO voting and vote switching | DONE | self-vote/member checks, คะแนนจริงต่อ UID, เปลี่ยน YES/NO ได้, repeated choice ไม่ยืดเวลา, YES-first settlement |
| CREATE72h+idle24h vs EDIT/HIDE24h | DONE | Unit + server fake-clock integration; exact deadline ปิดคำขอก่อนตอบปฏิเสธโหวต; sweeper/handler รันจริง |
| Published revision EDIT / one-edit lock | DONE | สองคำขอพร้อมกันได้ผู้ชนะเดียว; revision เก่า immutable, prefill ทุกช่อง, ประวัติเปิดอ่านได้ |
| HIDE yes/no, fresh snapshot, soft hidden | DONE | ลบ public projection เมื่อผ่าน, archive ส่วนตัวคงอยู่; ทดสอบ HIDE/EDIT race ไม่คืนเรื่องที่ซ่อน |
| Requests switch / badges / hub | DONE | OFF เมื่อเปิด view ใหม่; ghost/EDIT !/HIDE × ด้านขวาบน; filter และ cursor pages; 65→66 รายการระหว่างเปิดหน้าสอง |
| Timeline zoom/pan/modes/cluster/hover/delta | DONE | BigInt layout; equal/time spacing, fit, keyboard, mouse, touch/pinch; latest3+N; เลือกแล้วแสดงทุกเรื่องในกลุ่ม |
| Relative/uncertain/named era time | DONE | exact/approx/range/relative/unknown/era; anchor DAG, cycle/self/cross-topic rejection; recompute เมื่อ anchor เปลี่ยน |
| Entity aliases multilingual / sources | DONE | ชื่อไทย/อังกฤษ, alias พร้อม locale, reusable entities; source URL/title/publisher/notes/retrieved date และ validation |
| Media+PDF+DOCX viewer and 5MB cap | DONE | Upload จริง, private staging, finalized bytes, image/video URL, PDF canvas, DOCX ข้อความปลอดภัย; ข้อจำกัด DOCX ระบุในหัวข้อ 6 |
| Firebase rules/transactions/expiry sweeper | DONE | 23 integration scenarios; direct writes ถูกปฏิเสธ; actual exported scheduled handlers; cleanup cursor และ retry |
| Thai/mobile/accessibility | DONE | Thai-first, labels/focus/Escape/44px targets, mobile viewport และ real touch ผ่าน; ยังไม่ใช่ formal WCAG/screen-reader audit |
| Original ZZZ calculator unchanged | DONE | SHA-256 61 ไฟล์เดิมตรง baseline; DOM/inputs/ผลคำนวณก่อน-หลังตรงกัน; Nanoka 34 และ localization 11 tests ผ่าน |
| Production Firebase activation | NOT TESTED | เจ้าของต้องเปิดบริการ/config/Billing/IAM/App Check/deploy ตามคู่มือ ไม่ได้เขียนฐานข้อมูลจริง |

## 2. Files changed / added

### ไฟล์เดิมที่แก้ไข (9 ไฟล์)

| File | เหตุผล |
|---|---|
| `src/routes/route.tsx` | ให้ route Timeline เดิมรองรับ `/timeline/*` สำหรับหัวข้อ คำขอ และรายละเอียด |
| `src/views/timeline/index.tsx` | lazy-load โมดูล Timeline พร้อม loading fallback |
| `firebase.json` | เพิ่ม Functions codebase, Firestore/Storage config, Emulator และ deep-link rewrite; คง Hosting headers เดิม |
| `package.json`, `package-lock.json` | dependencies/domain validation/PDF/emulator tooling และ scripts ใหม่ โดยไม่เปลี่ยนสคริปต์ Nanoka/localization เดิม |
| `tsconfig.app.json` | ตรวจ shared domain TypeScript ร่วมกับ frontend และ ES2022 library types |
| `vite.config.ts` | ไม่ watch cache, handoff และ Functions build artifacts |
| `.eslintrc.cjs` | ไม่ lint reference handoff และ generated output; แก้ baseline lint failure โดยไม่แก้เอกสารต้นฉบับ |
| `.gitignore` | ไม่เก็บ emulator cache/backend build/debug logs; อนุญาต evidence logs ของงานนี้ |

### ไฟล์ใหม่

- `functions/package.json`, `functions/package-lock.json`, `functions/tsconfig.json`: backend package และ build แยก
- `functions/src/domain/types.ts`, `policy.ts`, `validation.ts`, `time.ts`: schema, voting policy, input validation และ time/layout engine ที่ใช้ร่วมกัน
- `functions/src/service.ts`: transactions, follow, request lifecycle, voting, revisions, locks, idempotency, expiry, privileged moderation และ audit
- `functions/src/media.ts`: prepare/finalize, byte/MIME/structure checks, private access, safe DOCX extraction, orphan cleanup
- `functions/src/index.ts`: callable/HTTP endpoints และ scheduled Functions v2
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`: สิทธิ์และ query indexes
- `.env.example`, `.env.emulator`: public config template และ demo config; ไม่มี private key
- `src/features/timeline/TimelineApp.tsx`, `client.ts`, `hooks.ts`, `types.ts`: routes, Firebase client, auth/follow gates และ bounded realtime pagination
- `src/features/timeline/TimelineCanvas.tsx`, `TimeFields.tsx`: horizontal interaction และ time input ทุกรูปแบบ
- `src/features/timeline/ContentForm.tsx`, `MediaFields.tsx`, `ReasonForm.tsx`: form/source/entity/media/proposal flows
- `src/features/timeline/StoryCard.tsx`, `StoryBody.tsx`, `RequestPanel.tsx`: เรื่องราว ประวัติ เปรียบเทียบคำขอ โหวต และ moderation
- `src/features/timeline/AuthPanel.tsx`, `Modal.tsx`, `MediaView.tsx`, `PdfView.tsx`, `style.css`: authentication, accessible modal, media/PDF และ scoped design
- `tools/timeline/unit.test.ts`, `integration.mjs`, `browser.mjs`, `scheduled-check.mjs`: application unit/integration/browser/scheduler tests
- `tools/timeline/emulators.mjs`, `seed.mjs`, `sweep.mjs`, `admin.mjs`: local suite, metadata seeding, local expiry worker และ private operator CLI
- `tools/timeline/checks.mjs`, `preservation.mjs`, `audit.mjs`: logs/results, regression comparison และ source inventory
- `docs/TIMELINE_IMPLEMENTATION_PLAN.md`, `TIMELINE_ARCHITECTURE.md`, `TIMELINE_SETUP_TH.md`: decisions, schema/API และขั้นตอนดูแลระบบ
- `evidence/timeline/`: logs/JSON/screenshots/baselines รายละเอียดใน [README](evidence/timeline/README.md)
- `TIMELINE_IMPLEMENTATION_REPORT.md`: รายงานฉบับนี้

ดูรายชื่อรายไฟล์ ขนาด และ SHA-256 ที่ [final-audit.json](evidence/timeline/final-audit.json) ไม่มีการแก้ไฟล์ใน `_handoff`, โค้ด ZZZ/Nanoka/localization หรือข้อมูล `public` เดิม

## 3. Database, server APIs and security

Schema และ contract ละเอียดอยู่ใน [TIMELINE_ARCHITECTURE.md](docs/TIMELINE_ARCHITECTURE.md)

- Metadata: `categories`, `topics`, `namedEntities`; member count แยกใน `topicStats` และ explicit membership ใน `topics/{topic}/interests/{uid}`
- Canonical: `stories` และ `stories/{id}/revisions`; projection `publicStories`/`history` มีเฉพาะ approved content โดย history อ่านได้เมื่อ public parent ยังอยู่
- Workflow: `requests`, `voteRounds`, `votes/{uid}` เก็บ frozen snapshot, round, scores, expiry และ terminal state; owner cancellation/round reset มี audit
- Security/ops: private `auditLog`, `abuseReports`, operation receipts, rate limits และ `maintenance/mediaCleanup`
- Callable `timelineApi`: `followTopic`, `createStory`, `proposeEdit`, `proposeHide`, `castVote`, `updatePendingRequest`, `cancelPendingRequest`, `saveEntity`, `prepareUpload`, `finalizeUpload`, `privilegedPublish`, `privilegedHide`, `reportStory`
- `timelineMedia`: ตรวจสิทธิ์และ approved association ทุกครั้งก่อนคืนไฟล์หรือ DOCX text; private media ใช้ Firebase bearer; response no-store ไม่มี permanent download-token URL ในเนื้อเรื่อง
- `expireTimelineRequests`: schedule ทุก 5 นาที; `cleanTimelineMedia`: ทุก 24 ชั่วโมง; local runner เรียก domain worker ทุก 5 นาทีเพื่อให้ทดลองครบวงจร
- การเปลี่ยนสถานะ/คะแนน/locks/revision/public projection ทำใน transaction เดียว มี operationId+payload digest ป้องกันการทำซ้ำ และอ่านครบก่อนเขียน ไม่มี Storage I/O ภายใน transaction callback
- ฟังก์ชันตรวจ verified auth context/member/owner/trusted custom claim ฝั่ง server; client แก้ status/count/vote/role โดยตรงไม่ได้ ไม่รับ UID/role จาก form มาเชื่อถือ
- Storage ให้สร้าง staging ครั้งแรกได้เฉพาะเจ้าของ ขนาด/MIME ตรง metadata ไม่ให้ overwrite/read/delete โดยตรง จากนั้น server ตรวจจริงก่อน copy ไป immutable validated path
- Emergency restriction ปิดทั้ง media endpoint และ owner metadata reads รวมข้อความ DOCX ที่สกัดเก็บใน Firestore มี regression test ครอบคลุมสองช่องทางนี้
- HIDE ผ่านแล้วลบ public parent และยกเลิก pending EDIT ใน transaction; EDIT ผ่านก่อนยังคง HIDE ผูก story ID เดิม ผู้ใช้ privileged ต้องมีเหตุผลและ audit ไม่มี phantom votes
- Private CLI เริ่ม dry-run เสมอ, ระบุ project ชัดเจน, เขียนจริงต้อง `--execute --reason`; มี claim/revoke, seed และ emergency restriction เพื่อหยุดอ่านเรื่อง/ประวัติ/สื่อ
- การหมดอายุใช้เวลา server ตรวจใน mutation แม้ scheduler ล่าช้า; expired แยกจาก rejected และ sweep ซ้ำได้

## 4. Commands actually run, results and evidence

| Command | Exit code | Actual result / evidence path |
|---|---:|---|
| `npm run build` | 0 | TypeScript + Vite production build; `evidence/timeline/build.log` |
| `npm run lint` | 0 | ผ่าน ไม่มี lint errors; `evidence/timeline/lint.log` |
| `npm run timeline:unit` | 0 | **51/51** ผ่านบน compiled backend domain รวม V5 vectors; `unit.log` |
| `node tools/timeline/integration.mjs` | 0 | **23/23** real Emulator scenarios; `integration.json`, `integration.log` |
| `node tools/timeline/integration.mjs --restriction` | 0 | **1/1 focused rerun** หลังเสริม Rules: owner อ่าน restricted DOCX metadata และ media ไม่ได้; `integration-restriction.json`, `restriction.log` |
| `npm run timeline:build` | 0 | build โหมด demo สำหรับ Hosting Emulator; `emulator-build.log` |
| `SAYARI_TIMELINE_ORIGIN=http://127.0.0.1:5000 node tools/timeline/browser.mjs` | 0 | **13/13** ผ่านบนไฟล์ build รวม actual upload/PDF canvas/DOCX; `browser.json`, `browser.log` |
| `npm run nanoka:test` | 0 | **34/34** ผ่าน; `nanoka.log` |
| `npm run localization:test` | 0 | **11/11** ผ่าน; `localization.log` |
| `npm run timeline:verify` | 0 | Calculator baseline ตรง + 61 protected files ไม่เปลี่ยน; `preservation.json`, `preservation.log` |
| `node tools/timeline/audit.mjs` | 0 | ตรวจ HEAD, 61 protected files, 30 kit manifest hashes และสร้าง file inventory |

คำสั่ง browser ในตารางเขียนแบบย่อ ใน PowerShell ใช้ `$env:SAYARI_TIMELINE_ORIGIN='http://127.0.0.1:5000'` ก่อนเรียก Node ตาม [คู่มือ](docs/TIMELINE_SETUP_TH.md) runner `checks.mjs` เก็บเวลาจริง/exit codes ใน [commands.json](evidence/timeline/commands.json)

**ประเด็นที่พบและแก้จากการรันจริง:** concurrent transaction transport retry, staging upload overwrite, cold-start function discovery timeout, accessible select labels, live page-boundary movement และ production-only Firebase chunk initialization cycle ปัญหา chunk แก้โดยกลับไปใช้ Vite automatic chunking แล้วทดสอบ Hosting build ใหม่ ชุดทดสอบ sweeper ปรับให้ตรวจหลาย batch เมื่อมีข้อมูลสะสมเกิน 100 รายการ โดยตรวจเพดานแต่ละ batch และ audit ไม่ซ้ำ ภาพ `debug/browser-fail-*.png` เป็นหลักฐานระหว่างแก้ ไม่ใช่ผลรอบสุดท้าย

**Screenshots:** guest, member ก่อน follow, requests OFF/ON, ghost, EDIT warning, HIDE X, hover3+N, cluster, create/edit forms, PDF/DOCX, request filter และ mobile อยู่ใน [รายการหลักฐาน](evidence/timeline/README.md) มี calculator ก่อน/หลังประกอบด้วย Browser ผลสุดท้ายไม่มี uncaught exceptions, forced downloads หรือ guest private request queries

**สิ่งที่ไม่เทียบเท่ากับผลบน cloud:** Emulator ไม่บังคับ production composite indexes ทุกกรณี, scheduled handler invocation ไม่ใช่ Cloud Scheduler delivery, Auth Emulator ไม่ใช่การส่งอีเมลจริง และ browser touch emulation ไม่ใช่การทดสอบโทรศัพท์จริง

## 5. Manual Firebase setup still required

คู่มือเต็ม: [TIMELINE_SETUP_TH.md](docs/TIMELINE_SETUP_TH.md)

1. ตรวจ Firebase project `sayari-81b58`, Web App config และ bucket/region จริง ใส่ public config ใน `.env.local` และตั้ง emulator flag เป็น false ก่อน production build
2. เปิด Email/Password provider และ authorized domains ใน Console ตั้ง password policy ตามต้องการ โดย V5 ไม่บังคับ email verification
3. เตรียม default Firestore, Storage และ Functions v2 ตรวจ/อนุมัติแผน Blaze/Billing เอง ไม่มีการเปิดหรืออนุมัติให้
4. ตรวจ rules/indexes โดยเฉพาะ default deny หากมี production collections ที่ไม่ปรากฏใน source นี้ จากนั้น deploy rules/indexes/functions ด้วยตนเองและรอ indexes พร้อม
5. ตรวจ runtime service account/IAM, Storage Rules → Firestore permissions, Scheduler invocation และ region `asia-southeast1` พร้อม monitoring/budget alerts
6. ตั้ง App Check site key ฝั่งเว็บ และ `TIMELINE_ENFORCE_APP_CHECK=true` ฝั่ง Functions เมื่อ token flow ใช้งานได้ ตรวจ staging ก่อน enforcement จริง
7. กำหนด moderator ผ่าน private operator CLI ด้วย credential ที่เชื่อถือได้เท่านั้น seed เฉพาะ metadata หัวข้อว่าง แล้วตรวจ cloud login, reset email, media, concurrency และ expiry jobs ก่อนเปิด production

Local quick start หลังติดตั้ง dependencies: `npm run timeline:build` → `npm run timeline:emulators`; อีก terminal รัน `npm run timeline:seed` และ `npm run timeline:dev` แล้วเปิด http://127.0.0.1:5174/timeline — คำสั่งและพอร์ตทั้งหมดอยู่ในคู่มือ ไม่มีข้อมูลเกมสมมติใน metadata seed

**สถานะ local เมื่อส่งมอบ:** เปิด Emulator และ Vite ไว้แล้ว หลังจบทดสอบเริ่มฐานข้อมูล Emulator ใหม่และ seed เฉพาะหัวข้อว่าง 3 หัวข้อ ไม่มี public stories หรือ requests เหลือจาก fixtures; Hosting smoke และ Functions auth gate ผ่าน หลักฐาน [local-ready.json](evidence/timeline/local-ready.json) การเปิด Firebase CLI ในเครื่องนี้ใช้เวลาหลายนาทีก่อนเริ่มบริการ

## 6. Open assumptions and unresolved issues

### Reversible defaults จาก `docs/11_OPEN_DECISIONS.md`

เป็นค่าเริ่มต้นเพื่อ implement ต่อ ไม่ได้อ้างว่าเป็นการตัดสินใจใหม่จากผู้ใช้:

- แก้ pending CREATE เริ่มขั้นต่ำ 72 ชั่วโมงใหม่; แก้ pending EDIT เริ่ม idle 24 ชั่วโมงใหม่; รอบเก่าถูก archive และคะแนนไม่กลับมานับ
- ยังไม่มี unfollow; ผู้ที่ follow ภายหลังโหวตได้ แต่ target ของคำขอคง snapshot ตอนเริ่มรอบ
- ห้ามเฉพาะผู้เสนอปัจจุบันโหวตคำขอตนเอง; original story author โหวต EDIT/HIDE ที่คนอื่นเสนอได้
- มี pending EDIT และ HIDE อย่างละหนึ่งพร้อมกันได้; HIDE ชนะแล้วยกเลิก EDIT; EDIT ชนะก่อน HIDE ยังผูก story เดิมและแสดง current revision
- ยกเลิก pending ของตนได้ทุกชนิด; hub อยู่ในหัวข้อที่ติดตามปัจจุบัน; หลาย badges ใช้พื้นที่แยก/กลุ่มที่กดได้
- Guest ดู approved history ได้เมื่อเรื่องยัง published; ซ่อนแล้ว history และ media ไม่เปิดต่อ guest
- เวลาไม่ชัดเจนอยู่ lane แยก ไม่ประดิษฐ์ระยะเวลา; เดือน/วันแปลงได้เฉพาะ calendar mapping ที่ระบุ ไม่เดาปฏิทินโลก
- 5 MB = 5,000,000 bytes; การ hide ปกติเป็น soft archive ส่วน emergency restriction ปิดสิทธิ์อ่านทันทีโดย operator

### ข้อจำกัดที่ยังมี

| รายการ | สถานะ / ผลกระทบ |
|---|---|
| Production activation | ต้องทำเองตามหัวข้อ 5; ยังยืนยันไม่ได้ว่าเปิด provider/billing/IAM/indexes/jobs แล้ว |
| DOCX | ดูข้อความ ย่อหน้า และตารางแบบข้อความในหน้าเว็บได้; ไม่รักษารูปแบบหน้า ฟอนต์ หรือรูปภาพทั้งหมด และไม่รองรับ legacy `.doc` |
| Large timelines | เรื่อง/คำขอแบ่งหน้าละ 60 ต้องโหลดเพิ่มเพื่อครอบคลุมข้อมูลทั้งหมด; metadata/entities/history cap 200 ต่อชุด; relative chain cap 200 |
| Cleanup/expiry capacity | bounded 100 รายการต่อรอบ; backlog ปริมาณมากต้องติดตาม/ปรับ capacity โดย server mutation ยังบังคับ expiry ทุกครั้ง |
| Build size | lazy Timeline bundle ประมาณ 633 KB (gzip 153 KB) จึงมี Vite 500 KB warning; PDF/worker โหลดเมื่อเปิดเอกสาร ไม่มี benchmark บนอุปกรณ์จริงหรือ production load test |
| Media safety | ตรวจขนาด MIME magic/structure, safe DOCX และ PDF actions; ไม่ใช่ระบบสแกนมัลแวร์เต็มรูปแบบ |
| External media | รูป/วิดีโอจากภายนอกขึ้นกับต้นทาง; bytes ที่เคยรับไปแล้วหรือ URL ภายนอกเรียกคืนไม่ได้หลัง hide |
| Abuse | จำกัด mutation/upload ตาม UID และมี reports/moderation แต่ไม่ได้พิสูจน์หนึ่งคนต่อหนึ่งบัญชี; ยังไม่มี moderator inbox UI เต็มรูปแบบ ใช้ Console/private operator flow |
| Accessibility | keyboard/Escape/labels/focus/touch และ mobile ผ่าน; formal screen-reader/WCAG audit ยังไม่ได้ทำ |
| Cloud-specific checks | real reset email, App Check enforcement, production rules/index deployment, IAM, region/egress, Scheduler delivery และ cloud smoke **NOT TESTED** |

ไม่มี mock backend หรือ placeholder action ที่อ้างว่าบันทึกสำเร็จ การใช้ Emulator และข้อมูลสังเคราะห์จำกัดอยู่ในเครื่องทดสอบ

## 7. Preservation and safety

- **No `git reset/clean`:** ไม่ได้ใช้
- **No commit/push/deploy:** ไม่ได้ใช้ HEAD เดิมและ remote เดิมคงอยู่ ไฟล์ใหม่ยัง untracked/modified เพื่อให้ตรวจทานได้
- **Original calculator:** สูตร/source ไม่เปลี่ยน เทียบ cards, input values และ numeric outputs ก่อน/หลัง รวมกรณี Piper RES20/DEF1000 ตรงกัน
- **Nanoka/localization:** source และ data pointers เดิมตรง SHA-256; ชุดทดสอบเดิมผ่าน 34+11
- **Original handoff:** 30 source files ตรง SHA256_MANIFEST และไม่แก้ reference contracts เพื่อให้ lint ผ่าน
- **Dirty/untracked files:** เริ่มตรวจพบ tree สะอาด; ไฟล์ untracked หลังจากนั้นเป็นงานนี้ ไม่มีการล้างงานผู้ใช้หรืองานเดิม
- **No secrets/mock lore deployed:** ไม่มี private service key ใน source, ไม่ deploy synthetic fixtures และ metadata seed ไม่มีเนื้อเรื่องเกมสมมติ

รายละเอียดก่อน-หลังและรายการไฟล์ครบ: [baseline](evidence/timeline/baseline.json), [preservation](evidence/timeline/preservation.json), [final audit](evidence/timeline/final-audit.json)
