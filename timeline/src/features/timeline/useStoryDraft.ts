import { useCallback, useEffect, useRef, useState } from "react";
import { draftKey, emptyEntity, readDraft, type EntityDraft, type FormContext, type StoryDraft } from "./drafts";
import { clearDraftFiles } from "./draftUploads";
import { sourceForForm } from "../../../functions/src/domain/sources";
import type { Content } from "./types";

export function useStoryDraft(project: string, uid: string, topicId: string, context: FormContext, initial: Content) {
  const key = draftKey(project, uid, topicId, context);
  const [record, setRecord] = useState<StoryDraft>(() => {
    const saved = readDraft(key);
    if (saved) return saved;
    return { version: 1, id: crypto.randomUUID(), updatedAt: Date.now(), context, content: { ...initial, sources: initial.sources.map(sourceForForm) }, entity: { ...emptyEntity }, operation: { fingerprint: "", id: crypto.randomUUID() } };
  });
  const current = useRef(record), discarded = useRef(false);
  const [storageError, setStorageError] = useState("");
  const persist = useCallback((next: StoryDraft) => {
    if (discarded.current) return;
    current.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("เบราว์เซอร์บันทึกฉบับร่างไม่ได้ ข้อมูลอาจไม่กลับมาหลังรีเฟรช"); }
  }, [key]);
  function update(patch: Partial<Pick<StoryDraft, "content" | "entity" | "operation">>) {
    if (discarded.current) return;
    const next = { ...current.current, ...patch, updatedAt: Date.now() };
    persist(next); setRecord(next);
  }
  useEffect(() => {
    persist(current.current);
    // Each input writes synchronously; pagehide also covers browser navigation
    // and bfcache without relying on an unmount/React effect to save the text.
    const flush = () => persist(current.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persist]);
  function discard() {
    discarded.current = true;
    try { localStorage.removeItem(key); } catch { /* Keep closing usable. */ }
    void clearDraftFiles(key).catch(() => {});
  }
  return {
    key, id: record.id, record, current, storageError, discard,
    isDiscarded: () => discarded.current,
    updateContent: (patch: Partial<Content> | ((content: Content) => Partial<Content>)) => update({ content: { ...current.current.content, ...(typeof patch === "function" ? patch(current.current.content) : patch) } }),
    updateEntity: (patch: Partial<EntityDraft>) => update({ entity: { ...current.current.entity, ...patch } }),
    updateOperation: (operation: StoryDraft["operation"]) => update({ operation }),
  };
}
