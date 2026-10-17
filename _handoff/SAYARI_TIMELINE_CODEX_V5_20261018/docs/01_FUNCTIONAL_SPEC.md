# 01 — User Journeys & Functional Specification

## A. Platform navigation

- Dedicated Timeline entry in Home/navigation, not replacement for `/game/zenless-zone-zero` calculator.
- Domain-neutral category registry (`Games` initially; later anime/film/history/etc). Topics belong to categories (`Zenless Zone Zero`, `Genshin Impact` as examples). Category and topic routes are shareable and work after refresh on Firebase Hosting.
- New topic has an empty horizontal line rather than filler story content. Admin/system-managed seed topics initially; topic creation UX reserved for later unless project already supports it.
- Top topic switcher and breadcrumbs; show category/topic name and brief metadata to both guests and members who have not followed.

## B. Access journeys

1. Guest visits topic directly: immediately sees only approved stories/events and their media/source references; no modal, no follow count, no voting/request toggle/icons/action controls, no request data queries.
2. Member signs in with email/password, no verification gate. If topic not followed, show topic name + CTA `สนใจหัวข้อนี้` and nothing from its timeline story content. Do not implicitly follow just by opening the topic. Following an item server records unique interest for UID/topic. After follow, see all public content and member actions.
3. Followed member can add, propose edit/hide, vote on others' requests, see Requests hub and turn pending overlays on. Their own request displays voting count/status but disable voting with explanation.
4. Privileged member may publish/hide directly via server-authorized path, with audit reason and immutable recorded version; never trust role set in browser or simple profile field. Explain that privileged actions bypass vote only under explicit granted permissions.

## C. New story form (Thai)

- Title required, rich narrative/body (plain text/limited markdown safe), optional short summary/cover, one or more references, one or more proper-noun entity references or creation of new alias, image upload/URL/embed, video URL/embed, document upload/viewer where feasible.
- Time editor supports exact / approximate / range / relative anchor / unknown. Game timeline time, distinct from database createdAt/updatedAt.
- Preview before send with visual references and media; clear validation errors.
- Submit takes interestCount snapshot in server transaction and derives threshold. <50 auto published. >=50 creates pending request, not public event until approved; show in Requests hub and faded marker when toggle on.
- Author may edit pending proposal (new version), resetting votes, threshold and idle start. Author may cancel while pending. Once accepted or rejected/expired/cancelled cannot mutate same proposal.
- Images/files up to 5,000,000 bytes per file; attachments must be approved/owned, never accept arbitrary stored file path to impersonate media.

## D. Timeline display

- Horizontal infinite-feeling interactive viewport; pan mouse drag/trackpad/scroll horizontally and touch; Zoom In/Out buttons, mouse-wheel zoom modifier or supported UX, pinch to zoom mobile; reset/fit-to-events action.
- Two presentation modes equal/event spacing and proportional-to-time spacing with minimum visual gap. Clearly label mode. Time gap tooltip from actual time data only, never deduce from pixel distance.
- Collisions/grouping at high zoom-out; individual markers recover as zoom in, group count indicates merged events. Co-temporal stories/events remain same game-time coordinate and grouped, not artificially separate game dates.
- Hover single marker shows 3 latest **submitted/added** (not latest game dates) published stories and `+N` for rest. On touch/keyboard use tap/focus equivalent; do not rely solely on hover.
- Selecting marker loads all currently published stories for that marker/time below the add button, borderless list/card style with cover/title/teaser and expand to full content, references and media.
- Relative/inexact/unknown time entries cannot occupy a fabricated exact position; use graph order or separate unscheduled lane until anchored; annotate uncertainty, reject cyclic dependencies.
- Exact content no `official` status; all accepted means community accepted, references optional but encouraged. Future theory feature not introduced now.

## E. Requests overlay and hub

- Switch `ดูเหตุการณ์คำขอ` defaults OFF every initial page visit; guests never see. OFF: no pending CREATE markers or EDIT/HIDE request icons or click-to-vote affordances. ON: faded ghost for pending create; tiny warning at TOP RIGHT of related marker for edit; tiny X TOP RIGHT for hide; if multiple statuses exist, no overlap—badges stack/collapse.
- Active requests only; expired/rejected/cancelled aren't displayed on timeline overlay. For edit/hide original public event marker stays.
- Clicking request badge/ghost opens request detail, current narrative or diff old/new, author, yes/no count, target, deadline and vote controls when eligible. Prevent self-vote.
- Separate hub of **current active** requests with type filter ALL / CREATE / EDIT / HIDE / future; pagination/search topic if supported; statuses, remaining threshold and expiry shown. Nonfollowed topics omitted for member; no guest hub.

## F. Edit published story

- Followed member selects `ขอแก้ไข` on published story. Prefill ALL fields of current active revision; proposer must change at least a substantive field; show old vs new diff or comparison.
- Enforce one active edit request per story globally with transaction/lock. Second concurrent submission receives clear Thai message, e.g. `เรื่องนี้มีคำขอแก้ไขที่กำลังพิจารณาอยู่แล้ว`.
- Threshold always `max(5,ceil(10%))`, cap100, snapshot at submission. Idle expiry24h; author's edits to pending proposal reset votes, threshold and idle start.
- On YES threshold: new immutable revision becomes `activeRevisionId`, update public projection including time coordinate; old revisions kept and accessible to authorized/public users for history while story is published. On NO or expiry original unchanged.
- If event time changes, marker can move, linked relative references must be re-evaluated; do not manufacture invalid ordering.

## G. Hide published story

- `ขอซ่อน` initiated by followed member; require reason. Snapshot current topic interestCount FOR EACH new round. Threshold `max(5,ceil(10%))` cap100; YES = hide event, NO = retain event.
- Terminal request can be recreated immediately, each new round fresh snapshot, zero votes and idle clock.
- Pending hide X badge. Approved hide removes current story from public queries/timeline and possibly empty marker; retain canonical record/revisions/votes and audit in server-only archive; do not reveal hidden details to guests.
- Prevent incompatible outcomes where concurrent hide and pending edit accidentally republish hidden story; serialized transactions + explicit policy in `docs/11_OPEN_DECISIONS.md`.

## H. Proper nouns, media, sources, histories

- Named entities (person/place/faction/organization/other) have stable ID, Thai displayName, optional aliases per locale (`en`, etc), reusable by multiple stories; allow free-form new terms cautiously, never merge solely by similar spelling.
- Multiple images/videos per revision; choose cover image; URL validation; no direct HTML injection. PDF/DOCX inline viewing, safe fallback if format unavailable; no auto-download click behavior.
- Source references may be external URL, in-game chapter/quest/item dialogue, note, version; represent reference links and citations neutrally as community-provided references; no claim fact-checked official.
- Version history for published story shows immutable prior snapshots, version number, date, proposer, decision, historical media metadata. Pending request history readable to authorized members, not guests.
