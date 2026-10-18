import test from "node:test";
import assert from "node:assert/strict";
import { draftKey, readDraft, emptyEntity, type StoryDraft } from "../../src/features/timeline/drafts";

const record: StoryDraft = { version: 1, id: "draft", updatedAt: 1700000000000, context: {}, content: { titleTh: "", summaryTh: "", bodyTh: "กำลังกรอก", time: { type: "exact", at: { year: "-", precision: "year" } }, namedEntityIds: [], sources: [{ id: "source", kind: "other", title: "", originTh: "" }], media: [], gameVersion: "", locale: "th-TH" }, entity: { ...emptyEntity, name: "ยังไม่บันทึก" }, operation: { id: "operation", fingerprint: "payload" } };
const read = (value: unknown) => readDraft("fixture", { getItem: () => JSON.stringify(value) });

test("browser drafts preserve incomplete content, time, references and unsaved names", () => {
  assert.deepEqual(read(record), record);
});
test("draft storage rejects corrupt/unsupported records and gracefully handles unavailable storage", () => {
  assert.equal(read({ ...record, version: 9 }), null);
  assert.equal(read({ ...record, content: { ...record.content, time: { type: "exact" } } }), null);
  assert.equal(readDraft("fixture", { getItem: () => "{broken" }), null);
  assert.equal(readDraft("fixture", { getItem: () => { throw Error("blocked"); } }), null);
});
test("draft keys isolate projects, accounts, topics and create/edit/request targets", () => {
  const key = draftKey("project", "owner", "topic", {});
  for (const [project, uid, topic] of [["project2", "owner", "topic"], ["project", "other", "topic"], ["project", "owner", "other"]])
    assert.notEqual(draftKey(project, uid, topic, {}), key);
  const base = { ...record.content, id: "v1", storyId: "story", topicId: "topic", revisionNumber: 1, authorLabel: "Author", editorLabel: "Editor", addedAt: 1, approvedAt: 1, decision: "test" };
  assert.notEqual(draftKey("project", "owner", "topic", { base }), key);
  assert.equal(read({ ...record, context: { base } })?.context.base?.revisionNumber, 1);
});
test("draft recovery retains the operation receipt for safe retries after a lost response", () => {
  assert.deepEqual(read(record)?.operation, record.operation);
});
