# Timeline V5 implementation architecture

Domain code: `functions/src/domain` is pure TypeScript, consumed by Functions and the lazily loaded React Timeline. It contains policy, Zod input validation and BigInt universe-time resolution; it never converts lore years through JavaScript Date. System timestamps are server-clock UTC integer milliseconds.

## Collections

| Path | Content / visibility |
|---|---|
| categories, topics | Public metadata and calendar; topics contain publishedCount, never interestCount |
| topicStats/{topic} | Member-only interestCount and transaction graphVersion |
| topics/{topic}/interests/{uid} | Unique explicit membership; own get only |
| users/{uid}/followedTopics | Own follow index |
| users/{uid}/operations/{operationId} | Server-only payload digest and response receipt for idempotent mutations |
| stories/{story} | Canonical status, submitter, active approved revision, EDIT/HIDE locks; member reads |
| stories/{story}/revisions/{vN} | Immutable approved revisions |
| publicStories/{story} | Sanitized current approved revision; no email/voter identities/pending narrative |
| publicStories/{story}/history/{vN} | Approved history; reads depend on existence of current public parent |
| requests/{id} | Current proposal/round, frozen interest snapshot, threshold, scores, deadline and terminal status |
| requests/{id}/voteRounds/{round} | Immutable closed round snapshots; private to members |
| requests/{id}/voteRounds/{round}/votes/{uid} | One effective choice per UID per round; only own read |
| namedEntities | Stable topic-scoped multilingual names and aliases |
| media/{id}, stories/{story}/media/{id} | Private validated object descriptor; approved association gate |
| auditLog, abuseReports | Private operator audit and member report workflow |
| writeLimits, uploadLimits, maintenance | Server-only abuse counters and cleanup cursor |

All client-authoritative writes are denied by Firestore Rules. Admin SDK bypasses Rules, so every exposed mutation separately validates auth, membership, ownership, input schema and claims. Production rules are restrictive for all unknown collections; review existing production collection uses before manually applying them (none were present in local source).

## APIs

`timelineApi` is a v2 callable dispatcher. Envelope: `{action, operationId, data}`. Auth UID and moderator claim come only from the verified callable context.

- `followTopic {topicId}`: atomic UID membership and exactly-once count increment.
- `createStory {topicId, content}`: server N snapshot; under50 auto-publish; otherwise CREATE request.
- `proposeEdit {topicId, storyId, baseRevisionId, content}` and `proposeHide {topicId, storyId, baseRevisionId, reason}`: one lock of each kind; stale/missing lock recovery.
- `castVote {requestId, roundId, choice}`: own-request ban, current membership, exact deadline enforcement, real-switch deltas, same-choice no idle extension, immediate YES-first settlement.
- `updatePendingRequest {requestId, roundId, content}`: substantive change, archive old round, zero scores/current N/new clock; rejects stale round.
- `cancelPendingRequest {requestId, roundId}`: own pending only, release lock.
- `saveEntity {topicId, kind, names, aliases}`: validated metadata.
- `prepareUpload {topicId, draftId, name, mimeType, sizeBytes}` and `finalizeUpload {mediaId}`: private immutable staging, validated bytes, deterministic content-addressed copy.
- `privilegedPublish {storyId, reason}`, `privilegedHide {storyId, reason}`: trusted `timelineModerator` claim + explicit reason + audit.
- `reportStory {topicId, storyId, reason}`: member report, operator-only read.

`timelineMedia?id=...` is a controlled GET endpoint; optional Firebase bearer token for private/member access. It checks current public parent and approved association on every read, serves no-store bytes without download-token URLs, or escaped-as-text DOCX JSON. Raw storage objects deny client reads. External user-owned image/video URLs are not revocable by Sayari.

`expireTimelineRequests` is scheduled every5min; `cleanTimelineMedia` every24h. Local runner uses a 5min timer to run the same domain worker against demo emulators; cloud delivery is a separate manual activation.

## Atomic invariants

Transactions read all required documents before writing. No Storage calls occur inside transaction callbacks. Story/follow/entity mutations have a digest-bound receipt, immutable audit entry and server rate limit. Upload preparation has a separate quota; finalization is idempotent through its immutable media descriptor and deterministic validated path. Closed-transaction transport failures can safely restart a whole transaction; business errors are not retried. Backend clock is sampled again after reading vote state so retry waits do not authorize stale votes.

Approved revision installation, public projection, scores/status and locks commit together. HIDE cancels a pending EDIT and deletes the public parent; stale EDIT cannot resurrect it. EDIT approval leaves a concurrent HIDE attached to the story ID. Approved old revisions are never overwritten. Public history objects may remain physically stored after HIDE but are unreadable because their public parent no longer exists.

Relative anchors are validated along their current published chain in the transaction (self, cross-topic and cycles rejected; depth cap200). Publication also validates again. Topic graphVersion serializes competing publication graph changes. Frontend recomputes positions from currently loaded approved revisions; missing/hidden anchors remain unresolved without leaking the old title.

## Query/index and time semantics

Public pages: topicId + addedAt ASC + document ID cursor, limit60. Request pages: topicId + pending + restricted=false + optional kind + submittedAt DESC + document ID cursor, limit60. Each loaded page has its own subscription and IDs are deduplicated. Adjacent cursors are recalculated when insertions/settlements move a page boundary. Hide removes a visible row through the live query. Refresh reloads from the first page; metadata lists are capped at200.

`firestore.indexes.json` includes the matching composite definitions, sweep query and cleanup query. Emulator does not enforce every production composite-index requirement; production index creation remains manual.

Time grouping joins exact coordinates, while display clustering depends only on pixel distance at current zoom. Relative order is topological when duration cannot be proven. BigInt differences are normalized before pixel conversion; duration labels never derive from pixels. Minimum120px layout gaps are disclosed; visible node hit targets44px. The view supports wheel/pointer, pinch, keyboard, fit, unknown lane and range bars. Metadata/calendar configuration is independent of Nanoka or any game-specific schema.

## Isolation

No calculator formula, Nanoka/localization source/data or `.firebaserc` change. Routing adds `/timeline/*` to the existing Home registry entry. Timeline and its Firebase client load lazily; the PDF viewer and its worker are separate lazy assets. Automatic Vite chunking is retained after a production-only initialization cycle was found with manual Firebase chunk splitting. The original handoff is unmodified and excluded from ESLint because it is a specification/reference package rather than application source.
