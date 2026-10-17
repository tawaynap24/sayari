# Acceptance Checklist — SAYARI Timeline V5

Use `DONE`, `PARTIAL`, `BLOCKED`, `NOT TESTED` per item in real Codex implementation report. This list describes **expected outcome**, not existing app state.

## Navigation + access

- [ ] Home links to Timeline and ZZZ damage calculator still works unchanged
- [ ] Categories and multiple topics supported without hard-coding game data model
- [ ] Topic with zero approved stories shows empty horizontal line
- [ ] Guest can read approved timeline on deep link with no modal, no count/action/request badges
- [ ] Signed-in not-followed only sees topic summary and explicit interested button, no timeline details
- [ ] Follow action idempotent and server counts only one UID once, no auto-follow on open
- [ ] Email/password register/login/logout works without mandatory email verification
- [ ] Privileged actions checked server-side and audited, no client elevation

## Story and time

- [ ] Story title/body/time/entities/refs and media accepted with server validation
- [ ] Thai-first UI and reusable multilingual entity aliases
- [ ] Exact, approx, range, unknown, relative time with selectable existing anchor
- [ ] Cycles and invalid/self/cross-topic references rejected
- [ ] Timelines have equal/time spacing, min visual gap, group/ungroup under zoom, pan/scroll/touch
- [ ] Segment delta computed from data, not pixels; unknown delta not faked
- [ ] Hover/focus shows latest 3 stories by add time and `+N`; selected marker lists all published stories below add button
- [ ] Stories list borderless/low-chrome and expandable details readable on mobile

## Requests and voting

- [ ] CREATE N<50 publishes directly; CREATE N=50 asks 5 yes/no, N=1000 asks 100, N>1000 stays100
- [ ] EDIT/HIDE threshold min5 max100 from current snapshot at each request start
- [ ] User may not vote own request; only interested signed-in member votes; one effective vote/UID/request
- [ ] Switch YES↔NO before terminal with accurate deltas; same choice again doesn't restart timer
- [ ] Request creation snapshot stays constant while followed count changes
- [ ] Editing pending proposal resets votes and recalculates current interest snapshot + clock
- [ ] YES threshold decides accept requested action before NO in simultaneous tie
- [ ] CREATE cannot expire before 72h; can settle by vote immediately; later idle24h governs
- [ ] EDIT/HIDE idle24h without 72h; unlimited duration if votes continue; expire server enforced even before sweep
- [ ] Expired requests `expired` distinct from negative-threshold `rejected`, new hide rounds use fresh snapshot
- [ ] Pending author may cancel own CREATE request; approved author cannot edit/hide directly
- [ ] Approved story edited only via proposal, one active EDIT/story transaction lock, version history kept
- [ ] HIDE successful removes from public timeline and public data reads; soft archive retained
- [ ] Hide/edit race cannot resurrect hidden content

## Overlay / hub

- [ ] Request visibility toggle defaults OFF for interested members
- [ ] ON shows pending CREATE faded marker, EDIT warning top-right, HIDE tiny X top-right
- [ ] OFF shows no ghost/warning/X; guest doesn't see toggle or badges at all
- [ ] Clicking request item opens correct proposal detail with votes
- [ ] Separate current requests hub with filters ALL/CREATE/EDIT/HIDE + pagination

## Media / source

- [ ] Image upload and URL/embed, video URL/allowed embed and source refs work
- [ ] <=5,000,000 bytes accepted and >5,000,000 bytes rejected on client/server/rules
- [ ] PDF inline viewer; DOCX safe inline preview if feasible, else clearly documented partial
- [ ] Document click doesn't automatically download; malicious file/URL disallowed
- [ ] Staging media private before approval and hidden/story archives not leaked to guests

## Backend/security/ops

- [ ] Firebase Auth, Firestore, Storage, Cloud Functions and emulator are wired locally
- [ ] Firestore rules block direct client vote/counter/story status/privileged role writes
- [ ] Atomic follow, request, vote, revision and lock updates; concurrent tests pass
- [ ] Scheduler expiry worker idempotent, API checks expiry at server time
- [ ] Public projection approved only; pending/hidden/rejected inaccessible to guest queries
- [ ] Firebase Hosting SPA rewrite supports deep links without breaking existing routes
- [ ] Seed data only categories/topics, no made-up public lore
- [ ] Build + lint + unit + Emulator integration + UI smoke ran with evidence
- [ ] All manual Firebase enabling/billing steps documented; no commit/push/deploy performed
