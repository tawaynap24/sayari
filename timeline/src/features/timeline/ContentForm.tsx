import { useRef, useState } from "react";
import { api, errorText } from "./client";
import {
  contentSchema,
  type Content,
  type Entity,
  type Revision,
  type Topic,
  type Request,
} from "./types";
import { useCollection } from "./hooks";
import Modal from "./Modal";
import TimeFields from "./TimeFields";
import MediaFields from "./MediaFields";
import StoryBody from "./StoryBody";
const empty: Content = {
  titleTh: "",
  summaryTh: "",
  bodyTh: "",
  time: { type: "unknown", noteTh: "" },
  namedEntityIds: [],
  sources: [],
  media: [],
  gameVersion: "",
  locale: "th-TH",
};
export default function ContentForm({
  topic,
  anchors,
  base,
  request,
  onClose,
  onSaved,
}: {
  topic: Topic;
  anchors: Revision[];
  base?: Revision;
  request?: Request;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<Content>(() => {
    const c = request?.proposal || base || empty;
    return {
      titleTh: c.titleTh,
      summaryTh: c.summaryTh,
      bodyTh: c.bodyTh,
      time: c.time,
      namedEntityIds: [...c.namedEntityIds],
      sources: [...c.sources],
      media: [...c.media],
      gameVersion: c.gameVersion,
      locale: c.locale,
    };
  });
  const [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [entityName, setEntityName] = useState(""),
    [entityEn, setEntityEn] = useState(""),
    [aliases, setAliases] = useState(""),
    [aliasesEn, setAliasesEn] = useState(""),
    [entityKind, setEntityKind] = useState<Entity["kind"]>("character");
  const entities = useCollection<Entity>("namedEntities", topic.id);
  const attempt = useRef({ fingerprint: "", id: crypto.randomUUID() });
  const update = (patch: Partial<Content>) => {
    setValue((v) => ({ ...v, ...patch }));
    setPreview(false);
  };
  const title = request
    ? "แก้ไขคำขอที่รออนุมัติ"
    : base
      ? "เสนอแก้ไขเรื่องราว"
      : "เพิ่มเรื่องราว";
  async function submit() {
    const parsed = contentSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        `กรุณาตรวจสอบข้อมูล: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 3)
          .join(" / ")}`,
      );
      return;
    }
    if (request && !confirmed) {
      setError("กรุณายืนยันการเริ่มรอบโหวตใหม่");
      return;
    }
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify(value);
    if (attempt.current.fingerprint !== fingerprint)
      attempt.current = { fingerprint, id: crypto.randomUUID() };
    try {
      await api(
        request ? "updatePendingRequest" : base ? "proposeEdit" : "createStory",
        request
          ? {
              requestId: request.id,
              roundId: request.currentVoteRoundId,
              content: parsed.data,
            }
          : base
            ? {
                topicId: topic.id,
                storyId: base.storyId,
                baseRevisionId: `v${base.revisionNumber}`,
                content: parsed.data,
              }
            : { topicId: topic.id, content: parsed.data },
        attempt.current.id,
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="tl-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (uploading || busy) return;
          if (preview) void submit();
          else {
            setPreview(true);
            setError("");
          }
        }}
      >
        {request && (
          <p className="tl-notice">
            การแก้ไขจะล้างคะแนนโหวตเดิม คำนวณเกณฑ์จากยอดผู้สนใจปัจจุบัน
            และเริ่มนับเวลาใหม่
          </p>
        )}
        {!preview ? (
          <>
            <label>
              ชื่อเรื่อง
              <input
                required
                maxLength={180}
                value={value.titleTh}
                onChange={(e) => update({ titleTh: e.target.value })}
              />
            </label>
            <label>
              สรุปเรื่องราว
              <textarea
                maxLength={1000}
                rows={2}
                value={value.summaryTh}
                onChange={(e) => update({ summaryTh: e.target.value })}
              />
            </label>
            <label>
              เนื้อเรื่อง
              <textarea
                required
                maxLength={50000}
                rows={9}
                value={value.bodyTh}
                onChange={(e) => update({ bodyTh: e.target.value })}
              />
            </label>
            <TimeFields
              topic={topic}
              anchors={anchors}
              storyId={base?.storyId || request?.storyId}
              value={value.time}
              onChange={(time) => update({ time })}
            />
            <fieldset>
              <legend>ชื่อเฉพาะและนามแฝง</legend>
              <div className="tl-entity-list">
                {entities.items.map((e) => (
                  <label className="tl-check" key={e.id}>
                    <input
                      type="checkbox"
                      checked={value.namedEntityIds.includes(e.id)}
                      onChange={(event) =>
                        update({
                          namedEntityIds: event.target.checked
                            ? [...value.namedEntityIds, e.id]
                            : value.namedEntityIds.filter((id) => id !== e.id),
                        })
                      }
                    />
                    {e.names["th-TH"]}{" "}
                    {e.names["en-US"] && `/ ${e.names["en-US"]}`}
                  </label>
                ))}
              </div>
              <details>
                <summary>เพิ่มชื่อเฉพาะในหัวข้อ</summary>
                <div className="tl-fields">
                  <label>
                    ประเภท
                    <select
                      aria-label="ประเภท"
                      value={entityKind}
                      onChange={(e) =>
                        setEntityKind(e.target.value as Entity["kind"])
                      }
                    >
                      <option value="character">ตัวละคร / บุคคล</option>
                      <option value="place">สถานที่</option>
                      <option value="organization">องค์กร</option>
                      <option value="faction">ฝ่าย</option>
                      <option value="other">อื่น ๆ</option>
                    </select>
                  </label>
                  <label>
                    ชื่อไทย
                    <input
                      value={entityName}
                      maxLength={200}
                      onChange={(e) => setEntityName(e.target.value)}
                    />
                  </label>
                  <label>
                    ชื่ออังกฤษ (ถ้ามี)
                    <input
                      value={entityEn}
                      maxLength={200}
                      onChange={(e) => setEntityEn(e.target.value)}
                    />
                  </label>
                  <label>
                    นามแฝง แยกด้วยจุลภาค
                    <input
                      value={aliases}
                      onChange={(e) => setAliases(e.target.value)}
                    />
                  </label>
                  <label>
                    นามแฝงภาษาอังกฤษ แยกด้วยจุลภาค
                    <input
                      value={aliasesEn}
                      onChange={(e) => setAliasesEn(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!entityName.trim() || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const saved = await api<{ entityId: string }>(
                        "saveEntity",
                        {
                          topicId: topic.id,
                          kind: entityKind,
                          names: {
                            "th-TH": entityName,
                            ...(entityEn ? { "en-US": entityEn } : {}),
                          },
                          aliases: {
                            "en-US": aliasesEn
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                            "th-TH": aliases
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          },
                        },
                      );
                      update({
                        namedEntityIds: [
                          ...value.namedEntityIds,
                          saved.entityId,
                        ],
                      });
                      setEntityName("");
                      setEntityEn("");
                      setAliases("");
                      setAliasesEn("");
                    } catch (e) {
                      setError(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  บันทึกชื่อเฉพาะ
                </button>
              </details>
            </fieldset>
            <fieldset>
              <legend>แหล่งอ้างอิง</legend>
              {value.sources.map((s, i) => (
                <div className="tl-attachment" key={s.id}>
                  <div className="tl-fields">
                    <label>
                      ประเภทแหล่งอ้างอิง
                      <select
                        aria-label="ประเภทแหล่งอ้างอิง"
                        value={s.kind}
                        onChange={(e) =>
                          update({
                            sources: value.sources.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    kind: e.target.value as typeof s.kind,
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        {[
                          ["in_game_quest", "ภารกิจในเกม"],
                          ["dialogue", "บทสนทนา"],
                          ["item", "ไอเทม"],
                          ["web", "เว็บไซต์"],
                          ["video", "วิดีโอ"],
                          ["document", "เอกสาร"],
                          ["other", "อื่น ๆ"],
                        ].map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(
                      [
                        ["title", "ชื่อแหล่งอ้างอิง"],
                        ["url", "URL แหล่งอ้างอิง"],
                        ["chapter", "บท"],
                        ["quest", "ภารกิจ"],
                        ["gameVersion", "เวอร์ชัน"],
                        ["timestampInVideo", "นาทีในวิดีโอ"],
                        ["noteTh", "หมายเหตุ"],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k}>
                        {label}
                        <input
                          required={k === "title"}
                          type={k === "url" ? "url" : "text"}
                          value={s[k] || ""}
                          onChange={(e) =>
                            update({
                              sources: value.sources.map((v, j) =>
                                j === i ? { ...v, [k]: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        sources: value.sources.filter((_, j) => j !== i),
                      })
                    }
                  >
                    นำแหล่งอ้างอิงออก
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update({
                    sources: [
                      ...value.sources,
                      {
                        id: crypto.randomUUID(),
                        kind: "in_game_quest",
                        title: "",
                      },
                    ],
                  })
                }
              >
                เพิ่มแหล่งอ้างอิง
              </button>
            </fieldset>
            <MediaFields
              onBusy={setUploading}
              topicId={topic.id}
              items={value.media}
              onChange={(media) => update({ media })}
            />
            <div className="tl-fields">
              <label>
                เวอร์ชันเรื่องราว / เกม
                <input
                  maxLength={100}
                  value={value.gameVersion}
                  onChange={(e) => update({ gameVersion: e.target.value })}
                />
              </label>
              <label>
                ภาษาเรื่องราว
                <select
                  aria-label="ภาษาเรื่องราว"
                  value={value.locale}
                  onChange={(e) => update({ locale: e.target.value })}
                >
                  <option value="th-TH">ไทย</option>
                  <option value="en-US">English</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <section>
            <h3>{value.titleTh}</h3>
            <StoryBody
              content={value}
              topic={topic}
              entities={entities.items}
            />
            {base && (
              <details>
                <summary>เปรียบเทียบกับเวอร์ชันเดิม</summary>
                <h4>{base.titleTh}</h4>
                <StoryBody
                  content={base}
                  topic={topic}
                  entities={entities.items}
                />
              </details>
            )}
            <button type="button" onClick={() => setPreview(false)}>
              กลับไปแก้ไข
            </button>
          </section>
        )}
        {request && (
          <label className="tl-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            ยืนยันล้างคะแนนและเริ่มรอบใหม่
          </label>
        )}
        {error && (
          <p className="tl-error" role="alert">
            {error}
          </p>
        )}
        <button className="tl-primary" disabled={busy || uploading}>
          {busy ? "กำลังบันทึก…" : preview ? "ส่งเรื่องราว" : "ตรวจสอบก่อนส่ง"}
        </button>
      </form>
    </Modal>
  );
}
