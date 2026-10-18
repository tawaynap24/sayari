import type { Source } from "./types";
import { sourceOptions } from "../../../functions/src/domain/sources";

export default function SourceFields({ items, onChange }: { items: Source[]; onChange: (items: Source[]) => void }) {
  const update = (index: number, patch: Partial<Source>) => onChange(items.map((source, i) => i === index ? { ...source, ...patch } : source));
  return (
    <fieldset>
      <legend>แหล่งอ้างอิง</legend>
      {items.map((source, i) => (
        <div className="tl-attachment" key={source.id}>
          <div className="tl-fields">
            <label>
              ประเภทแหล่งอ้างอิง
              <select
                aria-label="ประเภทแหล่งอ้างอิง"
                value={source.kind}
                onChange={e => update(i, { kind: e.target.value as Source["kind"] })}
              >
                {sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              ชื่อแหล่งอ้างอิง
              <input required maxLength={300} value={source.title} onChange={e => update(i, { title: e.target.value })} />
            </label>
            {source.kind === "other" && (
              <label>
                แหล่งอ้างอิงมาจากไหน
                <input required maxLength={1000} value={source.originTh || ""} onChange={e => update(i, { originTh: e.target.value })} />
              </label>
            )}
            {source.kind === "video" && (
              <>
                <label>
                  URL แหล่งอ้างอิง
                  <input type="url" maxLength={2000} value={source.url || ""} onChange={e => update(i, { url: e.target.value })} />
                </label>
                <label>
                  นาทีที่
                  <input maxLength={100} placeholder="เช่น 12:30" value={source.timestampInVideo || ""} onChange={e => update(i, { timestampInVideo: e.target.value })} />
                </label>
              </>
            )}
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, index) => index !== i))}>
            นำแหล่งอ้างอิงออก
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), kind: "main_story", title: "" }])}>
        เพิ่มแหล่งอ้างอิง
      </button>
    </fieldset>
  );
}
