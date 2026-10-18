# Sayari Timeline V5 — implementation record

Baseline: main / c8fc5b9; clean before this work. Scope: Timeline only; existing calculator, Nanoka and localization are protected by SHA-256 evidence.

1. Read entire V5 kit; verify kit vectors; record build/lint and calculator baseline.
2. Implement shared policy/time/validation, Firebase v2 callables, immutable revisions and public projections, rules, indexes and demo emulator configuration.
3. Implement auth/follow gates, complete content forms, requests/voting/history and safe media flow.
4. Implement horizontal time engine/view, clustering, zoom/pan/mobile/keyboard, overlay and paginated request hub.
5. Exercise unit vectors, emulator transactions/rules/media and browser scenarios; fix failures, verify original modules, build/lint and report.

Acceptance: use the full checklist in the untouched handoff, with real evidence per feature. Production Firebase activation is manual. No commit, push, reset, clean or deployment.

## Explicit provisional choices

Use all reversible defaults in V5 docs/11: pending CREATE edits restart 72h; EDIT resets 24h; no unfollow; new followers may vote with frozen threshold; only requester self-vote prohibited; one EDIT and one HIDE may coexist; approved HIDE cancels pending EDIT; approved EDIT does not cancel HIDE; own pending requests of all kinds may be cancelled; unresolved times stay nonnumeric; public approved history gated by current publication; decimal 5 MB; privileged takedown restricts access immediately.

Canonical server times are UTC integer milliseconds from the backend clock (not client values). Public guest data remains public even when the signed-in nonfollower UX hides it. Emulator project is demo-sayari-timeline, existing .firebaserc production target remains unchanged.

## Delivery record

Stages 1–5 have been implemented. Actual verification results, limitations and manual cloud activation are recorded in `TIMELINE_IMPLEMENTATION_REPORT.md` at the repository root; command logs and screenshots are in `evidence/timeline/`. This plan is retained as the initial scope/decision record, not a replacement for the final test evidence.
