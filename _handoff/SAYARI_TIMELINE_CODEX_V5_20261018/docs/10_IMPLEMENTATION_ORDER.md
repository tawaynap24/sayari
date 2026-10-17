# 10 — Required Execution Order (do the work, don't just plan)

Recommended sequence so the app stays runnable and preserves existing work. The user requested **all V5 features implemented**, not a phase-1-only prototype; these are **work stages**, not permission to stop at the first stage.

## Stage 0. Repository discovery and safety

- inspect `D:\sayari-project`, Git branch/worktree, current source and Nanoka changes, Firebase config, dependency versions, tests; record baseline build/lint/screenshots/calculator behavior.
- No hard reset/clean, no broad reformat/refactor, no dependency mass upgrade; maintain existing ZZZ calculators and Nanoka routes.
- Identify only files and config needing edits; create clean Timeline module folder.

## Stage 1. Foundation and Local Emulator

- Set up Firebase modular initialization from project env (no secrets checked in), Auth/Firestore/Storage/Functions emulator connections, rules/indexes, Node functions TypeScript build, tests setup and reproducible local run instructions.
- Determine exact provider/billing/console settings needed; don't turn on production services.
- Build domain types, `policy` pure functions and time model with tests.

## Stage 2. Auth + topic/follow

- Implement login/register/logout Email+Password (no required email verification) and restored auth state.
- Categories/topics with an empty horizontal line; guest published read, member not followed gating, deliberate follow and duplicate follow protection; interest counts not client controlled.
- Test browser scenarios and server rules, including guest not seeing request APIs.

## Stage 3. Story create/publish & requests

- Create form with time modes/named entities/source refs/media metadata. Submit via server snapshot and compute CREATE auto or pending; public projection for approved; pending request visibility to interested members only.
- Pending author edit/reset/cancel, request state machine and immutable story revisions; transaction and idempotency tests.

## Stage 4. Voting / expiry / edit/hide

- Implement yes/no and switches, self-vote restriction, snapshots, cap, YES priority, score integrity, server timestamp deadlines; scheduled worker + on-mutation enforcement.
- Implement EDIT prefill/diff/one active lock, HIDE/soft hidden, privileged bypass with claim + audit. Test concurrency and lock release.

## Stage 5. Timeline full interactions

- Horizontal axis, two spacing modes, min visual gap, zoom/pan/touch, clustering, hover 3+N, click marker/select stories with borderless list/detail expansion.
- Time order conversion only when domain clock definitions support it; relative anchors, unknown and cyclic reference handling, distance tooltip.
- Requests overlay switch default OFF, ghost/warning/X top-right tiny badges; dedicated requests hub and filters.

## Stage 6. Media, docs, names and language

- Safe image uploads/URL/embed, video allowlist embeds, PDF browser preview, safe DOCX preview when feasible, 5MB cap, Firebase Storage security.
- Source reference fields and historical snapshot; proper nouns with Thai/English aliases; Thai UI, keyboard/mobile responsiveness.

## Stage 7. Hardening and verification

- Add Security Rules tests for direct write denial/public read separation, emulator concurrency, idempotency, restrictions and expiry.
- Real browser E2E/smoke, mobile layout, baseline existing ZZZ pages unchanged, performance checks; SPA Hosting rewrite.
- Write setup/readme commands for Windows, user-config steps for Firebase, tests evidence; do NOT deploy/commit/push.

## What counts as complete

All required features have working routes, persistence, backend-authoritative logic, security, tests and documentation. If a cloud-account dependency blocks a production setting, implement local emulator path and mark that **external activation** remains manual. If safe DOCX preview is unavailable, report partial explicitly; do not silently downgrade scope or claim complete.

## Changes must be reviewable

Use small modular files, pure logic separated from UI, clear routes; avoid dumping whole solution into one component. Add a `TIMELINE_IMPLEMENTATION_REPORT.md` or equivalent based on report template, and list commands + test status.
