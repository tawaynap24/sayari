import { useState } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "./hooks";
import type { Entity, Revision, Topic } from "./types";
import StoryBody from "./StoryBody";
import StoryAttribution from "./StoryAttribution";
export default function StoryCard({
  story,
  topic,
  entities,
  member,
  onEdit,
  onHide,
  onReport,
  onPrivilegedHide,
  expanded = false,
}: {
  story: Revision;
  topic: Topic;
  entities: Entity[];
  member: boolean;
  onEdit: (s: Revision) => void;
  onHide: (s: Revision) => void;
  onReport: (s: Revision) => void;
  onPrivilegedHide?: (s: Revision) => void;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded),
    [history, setHistory] = useState(false);
  const versions = useCollection<Revision>(
    history ? `publicStories/${story.storyId}/history` : null,
  );
  return (
    <article className="tl-story" data-story-id={story.storyId}>
      <div className="tl-row">
        <div>
          <p className="tl-eyebrow">
            เวอร์ชัน {story.revisionNumber} ·{" "}
            {new Date(story.addedAt).toLocaleDateString("th-TH")}
          </p>
          <h3>
            <button
              className="tl-story-title"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {story.titleTh} <span>{open ? "−" : "＋"}</span>
            </button>
          </h3>
          <StoryAttribution
            authorLabel={story.authorLabel}
            editorLabel={story.editorLabel}
            revisionNumber={story.revisionNumber}
          />
        </div>
        <Link
          aria-label={`ลิงก์เรื่องราว ${story.titleTh}`}
          to={`/timeline/${topic.slug}/story/${story.storyId}`}
        >
          ↗
        </Link>
      </div>
      {!open && (
        <p className="tl-muted">
          {story.summaryTh || story.bodyTh.slice(0, 180)}
        </p>
      )}
      {open && (
        <>
          <StoryBody content={story} topic={topic} entities={entities} />
          <div className="tl-actions">
            <button onClick={() => setHistory(!history)}>
              ประวัติการแก้ไข
            </button>
            {member && (
              <>
                <button onClick={() => onEdit(story)}>ขอแก้ไข</button>
                <button onClick={() => onHide(story)}>ขอซ่อน</button>
                <button onClick={() => onReport(story)}>รายงานเนื้อหา</button>
                {onPrivilegedHide && (
                  <button onClick={() => onPrivilegedHide(story)}>
                    ผู้ดูแล: ซ่อนทันที
                  </button>
                )}
              </>
            )}
          </div>
          {history && (
            <section className="tl-history">
              <h4>เวอร์ชันที่เผยแพร่แล้ว</h4>
              {versions.error && <p role="alert">{versions.error}</p>}
              {versions.items
                .sort((a, b) => b.revisionNumber - a.revisionNumber)
                .map((v) => (
                  <details key={v.id}>
                    <summary>
                      เวอร์ชัน {v.revisionNumber} ·{" "}
                      {new Date(v.approvedAt).toLocaleString("th-TH")} ·
                      {v.revisionNumber === 1 ? "ผู้เพิ่ม" : "ผู้แก้ไข"}{" "}
                      {(v.revisionNumber === 1 ? v.authorLabel : v.editorLabel)?.trim() || "ไม่ระบุชื่อ"}
                    </summary>
                    <h4>{v.titleTh}</h4>
                    <StoryBody content={v} topic={topic} entities={entities} />
                  </details>
                ))}
            </section>
          )}
        </>
      )}
    </article>
  );
}
