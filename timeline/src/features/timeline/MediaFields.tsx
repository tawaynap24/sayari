import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { api, storage, errorText } from "./client";
import { MAX_BYTES, type Media } from "./types";
import { loadDraftFiles, saveDraftFile, removeDraftFile, type DraftFile } from "./draftUploads";
const accepted =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf";
interface UploadController {
  enqueue: (files: File[]) => Promise<void>;
  retry: () => void;
  remove: (id: string) => void;
  removeMedia: (id: string) => void;
}
interface Prepared { id: string; path: string; kind: Media["kind"]; status: "staging" | "ready" | "expired"; uploaded: boolean }
export default function MediaFields({
  items,
  onChange,
  topicId,
  onBusy,
  draftKey,
  draftId,
  isDiscarded,
}: {
  items: Media[];
  onChange: Dispatch<SetStateAction<Media[]>>;
  topicId: string;
  onBusy: (busy: boolean) => void;
  draftKey: string;
  draftId: string;
  isDiscarded: () => boolean;
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const [pending, setPending] = useState<DraftFile[]>([]);
  const callbacks = useRef({ items, onChange, onBusy, isDiscarded });
  callbacks.current = { items, onChange, onBusy, isDiscarded };
  const controller = useRef<UploadController | null>(null);
  useEffect(() => {
    let disposed = false, running = false, storing = 0, task: UploadTask | undefined;
    let records: DraftFile[] = [];
    const done = new Set<string>(), failed = new Set<string>(), removed = new Set<string>();
    function render() {
      if (disposed) return;
      setPending(records.filter(record => !done.has(record.id)));
      setBusy(running || storing > 0);
      callbacks.current.onBusy(storing > 0 || records.some(record => !done.has(record.id)));
    }
    async function processFile(record: DraftFile) {
      let prepared: Prepared | undefined;
      for (let retry = 0; retry < 3; retry++) {
        if (disposed || removed.has(record.id)) return;
        prepared = await api<Prepared>("prepareUpload", {
          topicId, draftId, uploadId: `${record.id}_${record.generation}`,
          name: record.file.name, sizeBytes: record.file.size, mimeType: record.file.type,
        });
        if (disposed || removed.has(record.id)) {
          if (callbacks.current.isDiscarded()) await removeDraftFile(record.id);
          return;
        }
        if (prepared.status !== "expired") break;
        record.generation++;
        await saveDraftFile(record);
      }
      if (!prepared || prepared.status === "expired") throw Error("กู้คืนไฟล์ไม่สำเร็จ กรุณาลองอัปโหลดอีกครั้ง");
      if (disposed || removed.has(record.id)) return;
      if (prepared.status !== "ready" && !prepared.uploaded) {
        task = uploadBytesResumable(ref(storage, prepared.path), record.file, { contentType: record.file.type });
        await new Promise<void>((resolve, reject) => task!.on("state_changed", state => {
          if (!disposed) setProgress(Math.round(state.bytesTransferred / state.totalBytes * 100));
        }, reject, resolve));
        task = undefined;
      }
      if (disposed || removed.has(record.id)) return;
      const ready = prepared.status === "ready" ? { id: prepared.id, kind: prepared.kind }
        : await api<{ id: string; kind: Media["kind"] }>("finalizeUpload", { mediaId: prepared.id });
      if (removed.has(record.id) || callbacks.current.isDiscarded()) { await removeDraftFile(record.id); return; }
      const previousIds = new Set([...(record.mediaIds || []), ...(record.mediaId ? [record.mediaId] : [])]);
      record.mediaId = ready.id;
      record.mediaIds = [...new Set([...previousIds, ready.id])];
      // Store the ID lineage first so recovery can reconcile an orphan that
      // was re-uploaded, even if the browser exits between the two stores.
      await saveDraftFile(record);
      if (callbacks.current.isDiscarded()) { await removeDraftFile(record.id); return; }
      if (!disposed) callbacks.current.onChange(current => {
        if (current.some(media => media.id === ready.id)) return current.filter(media => media.id === ready.id || !previousIds.has(media.id));
        if (current.some(media => previousIds.has(media.id)))
          return current.map(media => previousIds.has(media.id) ? { ...media, ...ready } : media);
        return [...current, { ...ready, altTextTh: record.file.name }];
      });
      // Keep the source bytes until the form is sent/discarded. A long-lived
      // browser draft can recover even after server orphan cleanup ran.
      done.add(record.id);
    }
    async function run() {
      if (disposed || running || !navigator.onLine) return;
      running = true; render();
      try {
        for (;;) {
          const record = records.find(file => !done.has(file.id) && !failed.has(file.id));
          if (!record || disposed) break;
          setProgress(0);
          try {
            if (navigator.locks) await navigator.locks.request(`timeline-upload:${draftKey}:${record.id}`, () => processFile(record));
            else await processFile(record);
          } catch (e) {
            if (!disposed) { failed.add(record.id); setError(`${record.file.name}: ${errorText(e)}`); }
          }
          render();
        }
      } finally { running = false; render(); }
    }
    const ready = loadDraftFiles(draftKey).then(files => {
      records = files;
      if (!disposed) { render(); void run(); }
    }).catch(() => { if (!disposed) setError("เบราว์เซอร์เปิดไฟล์ฉบับร่างไม่ได้ กรุณาเลือกไฟล์อีกครั้ง"); });
    function remove(id: string) {
      removed.add(id); done.delete(id); failed.delete(id);
      records = records.filter(record => record.id !== id);
      void removeDraftFile(id).catch(() => { if (!disposed) setError("ลบไฟล์ฉบับร่างไม่สำเร็จ กรุณาลองใหม่"); });
      render();
    }
    const controls: UploadController = {
      async enqueue(files) {
        if (!files.length) return;
        if (files.some(file => file.size > MAX_BYTES || !accepted.split(",").includes(file.type) || /\.docx?$/i.test(file.name))) {
          setError("รองรับภาพและ PDF ขนาดไม่เกิน 5 MB ต่อไฟล์"); return;
        }
        await ready;
        if (disposed) return;
        if (callbacks.current.items.length + records.filter(record => !done.has(record.id) && !record.mediaId).length + files.length > 20) {
          setError("แนบได้ไม่เกิน 20 รายการ"); return;
        }
        storing++; setError(""); render();
        try {
          for (const file of files) {
            const createdAt = Math.max(Date.now(), ...records.map(record => record.createdAt + 1));
            const record: DraftFile = { id: crypto.randomUUID(), draftKey, file, createdAt, generation: 0 };
            await saveDraftFile(record);
            if (disposed && callbacks.current.isDiscarded()) await removeDraftFile(record.id);
            if (disposed) break;
            records.push(record);
          }
        } catch { if (!disposed) setError("บันทึกไฟล์ฉบับร่างไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์แล้วเลือกไฟล์อีกครั้ง"); }
        finally { storing--; render(); }
        void run();
      },
      retry() { failed.clear(); setError(""); void run(); },
      remove,
      removeMedia(id) { for (const record of [...records]) if (record.mediaId === id || record.mediaIds?.includes(id)) remove(record.id); },
    };
    controller.current = controls;
    const online = () => controls.retry();
    window.addEventListener("online", online);
    return () => {
      disposed = true; task?.cancel();
      if (controller.current === controls) controller.current = null;
      window.removeEventListener("online", online);
    };
  }, [draftKey, draftId, topicId]);
  const patch = (i: number, p: Partial<Media>) =>
    onChange(
      items.map((m, j) =>
        j === i ? { ...m, ...p } : p.cover ? { ...m, cover: false } : m,
      ),
    );
  return (
    <fieldset disabled={busy}>
      <legend>สื่อประกอบและภาพปก</legend>
      <label>
        อัปโหลดภาพ / PDF (สูงสุด 5 MB ต่อไฟล์)
        <input
          type="file"
          accept={accepted}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) void controller.current?.enqueue(files);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">กำลังอัปโหลดและตรวจสอบไฟล์ {progress}%</p>}
      {pending.map(file => <div className="tl-attachment" key={file.id}>
        <span>{file.file.name}</span>
        <button type="button" onClick={() => controller.current?.remove(file.id)}>นำไฟล์ที่รอออก</button>
      </div>)}
      {!busy && pending.length > 0 && <button type="button" onClick={() => controller.current?.retry()}>ลองอัปโหลดอีกครั้ง</button>}
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
              onClick={() => { controller.current?.removeMedia(m.id); onChange(items.filter((_, j) => j !== i)); }}
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
