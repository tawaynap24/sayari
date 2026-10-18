import type { Content, Entity, Topic, Revision } from "./types";
import { Link } from "react-router-dom";
import { useDoc } from "./hooks";
import { resolveTimes } from "./types";
import MediaView from "./MediaView";
import { sourceKindLabel } from "../../../functions/src/domain/sources";
export default function StoryBody({
  content,
  topic,
  entities = [],
}: {
  content: Content;
  topic: Topic;
  entities?: Entity[];
}) {
  const anchor = useDoc<Revision>(
    content.time.type === "relative"
      ? `publicStories/${content.time.anchorEventId}`
      : null,
  );
  const time = resolveTimes(
    [
      ...(anchor.value
        ? [
            {
              id: anchor.value.storyId,
              time: anchor.value.time,
              addedAt: anchor.value.addedAt,
              titleTh: anchor.value.titleTh,
            },
          ]
        : []),
      {
        id: "preview",
        time: content.time,
        addedAt: 0,
        titleTh: content.titleTh,
      },
    ],
    topic.calendar,
  ).get("preview")!;
  const media = [...content.media].sort(
    (a, b) => Number(!!b.cover) - Number(!!a.cover),
  );
  return (
    <div className="tl-story-body">
      <p className="tl-eyebrow">{time.label}</p>
      {anchor.value && (
        <p>
          <Link to={`/timeline/${topic.slug}/story/${anchor.value.storyId}`}>
            เหตุการณ์อ้างอิง: {anchor.value.titleTh} ↗
          </Link>
        </p>
      )}
      {content.summaryTh && <p className="tl-summary">{content.summaryTh}</p>}
      <div className="tl-narrative">{content.bodyTh}</div>
      {content.gameVersion && (
        <p className="tl-muted">เวอร์ชันที่อ้างอิง: {content.gameVersion}</p>
      )}
      {!!content.namedEntityIds.length && (
        <div className="tl-tags">
          {content.namedEntityIds.map((id) => {
            const e = entities.find((e) => e.id === id);
            return e ? (
              <span
                key={id}
                title={Object.entries(e.aliases)
                  .map(([lang, names]) => `${lang}: ${names.join(", ")}`)
                  .join("\n")}
              >
                {e.names["th-TH"]} {e.names["en-US"] && `/ ${e.names["en-US"]}`}
              </span>
            ) : null;
          })}
        </div>
      )}
      {media.map((m) => (
        <MediaView key={m.id} media={m} />
      ))}
      {!!content.sources.length && (
        <section className="tl-sources">
          <h4>แหล่งอ้างอิงจากผู้เขียน</h4>
          <ol>
            {content.sources.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} ↗
                  </a>
                ) : (
                  <strong>{s.title}</strong>
                )}
                <p>
                  {[
                    sourceKindLabel(s.kind),
                    s.kind === "other" && s.originTh && `ที่มา: ${s.originTh}`,
                    s.chapter && `บท: ${s.chapter}`,
                    s.quest && `ภารกิจ: ${s.quest}`,
                    s.gameVersion && `เวอร์ชัน: ${s.gameVersion}`,
                    s.kind === "video" && s.timestampInVideo && `นาทีที่: ${s.timestampInVideo}`,
                    s.noteTh,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
