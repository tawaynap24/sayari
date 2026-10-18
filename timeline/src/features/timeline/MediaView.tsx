import { useEffect, useState } from "react";
import { auth, mediaEndpoint, errorText } from "./client";
import { embedUrl, type Media } from "./types";
import PdfView from "./PdfView";
export default function MediaView({ media }: { media: Media }) {
  const [open, setOpen] = useState(media.kind === "image"),
    [url, setUrl] = useState(media.url || ""),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open || media.url) return;
    const controller = new AbortController();
    let objectUrl = "";
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(
          `${mediaEndpoint}?id=${encodeURIComponent(media.id)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!response.ok)
          throw Error("เปิดสื่อไม่ได้ หรือเรื่องราวถูกซ่อนแล้ว");
        if (media.kind === "docx") {
          const data = await response.json();
          if (!controller.signal.aborted) setText(data.text);
        } else {
          objectUrl = URL.createObjectURL(await response.blob());
          if (!controller.signal.aborted) setUrl(objectUrl);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(errorText(e));
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.id, media.kind, media.url, open]);
  return (
    <figure className="tl-media">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}>
          เปิด
          {media.kind === "video"
            ? "วิดีโอ"
            : media.kind === "pdf"
              ? " PDF"
              : " DOCX"}{" "}
          ในหน้านี้
        </button>
      ) : (
        <>
          {media.kind === "image" && url && (
            <img
              src={url}
              alt={media.altTextTh || "ภาพประกอบเรื่องราว"}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setError("โหลดภาพไม่ได้")}
            />
          )}
          {media.kind === "video" && media.url && embedUrl(media.url) && (
            <iframe
              title={media.altTextTh || "วิดีโอประกอบ"}
              src={embedUrl(media.url)!}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="fullscreen; encrypted-media"
              referrerPolicy="no-referrer"
            />
          )}
          {media.kind === "pdf" && url && <PdfView url={url} />}
          {media.kind === "docx" && (
            <>
              <p className="tl-muted">
                ตัวอย่างข้อความ DOCX — จัดย่อหน้าและตารางแบบข้อความ
                ภาพและรูปแบบบางส่วนอาจต่างจากต้นฉบับ
              </p>
              <pre className="tl-docx">{text || "กำลังเปิดเอกสาร…"}</pre>
            </>
          )}
          {!url && !text && media.kind !== "video" && !error && (
            <span role="status">กำลังโหลดสื่อ…</span>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="tl-error">
          {error}
        </p>
      )}
      {media.altTextTh && <figcaption>{media.altTextTh}</figcaption>}
      {media.sourceUrl && (
        <a href={media.sourceUrl} target="_blank" rel="noopener noreferrer">
          ที่มาของสื่อ
        </a>
      )}
    </figure>
  );
}
