import { randomUUID, createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { interestIsCurrent, INTEREST_MAX_AGE_MS } from "./domain/interest";
import { z } from "zod";
import type { Actor } from "./domain/types";
import { idSchema, MAX_BYTES } from "./domain/validation";
const mimes: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
};
export function inspectFile(
  bytes: Buffer,
  mime: string,
): { kind: string; docText?: string } {
  if (bytes.length === 0 || bytes.length > MAX_BYTES || !mimes[mime])
    throw new HttpsError(
      "invalid-argument",
      "ไฟล์ต้องเป็นชนิดที่รองรับและมีขนาดไม่เกิน 5 MB",
    );
  let valid = false;
  if (mime === "image/png")
    valid = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg")
    valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp")
    valid =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/gif")
    valid = /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6));
  if (mime === "application/pdf") {
    valid = bytes.toString("ascii", 0, 5) === "%PDF-";
    if (
      /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i.test(
        bytes.toString("latin1"),
      )
    )
      valid = false;
  }
  if (!valid)
    throw new HttpsError(
      "invalid-argument",
      "เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ หรือมีเนื้อหาที่ไม่รองรับ",
    );
  return { kind: mimes[mime] };
}
export async function prepareUpload(
  db: Firestore,
  actor: Actor,
  input: unknown,
) {
  const d = z
    .object({
      topicId: idSchema,
      draftId: idSchema,
      uploadId: idSchema.optional(),
      name: z.string().min(1).max(180),
      mimeType: z.enum(Object.keys(mimes) as [string, ...string[]]),
      sizeBytes: z.number().int().min(1).max(MAX_BYTES),
    })
    .strict()
    .parse(input);
  if (/\.(svg|html?|js|exe|docx?|docm)$/i.test(d.name))
    throw new HttpsError("invalid-argument", "ไม่รองรับไฟล์ชนิดนี้");
  const id = d.uploadId
    ? createHash("sha256").update(`${actor.uid}\0${d.draftId}\0${d.uploadId}`).digest("hex")
    : randomUUID();
  const now = Date.now();
  const descriptor = db.doc(`media/${id}`);
  const status = await db.runTransaction(async (tx) => {
    const [member, rate, existing] = await tx.getAll(
      db.doc(`topics/${d.topicId}/interests/${actor.uid}`),
      db.doc(`uploadLimits/${actor.uid}`),
      descriptor,
    );
    if (!member.exists || !interestIsCurrent(member.data(), now))
      throw new HttpsError("permission-denied", "กรุณากดสนใจหัวข้อนี้ก่อน");
    if (existing.exists) {
      if (existing.get("ownerUid") !== actor.uid || existing.get("draftId") !== d.draftId || existing.get("topicId") !== d.topicId || existing.get("name") !== d.name || existing.get("mimeType") !== d.mimeType || existing.get("sizeBytes") !== d.sizeBytes)
        throw new HttpsError("failed-precondition", "ข้อมูลไฟล์เดิมไม่ตรงกัน กรุณาเลือกไฟล์ใหม่");
      const currentStatus = existing.get("status");
      if (currentStatus === "staging" && existing.get("interestExpiresAt") <= now)
        tx.update(existing.ref, { interestExpiresAt: member.get("expiresAt") ?? now + INTEREST_MAX_AGE_MS });
      return currentStatus === "ready" ? "ready" : currentStatus === "staging" ? "staging" : "expired";
    }
    const current = rate.data();
    const recent = current && now - current.at < 3_600_000;
    if (recent && current.count >= 50)
      throw new HttpsError(
        "resource-exhausted",
        "อัปโหลดครบ 50 ไฟล์ต่อชั่วโมงแล้ว กรุณารอ",
      );
    tx.set(rate.ref, {
      at: recent ? current.at : now,
      count: recent ? current.count + 1 : 1,
    });
    tx.create(descriptor, {
      ...d,
      id,
      ownerUid: actor.uid,
      status: "staging",
      kind: mimes[d.mimeType],
      path: `staging/${actor.uid}/${d.draftId}/${id}`,
      createdAt: now,
      // Storage Rules can read only two Firestore documents. Carry the
      // preparation-time deadline alongside the existing upload descriptor;
      // finalization rechecks the current membership on the server.
      interestExpiresAt: member.get("expiresAt") ?? now + INTEREST_MAX_AGE_MS,
      storyId: null,
    });
    return "staging";
  });
  const path = `staging/${actor.uid}/${d.draftId}/${id}`;
  const uploaded = status === "staging" ? (await getStorage().bucket().file(path).exists())[0] : status === "ready";
  return { id, path, status, uploaded, kind: mimes[d.mimeType] };
}
export async function finalizeUpload(
  db: Firestore,
  actor: Actor,
  input: unknown,
) {
  const { mediaId } = z.object({ mediaId: idSchema }).strict().parse(input);
  const ref = db.doc(`media/${mediaId}`);
  const snap = await ref.get();
  const m = snap.data();
  if (!m || m.ownerUid !== actor.uid)
    throw new HttpsError("permission-denied", "ไม่ใช่เจ้าของไฟล์");
  if (!mimes[m.mimeType] || /\.docx?$/i.test(m.name || ""))
    throw new HttpsError("invalid-argument", "รองรับการอัปโหลดเฉพาะภาพและ PDF");
  const member = await db.doc(`topics/${m.topicId}/interests/${actor.uid}`).get();
  if (!member.exists || !interestIsCurrent(member.data(), Date.now()))
    throw new HttpsError("permission-denied", "กรุณากดสนใจหัวข้อนี้ก่อน");
  if (m.status === "ready") return { id: mediaId, kind: m.kind };
  if (m.status !== "staging")
    throw new HttpsError("failed-precondition", "ไฟล์ไม่พร้อมตรวจสอบ");
  const bucket = getStorage().bucket();
  const file = bucket.file(m.path);
  const [metadata] = await file.getMetadata();
  if (
    Number(metadata.size) !== m.sizeBytes ||
    Number(metadata.size) > MAX_BYTES ||
    metadata.contentType !== m.mimeType
  )
    throw new HttpsError(
      "invalid-argument",
      "ขนาดหรือชนิดไฟล์ไม่ตรงกับที่ระบุ",
    );
  const [bytes] = await file.download();
  const inspected = inspectFile(bytes, m.mimeType);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `validated/${mediaId}/${hash}`;
  // Outside Firestore transactions: deterministic, retry-safe immutable copy; no download token.
  await bucket.file(path).save(bytes, {
    resumable: false,
    metadata: {
      contentType: m.mimeType,
      cacheControl: "private, no-store",
      contentDisposition: "inline",
      metadata: { sha256: hash },
    },
  });
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } });
  await db.runTransaction(async (tx) => {
    const [current, membership] = await tx.getAll(ref, member.ref);
    if (!membership.exists || !interestIsCurrent(membership.data(), Date.now()))
      throw new HttpsError("permission-denied", "กรุณากดสนใจหัวข้อนี้ก่อน");
    if (current.get("status") === "staging")
      tx.update(ref, {
        status: "ready",
        validatedPath: path,
        hash,
        ...inspected,
        validatedAt: Date.now(),
      });
  });
  return { id: mediaId, kind: inspected.kind };
}
export async function readMedia(db: Firestore, id: string, uid?: string) {
  idSchema.parse(id);
  const snap = await db.doc(`media/${id}`).get();
  const m = snap.data();
  if (!m || m.status !== "ready")
    throw new HttpsError("not-found", "ไม่พบสื่อ");
  let allowed = uid === m.ownerUid;
  let isPublic = false;
  if (m.storyId) {
    const [pub, approved, story] = await Promise.all([
      db.doc(`publicStories/${m.storyId}`).get(),
      db.doc(`stories/${m.storyId}/media/${id}`).get(),
      db.doc(`stories/${m.storyId}`).get(),
    ]);
    if (story.get("restricted") === true)
      throw new HttpsError(
        "permission-denied",
        "สื่อนี้ถูกจำกัดการเข้าถึงโดยผู้ดูแล",
      );
    isPublic = pub.exists && approved.exists;
    allowed ||= isPublic;
    if (!allowed && uid) {
      const membership = await db.doc(`topics/${m.topicId}/interests/${uid}`).get();
      allowed = membership.exists && interestIsCurrent(membership.data(), Date.now());
    }
  }
  if (!allowed)
    throw new HttpsError("permission-denied", "ไม่สามารถเปิดสื่อนี้ได้");
  return { m, isPublic };
}
export async function cleanupOrphans(db: Firestore) {
  const cut = Date.now() - 7 * 86_400_000;
  const checkpoint = db.doc("maintenance/mediaCleanup");
  const saved = (await checkpoint.get()).get("lastId");
  const cursor = saved ? await db.doc(`media/${saved}`).get() : null;
  let scan = db
    .collection("media")
    .where("status", "in", ["staging", "ready", "cleanup"])
    .where("createdAt", "<", cut)
    .orderBy("createdAt")
    .orderBy("__name__")
    .limit(100);
  if (cursor?.exists) scan = scan.startAfter(cursor);
  const docs = await scan.get();
  let removed = 0;
  for (const d of docs.docs) {
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(d.ref);
      if (
        !fresh.exists ||
        fresh.get("status") === "deleted" ||
        fresh.get("createdAt") >= cut
      )
        return null;
      const storyId = fresh.get("storyId");
      if (storyId) {
        const approved = await tx.get(
          db.doc(`stories/${storyId}/media/${d.id}`),
        );
        if (approved.exists) return null;
        const pending = await tx.get(
          db
            .collection("requests")
            .where("storyId", "==", storyId)
            .where("status", "==", "pending")
            .limit(3),
        );
        if (
          pending.docs.some((r) =>
            (r.get("proposal.media") || []).some(
              (m: { id: string }) => m.id === d.id,
            ),
          )
        )
          return null;
      }
      tx.update(d.ref, { status: "cleanup" });
      return fresh.data();
    });
    if (!claimed) continue;
    await getStorage()
      .bucket()
      .file(claimed.path)
      .delete({ ignoreNotFound: true });
    if (claimed.validatedPath)
      await getStorage()
        .bucket()
        .file(claimed.validatedPath)
        .delete({ ignoreNotFound: true });
    await d.ref.update({ status: "deleted", deletedAt: Date.now() });
    removed++;
  }
  await checkpoint.set({
    lastId: docs.size === 100 ? docs.docs.at(-1)!.id : null,
    scannedAt: Date.now(),
    scanned: docs.size,
    removed,
  });
  return removed;
}
