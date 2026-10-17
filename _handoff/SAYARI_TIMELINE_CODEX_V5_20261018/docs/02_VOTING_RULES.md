# 02 — Authoritative Vote / Request Policy (V5)

**All counts are integers; all timestamps are authoritative UTC server timestamps.** The client may show progress/countdown but must not decide state transitions.

## Types and states

- `kind`: `CREATE` new story; `EDIT` replacing published story revision; `HIDE` hiding published story (extensible to other request types later).
- `status`: `pending`, `approved`, `rejected`, `expired`, `cancelled`. Public event `status`: `published`/`hidden` (plus canonical archival flags).
- Vote `choice`: `yes`, `no` (one active effective choice per UID and request, transitions yes↔no permitted until terminal).
- `yes` means approve *the requested action*, i.e. YES on HIDE means remove from public view; `no` means deny requested action.

## Interest snapshot + thresholds

`N` := server topic interested member count **when request is created**. Must be >=0 integer, stored immutable for that request revision. Client cannot supply N or threshold.

| Type | N < 50 | N >= 50 |
|---|---|---|
| New CREATE | Immediately publish; no voting request | `min(100, ceil(N/10))` yes and no to decide |
| EDIT a published event | `5` | `min(100, max(5, ceil(N/10)))` |
| HIDE a published event | `5` | `min(100, max(5, ceil(N/10)))` |

For EDIT/HIDE same function applies for all N: `min(100,max(5,ceil(N/10)))`.

Expected examples:

| N | CREATE required | EDIT required | HIDE required |
|--:|:--:|--:|--:|
| 0 | auto | 5 | 5 |
| 1 | auto | 5 | 5 |
| 49 | auto | 5 | 5 |
| 50 | 5 | 5 | 5 |
| 51 | 6 | 6 | 6 |
| 99 | 10 | 10 | 10 |
| 100 | 10 | 10 | 10 |
| 500 | 50 | 50 | 50 |
| 1000 | 100 | 100 | 100 |
| 1001 | 100 | 100 | 100 |
| 99999 | 100 | 100 | 100 |

- Snapshot does NOT change as people follow later, even if the required vote count differs from the number of currently eligible followers.
- For each **new HIDE round**, snapshot N again. The first HIDE round in a story's lifetime does not govern later rounds.
- When creator modifies a **pending** proposal (CREATE or EDIT), old effective votes reset to zero; threshold recalculated using N at edit time. New proposal revision/round and reset clock must be recorded. This is deliberately *not* the same as retroactively changing an unmodified request's threshold.
- An author cannot vote on their **own request** (includes original author who submits own EDIT/HIDE request). A different requester is allowed to vote under ordinary rules, even if they authored an earlier revision; this is a provisional detail flagged in open decisions.

## Vote transition algorithm

All in one transaction:

1. Require `request.auth.uid`, verify account interested in request topic **at vote time**, and `auth.uid !== request.submittedBy`.
2. Load request pending, current effective vote doc (`requests/{id}/votes/{uid}`), plus records required to verify topic and integrity.
3. Before accepting vote, compare trusted server timestamp to `expiresAt`. If due, expire request and reject vote atomically; scheduled sweep only handles eventual cleanup, never grants more time.
4. If old choice == new choice, do not change counts or `lastVoteChangedAt`; return idempotent current status.
5. If previously voted, decrement old side; increment new side; disallow negative counter; preserve one doc per UID.
6. Set `lastVoteChangedAt=serverNow` and recompute `expiresAt`, keep `submissionSnapshot` unchanged.
7. Check `yesCount >= requiredVotes` **before** `noCount >= requiredVotes` in the same transaction; if YES => APPROVED, else if NO => REJECTED, else pending.
8. If terminal, atomically apply action: CREATE becomes published projection; EDIT installs immutable approved revision and refreshes public projection; HIDE hides/removes public projection. Seal request and lock any further votes.
9. Emit idempotent activity/audit record. Client receives committed request version/outcome.

If concurrent transactions conflict, retry transparently, never count twice. Firestore transaction callbacks may rerun; do not perform irreversible external effects in callback. For media promotion or post-commit effects use idempotent outbox/worker with safe retries.

## Deadline calculations (do not confuse minimum lifetime with decision wait)

- `CREATE`: `expiresAt = max(submittedAt + 72 hours, lastVoteChangedAt + 24 hours)`
- `EDIT`: `expiresAt = lastVoteChangedAt + 24 hours`
- `HIDE`: `expiresAt = lastVoteChangedAt + 24 hours`
- At creation set `lastVoteChangedAt = submittedAt` even with zero votes; this is the inactivity anchor, not fake vote count.
- Timestamp changes only for a genuine effective vote change. Last vote update persists after request complete but no further vote allowed.
- CREATE can APPROVE or REJECT as soon as threshold reached, e.g. within minute 1; 72h only delays timeout.
- If no vote before `expiresAt`, request becomes `expired`, distinct from `rejected`; no automatic negative votes.
- After 72h, CREATE continues as long as votes change at least every 24h; EDIT/HIDE likewise. No upper bound on total duration.
- Exact deadline boundary: `now >= expiresAt` counts as expired unless already terminal. Server-only; scheduler may run a few minutes later but API must enforce immediately.
- If a pending proposal is materially edited: wipe all vote docs from effective live round (archive earlier vote rounds for audit), recalc N and target, and reset inactivity anchor to edit time. **For CREATE edit, resetting 72h initial grace to revised-submission time is a reversible conservative assumption, not an explicit user decision** (see 11_OPEN_DECISIONS).

## Outcomes and rejection/cancel semantics

- YES wins in theoretically simultaneous tie. For HIDE, this means **hiding wins**, since YES means approving the hide request.
- CREATE YES => publish, NO => rejected/hidden from public. CREATE auto (<50) => publish without request; record reason `interest_below_50`.
- EDIT YES => replace active revision; NO/EXPIRED/CANCELLED => published version unchanged.
- HIDE YES => hidden; NO/EXPIRED/CANCELLED => published version unchanged.
- Author may CANCEL their own pending CREATE. Do not permit normal author's unilateral cancel/hide of already published event. Permit cancellation of user's still-pending EDIT/HIDE proposal as safe extension only if matches policy, logged, and request active (see 11_OPEN_DECISIONS).
- Privileged bypass after server-role check and audit entry, including original revision and reason.

## Example state matrix

| Initial state | Action | Expected |
|---|---|---|
| CREATE, N=49 | submit | published immediately |
| CREATE, N=50 | submit | pending, required=5 |
| CREATE pending 4 yes | another yes | published at once |
| CREATE pending 4 no | another no | rejected at once |
| HIDE N=20 | submit | pending, required=5 |
| HIDE N=20, 5 yes | pass | story hidden, history retained |
| HIDE N=20, 5 no | fail | story still public |
| EDIT pending, 4 yes | proposer changes body | yes=0,no=0, current snapshot+threshold, new inactivity anchor |
| any pending | voter yes->no | yes--, no++, deadline extends only if a real change |
| any pending | voter yes->yes | unchanged counts/deadline |
| any terminal | vote/toggle | forbidden; unchanged |
| CREATE pending within 72h, idle>24h | still pending | not expired yet |
| CREATE pending after 72h + idle>24h | read/vote/sweep | expired |
| EDIT/HIDE after idle24h | read/vote/sweep | expired |
