import { useEffect, useState } from "react";
import { api, auth, errorText } from "./client";
import { useDoc } from "./hooks";
import type { Request, Revision, Topic } from "./types";
import StoryBody from "./StoryBody";
import Modal from "./Modal";
import { Link } from "react-router-dom";
const titles = {
  CREATE: "เพิ่มเรื่องราว",
  EDIT: "แก้ไขเรื่องราว",
  HIDE: "ซ่อนเรื่องราว",
};
const statuses = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};
export default function RequestPanel({
  requestId,
  topic,
  onClose,
  onEdit,
  privileged = false,
}: {
  requestId: string;
  topic: Topic;
  onClose: () => void;
  onEdit: (r: Request) => void;
  privileged?: boolean;
}) {
  const state = useDoc<Request>(`requests/${requestId}`),
    r = state.value;
  const base = useDoc<Revision>(
    r?.baseRevisionId
      ? `stories/${r.storyId}/revisions/${r.baseRevisionId}`
      : null,
  );
  const current = useDoc<Revision>(r ? `publicStories/${r.storyId}` : null);
  const vote = useDoc<{ choice: string }>(
    r && auth.currentUser
      ? `requests/${r.id}/voteRounds/${r.currentVoteRoundId}/votes/${auth.currentUser.uid}`
      : null,
  );
  const [busy, setBusy] = useState(false),
    [overrideReason, setOverrideReason] = useState(""),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const owner = r?.submittedByUid === auth.currentUser?.uid;
  async function action(name: string, data: Record<string, unknown>) {
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      await api(name, {
        requestId: r.id,
        roundId: r.currentVoteRoundId,
        ...data,
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={r ? `คำขอ${titles[r.kind]}` : "กำลังโหลดคำขอ"}
      onClose={onClose}
    >
      {state.error && <p role="alert">{state.error}</p>}
      {r && (
        <>
          <p className="tl-eyebrow">
            {statuses[r.status]} · ผู้เสนอ {r.authorLabel}
          </p>
          <h3>
            {r.proposal?.titleTh ||
              current.value?.titleTh ||
              base.value?.titleTh ||
              "เรื่องราว"}
          </h3>
          {r.reason && <p>{r.reason}</p>}
          {r.proposal && <StoryBody content={r.proposal} topic={topic} />}
          {r.kind === "EDIT" && base.value && (
            <details>
              <summary>เวอร์ชันเดิม — เปรียบเทียบก่อนโหวต</summary>
              <h4>{base.value.titleTh}</h4>
              <StoryBody content={base.value} topic={topic} />
            </details>
          )}
          {r.kind === "HIDE" && current.value && (
            <details open>
              <summary>
                เรื่องราวเวอร์ชันปัจจุบันที่ขอซ่อน (เวอร์ชัน{" "}
                {current.value.revisionNumber})
              </summary>
              <StoryBody content={current.value} topic={topic} />
            </details>
          )}
          <div className="tl-vote-score">
            <span>
              เห็นด้วย{" "}
              <strong>
                {r.yesCount} / {r.requiredVotes}
              </strong>
            </span>
            <span>
              ไม่เห็นด้วย{" "}
              <strong>
                {r.noCount} / {r.requiredVotes}
              </strong>
            </span>
          </div>
          <p className="tl-muted">
            เกณฑ์จากผู้สนใจ {r.interestSnapshot} บัญชี ณ เริ่มรอบ · รอบที่{" "}
            {r.version}
          </p>
          <p>
            หมดอายุ: {new Date(r.expiresAt).toLocaleString("th-TH")}{" "}
            {r.status === "pending" &&
              (now >= r.expiresAt
                ? "— ถึงกำหนดแล้ว รอเซิร์ฟเวอร์ยืนยัน"
                : `— เหลือ ${Math.ceil((r.expiresAt - now) / 60000)} นาที`)}
          </p>
          {vote.value && (
            <p>
              คะแนนของคุณในรอบนี้:{" "}
              {vote.value.choice === "yes" ? "เห็นด้วย" : "ไม่เห็นด้วย"}
            </p>
          )}
          {r.status === "pending" && (
            <>
              {owner ? (
                <p className="tl-notice">
                  คุณเป็นผู้ส่งคำขอนี้ จึงโหวตคำขอของตนเองไม่ได้
                </p>
              ) : (
                <div className="tl-actions">
                  <button
                    className="tl-primary"
                    disabled={busy || now >= r.expiresAt}
                    onClick={() => void action("castVote", { choice: "yes" })}
                  >
                    เห็นด้วยกับการ{titles[r.kind]}
                  </button>
                  <button
                    disabled={busy || now >= r.expiresAt}
                    onClick={() => void action("castVote", { choice: "no" })}
                  >
                    ไม่เห็นด้วย
                  </button>
                </div>
              )}
              {owner && (
                <div className="tl-actions">
                  {r.kind !== "HIDE" && (
                    <button
                      disabled={busy || now >= r.expiresAt}
                      onClick={() => onEdit(r)}
                    >
                      แก้ไขคำขอ / เริ่มโหวตใหม่
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    ยกเลิกคำขอ
                  </button>
                  {confirmCancel && (
                    <>
                      <span>ยืนยันยกเลิกคำขอนี้?</span>
                      <button
                        disabled={busy}
                        onClick={() => void action("cancelPendingRequest", {})}
                      >
                        ยืนยันยกเลิก
                      </button>
                      <button onClick={() => setConfirmCancel(false)}>
                        กลับ
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {r.kind !== "CREATE" && (
            <p>
              <Link
                to={`/timeline/${topic.slug}/story/${r.storyId}`}
                onClick={onClose}
              >
                เปิดเรื่องราวและตำแหน่งเวลา ↗
              </Link>
            </p>
          )}
          {privileged && r.kind === "CREATE" && r.status === "pending" && (
            <details>
              <summary>เผยแพร่ด้วยสิทธิ์ผู้ดูแล</summary>
              <label>
                เหตุผลของผู้ดูแล
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  minLength={3}
                  maxLength={2000}
                />
              </label>
              <button
                disabled={busy || overrideReason.trim().length < 3}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("privilegedPublish", {
                      storyId: r.storyId,
                      reason: overrideReason,
                    });
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                ยืนยันเผยแพร่และบันทึกเหตุผล
              </button>
            </details>
          )}
          {error && (
            <p role="alert" className="tl-error">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
