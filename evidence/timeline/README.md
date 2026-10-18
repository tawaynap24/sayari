# Timeline V5 local verification evidence

All fixture users and stories belong to `demo-sayari-timeline` on localhost. They are synthetic test data, not game canon or production content. Current results are in the JSON/log files below; earlier diagnostic screenshots in `debug/` show failures that were subsequently repaired, not the final result.

- `commands.json`: actual command start/end times and exit codes. Repeated records are intentional reruns after fixes or evidence capture. Each named `.log` and result JSON contains the latest run of that command; earlier command records retain their original exit status but their shared log path refers to the latest output.
- `unit.log`: 51 policy/time/validation/media tests against compiled application domain code and the untouched V5 vectors.
- `integration.json`, `integration.log`: 23 real Emulator transaction/security/Auth/callable/Storage/scheduled-handler scenarios, including concurrent votes, exact expiry, 1001 memberships and the 100-vote cap.
- `integration-restriction.json`, `restriction.log`: focused rerun after strengthening the media metadata rule; a restricted DOCX cannot be read by its uploader through Firestore metadata or the media access function. The assertions are also included in the normal integration suite.
- `browser.json`, `browser.log`: 13 Edge browser scenarios against the built app on Hosting Emulator. Check `origin`, each result, uncaught errors, forced downloads and guest private queries.
- `build.log`, `lint.log`: ordinary production build and lint. `emulator-build.log` records the later build for local Hosting; this emulator-mode `dist` must not be deployed to production.
- `nanoka.log`, `localization.log`: original project suites, 34 and 11 tests.
- `baseline.json`: original source hashes and HEAD. Its status already includes the implementation plan and initial tooling created by this task; the first repository inspection before those files was clean.
- `calculator-baseline.json`, `calculator-before.png`, `calculator-after.png`, `preservation.json`, `preservation.log`: original calculator render/input/output comparison and 61 protected source/data pointer/config hashes.
- `final-audit.json`: final source inventory with hashes, original-source/kit preservation, branch, HEAD and remote. The audit file itself is generated after its inventory snapshot.
- `local-ready.json`, `ready-explorer.png`, `ready-empty-topic.png`: after the tests, the task-owned Emulator was restarted and seeded with only three empty topics. Hosting and the Functions authentication gate were checked again; synthetic test stories are absent from the ready-to-use local database.

Screenshots of the successful browser run:

| State | File |
|---|---|
| Public guest | `guest-desktop.png` |
| New member before explicit follow | `member-not-followed.png` |
| Followed member, requests OFF / ON | `member-toggle-off.png`, `member-toggle-on-ghost.png` |
| Latest three titles and remainder / time-scale clustering | `marker-hover.png`, `time-scale-cluster.png` |
| Create form and uploaded media | `create-form-media.png` |
| Inline PDF canvas and escaped DOCX text | `inline-pdf-docx.png` |
| Pending edit/reset confirmation / approved revision edit form | `pending-edit-form.png`, `published-edit-form.png` |
| EDIT warning / HIDE X | `edit-warning-badge.png`, `hide-x-badge.png` |
| Current requests and type filter | `requests-filter.png` |
| Mobile timeline | `mobile.png` |

Screenshots were visually inspected for desktop, mobile and request states. Browser checks include real touch input, but no formal screen-reader or WCAG conformance audit was performed. No production Console, billing, IAM, index provisioning, email delivery, App Check enforcement or Cloud Scheduler delivery is marked tested.
