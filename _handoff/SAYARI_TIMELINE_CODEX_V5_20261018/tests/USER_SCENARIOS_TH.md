# Detailed manually executable scenarios (Codex: automate where practical)

## Scenario A — Guest vs signed-in not followed

1. Visit `/timeline/zenless-zone-zero` logged out. Expected: if test pub events exist, read them. No dialog, request icons/switch, follow tally or add/edit/hide/vote buttons.
2. Register member A with email/password emulator; visit same topic without clicking follow. Expected: topic heading/CTA only, no story content. Refresh: still not followed; cannot vote via backend API.
3. Click `สนใจหัวข้อนี้` once. Timeline appears. Click again/race two tabs: interestCount increment only once.
4. Sign out: guest view resumes, approved content readable; pending requests unavailable.

## Scenario B — Threshold boundary + editing pending

1. Seed topic with exactly 49 unique interested users. A followed member sends story new with invented event `ทดสอบ A`. Expected auto published, no pending vote request.
2. Add 50th interest. B sends new story `ทดสอบ B`, expected pending target5/5; default overlay OFF so public line unchanged; logged interested ON sees faint ghost.
3. Other four voters YES. Before fifth, B modifies title. Expected YES=0 NO=0, threshold N recomputed if interests grew; new vote round, previous 4 votes invalid; reviewer sees updated content.
4. Five other users vote YES on latest round. Expected immediate publication even though <72h. Guest can now see it.

## Scenario C — Vote switch, timeout and cap

1. With N=500, HIDE target50. One voter YES, then NO. Expect yes0/no1 and `lastVoteChangedAt` update. Repeat NO → no change and no clock extension.
2. N=1001 create/edit/hide target100 (no 101). N=100000 also 100.
3. CREATE pending no votes within first 24h remains pending; after 72h expires (unless vote after48h extends deadline longer).
4. EDIT no votes expires after24h; change YES->NO at23h extends next deadline by24h. At exact `expiresAt`, vote rejected even if sweep not yet run.

## Scenario D — Edit lock and revision history

1. Published A revision1. Two members propose EDIT at once. Exactly one pending; other receives Thai conflict message.
2. Pending EDIT approved with 5 votes for topic N<50 (assuming enough other interested users later). Old timeline marker updates, revision1 still readable in history.
3. Verify no direct client update to approved content succeeds.
4. Concurrent pending hide with edit: if hide approved first, pending edit must not re-publish hidden story.

## Scenario E — Time and visualization

1. Add events same in-universe year: group at same coordinate, multiple story rows.
2. Add event `C เกิดหลัง B` via reference selection. If B year changes via approved revision, C recalculates position or marks unresolved.
3. Attempt A after B while B after A: reject cycle.
4. Zoom out: nearby markers cluster; zoom in uncluster. Hover/focus displays latest 3 stories + remainder count.
5. Switch equal to proportional mode; segment tooltip accurately shows known 10-year difference, unknown case does not invent number.
6. Touchscreen tap and mobile scrolling can open and dismiss details.

## Scenario F — Media and privacy

1. Upload 5,000,000 bytes image allowed if file otherwise valid; 5,000,001 bytes rejected.
2. Upload PDF and DOCX, open in-page without auto download (DOCX fallback may be marked unsupported only if safe render unavailable).
3. Try malicious SVG, `javascript:` URL, HTML masquerading as image, and attach other user's staged file; all rejected.
4. Hide story, reload guest. No hidden title/summary/media present in public queries or public screen; verify archival remains for authorized audit.

## Scenario G — Existing app regression

1. Home and `/game/zenless-zone-zero` still navigate correctly after change.
2. Compare calculator baseline input-output before/after; any unrelated formula drift is FAIL.
3. Check existing Nanoka-related routes/files unchanged aside from explicit additive integration.
