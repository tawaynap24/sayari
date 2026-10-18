import type { Coordinate, Revision, TimeSpec, Topic } from "./types";
const units = ["year", "month", "day", "hour", "minute"] as const;
const labels = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "ชั่วโมง",
  minute: "นาที",
};
function CoordinateFields({
  value,
  onChange,
  topic,
  label,
}: {
  value: Coordinate;
  onChange: (v: Coordinate) => void;
  topic: Topic;
  label: string;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="tl-fields">
        <label>
          ความละเอียด
          <select
            aria-label="ความละเอียด"
            value={value.precision}
            onChange={(e) => {
              const precision = e.target.value as Coordinate["precision"];
              const next: Coordinate = { precision };
              if (value.eraId) next.eraId = value.eraId;
              const until = units.indexOf(precision as (typeof units)[number]);
              for (const u of units.slice(0, until + 1)) {
                if (u === "year") next.year = value.year ?? "0";
                else
                  next[u] = value[u] ?? (u === "month" || u === "day" ? 1 : 0);
              }
              onChange(next);
            }}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {labels[u]}
              </option>
            ))}
            <option value="era">ยุค</option>
          </select>
        </label>
        <label>
          ยุค (ถ้ามี)
          <input
            list={`era-${label}`}
            value={value.eraId || ""}
            maxLength={100}
            onChange={(e) => onChange({ ...value, eraId: e.target.value })}
          />
          <datalist id={`era-${label}`}>
            {Object.entries(topic.calendar.eras || {}).map(([id, era]) => (
              <option key={id} value={id}>
                {era.nameTh}
              </option>
            ))}
          </datalist>
        </label>
        {units
          .slice(
            0,
            units.indexOf(value.precision as (typeof units)[number]) + 1,
          )
          .map((u) => (
            <label key={u}>
              {labels[u]}
              <input
                inputMode={u === "year" ? "text" : "numeric"}
                type={u === "year" ? "text" : "number"}
                required
                value={value[u] ?? ""}
                min={u === "month" || u === "day" ? 1 : 0}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [u]: u === "year" ? e.target.value : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
      </div>
    </fieldset>
  );
}
export default function TimeFields({
  value,
  onChange,
  topic,
  anchors,
  storyId,
}: {
  value: TimeSpec;
  onChange: (v: TimeSpec) => void;
  topic: Topic;
  anchors: Revision[];
  storyId?: string;
}) {
  const origin: Coordinate = { year: "0", precision: "year" };
  return (
    <fieldset>
      <legend>เวลาในโลกของเรื่องราว</legend>
      <p className="tl-muted">ระบุเท่าที่ทราบ ปฏิทินของแต่ละหัวข้ออาจต่างกัน</p>
      <label>
        รูปแบบเวลา
        <select
          aria-label="รูปแบบเวลา"
          value={value.type}
          onChange={(e) => {
            const type = e.target.value as TimeSpec["type"];
            onChange(
              type === "exact"
                ? { type, at: origin }
                : type === "approximate"
                  ? { type, around: origin }
                  : type === "range"
                    ? { type, from: origin, to: origin }
                    : type === "relative"
                      ? { type, anchorEventId: "", relation: "after" }
                      : { type, noteTh: "" },
            );
          }}
        >
          <option value="unknown">ไม่ทราบเวลา</option>
          <option value="exact">เวลาที่ระบุได้</option>
          <option value="approximate">เวลาโดยประมาณ</option>
          <option value="range">ช่วงเวลา</option>
          <option value="relative">อ้างอิงเหตุการณ์อื่น</option>
        </select>
      </label>
      {value.type === "exact" && (
        <CoordinateFields
          label="เวลา"
          topic={topic}
          value={value.at}
          onChange={(at) => onChange({ ...value, at })}
        />
      )}
      {value.type === "approximate" && (
        <CoordinateFields
          label="เวลาโดยประมาณ"
          topic={topic}
          value={value.around}
          onChange={(around) => onChange({ ...value, around })}
        />
      )}
      {value.type === "range" && (
        <>
          <CoordinateFields
            label="เริ่ม"
            topic={topic}
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
          />
          <CoordinateFields
            label="สิ้นสุด"
            topic={topic}
            value={value.to}
            onChange={(to) => onChange({ ...value, to })}
          />
        </>
      )}
      {value.type === "relative" && (
        <div className="tl-fields">
          <label>
            ความสัมพันธ์
            <select
              aria-label="ความสัมพันธ์"
              value={value.relation}
              onChange={(e) => {
                const relation = e.target.value as typeof value.relation;
                const next = { ...value, relation };
                if (["same_time", "during"].includes(relation))
                  delete next.offset;
                onChange(next);
              }}
            >
              <option value="after">หลัง</option>
              <option value="before">ก่อน</option>
              <option value="same_time">พร้อมกัน</option>
              <option value="during">ระหว่าง</option>
            </select>
          </label>
          <label>
            เหตุการณ์อ้างอิง
            <select
              aria-label="เหตุการณ์อ้างอิง"
              required
              value={value.anchorEventId}
              onChange={(e) =>
                onChange({ ...value, anchorEventId: e.target.value })
              }
            >
              <option value="">เลือกเรื่องราวที่เผยแพร่แล้ว</option>
              {anchors
                .filter((a) => a.storyId !== storyId)
                .map((a) => (
                  <option key={a.storyId} value={a.storyId}>
                    {a.titleTh}
                  </option>
                ))}
            </select>
          </label>
          {["before", "after"].includes(value.relation) && (
            <>
              <label>
                ระยะห่าง (ไม่จำเป็น)
                <input
                  inputMode="numeric"
                  value={value.offset?.amount || ""}
                  onChange={(e) => {
                    const next = { ...value };
                    if (e.target.value)
                      next.offset = {
                        amount: e.target.value,
                        unit: value.offset?.unit || "year",
                        approximate: value.offset?.approximate ?? false,
                      };
                    else delete next.offset;
                    onChange(next);
                  }}
                />
              </label>
              {value.offset && (
                <>
                  <label>
                    หน่วย
                    <select
                      aria-label="หน่วย"
                      value={value.offset.unit}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          offset: {
                            ...value.offset!,
                            unit: e.target.value as typeof value.offset.unit,
                          },
                        })
                      }
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {labels[u]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tl-check">
                    <input
                      type="checkbox"
                      checked={!!value.offset.approximate}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          offset: {
                            ...value.offset!,
                            approximate: e.target.checked,
                          },
                        })
                      }
                    />
                    โดยประมาณ
                  </label>
                </>
              )}
            </>
          )}
        </div>
      )}
      {"noteTh" in value ||
      value.type === "unknown" ||
      value.type === "relative" ||
      value.type === "approximate" ? (
        <label>
          หมายเหตุเวลา
          <input
            maxLength={500}
            value={"noteTh" in value ? value.noteTh || "" : ""}
            onChange={(e) =>
              onChange({ ...value, noteTh: e.target.value } as TimeSpec)
            }
          />
        </label>
      ) : null}
    </fieldset>
  );
}
