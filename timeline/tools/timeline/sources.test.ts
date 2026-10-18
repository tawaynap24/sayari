import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { contentSchema }: typeof import("../../functions/src/domain/validation") = require("../../functions/lib/domain/validation.js");
const { sourceForForm, sourceForSubmission }: typeof import("../../functions/src/domain/sources") = require("../../functions/lib/domain/sources.js");
import type { Content, Source } from "../../functions/src/domain/types";

const content: Content = { titleTh: "Test", summaryTh: "", bodyTh: "Synthetic", time: { type: "unknown" }, namedEntityIds: [], sources: [], media: [], gameVersion: "", locale: "th-TH" };
const parse = (source: Source) => contentSchema.safeParse({ ...content, sources: [source] });

test("all five reference categories are accepted with their applicable data", () => {
  for (const kind of ["main_story", "character_story", "side_quest", "video", "other"] as const) {
    const source: Source = { id: "source", kind, title: "Reference", ...(kind === "other" ? { originTh: "หนังสือรวมเรื่องราว" } : {}), ...(kind === "video" ? { url: "https://example.com/video", timestampInVideo: "12:30" } : {}) };
    assert.equal(parse(source).success, true, kind);
  }
});

test("other references require a nonblank origin on the server", () => {
  for (const originTh of [undefined, "", "   "]) {
    const result = parse({ id: "source", kind: "other", title: "Reference", originTh });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path.join(".") === "sources.0.originTh"));
  }
});

test("switching reference type excludes inactive video/origin fields without discarding draft values", () => {
  const draft: Source = { id: "source", kind: "main_story", title: "Reference", url: "not-a-url", timestampInVideo: "12:30", originTh: "draft origin" };
  const submitted = sourceForSubmission(draft);
  assert.equal(parse(submitted).success, true);
  assert.equal(submitted.url, undefined); assert.equal(submitted.timestampInVideo, undefined); assert.equal(submitted.originTh, undefined);
  assert.equal(draft.url, "not-a-url"); assert.equal(draft.timestampInVideo, "12:30");
  assert.equal(parse(sourceForSubmission({ ...draft, kind: "video" })).success, false);
});

test("legacy reference categories can be edited within five choices while preserving historical metadata", () => {
  const legacy: Source = { id: "source", kind: "dialogue", title: "Reference", chapter: "บทเก่า", noteTh: "ข้อมูลเดิม" };
  const editable = sourceForForm(legacy);
  assert.equal(editable.kind, "other"); assert.equal(editable.originTh, "บทสนทนา");
  assert.equal(editable.chapter, legacy.chapter); assert.equal(editable.noteTh, legacy.noteTh);
  assert.equal(legacy.kind, "dialogue"); assert.equal(parse(editable).success, true);
});
