import { z } from "zod";
import type { Content, Entity, Request, Revision } from "./types";

export interface FormContext { base?: Revision; request?: Request }
export interface EntityDraft { name: string; english: string; aliases: string; aliasesEnglish: string; kind: Entity["kind"] }
export interface StoryDraft {
  version: 1;
  id: string;
  updatedAt: number;
  context: FormContext;
  content: Content;
  entity: EntityDraft;
  operation: { fingerprint: string; id: string };
}
export const emptyEntity: EntityDraft = { name: "", english: "", aliases: "", aliasesEnglish: "", kind: "character" };

// Draft validation deliberately allows incomplete form values. Published
// content is validated separately by the shared server schema before sending.
const coordinate = z.object({ precision: z.enum(["year", "month", "day", "hour", "minute", "era", "unknown"]), year: z.string().optional(), month: z.number().optional(), day: z.number().optional(), hour: z.number().optional(), minute: z.number().optional(), eraId: z.string().optional() });
const time = z.discriminatedUnion("type", [
  z.object({ type: z.literal("unknown"), noteTh: z.string().optional(), eraId: z.string().optional() }),
  z.object({ type: z.literal("exact"), at: coordinate }),
  z.object({ type: z.literal("approximate"), around: coordinate, noteTh: z.string().optional() }),
  z.object({ type: z.literal("range"), from: coordinate, to: coordinate }),
  z.object({ type: z.literal("relative"), anchorEventId: z.string(), relation: z.enum(["before", "after", "same_time", "during"]), offset: z.object({ amount: z.string(), unit: z.enum(["year", "month", "day", "hour", "minute"]), approximate: z.boolean().optional() }).optional(), noteTh: z.string().optional() }),
]);
const source = z.object({ id: z.string(), kind: z.enum(["main_story", "character_story", "side_quest", "video", "other", "in_game_quest", "dialogue", "item", "web", "document"]), title: z.string(), originTh: z.string().optional(), url: z.string().optional(), chapter: z.string().optional(), quest: z.string().optional(), gameVersion: z.string().optional(), timestampInVideo: z.string().optional(), noteTh: z.string().optional() });
const media = z.object({ id: z.string(), kind: z.enum(["image", "pdf", "video", "docx"]), url: z.string().optional(), altTextTh: z.string().optional(), sourceUrl: z.string().optional(), cover: z.boolean().optional() });
const content = z.object({ titleTh: z.string(), summaryTh: z.string(), bodyTh: z.string(), time, namedEntityIds: z.array(z.string()), sources: z.array(source), media: z.array(media), gameVersion: z.string(), locale: z.string() });
const revision = content.extend({ id: z.string(), topicId: z.string(), storyId: z.string(), revisionNumber: z.number().int().positive() }).passthrough();
const request = z.object({ id: z.string(), topicId: z.string(), storyId: z.string(), currentVoteRoundId: z.string(), proposal: content }).passthrough();
const schema = z.object({ version: z.literal(1), id: z.string(), updatedAt: z.number(), context: z.object({ base: revision.optional(), request: request.optional() }), content, entity: z.object({ name: z.string(), english: z.string(), aliases: z.string(), aliasesEnglish: z.string(), kind: z.enum(["character", "place", "organization", "faction", "other"]) }), operation: z.object({ fingerprint: z.string(), id: z.string() }) });

export function draftPrefix(project: string, uid: string, topicId: string) {
  return `timeline.draft.v1:${[project, uid, topicId].map(encodeURIComponent).join(":")}:`;
}
export function draftKey(project: string, uid: string, topicId: string, context: FormContext) {
  const target = context.request ? `request:${context.request.id}` : context.base ? `edit:${context.base.storyId}` : "create";
  return draftPrefix(project, uid, topicId) + target;
}
export function readDraft(key: string, store?: Pick<Storage, "getItem">): StoryDraft | null {
  try {
    const value = JSON.parse((store ?? localStorage).getItem(key) || "null"), parsed = schema.safeParse(value);
    return parsed.success ? parsed.data as unknown as StoryDraft : null;
  } catch { return null; }
}
export function latestDraft(project: string, uid: string, topicId: string): StoryDraft | null {
  try {
    const prefix = draftPrefix(project, uid, topicId);
    const drafts = Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => readDraft(key)).filter((value): value is StoryDraft => !!value);
    // An edit always retains its original revision/round. Server stale checks
    // remain effective after recovery, including changes from another device.
    return drafts.filter(d => (!d.context.base || d.context.base.topicId === topicId) && (!d.context.request || d.context.request.topicId === topicId)).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  } catch { return null; }
}
