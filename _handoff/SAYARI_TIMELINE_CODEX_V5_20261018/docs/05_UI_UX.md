# 05 — UI/UX and Navigation Spec (Thai First)

## Proposed routes (adapt to existing router; no collision)

```
/timeline                          // category/topic explorer
/timeline/:topicSlug               // selected timeline
/timeline/:topicSlug/requests      // current requests for followed member
/timeline/:topicSlug/story/:storyId // story detail/history (public current; member request actions)
/login, /register                  // or modal/page per existing app conventions
```

The old `/game/zenless-zone-zero` must stay intact. Add a Home link to Timeline. Keep existing React/MUI design language; do not global-redesign.

## Topic header, states

- Browse category/topical tabs across header (e.g. `Zenless Zone Zero`, `Genshin Impact`), extendable domain-neutral.
- Guest: header + public timeline with current approved content + open story details, no actionable request items or interest CTA required (may have discreet sign-in link outside Timeline actions if global navigation).
- Signed-in not followed: topic title/description + one explicit CTA `สนใจหัวข้อนี้` and no timeline content, voting, request toggle or submission controls. Avoid auto-follow when entering route.
- Signed-in followed: full approved timeline and actions: `เพิ่มเรื่องราว`, `คำขอทั้งหมด`, `ดูเหตุการณ์คำขอ` toggle, mode switch, zoom/navigation.
- Loading: no flickering sensitive pending request data to guest; use role/follow loading gate before queries/subscriptions. Errors/retry/empty states localized.

## Horizontal timeline visual

- First view with no approved stories = empty horizontal line, still scroll/zoom testable, `ยังไม่มีเรื่องราวที่เผยแพร่` context appropriate.
- Long line, horizontally scrollable with markers at in-universe times, playable at desktop and mobile, wheel/drag/touch input including clickable markers; avoid unwanted scroll hijacking and unintentional zoom.
- Marker point size and minimum accessible touch target 44px (hit target may exceed visible dot). Timeline scale labels may reflect named eras/years; preserve proper Thai fonts and Arabic digits where requested by browser context.
- Scale toggle `ระยะเท่ากัน` vs `ระยะตามเวลา`; hint that minimum gap is for readability. Zoom In/Out, Fit All, pan mini-guide, current cursor time if meaningful.
- Hover shows latest THREE published story titles/summaries by createdAt descending + `+N` remainder; group markers aggregate member stories; on mobile tap opens accessible popover/list. Don't render entire scrollable list inside hovering tooltip.
- Click marker selects event(s) and renders **all** matching published stories in borderless list *below add-story button*, each has title/cover/short summary and Expand to full details; avoid stacking border-heavy cards. Preserve selected location while reloading.
- Segment hover for actual computable time deltas; when unknown show `ไม่ทราบระยะห่างที่แน่นอน` instead of guessed number; use tooltip accessible on focus/tap.
- Grouping on zoom out with count and drilldown; equal-date events form common location at all zoom levels.

## Request switch and tiny badges

- `ดูเหตุการณ์คำขอ` starts OFF every fresh view; visible only followed member, not guest/not-followed.
- ON reveals pending CREATE ghost markers (`fade` opacity but enough contrast for accessibility), pending EDIT warning triangle / `!` tiny icon **top-right** of current published marker, pending HIDE tiny X **top-right**.
- If both EDIT and HIDE pending on same story, show two nonoverlapping tiny icons or grouped count; no huge labels over line. Current event remains visible until hide passes.
- Click ghost/badge opens a panel/modal with before-after comparison (EDIT), yes/no vote controls, required threshold, progress, author, expiry, rationale, sources. Show disabled vote/author message for one's own request.
- Switch OFF must remove all pending ghost/badges; no badge shown to guest irrespective of persisted state.

## Requests hub

- `คำขอทั้งหมด` UI lists currently pending requests for selected followed topic; optional filter across all followed topics if easy without leaking unrelated topics.
- Filters: `ทั้งหมด`, `ขออนุมัติ`, `ขอแก้ไข`, `ขอซ่อน`, future type; status current by default, optional history tab later.
- Request rows show type, story heading, teaser, date submitted, countdown until deadline, yes/no progress, user own vote, ability to jump to event/ballot. When deadline passed but sweeper not run yet, prevent voting and show resolving state.
- Pagination/cursor, empty state, skeleton loading, errors and retry. No public listing of request details.

## Story form and detail

- Fields for title, summary, body, time (selector modes), proper nouns + aliases, sources, media (list/preview/reorder, cover), accessible upload progress/file size errors; in Thai.
- Relative time selector searches existing approved events (not invisible pending); show relation and optional offset, preview placement without inventing exact date.
- EDIT form prefilled from current active revision, shows what changed vs previous, button `ส่งคำขอแก้ไข`; if another edit pending show conflict toast and link to existing pending request.
- Author can edit/cancel pending proposal; show warning that edits reset ALL votes and thresholds; require confirm before resubmit.
- Story details include public immutable version history, published community status, references with links, image gallery/embed, safe video and document preview; hide requests only to eligible members.
- Source attribution: community supplied; no official verified badge unless added through explicit future workflow.

## Accessibility/Responsive

- Semantic buttons/links, keyboard pan and focusable event marker, Escape closes overlays, tooltip available via focus, accessible labels for warning/X/fade; color not sole status cue.
- Avoid icon-only ambiguity: provide `aria-label` text while keeping tiny visual icon.
- Narrow screens scroll timeline while panels become sheets/drawers; pinch supported if practical; prevent horizontal page overflow outside component.
- No timestamp createdAt mixed with game time. Format Thai language and digits consistently; don't auto translate lore.
