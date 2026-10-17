# CODEX MASTER PROMPT — IMPLEMENT SAYARI TIMELINE V5 END-TO-END

คุณคือ Coding Agent ที่รับผิดชอบ implement โมดูล **Timeline** ลงในโปรเจกต์จริง `D:\sayari-project` โดยยึดข้อตกลงผู้ใช้ล่าสุดในแพ็กเกจนี้เป็น authority สูงสุด ต้องลงมือพัฒนาจนเป็นระบบเชื่อมต่อ Frontend–Backend–Database ที่ใช้งานได้จริงใน local/emulator, ไม่ใช่แค่ UI Prototype หรือ Implementation Plan

## คำสั่งก่อนเริ่ม (ต้องทำ)

1. อ่าน `README_TH.md`, `docs/00_REQUIREMENTS_PRIORITY.md` และเอกสารทั้งหมดใน `docs/`, `contracts/`, `reference/policy.v5.json`, `tests/` ก่อนแตะไฟล์โปรเจกต์
2. ตรวจ `pwd`, `git status --short`, branch, config, dependency versions, routes, architecture, Firebase files, current Auth/Firestore/Storage/functions status และความเปลี่ยนแปลงที่มีอยู่จริง
3. อ้าง `reference/SAYARI_PROJECT_SUMMARY.txt` เป็นแค่ snapshot 17 ต.ค. 2026; ถ้ามีงาน Nanoka/API ที่เพิ่มหลัง snapshot ให้รักษาไว้ทั้งหมดและเชื่อมส่วน Timeline อย่างปลอดภัย
4. เขียน implementation plan ภายในงานให้มีลำดับและเกณฑ์ตรวจรับ แต่**ให้ทำจริงต่อทันที** อย่าจบแค่ plan หรือขออนุมัติในสิ่งที่ไม่ต้องใช้สิทธิ์ภายนอก
5. เลือก Firebase (Auth + Firestore + Cloud Functions + Storage + Emulator) เป็นค่าเริ่มต้นเนื่องจาก project ใช้ Firebase Hosting อยู่แล้ว; ปรับเฉพาะเมื่อสำรวจ repo พบเหตุผลจริง พร้อมบันทึกเหตุผล

## เป้าหมายที่ต้องส่งมอบทั้งหมด

- หมวด/หัวข้อกลางแบบไม่ผูกกับชื่อเกม และ seed เฉพาะหัวข้อเปล่าที่จำเป็น (ZZZ/Genshin เป็นตัวอย่าง), ไม่ปลอมเนื้อเรื่อง Official
- หน้า Timeline แนวนอน (Zoom/Pan/Scroll), equal spacing & time spacing with min spacing, auto-clustering on zoom out, timeline-relative calendar including relative/uncertain/range time and reference to another event, show duration only when computable, no fake dates
- Marker tooltip latest 3 stories and `+N` by submit/add time, event selection and borderless story list below with detail expansion, media previews and source references
- Thai-first UI, entities/proper nouns with multilingual aliases, scalable to multiple topics/domains
- Email/password authentication via Firebase; no enforced email verification initially; guest reads public published timeline without interest dialog; logged-in users **must explicitly follow a topic before any topic content/actions appear**
- Interest membership in server database (one per UID/topic), counts and threshold snapshots; non-followed logged-in user sees only topic identity and follow CTA
- Submitting story, editing/cancelling own pending, auto-publish for <50 interests, voting for >=50, guest no write/actions, author cannot vote own request, max100 votes threshold
- Published story immutable in place; proposal-based editing of published story, approval replaces active revision and retains prior revisions; enforce exactly one active edit proposal per story (later request rejected with clear error)
- Hide proposal with yes/no voting, 5–100 threshold, snapshot per new hide round, soft hidden archive/history; privileged override with secure claim and audit log
- Vote switches yes↔no until request is terminal, true score delta and inactivity clock reset; same choice again idempotent and must not reset timer
- Create approval requests: minimum 72h before **expiry only** and idle24h; as soon as yes/no reaches threshold close immediately. Edit/hide requests: idle24h only. Scheduled expiry + server-side deadline check, reopen new requests after terminal, no maximum cumulative age if vote changes continue
- Default OFF switch `ดูเหตุการณ์คำขอ`; ON shows faded pending create markers, tiny top-right warning for pending edit, tiny top-right X for pending hide, click to see/request-vote; guest cannot see this option nor request statuses
- Separate current requests page/tab with filters (all/create/edit/hide/other), paginated and linked to corresponding topic/time marker
- Image URL/embed and image upload, video URLs/allowlisted embeds; per-file upload cap 5,000,000 bytes. PDF inline viewing, DOCX inline viewing where safely feasible without auto-download, safe fallback and explicit reporting if any format unsupported
- Firebase security rules and private/public views; server-controlled transitions; Emulator tests incl concurrent votes, edit lock, access control; realistic frontend tests including mobile and keyboard
- Firebase Hosting SPA rewrite for new route where appropriate, without changing deployment target or deploying

