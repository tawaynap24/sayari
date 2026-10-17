# 06 — Required Tests and Evidence (not an aspirational checkbox-only plan)

## 1. Pure domain policy unit tests

Use `tests/vectors.v5.json` and `contracts/vote-policy.ts` reference. Test N=0,1,49,50,51,99,100,1000,1001,100000; N=49 CREATE auto, EDIT/HIDE min5, all caps100, no fractions/no rounding down.

- Deadline CREATE no votes: submittedAt+72h, not 24h; reaches threshold in 1 min => settle immediately.
- CREATE vote at t=70h extends until max(t=72h,t=94h); if last vote t=20h, expiry t=72h.
- EDIT/HIDE no votes expires at +24h; later vote extends by +24h; no overall maximum.
- At exact expiry now==deadline vote denied and request closes `expired`. Scheduler lag cannot create extra voting window.
- YES vs NO counters, change YES→NO and NO→YES; old counter--, new++, lastVoteChangedAt renews, same repeated choice no counter/timer effect; unique vote.
- Tie decision YES-first in a single adjudication; HIDE yes means hide.
- Editing pending resets old vote doc/round, new snapshot N and threshold, new clock; old votes cannot reappear.
- AUTHOR self-vote denied; guest/not-followed denied; later follow allowed (eligible new voter) without rewriting snapshot.
- Terminal states immutable. Privileged bypass role permission, audit logging, absence of phantom votes.

## 2. Firestore/Functions Emulator transaction tests

- Simultaneous followTopic duplicate requests yield only one interest record/counter bump; interestedCount never goes negative.
- 2 clients create EDIT request for same story at same time: exactly one pending, second localized conflict error; release lock upon terminal.
- 2 devices same UID vote concurrently: one effective choice; no double count.
- Parallel votes crossing threshold: transition exactly once, public projection updated once; no `approved`/`rejected` conflict.
- Request HIDE and EDIT on same story concurrently: enforce documented precedence; no hidden story accidentally re-published by a later edit approval.
- Forced cached/missing request state; expired requests cleaned idempotently by scheduled sweeper; sweeper retries; missing on-demand checks.
- Public projection created on approval; removed/hid on successful hide; rejected/expired pending media not exposed.
- Archival/history retains immutable revisions with actor and timestamps; authorized access only to private audit.
- Verified allowed/denied Cloud Firestore and Storage access matrix; attempt malicious direct writes to votes, counters, role and public event should FAIL.
- Server validation for negative/NaN interest, overlong text, SVG/html upload, MIME spoof, >5,000,000-byte file, malicious embed URL, invalid reference entity and cross-topic event anchor.

## 3. Time engine tests

- Exact year 100 to year 110 => `10 ปี` with consistent topic calendar; non-Earth calendar not assumed.
- Relative `A after B` resolution from known B; `B after A` cycle rejected; self-anchor rejected.
- Unknown/approx/range event never labeled with unsupported exact duration.
- Relative descendants re-evaluated when anchor's approved revision changes time; hidden anchor treated safely.
- Overlapping event time grouping; minimum visual gap doesn't modify stored time or duration tooltip.
- Equal spacing and time spacing same chronological order but different x positions; zoom out groups; zoom in restores markers.

## 4. Browser integration/E2E

- Guest direct URL to topic loads public published events without interest dialog or action and no request icons/toggle/hub, even if UI setting was ON before logout.
- Member login -> unfollowed topic displays CTA but no timeline content; click follow once counts once; multi-device follow idempotent.
- Followed can create story and media refs; new topic below50 auto publishes, at50 goes pending; pending ghost only when toggle ON.
- Parent source refs/story details fully expand and can be linked; hover latest3+N; touch tap and keyboard focus equivalents.
- Pending EDIT warning at top-right, pending HIDE X top-right; multi-request marker does not visually overlap. Requests tab filters and opens correct ballot.
- Published story immutable direct editing; create edit proposal with prefill; approval installs revision and history; rejection leaves old revision.
- Concurrent duplicate edit visible error; pending edit resets vote and threshold, pending author cancel works.
- Media 5,000,000 bytes accepted, 5,000,001 rejected; image renders; video safe embed; PDF inline; DOCX safe inline or explicitly recorded unsupported (best-effort). No automatic download click.
- Desktop, mobile viewport, zoom/pan/cluster, long Thai labels, page refresh/deep link; authentication state loading no content leak.
- Existing Home and `/game/zenless-zone-zero` calculator still work and formula output unchanged vs before snapshot/current baseline.

## 5. Commands / evidence

- `npm run lint`, `npm run build` and relevant `npm run test` in root/functions if configured
- Firebase Emulator with test users, tests and setup; no tests touching prod Firestore/Storage.
- Screenshot at minimum: Guest, member not interested, interested timeline toggle OFF/ON, ghost/edit warning/hide X, request filter, create/edit forms, time scale/cluster, mobile.
- Log tests executed with exit status; explicitly NOT VERIFIED when cloud credentials/provider/settings unavailable. Fix failures caused by implementation before reporting completion.

## 6. Reporting rules

Never equate successful TypeScript compile with actual backend correctness. Never report tests that weren't run. Unit tests of kit are not tests of user project. Use `templates/CODEX_FINAL_REPORT.md` and `tests/ACCEPTANCE_CHECKLIST.md`.
