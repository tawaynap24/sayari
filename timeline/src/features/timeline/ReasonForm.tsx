import { useState } from "react";
import type { Revision, Topic } from "./types";
import { api, errorText } from "./client";
import Modal from "./Modal";
export default function ReasonForm({
  story,
  topic,
  action,
  onClose,
}: {
  story: Revision;
  topic: Topic;
  action: "proposeHide" | "reportStory" | "privilegedHide";
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const title =
    action === "reportStory"
      ? "รายงานเนื้อหา"
      : action === "privilegedHide"
        ? "ผู้ดูแล: ซ่อนทันที"
        : "ขอซ่อนเรื่องราว";
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="tl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              action,
              action === "privilegedHide"
                ? { storyId: story.storyId, reason }
                : action === "reportStory"
                  ? { topicId: topic.id, storyId: story.storyId, reason }
                  : {
                      topicId: topic.id,
                      storyId: story.storyId,
                      baseRevisionId: `v${story.revisionNumber}`,
                      reason,
                    },
            );
            onClose();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>{story.titleTh}</h3>
        <p>
          {action === "proposeHide"
            ? "เรื่องราวยังเปิดอ่านได้ระหว่างโหวต หากคำขอผ่านจะซ่อนจากหน้าสาธารณะและเก็บประวัติไว้"
            : action === "privilegedHide"
              ? "การใช้สิทธิ์ผู้ดูแลจะซ่อนเรื่องราวและบันทึกเหตุผลในประวัติการดำเนินการ"
              : "ส่งให้ผู้ดูแลตรวจสอบ ไม่แสดงรายงานนี้ต่อสาธารณะ"}
        </p>
        <label>
          เหตุผล
          <textarea
            required
            minLength={3}
            maxLength={2000}
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="tl-error">
            {error}
          </p>
        )}
        <button className="tl-primary" disabled={busy}>
          {busy ? "กำลังส่ง…" : title}
        </button>
      </form>
    </Modal>
  );
}
