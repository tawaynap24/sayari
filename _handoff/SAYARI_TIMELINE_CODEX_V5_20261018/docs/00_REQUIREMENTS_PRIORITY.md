# 00 — Authority / Scope / Constraints

## Confirmed user decisions (keep, don't reinterpret)

1. Platform-wide horizontal timeline, multiple categories/topics; initial examples ZZZ and Genshin; Thai-first; public content comes entirely from community, **no automatic official content ingestion**.
2. Guest not logged in sees **only published/approved** story/time content with no dialog, interest count, creation/vote/request actions, request visibility switch or request icons. For signed-in users, explicit interested/follow action required before seeing topic timeline content or actions.
3. Email/password auth via Firebase preferred, without mandatory email verification in first release; interest tied to account. Privileged accounts may bypass publish/hide vote according to trusted server roles.
4. Stories have title, description, game-world time (minute/hour/day/month/year + named era + relative/range/approx/unknown), multilingual proper nouns, refs, multiple images/videos, optional inline PDF/Word viewer; **file cap 5MB per uploaded file**.
5. Timeline first appears empty horizontal line; events appear as time markers. Hover latest THREE stories by time added and `+N` remaining. Click opens all stories beneath add button in borderless list, details expandable. Two spacing modes, smooth pan/zoom, clustering based on zoom.
6. New story under **50 interested members** auto publishes; starting at 50 needs positive vote threshold `ceil(10%)` capped at 100; negative threshold same. Author cannot vote for own request; approval side wins only if simultaneous tie at adjudication.
7. Changes to pending story proposal by its author permitted, votes reset to zero and required threshold recomputed with **current** follower count. Author may cancel own pending proposal. Published stories cannot be directly edited/deleted by submitter.
8. Edit a published story via a separate revision proposal populated from current story. Edit proposals always need min 5 approvals, max 100; no more than one active edit proposal per published story. On passing, replace active version and retain old visible version history. Warning overlay on existing timeline marker while pending.
9. Hide a published story via proposal yes/no; threshold min 5, max 100. Each new hide round snapshots **current** follower count. Once passed, hide from public responses, retain history for backoffice/authorized actors. X overlay on marker while pending.
10. New CREATE request cannot **expire** before 72h, but can close by approval/rejection immediately upon threshold; after 72h, inactivity24h since latest real vote change governs expiry. EDIT/HIDE request idle24h from initial submitted/last real vote change, with no 72h minimum. Unlimited total duration while votes actually change before expiry.
11. Voters may switch agree/disagree while request active; reselecting existing choice doesn't extend expiry. One active effective vote per UID/request, with accurate counter deltas.
12. `ดูเหตุการณ์คำขอ` toggle is **OFF** on initial view; visible to interested signed-in members, never guest. ON: faded pending CREATE marker; EDIT tiny top-right warning badge; HIDE tiny top-right X badge. Each opens request for voting. Requests hub/tab lists current requests with type filters.
13. Backend and storage: use Firebase if feasible; every authoritative vote/state rule enforced server-side, not only UI. Preserve existing source/worktree. No automated commit/push/deploy.

## Non-goals (do not implement instead of core)

- Content scraped automatically from Nanoka, game scripts, official wiki, or paid APIs; user will enter stories manually.
- AI-generated fan theories as if canon (theory/prediction is future separate feature).
- Hard-coded calendar as Earth/Gregorian for every game universe; fabricated exact dates for undated events.
- Building only a UI mock with client-side scores/localStorage-only story DB.
- Comprehensive role admin dashboard/auto-translation/automated video transcoding beyond this V5 scope.

## Implementation decisions the user has NOT locked

See `docs/11_OPEN_DECISIONS.md`. Make small, reversible defaults to complete the system and document each explicitly. **Do not silently turn an assumption into a user-confirmed requirement.**

## Safety for repository

- Work within `D:\sayari-project` only; respect dirty working tree.
- Do not run `git reset --hard`, `git clean`, broad destructive find/delete, production deployments, billing upgrades, or schema resets.
- Do not replace ZZZ damage calculator / Nanoka integrations with Timeline. Add modular routes/features.
- Do not publish example lore as factual; seed only topic metadata (no official content).
