# 13 — Thai-first Copy, Localization and Accessibility

- Thai is primary language for labels, forms, validation, tooltips, aria-labels, request errors and confirmation dialogs.
- Do not assume Nanoka/ZenlessData translations are needed here: Timeline storytelling is manually authored by the community. Existing game data translation project is separate; do not overwrite or merge datasets into timeline.
- Topic/entity proper names support locales and aliases (`th-TH` initial, `en-US` future). Do not translate proper names by AI without provenance; let authors specify aliases.
- Store narrative text as user-entered language with optional locale metadata; do not force content translation. Layout handles long Thai words, line wrapping and mobile width.
- Thai calendar display for **server system timestamps** may use local date/clock; game-world time must use topic-defined calendar, never infer calendar year from real system `Date`.
- Distinguish `เพิ่มเรื่องราว`, `ขอแก้ไข`, `ขอซ่อน`, `รออนุมัติ`, `หมดอายุ`, `ปฏิเสธ`, `เผยแพร่แล้ว`; use `สนใจหัวข้อนี้` for explicit member follow.
- On vote buttons make requested action explicit (e.g. `เห็นด้วยกับการซ่อน`), not just a generic green button or ambiguous icon.
- Icons tiny top-right of marker must have accessible tooltips/labels; keyboard and touch interaction equivalent to hover; sufficient contrast and visible focus.
- Display numeric votes in Arabic digits 0–9 consistently; use `Intl.NumberFormat('th-TH-u-nu-latn')` if formatting needs explicit Latin digit shapes.
- Treat mixed Thai/English names and links carefully; LTR timeline order refers chronology not text direction.