## ตัวเลขและ State: ห้ามเดา

ดู `docs/02_VOTING_RULES.md` และ `reference/policy.v5.json` เป็น authority. โดยย่อ:

- CREATE เมื่อ N<50 auto publish; otherwise `min(100, ceil(N/10))`
- EDIT / HIDE `min(100, max(5, ceil(N/10)))`
- ผู้ส่งคำขอห้ามโหวตตนเอง; บัญชีหนึ่งคะแนนหนึ่งฝั่งต่อคำขอ; changing vote allowed
- `yes` ถึง threshold => accept request; `no` ถึง threshold => reject request; tie same atomic adjudication => YES priority
- ยอด N snapshot เมื่อสร้าง request; pending proposal edited => reset all votes + threshold based on current N; previous votes must not be counted
- CREATE deadline while still pending: `max(submittedAt+72h,lastVoteChangedAt+24h)`; no vote=>lastVoteChangedAt=submittedAt
- EDIT/HIDE deadline: `lastVoteChangedAt+24h` (no vote=>submittedAt)
- Time is UTC server timestamps; UI locale Thai; never use client clock to authoritatively decide

## ความปลอดภัยและการเปลี่ยนฐานข้อมูล

- Every critical mutation via authenticated Backend Callable Function / equivalent server-side controlled endpoint; auth, topic interest, submitter, role, payload validation server-side; Firestore transaction to atomically update request/votes/counters/revision and public projection; no trust in client submitted vote count, current interestCount, threshold, status, or role
- Deny direct client edits to public event records, votes, counters, snapshots, roles and audit; allow public read only for approved public projection. Pending/rejected/hidden never leaked in public queries
- Guest read to public projection means you **cannot securely forbid the same public data at API level solely because somebody is logged-in but not followed**; implement the special member restriction at UX/query level and describe limitation (public data remains public)
- Do not store passwords in Firestore or source; Firebase Authentication owns credentials. Use controlled custom claims / admin for roles. Protect media from XSS and malicious uploads; immutable revision paths, file type+size checks, safe URL/embed handling
- Snapshot and audit trace for votes/revisions. UI status/expired countdown cannot itself be trusted for server decisions

## Workflow ที่ต้องทำจริง

Follow `docs/10_IMPLEMENTATION_ORDER.md`: inspect → implement vertical slice Firebase/emulator → auth/follow → add story/request/votes → time engine → full timeline UI → history/media/requests hub → rules/abuse protection → test all → review/build/lint → report. You may organize subtasks but continue through full scope. Avoid sweeping unrelated refactors; reconcile dirty files carefully.

### Tests ที่ต้องรันจริง

- `npm run build` and `npm run lint` (update package scripts thoughtfully if necessary)
- Unit tests for pure policies/time graph
- Firestore/Auth/Functions/Storage rules tests with Emulator or explicit documented constraint
- Concurrent duplicate vote/edit requests tests, 100 vote cap, 49/50 boundary, snapshot on edit, reversible votes, scheduled expiry, tie priority, reject/hide/read filters
- UI integration and E2E or browser smoke tests (desktop, mobile, keyboard, Zoom/pan and persisted auth/follows)
- Guest published-only visibility and no request icon/button; logged not-followed hides details/actions; active followed user can vote; no owner self-vote
- Existing ZZZ calculator routes and formula results unchanged (baseline comparison; if changed flag/block until resolved)

If tests are blocked by missing external Firebase configuration, implement and test with emulator first; mark external integration **not verified**, never invent PASS. When introducing Firebase Functions/Storage, inform the user that Console/provider enablement and possibly Blaze billing must be approved/performed by the user; do **not** deploy production.

## Deliverable report

Use `templates/CODEX_FINAL_REPORT.md` with:
- status DONE/PARTIAL/BLOCKED for **each** feature and test; no inaccurate global PASS
- all modified files, new routes, backend Functions, data models, Firebase setup manual steps, index/rules files, migration/seed requirements
- real execution commands and exit codes, screenshots/logs if generated, unresolved issues, security/performance limits
- explicit mention what cannot work until Firebase Console/Storage/Functions are enabled and pricing plan verified
- evidence that original ZZZ calculator and any existing Nanoka work are preserved
- NO commit/push/deploy unless user separately requests it

Start the implementation now. Follow actual repository state if it differs from the snapshot. Do not stop after scaffolding; work until complete or genuinely blocked by requirements outside local workspace, then finish all other independent work and report clearly.
