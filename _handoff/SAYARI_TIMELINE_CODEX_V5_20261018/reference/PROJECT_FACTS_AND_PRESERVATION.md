# Verified source snapshot facts (17 Oct 2026; not present-time repository inspection)

Grounded in `reference/SAYARI_PROJECT_SUMMARY.txt` included in this ZIP. Codex must inspect current local project before implementation; newer changes may exist.

- Directory: `D:\sayari-project`.
- React 18.3.1, React Router 6.25.1, MUI 5.16.4, Vite 5.3.4, TypeScript 5.5.3 installed in snapshot; Firebase 10.12.4 dependency.
- Routes then: `/` Home and `/game/zenless-zone-zero` damage/DEF reverse calculator.
- Router registry `src/routes/routeList.tsx`; `src/routes/route.tsx` layout; BrowserRouter used. Home links generated from registry. Keep all new Timeline components modular to avoid circular imports.
- Existing ZZZ formulas in `src/views/games/zenless-zone-zero/card.tsx`; do not alter logic or sample data just to add Timeline. See original report for detailed equations and known issues.
- Firebase Hosting `firebase.json` pointed `hosting.public=dist` with no SPA rewrite in snapshot, `.firebaserc` had default project. No active Auth/Firestore/Storage/Functions implementation seen in source at that date.
- Snapshot git branch main with dirty working tree/untracked changes; preserve them; avoid `git clean/reset`. Build/lint passed in snapshot, not proof of current state.
- A separate Nanoka ZZZ API handoff kit may also exist in the project or be under active development. Do not overwrite it, and Timeline does not require Nanoka ingestion.

This package does NOT contain the user's full Git repository; Codex runs locally and must read actual source. This report is contextual input, not proof that code exists or that Firebase is configured.
