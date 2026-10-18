import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
export default function PdfView({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    let document: PDFDocumentProxy | null = null;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = workerUrl;
        const task = lib.getDocument({
          url,
          isEvalSupported: false,
          enableXfa: false,
          disableFontFace: false,
        });
        destroy = () => {
          void task.destroy();
        };
        document = await task.promise;
        if (stopped) {
          void document.destroy();
          return;
        }
        setPdf(document);
      } catch {
        if (!stopped) setError("เปิด PDF นี้ไม่ได้ กรุณาตรวจสอบไฟล์ต้นฉบับ");
      }
    })();
    return () => {
      stopped = true;
      destroy?.();
    };
  }, [url]);
  useEffect(() => {
    if (!pdf) return;
    let stopped = false;
    let render: RenderTask | undefined;
    setReady(false);
    (async () => {
      try {
        const p = await pdf.getPage(page);
        if (stopped || !canvas.current) return;
        const viewport = p.getViewport({
          scale: Math.min(
            2,
            1000 / p.getViewport({ scale: 1 }).width,
            1400 / p.getViewport({ scale: 1 }).height,
          ),
        });
        const el = canvas.current;
        el.width = viewport.width;
        el.height = viewport.height;
        render = p.render({ canvasContext: el.getContext("2d")!, viewport });
        await render.promise;
        const content = await p.getTextContent();
        if (!stopped) {
          setText(
            content.items.map((i) => ("str" in i ? i.str : "")).join(" "),
          );
          setReady(true);
        }
      } catch (e) {
        if (!stopped && (e as Error).name !== "RenderingCancelledException")
          setError("แสดงหน้านี้ไม่ได้");
      }
    })();
    return () => {
      stopped = true;
      render?.cancel();
    };
  }, [pdf, page]);
  return (
    <section className="tl-pdf" aria-label="ตัวอ่าน PDF">
      <div className="tl-actions">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          หน้าก่อน
        </button>
        <span>
          หน้า {page} / {pdf?.numPages ?? "…"}
        </span>
        <button
          disabled={!pdf || page >= pdf.numPages}
          onClick={() => setPage((p) => p + 1)}
        >
          หน้าถัดไป
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <canvas
            ref={canvas}
            aria-label={`PDF หน้า ${page}`}
            data-rendered={ready}
          />
          {!ready && <p role="status">กำลังแสดง PDF…</p>}
          <details>
            <summary>ข้อความในหน้านี้</summary>
            <p className="tl-narrative">
              {text || "เอกสารหน้านี้ไม่มีข้อความที่ดึงออกมาได้"}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
