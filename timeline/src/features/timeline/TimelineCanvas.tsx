import { useEffect, useMemo, useRef, useState } from "react";
import {
  layout,
  cluster,
  distance,
  type LayoutGroup,
  type Topic,
  type Request,
} from "./types";
import type { TimeNode } from "../../../functions/src/domain/time";
import StoryAttribution from "./StoryAttribution";
export interface CanvasNode extends TimeNode {
  authorLabel: string;
  editorLabel?: string;
  revisionNumber?: number;
  ghost?: boolean;
  requestId?: string;
}
export default function TimelineCanvas({
  nodes,
  topic,
  requests,
  onSelect,
  onRequest,
}: {
  nodes: CanvasNode[];
  topic: Topic;
  requests: Request[];
  onSelect: (ids: string[]) => void;
  onRequest: (id: string) => void;
}) {
  const [mode, setMode] = useState<"equal" | "time">("equal"),
    [camera, setCamera] = useState({ zoom: 1, pan: 0 }),
    [width, setWidth] = useState(800),
    [hover, setHover] = useState<LayoutGroup<CanvasNode>[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const groups = useMemo(
    () => layout(nodes, topic.calendar, mode),
    [nodes, topic.calendar, mode],
  );
  const clusters = useMemo(
    () => cluster(groups, camera.zoom),
    [groups, camera.zoom],
  );
  const max = groups.at(-1)?.x ?? 600;
  const visible = clusters.filter((c) => {
    const x = c[0].x * camera.zoom + camera.pan;
    return x > -150 && x < width + 150;
  });
  function zoomAt(factor: number, at = width / 2) {
    setCamera((c) => {
      const zoom = Math.max(0.00001, Math.min(12, c.zoom * factor));
      return { zoom, pan: at - ((at - c.pan) * zoom) / c.zoom };
    });
    setHover(null);
  }
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = element.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const c = cameraRef.current;
        const zoom = Math.max(
          0.00001,
          Math.min(12, c.zoom * Math.exp(-e.deltaY / 300)),
        );
        const x = e.clientX - rect.left;
        setCamera({ zoom, pan: x - ((x - c.pan) * zoom) / c.zoom });
      } else setCamera((c) => ({ ...c, pan: c.pan - (e.deltaX || e.deltaY) }));
      setHover(null);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  function pick(c: LayoutGroup<CanvasNode>[]) {
    if (moved.current) return;
    if (c.length > 1) {
      const span = c.at(-1)!.x - c[0].x;
      const zoom = Math.min(12, (width - 160) / Math.max(120, span));
      setCamera({ zoom, pan: 80 - c[0].x * zoom });
    }
    const published = c
      .flatMap((g) => g.nodes)
      .filter((n) => !n.ghost)
      .map((n) => n.id);
    if (published.length) onSelect(published);
    else {
      const id = c[0].nodes[0].requestId;
      if (id) onRequest(id);
    }
  }
  const preview =
    hover?.flatMap((g) => g.nodes).sort((a, b) => b.addedAt - a.addedAt) || [];
  return (
    <section className="tl-axis-section" aria-label="เส้นเวลา">
      <div className="tl-axis-tools">
        <div className="tl-segmented">
          <button
            aria-pressed={mode === "equal"}
            onClick={() => setMode("equal")}
          >
            ระยะเท่ากัน
          </button>
          <button
            aria-pressed={mode === "time"}
            onClick={() => setMode("time")}
          >
            ระยะตามเวลา
          </button>
        </div>
      </div>
      <p className="tl-muted tl-axis-legend">
        {mode === "equal"
          ? "จัดระยะเท่ากันเพื่ออ่านง่าย"
          : "สัดส่วนเวลาที่เปรียบเทียบได้ · ปรับระยะขั้นต่ำเพื่ออ่านง่าย"}{" "}
        · ลากหรือเลื่อนเพื่อดู
      </p>
      <div
        ref={root}
        className="tl-axis"
        tabIndex={0}
        aria-label="พื้นที่เส้นเวลา ใช้ลูกศรซ้ายขวาเลื่อน และปุ่มบวกลบซูม"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (["ArrowLeft", "ArrowRight", "+", "-", "Escape"].includes(e.key))
            e.preventDefault();
          if (e.key === "ArrowLeft")
            setCamera((c) => ({ ...c, pan: c.pan + 100 }));
          if (e.key === "ArrowRight")
            setCamera((c) => ({ ...c, pan: c.pan - 100 }));
          if (e.key === "+") zoomAt(1.5);
          if (e.key === "-") zoomAt(0.65);
          if (e.key === "Escape") setHover(null);
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            moved.current = false;
            return;
          }
          root.current?.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const previous = pointers.current.get(e.pointerId);
          if (!previous) return;
          const before = [...pointers.current.values()];
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const after = [...pointers.current.values()];
          if (Math.abs(e.clientX - previous.x) > 2) moved.current = true;
          if (before.length === 2 && after.length === 2) {
            const old = Math.hypot(
                before[0].x - before[1].x,
                before[0].y - before[1].y,
              ),
              next = Math.hypot(
                after[0].x - after[1].x,
                after[0].y - after[1].y,
              );
            if (old > 0)
              zoomAt(
                next / old,
                (after[0].x + after[1].x) / 2 -
                  (root.current?.getBoundingClientRect().left || 0),
              );
          } else
            setCamera((c) => ({ ...c, pan: c.pan + e.clientX - previous.x }));
          setHover(null);
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      >
        <div className="tl-axis-line" />
        {!nodes.length && (
          <p className="tl-axis-empty">ยังไม่มีเรื่องราวที่เผยแพร่</p>
        )}
        {!!groups.some((g) => g.position.unresolved) && (
          <span className="tl-unknown-caption">
            ลำดับ / เวลาที่ยังไม่ชัดเจน
          </span>
        )}
        {visible.map((c) => {
          const all = c.flatMap((g) => g.nodes),
            x = c[0].x * camera.zoom + camera.pan;
          const ids = new Set(all.map((n) => n.id));
          const related = requests.filter(
            (r) => r.kind !== "CREATE" && ids.has(r.storyId),
          );
          const edits = related.filter((r) => r.kind === "EDIT"),
            hides = related.filter((r) => r.kind === "HIDE");
          const ghost = all.every((n) => n.ghost);
          const prior = groups[groups.indexOf(c[0]) - 1];
          const delta = prior
            ? distance(prior.position, c[0].position, topic.calendar)
            : "";
          return (
            <div
              key={c[0].key}
              className={`tl-marker-wrap ${ghost ? "is-ghost" : ""} ${c[0].position.unresolved ? "is-unknown" : ""}`}
              style={{ left: x }}
            >
              {c[0].endX !== undefined && (
                <div
                  className="tl-range"
                  style={{
                    width: Math.max(
                      12,
                      Math.min(width, (c[0].endX - c[0].x) * camera.zoom),
                    ),
                  }}
                />
              )}
              <button
                className="tl-marker"
                aria-label={`${ghost ? "คำขอเพิ่ม: " : ""}${all.length > 1 ? `${all.length} เรื่องราว: ` : ""}${all[0].titleTh}`}
                onPointerDown={() => {
                  moved.current = false;
                }}
                onFocus={() => setHover(c)}
                onMouseEnter={() => setHover(c)}
                onClick={() => pick(c)}
              >
                <span>{all.length > 1 ? all.length : ""}</span>
              </button>
              <span className="tl-marker-label">
                {c.length > 1 ? `${c.length} จุดเวลา` : c[0].position.label}
              </span>
              {!!(edits.length || hides.length) && (
                <div className="tl-marker-badges">
                  {edits.map((r) => (
                    <button
                      key={r.id}
                      aria-label={`คำขอแก้ไข ${all[0].titleTh}`}
                      onClick={() => onRequest(r.id)}
                    >
                      <span>!</span>
                    </button>
                  ))}
                  {hides.map((r) => (
                    <button
                      key={r.id}
                      aria-label={`คำขอซ่อน ${all[0].titleTh}`}
                      onClick={() => onRequest(r.id)}
                    >
                      <span>×</span>
                    </button>
                  ))}
                </div>
              )}
              {prior && x - (prior.x * camera.zoom + camera.pan) > 90 && (
                <span className="tl-delta" title={delta}>
                  {delta}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {nodes.some((node) => !node.ghost) && (
        <div className="tl-actions tl-axis-controls" role="group" aria-label="ปรับมุมมองเส้นเวลา">
          <button aria-label="ซูมออก" onClick={() => zoomAt(0.65)}>
            −
          </button>
          <button aria-label="ซูมเข้า" onClick={() => zoomAt(1.5)}>
            ＋
          </button>
          <button
            onClick={() =>
              setCamera({
                zoom: Math.min(1, (width - 100) / (max + 60)),
                pan: 30,
              })
            }
          >
            พอดีจอ
          </button>
        </div>
      )}
      {hover && (
        <aside className="tl-tooltip" role="status">
          <strong>เรื่องราวล่าสุด ณ จุดนี้</strong>
          <ul>
            {preview.slice(0, 3).map((n) => (
              <li key={n.id}>
                {n.titleTh}
                {n.ghost ? " · รออนุมัติ" : ""}
                {n.ghost ? (
                  <p className="tl-story-attribution">
                    <span>ผู้เสนอ <strong>{n.authorLabel?.trim() || "ไม่ระบุชื่อ"}</strong></span>
                  </p>
                ) : (
                  <StoryAttribution
                    authorLabel={n.authorLabel}
                    editorLabel={n.editorLabel}
                    revisionNumber={n.revisionNumber}
                  />
                )}
              </li>
            ))}
          </ul>
          {preview.length > 3 && <span>+{preview.length - 3} เรื่องราว</span>}
          <button
            className="tl-icon"
            aria-label="ปิดตัวอย่าง"
            onClick={() => setHover(null)}
          >
            ×
          </button>
        </aside>
      )}
    </section>
  );
}
