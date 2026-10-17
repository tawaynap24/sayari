# 14 — Suggested Architecture Diagrams

## Data and public projection

```mermaid
flowchart TD
  U[Guest / Member Browser] --> F[React + MUI Timeline]
  F -->|Auth| A[Firebase Authentication]
  F -->|Public read| P[(Firestore publicStories projection)]
  F -->|Authorized requests| R[Callable Cloud Functions]
  R -->|Trusted transactions| C[(Firestore canonical Stories / Requests / Votes / Interests)]
  R -->|Publish or hide| P
  F -->|Staged upload| S[Cloud Storage]
  R -->|Validate/publish media refs| S
  SC[Scheduled expiry worker] -->|Set terminal on due requests| C
```

## Story request transitions

```mermaid
flowchart TD
  Start[Followed member submits story] --> Q{Interested count < 50?}
  Q -->|Yes| Pub[Publish new revision immediately]
  Q -->|No| Pen[Pending CREATE request]
  Pen --> Y{Threshold reached?}
  Y -->|YES| Pub
  Y -->|NO| Rej[Reject and archive]
  Y -->|Neither + deadline passed| Ex[Expire and archive]
  Pen -->|Author updates proposal| Reset[Reset votes, new N/threshold/clock]
  Reset --> Pen
  Pen -->|Author cancels| Cancel[Cancelled]
  Pub --> Edit[Separate EDIT proposal to replace revision]
  Pub --> Hide[Separate HIDE proposal to soft-hide]
```

Mermaid is conceptual; backend Firestore transaction and rules are still required. A frontend-drawn graph does not implement server security or exactness.
