# 08 — Authentication, Interest Membership, Roles and Privacy

## Access matrix (normative UX)

| Feature | Guest | Signed in, NOT interested | Signed in, interested | Privileged interested |
|---|---|---|---|---|
| Topic names/category metadata | yes | yes | yes | yes |
| Approved published story/timeline in UI | yes | **no**, CTA to follow | yes | yes |
| Request toggle and pending markers | no | no | yes | yes |
| Requests hub / vote | no | no | yes except own request | yes except own ordinary request |
| Submit story, propose edit/hide | no | no | yes | yes |
| Bypass publish/hide threshold | no | no | no | permitted only with explicit server claim and audit |

**Important architecture limitation:** public approved content is publicly retrievable for guests by definition; a signed-in non-follower can theoretically log out or request the public API. Their no-view behavior is a **UI/flow restriction, not strong secrecy**. Do not claim Firestore Rules can make public content simultaneously inaccessible to deliberately unauthenticated queries from same person.

## Email/password

- Use Firebase Auth email/password provider; require proper format and password policy as supported; enable in Console manually as necessary.
- No mandatory email verification at launch per user. This means fake-address signup/large-scale account farming remain possible; monitor abuse, restrict automated submissions, App Check/CAPTCHA as feasible, rate-limit server functions, and have abuse reporting. Do not promise one account=one human.
- Do not store plain password, recovery secrets, private auth tokens or service account keys in the project source/Firestore.
- Implement login/register/logout UI, auth restoration state and readable errors in Thai.

## Interested / follow action

- Must be explicit button; simply visiting topic never increments count.
- `interests/{uid}` ID unique inside topic; server transaction sets membership and increments count once; requests snapshot count at submission. Multiple browsers/devices same account cannot duplicate.
- A fresh member may follow after a request starts and then vote on that still pending request; threshold already snapshotted and never silently changes. Note this is the expected design choice from prior proposal.
- No unsubscribe requirement was explicitly decided; do not add complex unfollow count/revote behavior without writing down a choice in `11_OPEN_DECISIONS.md`.
- Author cannot vote their own submitted request even though their topic interest contributes to the total interestCount (per-user rule).

## Privileged roles

- Design claim names e.g. `timeline.moderator` or `timeline.publisher` and permission checks in backend, adjustable to user account types.
- Grant only via private admin/CLI operation with explicit user permission; never allow users to edit `role: admin` in Firestore to gain rights.
- Bypass actions audited with `{actorUid, action, storyId, reason, previousStatus, timestamp}`. Public side can optionally show neutral `เผยแพร่โดยผู้ดูแล` meta, do not misrepresent as community vote.
- Privileged override not equal to arbitrarily altering past immutable revision or silently deleting audit records.

## Personal data and abuse

- Public story shows author handle or anonymized name if available; no private email address, IP, fingerprint, password or vote identities.
- Do not use device fingerprinting for interest counts (user replaced browser anonymous interest with account-based interest).
- Rate limiting/bot mitigation on registration/writes, report workflow/soft moderation, basic terms/privacy text if publishing site publicly.
- Allow lawful deletion of PII/infringing materials even though ordinary story removals are soft hidden.
