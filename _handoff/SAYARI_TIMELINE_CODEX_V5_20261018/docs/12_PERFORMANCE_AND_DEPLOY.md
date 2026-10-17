# 12 — Performance, Costs, Deployment Gate and Operations

## Performance targets / practices

- Open empty or moderate timeline swiftly with minimal initial bundle; lazy-load Timeline route separate from ZZZ calculator when feasible, no large game data in main JS.
- Use Firestore cursor pagination for public event batches and request hubs; topic and status indexes, avoid scan-all; precompute light public projection vs heavy full history/media.
- Cluster markers in memory based on viewport/window; virtualize or canvas/SVG batch if >thousands events. Don't create one expensive tooltip/popover per off-screen item.
- Throttle pointer move/render and cancel stale requests; keep zoom/pan response fluid on normal desktop/mobile.
- Avoid uploading same media repeatedly; label attachments with size, generate thumbnails efficiently and optimize dimensions without changing original history if applicable.
- Cache public approved data appropriately but ensure hide/revision changes invalidate index/client subscriptions; do not cache pending responses publicly.

## Cost / account boundaries

- Cloud Functions scheduled expiry uses Cloud Scheduler which may require Blaze/billing; Cloud Storage creating bucket and Functions likewise can require Blaze. Check user plan and availability **before asking to enable/deploy**; never perform billing changes without explicit user approval.
- Firestore/Storage quota and billing based on reads/writes/storage/egress; no claims of fully free production. Emulator should work offline once dependencies installed.
- Prefer one scheduled sweeper every ~5 min for eventual expiry, with immediate server-time cutoff on any vote/write. Make sweep frequency configurable, document scheduler approximate latency. No recurring per-request browser timers as source of truth.
- Firebase Auth email/password provider enabled by user in Console; no forced verification in this initial design; implement bot abuse mitigation and explain that email ownership is not established.
- Do not deploy to the existing `sayari-81b58` project or another production destination. Preserve `.firebaserc` and existing Hosting settings; add necessary SPA rewrites only with review.

## Windows local dev documentation Codex must create

- Commands in PowerShell (explicit workspace `D:\sayari-project`): `npm install` only for new dependencies with package-lock change, `npm run dev`, `npm run build`, `npm run lint`, root and functions test scripts, `firebase emulators:start --only auth,firestore,functions,storage,hosting` if configured.
- Emulator envs / `.env.example` placeholders, Firebase config step-by-step, emulator seed and fixture reset with explicit safe command, no actual service account keys in repository.
- Test setup and output directories excluded from Git as appropriate. No Docker requirement, no huge cache temp artifacts committed.
- Explain new route deep-link refresh test and Hosting rewrite. Verify route compatibility with existing BrowserRouter and Vite.

## Operational behavior

- Track counts of active requests, expiring requests, failed media promotions/cleanup, suspicious repeated vote toggling, function errors; no sensitive info in client logs.
- Idempotent retry for distributed events; scheduled sweeper and submit/approve transaction are race-safe.
- Soft-hidden content may still exist on backups/old URLs/caches. Legal takedown procedure needs direct privileged exception.
- Focus Thai error messages, accessible event cards, support source/version provenance in history.
