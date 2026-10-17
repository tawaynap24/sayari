# 09 — Content Lifecycle, Revision History, Request Locks

## Story vs event point distinction

`TimelineEvent` is the in-universe occurrence/position (potentially shared by several stories), while `Story` is an authored narrative attached to an event/time specification. The frontend can group same-time stories under one marker and can separately cluster near markers at zoom-out. A story's public projection always points to its currently approved immutable revision.

## CREATE lifecycle

`draft local form` → server `createStory` → if N<50: `published` immediately with revision#1 and reason `auto_below_50`; otherwise new CREATE request with `pending` status and frozen proposed revision.

While pending: author may change request content (resets all votes/threshold with current N and time anchor), cancel request (nonpublic historical audit); other users interested may yes/no vote. YES: publish. NO: rejected. Idle timeout: expired. Rejected/expired/cancelled private history; no public projection. Users may submit another new story later, subject to abuse rules.

## Published revision and EDIT lifecycle

A published story's active approved revision is immutable. Do not expose direct UPDATE on approved record. Any interested member may propose EDIT; form prefilled with **all** current approved content and verified media references. Server compares base revision ID at submit, acquires single edit lock on parent story, creates revision proposal + EDIT request.

While pending: old published revision remains visible and immutable. Toggle ON shows tiny warning top-right. Proposer may edit the proposal (reset votes/snapshot/clock) while pending; no competing edit pending accepted for same story. YES: install proposed revision as new immutable approved revision, history retains previous and dates, update public index and sort position; release edit lock. NO/expired/cancelled: discard live proposal from public state, release lock. If base revision changed before approval, must abort/rebase explicitly, not blindly overwrite newer revision.

## HIDE lifecycle

An interested member proposes HIDE on current published story with reason. Store `interestSnapshot` when **that round** starts. While pending story continues public; X badge top-right only when toggle ON. YES: set story `hidden`, remove public projection/marker if empty, retain canonical/revisions/audit; NO/expired: leave published. A subsequent HIDE round (after no/expired) must use fresh N and zero votes. Privileged actor may hide immediately with audit.

## Interactions between EDIT and HIDE

- A pending EDIT and HIDE may refer to the same story. Safe default: allow one active of each kind but not two EDITs simultaneously. If HIDE passes, invalidate/cancel pending EDIT atomically, clear locks, prevent approve-edit from making a hidden story public again. If EDIT passes first, HIDE remains attached to same story and still able to hide the new current version (unless requirement review dictates otherwise). Always record base/current revision IDs and audit.
- If HIDE passes and media files still have published URLs, revoke public read tokens/access where technically feasible and suppress all public projections; keep audit/private data for lawful handling.
- A HIDE event's story cannot be approved again via previously pending EDIT or stale retry request.

## Request cancellation / expiration / votes revisioning

- User confirmed author can cancel own pending CREATE proposal. User did not explicitly confirm EDIT/HIDE proposer cancellation: provisional safe default permit cancellation of own still-pending request, with audit; never cancel another user's request.
- For pending proposal edits, old vote documents/rounds archived and **not** counted. No ghost votes after reset; use `currentVoteRoundId` to reject stale vote posts.
- Closing terminal request releases associated lock; scheduled expiry worker + on-demand transition both idempotent.
- `rejected` for negative threshold, `expired` for idle timeout, `cancelled` for submitter withdrawn. No permanent deletes under normal workflow; privacy/legal takedown exception.

## Version display

`ประวัติการแก้ไข` shows version numbers and timestamps for **approved** previous versions; opening version displays archival read-only content and provenance. Guest can view historical approved version while story still public if it doesn't leak pending/hidden docs (use sanitized public history projection); hidden story history only authorized private audience. Distinguish original author from editors and decision/approval request.
