import type { Revision } from "./types";

export default function StoryAttribution({
  authorLabel,
  editorLabel,
  revisionNumber = 1,
}: Partial<Pick<Revision, "authorLabel" | "editorLabel" | "revisionNumber">>) {
  return (
    <p className="tl-story-attribution">
      <span>ผู้เพิ่ม <strong>{authorLabel?.trim() || "ไม่ระบุชื่อ"}</strong></span>
      {revisionNumber > 1 && (
        <span>ผู้แก้ไขล่าสุด <strong>{editorLabel?.trim() || "ไม่ระบุชื่อ"}</strong></span>
      )}
    </p>
  );
}
