# CODEX FINAL REPORT — SAYARI TIMELINE V5

**Date/time, timezone:**
**Branch/worktree status before / after:**
**Scope:** Timeline module, existing ZZZ calculator preserved?
**Build/deployment:** LOCAL ONLY. No commit/push/deploy unless user requested separately.

## 1. Status per feature

| Feature | DONE / PARTIAL / BLOCKED / NOT TESTED | Evidence / URL / File |
|---|---|---|
| Topic/category navigation | | |
| Auth email/password | | |
| Guest approved-only view / member follow gate | | |
| Interest snapshot/threshold/cap | | |
| New story create/auto publish | | |
| Pending author edit/reset/cancel | | |
| YES/NO voting and vote switching | | |
| CREATE72h+idle24h vs EDIT/HIDE24h | | |
| Published revision EDIT workflow / one-edit lock | | |
| HIDE yes/no, new round snapshot, soft hidden | | |
| Requests switch fade/warning/X and hub filters | | |
| Timeline zoom/pan/two modes/cluster/hover/delta | | |
| Relative/uncertain/named era time | | |
| Entity aliases multilingual / sources | | |
| Media+PDF+DOCX viewer and 5MB cap | | |
| Firebase rules/transactions/expiry sweeper | | |
| Thai/mobile/accessibility | | |
| Original ZZZ calculator unchanged | | |

## 2. Files changed / added

- `...`: why changed

## 3. Database, server APIs and security

- Firestore schema+composite indexes, public/private projection, CLI functions, Storage paths.
- Rules/race protections, role elevation path, scheduled expiry behavior.

## 4. Commands actually run, results and evidence

| Command | Exit code | Actual result / evidence path |
|---|---:|---|
| npm run lint | | |
| npm run build | | |
| test/unit | | |
| Firebase emulator integration/rules | | |
| Browser E2E | | |

Screenshots and test artifacts:

## 5. Manual Firebase setup still required

- Email/password provider:
- Firestore/Storage/Functions availability:
- Billing/Blaze approvals:
- IAM/App Check/Scheduler:
- Environment config and project scope:

## 6. Open assumptions and unresolved issues

- Explicit assumptions from `docs/11_OPEN_DECISIONS.md` that were used:
- Known functional gaps and severity:
- Not verified (don't mark PASS):

## 7. Preservation and safety

- No `git reset/clean`:
- No commit/push/deploy:
- Original calculator behavior evidence:
- Dirty/untracked files preserved:
- No secrets or mock lore deployed:
