# 11 — Ambiguities and Reversible Defaults (not user-confirmed)

The user has confirmed nearly all important policy rules, but some edge semantics remain unspecified. **Do not silently describe these proposals as user decisions.** To keep implementation moving, choose safe reversible defaults below and put them in final report; if a blocker fundamentally changes the confirmed experience, ask the user only then.

| Topic | Ambiguity | Proposed implementation default |
|---|---|---|
| Fresh-create pending edit clock | When author edits an unapproved CREATE, does 72h minimum restart? | Treat edited proposal as new submission for inactivity/grace (`submittedAt` of current vote round := edit timestamp, min72h restarts). Log this assumption; easy to change with policy config. |
| Pending EDIT edit clock | When proposer edits pending EDIT request, does 24h idle restart? | Yes; all votes reset and new 24h starts from edit timestamp. |
| Follow removal | Can member unfollow after following? | Do not expose unfollow in MVP, since counting/old votes/removal semantics weren't specified. Schema can support it later. |
| Eligible voter timing | Can someone follow after proposal submission and vote? | Yes, once followed; target stays at submission snapshot. |
| Vote by original author on someone else's EDIT/HIDE | Is original author forbidden even if not current requester? | User says "cannot vote own request"; forbid only current `submittedBy`. Document this interpretation. |
| Concurrent HIDE requests | More than one hide proposal for same published story? | One active HIDE request per story (deduplicate/lock), allow one HIDE + one EDIT to coexist. |
| HIDE approval vs pending EDIT | Can EDIT approval resurrect hidden content? | Never; hide takes priority, cancel pending EDIT atomically. |
| EDIT approved while HIDE pending | Does HIDE follow old/new revision? | HIDE remains attached to same story ID and can hide new current revision; show exact current revision to voters. Audit change. |
| Pending author cancellation | Can EDIT/HIDE proposer cancel pending request? | Permit their own pending proposal cancellation with audit; user expressly confirmed CREATE cancellation, others are a provisional convenience. |
| Time system not numeric | Calendar unknown; how position events? | Use explicit relative order/era lanes with uncertainty, no fake numeric gap; when unresolved show separate lane. |
| Multiple requests at identical marker | How represent many icons? | Small top-right clustered/stacked badges with accessible popover, avoid overlap; toggle OFF hides all. |
| Requests hub scope | Current topic vs sitewide? | Current followed topic by default. Other followed topics accessible by topic switch; no leak of unrelated pending. |
| Published version history guest | Can public guest see past published revisions? | Yes for stories still published if safe/no private fields, since history is core to site; hide removes public access to all its revisions. |
| Month/year conversion | How many days/month in game? | Per-topic explicit calendar definition only; otherwise symbolic comparison and uncomputable tooltip. |
| Edited proposal reset old votes | Retain vote history? | Archive old rounds with privacy, ensure no stale effective votes are counted. |
| Max 5MB | Decimal MB vs binary MiB? | Enforce <=5,000,000 bytes to match strict "5 MB"; label as 5 MB. |
| Moderation/takedown | Soft delete everything? | Ordinary workflow soft-hide; privileged lawful takedown can hard-restrict/remove risky personal/copyright content. |

No conjectured game lore, timestamps or API data should be seeded into public DB. Example event A/B/C in tests is artificial test data and must never appear as canon.
