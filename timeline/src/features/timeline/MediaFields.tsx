import { useRef, useState } from "react";
import { ref, uploadBytesResumable } from "firebase/storage";
import { api, storage, errorText } from "./client";
import { MAX_BYTES, type Media } from "./types";
const accepted =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export default function MediaFields({
  items,
  onChange,
  topicId,
  onBusy,
}: {
  items: Media[];
  onChange: (m: Media[]) => void;
  topicId: string;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [kind, setKind] = useState<"image" | "video">("image");
  const draft = useRef(crypto.randomUUID());
  const patch = (i: number, p: Partial<Media>) =>
    onChange(
      items.map((m, j) =>
        j === i ? { ...m, ...p } : p.cover ? { ...m, cover: false } : m,
      ),
    );
  async function upload(files: File[]) {
    setError("");
    if (
      files.some(
        (f) => f.size > MAX_BYTES || !accepted.split(",").includes(f.type),
      )
    ) {
      setError("รองรับภาพ PDF และ DOCX ขนาดไม่เกิน 5 MB ต่อไฟล์");
      return;
    }
    if (items.length + files.length > 20) {
      setError("แนบได้ไม่เกิน 20 รายการ");
      return;
    }
    setBusy(true);
    onBusy(true);
    const next = [...items];
    try {
      for (const file of files) {
        setProgress(0);
        const prepared = await api<{ id: string; path: string }>(
          "prepareUpload",
          {
            topicId,
            draftId: draft.current,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
          },
        );
        const task = uploadBytesResumable(ref(storage, prepared.path), file, {
          contentType: file.type,
        });
        await new Promise<void>((resolve, reject) =>
          task.on(
            "state_changed",
            (s) =>
              setProgress(
                Math.round((s.bytesTransferred / s.totalBytes) * 100),
              ),
            reject,
            resolve,
          ),
        );
        const ready = await api<{ id: string; kind: Media["kind"] }>(
          "finalizeUpload",
          { mediaId: prepared.id },
        );
        next.push({ ...ready, altTextTh: file.name });
        onChange([...next]);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <fieldset disabled={busy}>
      <legend>สื่อประกอบและภาพปก</legend>
      <label>
        อัปโหลดภาพ / PDF / DOCX (สูงสุด 5 MB ต่อไฟล์)
        <input
          type="file"
          accept={accepted}
          multiple
          onChange={(e) => {
            void upload(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">กำลังอัปโหลดและตรวจสอบไฟล์ {progress}%</p>}
      <div className="tl-fields">
        <label>
          ชนิดลิงก์
          <select
            aria-label="ชนิดลิงก์"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="image">ภาพ</option>
            <option value="video">YouTube / Vimeo</option>
          </select>
        </label>
        <label>
          ลิงก์ HTTPS
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!url}
          onClick={() => {
            onChange([...items, { id: crypto.randomUUID(), kind, url }]);
            setUrl("");
          }}
        >
          เพิ่มลิงก์
        </button>
      </div>
      {items.map((m, i) => (
        <div key={m.id} className="tl-attachment">
          <strong>
            {i + 1}. {m.kind.toUpperCase()}
          </strong>
          <label>
            คำอธิบายภาพ / ชื่อสื่อ
            <input
              maxLength={500}
              value={m.altTextTh || ""}
              onChange={(e) => patch(i, { altTextTh: e.target.value })}
            />
          </label>
          <label>
            แหล่งที่มาของสื่อ
            <input
              type="url"
              value={m.sourceUrl || ""}
              onChange={(e) => patch(i, { sourceUrl: e.target.value })}
            />
          </label>
          {m.url && (
            <label>
              URL
              <input
                type="url"
                value={m.url}
                onChange={(e) => patch(i, { url: e.target.value })}
              />
            </label>
          )}
          <div className="tl-actions">
            {m.kind === "image" && (
              <label className="tl-check">
                <input
                  type="checkbox"
                  checked={!!m.cover}
                  onChange={(e) => patch(i, { cover: e.target.checked })}
                />
                ใช้เป็นภาพปก
              </label>
            )}
            <button
              type="button"
              disabled={!i}
              onClick={() => {
                const next = [...items];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              ขึ้น
            </button>
            <button
              type="button"
              disabled={i === items.length - 1}
              onClick={() => {
                const next = [...items];
                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                onChange(next);
              }}
            >
              ลง
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              นำสื่อออก
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="tl-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
