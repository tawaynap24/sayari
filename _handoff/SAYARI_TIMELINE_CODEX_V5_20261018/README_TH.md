# SAYARI Timeline — Full Implementation Handoff (Specification V5)

**วันที่จัดชุดเอกสาร:** 18 ตุลาคม 2026  
**Workspace เป้าหมาย:** `D:\sayari-project`  
**วัตถุประสงค์:** ส่งมอบข้อกำหนดครบถ้วนให้ Codex implement โมดูล Timeline ของ Sayari จริง แบบ end-to-end  
**สถานะ:** ชุดคำสั่งและข้อมูลอ้างอิงเท่านั้น — **ยังไม่ได้ลงมือแก้ source ในเครื่องผู้ใช้ ไม่ได้ทดสอบแอปจริง และไม่ได้ deploy**

## วิธีใช้

1. แตก ZIP โดยให้โฟลเดอร์ `SAYARI_TIMELINE_CODEX_V5_20261018` อยู่ที่ `D:\sayari-project\_handoff\SAYARI_TIMELINE_CODEX_V5_20261018` (หรือแก้ Path ใน Prompt ให้ตรงตำแหน่งที่แตกจริง)
2. เปิด Codex โดยใช้ `D:\sayari-project` เป็น Workspace
3. เปิด `00_CODEX_PASTE_FIRST.txt` แล้วคัดลอกข้อความไปส่งให้ Codex
4. Codex ต้องอ่าน `CODEX_MASTER_PROMPT_TH.md` และ `docs/` ทั้งหมดก่อนลงมือ, ตรวจ Git Status และทดสอบด้วย Firebase Emulator
5. หลังทำเสร็จให้ตรวจผลจาก `templates/CODEX_FINAL_REPORT.md`, `tests/ACCEPTANCE_CHECKLIST.md` และหลักฐาน Test จริง

## ลำดับอ้างอิงเมื่อข้อมูลขัดกัน

1. ข้อตกลงล่าสุดของผู้ใช้ใน `docs/00_REQUIREMENTS_PRIORITY.md` และ `docs/01_FUNCTIONAL_SPEC.md`
2. กฎคำนวณที่ล็อกไว้ใน `docs/02_VOTING_RULES.md` และ `reference/policy.v5.json`
3. เอกสารเฉพาะส่วนอื่นใน ZIP
4. รายงาน Source snapshot `reference/SAYARI_PROJECT_SUMMARY.txt` (เป็น snapshot ของ 17 ต.ค. 2026 ไม่ใช่ repo ปัจจุบัน)
5. Assumption สำหรับกรณีที่ผู้ใช้ไม่ได้ตัดสินใจ ให้เปิดเผยในรายงานและเลือก safe default ที่กลับมาแก้ไขได้

## โครงสร้างเอกสาร

- `CODEX_MASTER_PROMPT_TH.md` — คำสั่งหลักให้ implement ทั้งระบบจริง
- `docs/00_REQUIREMENTS_PRIORITY.md` — ขอบเขตและสิ่งที่ห้ามเปลี่ยน
- `docs/01_FUNCTIONAL_SPEC.md` — รายละเอียดหน้าที่และผู้ใช้ทุกประเภท
- `docs/02_VOTING_RULES.md` — สูตรคะแนน, state transition, snapshot, tie, 24h/72h
- `docs/03_TIME_ENGINE.md` — เวลาในโลกเรื่องและสองโหมดระยะ Timeline
- `docs/04_BACKEND_AND_SECURITY.md` — Firebase, schema, callable APIs, transaction, rules
- `docs/05_UI_UX.md` — หน้า/คอมโพเนนต์และสถานะ UI
- `docs/06_TEST_PLAN.md` — แผนทดสอบจาก policy ถึง emulator และ E2E
- `docs/07_MEDIA_AND_REFERENCES.md` — รูป/วิดีโอ/PDF/Word, 5MB, แหล่งอ้างอิง
- `docs/08_ROLES_FOLLOWS_AND_PRIVACY.md` — guest/member/follower/privileged และความเป็นส่วนตัว
- `docs/09_TIMELINE_CONTENT_LIFECYCLE.md` — เรื่องราว, revision, ซ่อน/ปฏิเสธ, audit
- `docs/10_IMPLEMENTATION_ORDER.md` — ลำดับงานแบบทำต่อจนจบ ไม่หยุดแค่ Plan
- `docs/11_OPEN_DECISIONS.md` — กรณีที่ผู้ใช้ยังไม่ระบุ พร้อม default ชั่วคราวที่ต้องเปิดเผย
- `docs/12_PERFORMANCE_AND_DEPLOY.md` — pagination, indexes, Storage/Functions cost, ไม่ deploy เอง
- `docs/13_THAI_LANGUAGE.md` — ภาษาไทย, formatting, locale และอนาคตหลายภาษา
- `reference/policy.v5.json` — machine-readable policy constants
- `reference/FIREBASE_OFFICIAL_DOCS.md` — ลิงก์ Firebase ทางการพร้อมข้อควรระวัง
- `contracts/timeline-types.ts`, `contracts/vote-policy.ts` — TypeScript reference contracts / pure calculations
- `tests/vectors.v5.json` — test vectors สำหรับเกณฑ์และ deadline
- `tests/ACCEPTANCE_CHECKLIST.md` — Acceptance Checklist
- `templates/CODEX_FINAL_REPORT.md` — รูปแบบรายงานสุดท้าย
- `tools/verify_kit.py` — ตรวจความถูกต้องพื้นฐานของชุดเอกสาร ไม่ใช่ตัวทดสอบแอป

## เงื่อนไขสำคัญ

- **ห้าม**ลบ/เปลี่ยนสูตร Damage ของ ZZZ หรือกระทบงาน Nanoka ที่อาจกำลังพัฒนาอยู่
- **ห้าม**นำไฟล์เอกสารใดไปถือว่าเป็น Firebase configuration ที่ยืนยันแล้ว; ตรวจสถานะจริงก่อนเสมอ
- **ห้าม**สร้างเรื่องราวเนื้อเรื่องเกมสมมติแล้วเผยแพร่เป็นข้อมูลจริง; test seed ใช้ข้อมูล A/B/C ใน Emulator เท่านั้น
- **ห้าม**เปลี่ยน Firebase project production, เปิด Billing, แก้ Console, deploy, commit, push โดยไม่ได้รับอนุญาต
- หากไม่มีสิทธิ์หรือ credential ให้ implement ด้วย Emulator/Local และระบุการตั้งค่าที่ผู้ใช้ต้องทำ
- เป้าหมายคือระบบใช้จริงผ่าน backend; การแสดง Mock Data อย่างเดียวไม่ถือว่าเสร็จ
