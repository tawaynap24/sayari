# 04 — Backend Architecture, Firebase, Security and Integrity

## Baseline and preferred stack

The uploaded project snapshot (2026-10-17) contains React 18 / TS 5 / Vite 5 / MUI 5 / React Router 6 / Firebase Hosting, but **no initialized Auth, Firestore, Storage or Functions** at that snapshot. Codex must inspect repo now. Prefer:

- Firebase Authentication Email/Password
- Cloud Firestore for authoritative records/queries
- Cloud Functions for Firebase v2 callable HTTPS for mutations and scheduled expiry sweeper
- Cloud Storage for Firebase for staged and published media
- Firebase Hosting for SPA; Firebase Local Emulator Suite for tests
- Make optional per-topic/Firebase Region configurable with appropriate user approval; do not create cloud services/billing automatically.

## Conceptual document model (Codex can refine)

```
categories/{categoryId}
  slug, displayNameTh, displayNames, order, visibility

topics/{topicId}
  categoryId, slug, displayNameTh, displayNames, calendarDefinition,
  publishedCount, interestCount, topicStatus, createdAt

topics/{topicId}/interests/{uid}
  uid, followedAt

users/{uid}
  publicDisplayName?, createdAt, uiPrefs?  // do NOT store password

users/{uid}/followedTopics/{topicId}
  topicId, followedAt            // optional derived convenience index

stories/{storyId}
  topicId, submittedBy, status: published|hidden|pending|rejected|..., 
  activeRevisionId?, activeEditRequestId?, activeHideRequestId?,
  createdAt, updatedAt, hiddenAt?, hiddenByRequestId?, ...

stories/{storyId}/revisions/{revisionId}
  immutable content: title, body, shortSummary, timeSpec, entityRefs,
  mediaRefs, sourceRefs, coverMediaId, gameVersion?, createdBy, createdAt

publicStories/{storyId}
  topicId, activeRevisionId, denormalized approved title/body/summary/time,
  cover, source refs safe for guest, order fields, visibility="published"

requests/{requestId}
  kind: CREATE|EDIT|HIDE, topicId, storyId?, baseRevisionId?, 
  proposedRevisionId?, submittedBy, status,
  interestSnapshot, requiredVotes, yesCount, noCount,
  submittedAt, lastVoteChangedAt, expiresAt, settledAt?, decision?,
  currentVoteRoundId?, reviewReason?, requestVersion?

requests/{requestId}/voteRounds/{roundId}
  snapshot metadata, closedAt, reason?   // optionally archive old rounds

requests/{requestId}/votes/{uid}
  choice:yes|no, uid, changedAt, roundId  // effective votes only

namedEntities/{entityId}
  topicId, kind, displayNames, aliasesByLanguage, createdAt

auditLog/{auditId}
  actorUid, action, objectType, objectId, before/after refs, at, reason,
  requestId?, idempotencyKey?

media/{mediaId}
  ownerUid, storyId, revisionId/requestId, storagePath, mime, size, status,
  publishedAt?, attributedSource?, altTextTh?
```

Design can be nested by topic if better for rules/query. Use stable IDs to avoid duplicate entity identity; immutable approved revisions, mutable request status only through server functions, and public projection computed on approve/hide.

## Server mutation endpoints (illustrative names)

- `followTopic(topicId)` — signed-in; idempotent, atomic creation + count bump once; cannot auto-follow on view.
- `createStory(topicId,payload,mediaIds)` — followed/authenticated; validate content/time/refs; snapshot interest; auto publish <50 or pending request; write audit.
- `updatePendingRequest(requestId,payload)` — creator of pending CREATE or EDIT; archive vote round, reset votes and snapshot, recalc threshold and timer; never edit approved revision in place.
- `cancelPendingRequest(requestId)` — owner of allowed still-pending proposal, lock/time checks, audit.
- `proposeEdit(storyId,newRevisionPayload)` — followed/auth; one active edit request per story using story-level lock and transaction; baseRevisionId pinned to currently active revision.
- `proposeHide(storyId,reason)` — followed/auth; one live hide request per story as conservative default; snapshot interest each new round.
- `castVote(requestId,choice)` — followed/auth, not own request, deadline checked on server; transaction + outcome and projection.
- `getMyVotes`, `listRequests` if read rules require server-proxy (or appropriately scoped Firestore queries).
- `privilegedPublish`/`privilegedHide` — custom claim permission, immutable audit and reason; idempotent.
- `expireDueRequests` — Cloud Scheduler batch sweeper, status writes idempotent, no direct Firestore TTL document deletion.
- `finalizeUpload` or equivalent staged-media validation/attachment; prevent other user's staged-path takeover.

