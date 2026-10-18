import type { Source } from "./types";

export const sourceOptions = [
  ["main_story", "เนื้อเรื่องหลัก"],
  ["character_story", "เนื้อเรื่องตัวละคร"],
  ["side_quest", "เควสย่อย"],
  ["video", "วิดีโอ"],
  ["other", "อื่นๆ"],
] as const;

const legacyLabels: Partial<Record<Source["kind"], string>> = {
  in_game_quest: "ภารกิจในเกม",
  dialogue: "บทสนทนา",
  item: "ไอเทม",
  web: "เว็บไซต์",
  document: "เอกสาร",
};

export function sourceKindLabel(kind: Source["kind"]) {
  return sourceOptions.find(([value]) => value === kind)?.[1] ?? legacyLabels[kind];
}

/** Older broad categories cannot reliably identify main/character/side quests. */
export function sourceForForm(source: Source): Source {
  const legacy = legacyLabels[source.kind];
  return legacy ? { ...source, kind: "other", originTh: source.originTh || legacy } : { ...source };
}

/** Preserve draft values when switching type; send only relevant optional fields. */
export function sourceForSubmission(source: Source): Source {
  const result = { ...source };
  if (source.kind !== "video") {
    delete result.url;
    delete result.timestampInVideo;
  }
  if (source.kind !== "other") delete result.originTh;
  return result;
}
