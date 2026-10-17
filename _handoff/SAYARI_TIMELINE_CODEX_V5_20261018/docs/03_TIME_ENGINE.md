# 03 — Fictional/Universe Time Engine and Horizontal Layout

## Core principles

User explicitly wants **in-universe time**, not UTC or Gregorian dates. `submittedAt`, `createdAt`, `lastVoteChangedAt`, `deadline` are unrelated system timestamps and must never be confused with game-world time. The service cannot fabricate in-universe minutes from human calendars without a topic-specific conversion definition.

## Time model (per story/event)

Supported user inputs:

- `exact`: a year/month/day/hour/minute or named-era coordinate as defined by *that topic*; may be partially specified (year only). Precision stored explicitly.
- `approximate`: approximate coordinate with qualifier (`ประมาณปี 150`, `ราว 500 ปีก่อน...`); store estimate plus uncertainty info; do not assert exact duration.
- `range`: from-to known points, inclusive/exclusive nuance stored; represent time-spanning event as bar/interval when resolvable.
- `relative`: relation `before`, `after`, `same_time`, `during` with existing approved event/entity anchor ID; optional relative offset `{magnitude,unit}` (minute/hour/day/month/year), display semantics without numerical conversion if unavailable.
- `unknown`: unknown time, optionally manual note and partial ordering/lore era; place in unscheduled/unknown lane, not at invented coordinate.
- `era`: named era/category; eras belong to topic; e.g. era label is not assumed numeric year unless configured.

### Suggested shape (conceptual; refer to `contracts/timeline-types.ts`)

`TimeAnchor { kind, precision?, eraId?, eraLabel?, units?, values?, start?, end?, anchorEventId?, relation?, offset?, note?, sortKey?, resolved?, provenance? }`

Never use JS `Date` to represent a game-world year or minute if the system does not map to Earth epochs. Never assume months=30days and years=365days. For a universe which explicitly defines calendar conversions, store a per-topic immutable/explicit `CalendarDefinition` (units/lengths/epoch/eras), and convert to normalized ticks using safe numeric methods. If no mapping, only compare where semantically valid (same epoch/year precision or explicit dependency edges).

## Relative references and update propagation

- User can select an already-present approved event as reference from autocomplete, e.g. `A หลัง B`.
- Persist stable event ID and relation (not just text) and show source event title as link.
- Build dependency DAG and cycle-detect before saving; reject A after B + B after A, direct self reference, and deeper cycles. Avoid stale aliases or deleted ref pointers.
- When approved event B changes time in a new revision, recompute affected descendants' resolved positions deterministically, or mark `unresolved` if no longer provable. Do not quietly make up positions.
- If reference event is hidden, hide linked secret content from guest and make dependent position uncertain if needed; preserve internal original reference for editors/history.

## Time intervals and distances

- Distance tooltip appears on segments only when both coordinates are resolvable in common units/calendar with adequate precision. Format in Thai, choose human readable largest unit respecting configured calendar: `10 ปี`, `2 เดือน`, `1 วัน`, `3 ชั่วโมง`, `15 นาที`.
- For `approximate` show qualifier (e.g. `ประมาณ 10 ปี`), or label unknown if precision insufficient; never assert fake exact delta.
- For `unknown`/nonquantified relative, say `ไม่สามารถระบุระยะห่างที่แน่นอนได้` and do not show numeric value.
- Do not derive duration from pixel gaps in Equal Spacing mode or min-gap visual adjustments.
- If same in-universe timestamp contains multiple events, group under one game-time coordinate and show multiple stories in card list. Clustering visually nearby markers at low zoom is a separate, reversible UI-only grouping operation.

## 2 layout modes

**Equal Spacing**: order events topologically/chronologically, allocate roughly equal on-screen x separation for readability; tooltip still computes from data. Mark this mode clearly, not a true-scale diagram.

**Time Spacing**: where normalized coordinates exist, map proportionally to x with min visible marker gap to avoid total overlap; detect when visual gap adjustment breaks strict proportionality and show mode legend. For huge ranges (thousands years vs one minute), use zoom, clusters, bounds and virtualized viewport. Avoid integer overflow/float precision loss for unbounded year values (arbitrary precision or offset-based normalization).

**Zoom and clustering**:
- Zoom anchored under mouse/pointer if practical; drag/pan horizontally; touch pinch/tap support; keyboard accessible controls.
- Group by **visual pixel threshold in current zoom**, not by changing stored event time. Cluster displays count, optional date range, latest 3 stories and `+N`; clicking expands or zooms to reveal members.
- Markers with edit/hide badges stack icons small top-right of node in member toggle mode; if cluster includes requests, show aggregated small status counts only when requests toggle is enabled.
- Render only visible subset of data for performance; use labels/hover virtualization, no 10,000 DOM/SVG nodes on every scroll frame.

## Nonfabrication and validation

- Accept incomplete dates; validate range start<=end only when comparability can be proven.
- Avoid assigning artificial exact 1-year increments to unresolved stories.
- Distinguish in-universe time order from ingestion order and creation time in all sorts.
- Test mixed eras, partial dates, negative/BCE-like years, 0 lengths, huge spans, duplicates, unresolved relative, cycles, hidden anchor and approved revision moving time.
