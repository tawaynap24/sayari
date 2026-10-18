import { useState } from "react";
import { api, db, errorText } from "./client";
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
import SourceFields from "./SourceFields";
import { sourceForSubmission } from "../../../functions/src/domain/sources";
import { useStoryDraft } from "./useStoryDraft";
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
  base: initialBase,
  request: initialRequest,
  userId,
  onClose,
  onSaved,
}: {
  topic: Topic;
  anchors: Revision[];
  base?: Revision;
  request?: Request;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = initialRequest?.proposal || initialBase || empty;
  const draft = useStoryDraft(db.app.options.projectId || "timeline", userId, topic.id, { base: initialBase, request: initialRequest }, {
    titleTh: initial.titleTh, summaryTh: initial.summaryTh, bodyTh: initial.bodyTh, time: initial.time,
    namedEntityIds: [...initial.namedEntityIds], sources: [...initial.sources], media: [...initial.media], gameVersion: initial.gameVersion, locale: initial.locale,
  });
  const value = draft.record.content, { base, request } = draft.record.context;
  const [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const { name: entityName, english: entityEn, aliases, aliasesEnglish: aliasesEn, kind: entityKind } = draft.record.entity;
  const setEntityName = (name: string) => draft.updateEntity({ name });
  const setEntityEn = (english: string) => draft.updateEntity({ english });
  const setAliases = (aliases: string) => draft.updateEntity({ aliases });
  const setAliasesEn = (aliasesEnglish: string) => draft.updateEntity({ aliasesEnglish });
  const setEntityKind = (kind: Entity["kind"]) => draft.updateEntity({ kind });
  const entities = useCollection<Entity>("namedEntities", topic.id);
  const update = (patch: Partial<Content>) => {
    draft.updateContent(patch);
    setPreview(false);
  };
  const title = request
    ? "แก้ไขคำขอที่รออนุมัติ"
    : base
      ? "เสนอแก้ไขเรื่องราว"
      : "เพิ่มเรื่องราว";
  async function submit() {
    const parsed = contentSchema.safeParse({ ...value, sources: value.sources.map(sourceForSubmission) });
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
    const fingerprint = JSON.stringify(parsed.data);
    if (draft.current.current.operation.fingerprint !== fingerprint)
      draft.updateOperation({ fingerprint, id: crypto.randomUUID() });
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
        draft.current.current.operation.id,
      );
      if (!draft.isDiscarded()) { draft.discard(); onSaved(); onClose(); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} closeOnEscape={false} onClose={() => { draft.discard(); onClose(); }}>
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
            <SourceFields items={value.sources} onChange={sources => update({ sources })} />
            <MediaFields
              onBusy={setUploading}
              topicId={topic.id}
              draftKey={draft.key}
              draftId={draft.id}
              isDiscarded={draft.isDiscarded}
              items={value.media}
              onChange={change => { draft.updateContent(current => ({ media: typeof change === "function" ? change(current.media) : change })); setPreview(false); }}
            />
          </>
        ) : (
          <section>
            <h3>{value.titleTh}</h3>
            <StoryBody
              content={{ ...value, sources: value.sources.map(sourceForSubmission) }}
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
        {draft.storageError && <p role="alert" className="tl-error">{draft.storageError}</p>}
        <div className="tl-form-actions">
          {preview && <button type="button" disabled={busy} onClick={() => setPreview(false)}>กลับไปแก้ไข</button>}
          <button className="tl-primary" disabled={busy || uploading}>
            {busy ? "กำลังบันทึก…" : preview ? "ส่งเรื่องราว" : "ตรวจสอบก่อนส่ง"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
