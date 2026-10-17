# 07 — Media, Documents, References, and Content Integrity

## User-confirmed media scope

- Start with image upload and image URLs/embed, plus video URLs/embed.
- Support PDF/Word inline browser preview if feasible; auto-download on clicking document is unwanted. If legacy .doc cannot be safely previewed, clearly mark unsupported rather than opening/downloading automatically.
- **Max upload size 5,000,000 bytes (decimal 5 MB) per file**, including photos and docs. Validate in both browser and Storage/Backend; users must see localized error when rejected.
- Firebase Storage preferred; avoid storing binary in Firestore. Store metadata and references separate from file bytes.
- Multiple media items per story, cover image selection, alt text/attribution when provided, stable revision association, no accidental attachments from different user requests.

## Allowed types, suggested initial allowlist

- Images: `image/jpeg`, `image/png`, `image/webp`, safe `image/gif` if desired; avoid SVG/HTML due script/XSS risk.
- Documents: `application/pdf`, DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`). Legacy DOC requires converter and can be deferred with explicit report; do not rename unsupported .doc to docx.
- Videos: external URL/embedded player from allowlisted providers e.g. YouTube/Vimeo where terms permit. Do not implement raw video uploads/transcoding now unless user separately asks.
- Reject executable/HTML/malware-style extensions and MIME mismatches; size applies to each file even if user selects multiple files.

## Preview strategy

- Image: browser `<img>` with safe URL and loading hints; optional gallery/lightbox.
- PDF: pdf.js/sandboxed document viewer or browser inline viewer with appropriate content type and `Content-Disposition:inline`, proper CORS; no automatic forced attachment downloads.
- DOCX: local safe read-only renderer (e.g. text extraction + escaped/sanitized HTML) with strict XSS sanitization/CSP; no macros/scripts, external media fetching blocked where feasible. Render embedded tables/formatting when possible; if fidelity is insufficient flag caveat. If no safe viewer possible, show `ไม่รองรับการเปิดไฟล์นี้บนเว็บ` without triggering download.
- URL/embed: validate http(s), source host allowlist for iframes, iframe `sandbox`, `referrerPolicy` / permissions appropriately; external links `target=_blank rel=noopener noreferrer`.
- Never directly inject user-provided HTML or game-format color tags with `dangerouslySetInnerHTML` without trusted sanitization.

## Publishing, hiding, rights

- Stage upload per author/request, protected from public. On story approval, assign immutable published revision media refs (copy/promote or controlled read gating). On rejection/expiry, keep minimal private metadata for audit and set retention cleanup policy for uploaded orphan files.
- Hide removes media from public story APIs and guest render. Already cached media/download-token URLs cannot be universally retracted; use revoke/rotation or controlled proxy if higher confidentiality needed.
- User supplied cover/media/source references must not imply official endorsement; attribution shown where provided.
- Policies for inappropriate/illegal/PII/copyright-infringing files: privileged emergency access restriction and lawful removal path overrides ordinary community soft-delete retention (document action in audit), no need to wait 100 votes.

## Source reference fields

Example source record: `{kind:'in_game_quest'|'dialogue'|'item'|'web'|'video'|'document'|'other', title, url?, chapter?, quest?, gameVersion?, minuteMark?, noteTh?}`. Allow multiple per story; URL optional for in-game source. Links shown in detailed story view, archived with each approved revision; safe protocols only.

## UX

- Show filename, size, thumbnail/previews, upload progress and explicit type/size errors.
- Clicking a document opens an on-page viewer, never a blind direct-download link.
- Body copy and media notes Thai-first.