Callable APIs should use Firebase Auth ID token, `auth.uid` from verified server request, not client-typed uid. Apply App Check where configured without blocking emulator/testing. All server mutations validate membership, roles, max lengths, approved refs, time graph and ownership.

## Security rules (production principles)

- Public read only `publicStories` documents with currently approved content + public topic metadata; never leak pending/rejected/hidden, votes/audit, user emails, storage draft URLs in public projection.
- Direct writes to `stories`, `requests`, `votes`, `topics.interestCount`, `revisions`, `publicStories`, `auditLog`, `roles` denied to client. Backend Admin SDK handles authorized mutations. Rules still tested for malicious direct client bypass.
- User profile read own/limited public fields; role privileges assigned server-side custom claims/administrative setup, never via user-editable role document.
- Signed-in but not followed topic cannot see topic content in UI (the public projection must, by user requirement, be available to unauthenticated viewers too). **Guest-public data cannot be made confidential from a logged-in nonfollower at API level**; enforce that nuance in UX, don't claim security against deliberate logout/REST requests.
- Storage `staging/{uid}/{requestId}/{mediaId}` write allowed for that uid only with MIME/size/path checks, no overwriting other files; read limited to owner/authorized reviewers while pending. `published/{topicId}/{storyId}/{revisionId}/{mediaId}` safe to read only while associated story is public, or through authenticated server proxy as needed.
- Think about Firebase download token URLs: after a hide, previously distributed download links or browser cache may survive even if database projection is hidden. Rotate/remove public tokens or serve via controlled paths if stronger hiding needed; never promise perfect revocation of already downloaded bytes.
- Storage Rules may consult **default Firestore** docs for published-state access; costs/limits apply. Restrict direct HTML/SVG uploads and unsafe MIME types. Validate file magic on server where feasible, sanitize rich text/rendered docx.
- The admin/server SDK bypasses Firestore Security Rules: strong input validation and least-privilege IAM are mandatory; Security Rules alone do not secure cloud functions.

## Atomicity, duplicate/race protections

- Use Firestore transactions for follow count once, request submit/snapshot, casting/changing vote/outcome, cancelling, edit locks and revision switch/public projection.
- `requests/{id}/votes/{uid}` unique doc enforces one vote; idempotency request IDs handle duplicated button submit/network retries; no client-side counters.
- For submit EDIT, transaction reads `stories/{id}.activeEditRequestId`; if a pending request still active, reject later submit with localized conflict notification. Keep one edit lock even if two clients act at same millisecond.
- Concurrent hide versus edit approval must be serialized and defined (suggest hide closes edit if hide approved, see open decisions).
- On expired request, release edit/hide lock so another request can be submitted. Never delete audit history.
- Scheduled sweeper runs frequently (e.g. every 5 min) to close overdue requests for UX; **on-vote/on-submit** checks enforce deadlines immediately. Don't rely on client timer or Firestore TTL for business decision.
- Use cursor pagination/Firestore composite indexes, no unbounded collection reads. Avoid exposing hidden story contents in request badges or logs.

## Emulator and migration

- Supply firebase.json emulator settings for Auth/Firestore/Functions/Storage/Hosting without disrupting existing Hosting config. Add `firestore.rules`, `storage.rules`, `firestore.indexes.json` with carefully scoped access.
- Implement local seed of category/topic metadata **only for Emulator**. Protect any production seed with explicit human-run command and dry-run preview; don't auto insert game events.
- Document Firebase console one-time steps: enable Email/Password, Firestore, Storage (requires plan review), Functions/billing as needed, choose region, required IAM & scheduler. Never do cloud deploy or billing upgrade unattended.
