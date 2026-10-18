import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Firestore, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import type {
  Actor,
  Content,
  Kind,
  Request,
  Revision,
  Story,
  Topic,
} from "./domain/types";
import { contentSchema, entitySchema, idSchema } from "./domain/validation";
import { count, expiry, outcome, voteDelta } from "./domain/policy";
import { requiredVotes } from "./domain/policy";
import { InterestService } from "./interests";
import { interestIsCurrent } from "./domain/interest";

type Reply = { [key: string]: unknown };
type Failure = { failure: string; message: string };
function fail(
  message: string,
  code:
    | "permission-denied"
    | "failed-precondition"
    | "not-found"
    | "already-exists"
    | "invalid-argument" = "failed-precondition",
): never {
  throw new HttpsError(code, message);
}
const envelope = z
  .object({ action: z.string(), operationId: idSchema, data: z.unknown() })
  .strict();
const topicInput = z.object({ topicId: idSchema }).strict();
const storyInput = z
  .object({ topicId: idSchema, storyId: idSchema, baseRevisionId: idSchema })
  .strict();
const requestInput = z
  .object({ requestId: idSchema, roundId: idSchema })
  .strict();
const reason = z
  .string()
  .trim()
  .min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร")
  .max(2000);
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export class TimelineService {
  readonly interests: InterestService;
  constructor(
    readonly db: Firestore,
    readonly clock: () => number = Date.now,
  ) { this.interests = new InterestService(db, clock); }
  ref(path: string) {
    return this.db.doc(path);
  }
  async run(actor: Actor, input: unknown): Promise<Reply> {
    const parsed = envelope.parse(input);
    const { action, operationId, data } = parsed;
    const digest = createHash("sha256")
      .update(stable({ action, data }))
      .digest("hex");
    const response = await this.retryTransaction(async (tx) => {
      const now = this.clock();
      const opRef = this.ref(`users/${actor.uid}/operations/${operationId}`);
      const rateRef = this.ref(`writeLimits/${actor.uid}`);
      const [op, rate] = await tx.getAll(opRef, rateRef);
      if (op.exists) {
        if (op.get("digest") !== digest)
          fail("รหัสส่งซ้ำไม่ตรงกับข้อมูลเดิม", "invalid-argument");
        return op.get("response") as Reply;
      }
      const limit = rate.data();
      const recent = limit && now - limit.windowAt < 60_000;
      if (recent && limit.count >= 120)
        throw new HttpsError(
          "resource-exhausted",
          "ส่งคำขอถี่เกินไป กรุณารอสักครู่",
        );
      let result: Reply;
      if (action === "followTopic")
        result = await this.follow(
          tx,
          actor,
          topicInput.parse(data).topicId,
          now,
        );
      else if (action === "createStory")
        result = await this.create(
          tx,
          actor,
          z
            .object({ topicId: idSchema, content: contentSchema })
            .strict()
            .parse(data),
          now,
          operationId,
        );
      else if (action === "proposeEdit" || action === "proposeHide") {
        const d =
          action === "proposeEdit"
            ? storyInput.extend({ content: contentSchema }).parse(data)
            : storyInput.extend({ reason }).parse(data);
        result = await this.propose(
          tx,
          actor,
          d,
          action === "proposeEdit" ? "EDIT" : "HIDE",
          now,
          operationId,
        );
      } else if (action === "castVote")
        result = await this.vote(
          tx,
          actor,
          requestInput.extend({ choice: z.enum(["yes", "no"]) }).parse(data),
          now,
        );
      else if (action === "updatePendingRequest")
        result = await this.update(
          tx,
          actor,
          requestInput.extend({ content: contentSchema }).parse(data),
          now,
        );
      else if (action === "cancelPendingRequest")
        result = await this.cancel(tx, actor, requestInput.parse(data), now);
      else if (action === "saveEntity")
        result = await this.entity(
          tx,
          actor,
          entitySchema.parse(data),
          now,
          operationId,
        );
      else if (action === "privilegedHide" || action === "privilegedPublish") {
        if (!actor.privileged)
          fail("บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล", "permission-denied");
        result = await this.override(
          tx,
          actor,
          z.object({ storyId: idSchema, reason }).strict().parse(data),
          action === "privilegedHide",
          now,
        );
      } else if (action === "reportStory") {
        const d = z
          .object({ topicId: idSchema, storyId: idSchema, reason })
          .strict()
          .parse(data);
        await this.member(tx, actor, d.topicId);
        const s = await tx.get(this.ref(`stories/${d.storyId}`));
        if (s.get("topicId") !== d.topicId) fail("ไม่พบเรื่องราว", "not-found");
        tx.create(this.ref(`abuseReports/${actor.uid}_${operationId}`), {
          ...d,
          reportedByUid: actor.uid,
          at: now,
          status: "open",
        });
        result = { reported: true };
      } else fail("ไม่รองรับคำสั่งนี้", "invalid-argument");
      tx.set(rateRef, {
        windowAt: recent ? limit.windowAt : now,
        count: recent ? limit.count + 1 : 1,
      });
      tx.create(opRef, { digest, response: result, at: now });
      tx.create(this.ref(`auditLog/${actor.uid}_${operationId}`), {
        actorUid: actor.uid,
        action,
        at: now,
        objectId: result.storyId || result.requestId || result.topicId || null,
        reason:
          typeof data === "object" && data && "reason" in data
            ? data.reason
            : null,
        result,
      });
      return result;
    });
    if ("failure" in response)
      throw new HttpsError("failed-precondition", String(response.message));
    return response;
  }
  async retryTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.runTransaction(work, { maxAttempts: 8 });
      } catch (error) {
        const e = error as { code?: number; message?: string };
        // Some emulator/transport retries reference an already closed transaction.
        // Re-open it; operation receipts ensure committed work cannot be applied twice.
        if (
          attempt >= 3 ||
          !(
            e.code === 10 ||
            (e.code === 3 &&
              /Transaction is invalid or closed/.test(e.message || ""))
          )
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * (attempt + 1) + Math.random() * 200),
        );
      }
    }
  }
  async member(tx: Transaction, actor: Actor, topicId: string) {
    const [topic, membership, stats] = await tx.getAll(
      this.ref(`topics/${topicId}`),
      this.ref(`topics/${topicId}/interests/${actor.uid}`),
      this.ref(`topicStats/${topicId}`),
    );
    if (!topic.exists) fail("ไม่พบหัวข้อ", "not-found");
    if (!membership.exists || !interestIsCurrent(membership.data(), this.clock()))
      fail("กรุณากดสนใจหัวข้อนี้ก่อน", "permission-denied");
    return {
      topic: topic.data() as Topic,
      n: count(stats.get("interestCount") ?? 0),
      graphVersion: stats.get("graphVersion") ?? 0,
    };
  }
  async follow(
    tx: Transaction,
    actor: Actor,
    topicId: string,
    now: number,
  ): Promise<Reply> {
    return this.interests.follow(tx, actor.uid, topicId, now);
  }
  async validateContent(
    tx: Transaction,
    content: Content,
    topicId: string,
    storyId: string,
    actorUid: string,
    base?: Content,
  ) {
    const entityDocs = content.namedEntityIds.length
      ? await tx.getAll(
          ...content.namedEntityIds.map((id) =>
            this.ref(`namedEntities/${id}`),
          ),
        )
      : [];
    if (entityDocs.some((d) => !d.exists || d.get("topicId") !== topicId))
      fail("ชื่อเฉพาะไม่ได้อยู่ในหัวข้อนี้", "invalid-argument");
    const ids = content.media.filter((m) => !m.url).map((m) => m.id);
    const mediaDocs = ids.length
      ? await tx.getAll(...ids.map((id) => this.ref(`media/${id}`)))
      : [];
    for (const doc of mediaDocs) {
      const m = doc.data();
      const inherited = base?.media.some((x) => x.id === doc.id && !x.url);
      if (
        !m ||
        m.status !== "ready" ||
        m.topicId !== topicId ||
        (!inherited && m.ownerUid !== actorUid) ||
        (m.storyId && m.storyId !== storyId) ||
        m.kind !== content.media.find((x) => x.id === doc.id)?.kind
      )
        fail("สื่อไม่พร้อมใช้หรือไม่ได้เป็นของคำขอนี้", "permission-denied");
    }
    // Read each anchor in this transaction. A shared graphVersion write serializes concurrent graph changes.
    const seen = new Set([storyId]);
    let time = content.time;
    let depth = 0;
    while (time.type === "relative") {
      const id = time.anchorEventId;
      if (seen.has(id))
        fail("เวลาอ้างอิงเป็นวงจร กรุณาเลือกเหตุการณ์อื่น", "invalid-argument");
      if (++depth > 200)
        fail(
          "สายอ้างอิงยาวเกิน 200 ขั้น กรุณาใช้เวลาที่ชัดเจน",
          "invalid-argument",
        );
      seen.add(id);
      const anchor = await tx.get(this.ref(`publicStories/${id}`));
      if (!anchor.exists || anchor.get("topicId") !== topicId)
        fail("เหตุการณ์อ้างอิงต้องเผยแพร่แล้วในหัวข้อนี้", "invalid-argument");
      time = anchor.get("time") as Content["time"];
    }
    return mediaDocs;
  }
  bindMedia(tx: Transaction, content: Content, storyId: string) {
    for (const m of content.media.filter((m) => !m.url))
      tx.update(this.ref(`media/${m.id}`), { storyId });
  }
  request(
    kind: Kind,
    actor: Actor,
    story: Story,
    proposal: Content | null,
    n: number,
    now: number,
    id: string,
    why = "",
  ): Request {
    return {
      id,
      kind,
      topicId: story.topicId,
      storyId: story.id,
      baseRevisionId: story.activeRevisionId,
      submittedByUid: actor.uid,
      authorLabel: actor.label,
      status: "pending",
      proposal,
      reason: why,
      interestSnapshot: n,
      requiredVotes: requiredVotes(kind, n) ?? 0,
      yesCount: 0,
      noCount: 0,
      currentVoteRoundId: randomUUID(),
      restricted: false,
      submittedAt: now,
      lastVoteChangedAt: now,
      expiresAt: expiry(kind, now),
      settledAt: null,
      version: 1,
    };
  }
  async create(
    tx: Transaction,
    actor: Actor,
    d: { topicId: string; content: Content },
    now: number,
    opId: string,
  ): Promise<Reply> {
    const { n } = await this.member(tx, actor, d.topicId);
    const id = `s_${actor.uid}_${opId}`;
    const story: Story = {
      id,
      topicId: d.topicId,
      submittedByUid: actor.uid,
      authorLabel: actor.label,
      addedAt: now,
      status: "pending",
      activeRevisionId: null,
      revisionNumber: 0,
      activeEditRequestId: null,
      activeHideRequestId: null,
    };
    await this.validateContent(tx, d.content, d.topicId, id, actor.uid);
    this.bindMedia(tx, d.content, id);
    if (requiredVotes("CREATE", n) === null) {
      this.publish(tx, story, d.content, actor.label, now, "interest_below_50");
      return { storyId: id, status: "published" };
    }
    const request = this.request(
      "CREATE",
      actor,
      story,
      d.content,
      n,
      now,
      `r_${actor.uid}_${opId}`,
    );
    tx.create(this.ref(`stories/${id}`), story);
    tx.create(this.ref(`requests/${request.id}`), request);
    return { storyId: id, requestId: request.id, status: "pending" };
  }
  publish(
    tx: Transaction,
    story: Story,
    content: Content,
    editorLabel: string,
    now: number,
    decision: string,
  ) {
    const revisionNumber = story.revisionNumber + 1;
    const id = `v${revisionNumber}`;
    const revision: Revision = {
      ...content,
      id,
      storyId: story.id,
      topicId: story.topicId,
      revisionNumber,
      authorLabel: story.authorLabel,
      editorLabel,
      addedAt: story.addedAt,
      approvedAt: now,
      decision,
    };
    tx.create(this.ref(`stories/${story.id}/revisions/${id}`), revision);
    tx.create(this.ref(`publicStories/${story.id}/history/${id}`), revision);
    tx.set(this.ref(`publicStories/${story.id}`), revision);
    tx.set(this.ref(`stories/${story.id}`), {
      ...story,
      status: "published",
      activeRevisionId: id,
      revisionNumber,
      activeEditRequestId: null,
    });
    tx.set(
      this.ref(`topicStats/${story.topicId}`),
      { graphVersion: FieldValue.increment(1) },
      { merge: true },
    );
    tx.update(this.ref(`topics/${story.topicId}`), {
      timelineUpdatedAt: now,
      ...(story.status !== "published" ? { publishedCount: FieldValue.increment(1) } : {}),
    });
    for (const m of content.media.filter((m) => !m.url))
      tx.set(
        this.ref(`stories/${story.id}/media/${m.id}`),
        { mediaId: m.id, approved: true },
        { merge: true },
      );
  }
  async propose(
    tx: Transaction,
    actor: Actor,
    d: {
      topicId: string;
      storyId: string;
      baseRevisionId: string;
      content?: Content;
      reason?: string;
    },
    kind: "EDIT" | "HIDE",
    now: number,
    opId: string,
  ): Promise<Reply> {
    const { n } = await this.member(tx, actor, d.topicId);
    const snapshot = await tx.get(this.ref(`stories/${d.storyId}`));
    const story = snapshot.data() as Story | undefined;
    if (!story || story.topicId !== d.topicId || story.status !== "published")
      fail("เรื่องราวไม่อยู่ในสถานะเผยแพร่");
    if (story.activeRevisionId !== d.baseRevisionId)
      fail("เรื่องราวมีเวอร์ชันใหม่ กรุณาโหลดใหม่");
    const lockField =
      kind === "EDIT" ? "activeEditRequestId" : "activeHideRequestId";
    const old = story[lockField]
      ? await tx.get(this.ref(`requests/${story[lockField]}`))
      : null;
    const oldRequest = old?.data() as Request | undefined;
    if (oldRequest?.status === "pending" && now < oldRequest.expiresAt)
      fail(
        kind === "EDIT"
          ? "มีคำขอแก้ไขที่รออนุมัติอยู่แล้ว"
          : "มีคำขอซ่อนที่รออนุมัติอยู่แล้ว",
        "already-exists",
      );
    if (kind === "EDIT") {
      const base = await tx.get(
        this.ref(`stories/${story.id}/revisions/${story.activeRevisionId}`),
      );
      if (
        stable(
          contentSchema.parse(
            base.data() && this.contentOf(base.data() as Revision),
          ),
        ) === stable(d.content)
      )
        fail("เนื้อหาไม่มีการเปลี่ยนแปลง");
      await this.validateContent(
        tx,
        d.content!,
        story.topicId,
        story.id,
        actor.uid,
        base.data() as Content,
      );
    }
    if (oldRequest?.status === "pending") {
      this.archiveRound(tx, oldRequest, now, "expired");
      tx.update(old!.ref, { status: "expired", settledAt: now });
    }
    const request = this.request(
      kind,
      actor,
      story,
      d.content ?? null,
      n,
      now,
      `r_${actor.uid}_${opId}`,
      d.reason ?? "",
    );
    if (d.content) this.bindMedia(tx, d.content, story.id);
    tx.create(this.ref(`requests/${request.id}`), request);
    tx.update(snapshot.ref, { [lockField]: request.id });
    return { storyId: story.id, requestId: request.id, status: "pending" };
  }
  contentOf(r: Content): Content {
    return {
      titleTh: r.titleTh,
      summaryTh: r.summaryTh,
      bodyTh: r.bodyTh,
      time: r.time,
      namedEntityIds: r.namedEntityIds,
      sources: r.sources,
      media: r.media,
      gameVersion: r.gameVersion,
      locale: r.locale,
    };
  }
  async bundle(tx: Transaction, requestId: string) {
    const snap = await tx.get(this.ref(`requests/${requestId}`));
    if (!snap.exists) fail("ไม่พบคำขอ", "not-found");
    const r = snap.data() as Request;
    const s = await tx.get(this.ref(`stories/${r.storyId}`));
    if (!s.exists) fail("ไม่พบเรื่องราว", "not-found");
    const story = s.data() as Story;
    const other =
      story.activeEditRequestId && story.activeEditRequestId !== requestId
        ? await tx.get(this.ref(`requests/${story.activeEditRequestId}`))
        : null;
    return { r, story, other: other?.data() as Request | undefined };
  }
  archiveRound(tx: Transaction, r: Request, now: number, status: string) {
    tx.set(this.ref(`requests/${r.id}/voteRounds/${r.currentVoteRoundId}`), {
      ...r,
      closedAt: now,
      roundStatus: status,
    });
  }
  settle(
    tx: Transaction,
    r: Request,
    story: Story,
    status: Exclude<Request["status"], "pending">,
    now: number,
    other?: Request,
  ) {
    this.archiveRound(tx, r, now, status);
    tx.update(this.ref(`requests/${r.id}`), { ...r, status, settledAt: now });
    if (status === "approved" && r.kind !== "HIDE")
      this.publish(
        tx,
        story,
        r.proposal!,
        r.authorLabel,
        now,
        `request:${r.id}`,
      );
    else if (status === "approved") this.hide(tx, story, now, other);
    else if (r.kind === "CREATE")
      tx.update(this.ref(`stories/${story.id}`), { status: "archived" });
    if (r.kind === "EDIT" && story.activeEditRequestId === r.id)
      tx.update(this.ref(`stories/${story.id}`), { activeEditRequestId: null });
    if (r.kind === "HIDE" && story.activeHideRequestId === r.id)
      tx.update(this.ref(`stories/${story.id}`), { activeHideRequestId: null });
  }
  hide(tx: Transaction, story: Story, now: number, edit?: Request) {
    tx.update(this.ref(`stories/${story.id}`), {
      status: "hidden",
      hiddenAt: now,
      activeEditRequestId: null,
      activeHideRequestId: null,
    });
    tx.delete(this.ref(`publicStories/${story.id}`)); // History and media rules check this parent's existence on EVERY read.
    tx.update(this.ref(`topics/${story.topicId}`), {
      timelineUpdatedAt: now,
      ...(story.status === "published" ? { publishedCount: FieldValue.increment(-1) } : {}),
    });
    tx.set(
      this.ref(`topicStats/${story.topicId}`),
      { graphVersion: FieldValue.increment(1) },
      { merge: true },
    );
    if (edit?.status === "pending") {
      this.archiveRound(tx, edit, now, "cancelled_by_hide");
      tx.update(this.ref(`requests/${edit.id}`), {
        status: "cancelled",
        settledAt: now,
        reason: "เรื่องราวถูกซ่อนแล้ว",
      });
    }
  }
  expired(
    tx: Transaction,
    r: Request,
    story: Story,
    now: number,
  ): Failure | null {
    if (r.status !== "pending")
      return {
        failure: "terminal",
        message: "คำขอนี้ปิดแล้ว กรุณาโหลดข้อมูลใหม่",
      };
    if (now >= r.expiresAt) {
      this.settle(tx, r, story, "expired", now);
      return { failure: "expired", message: "คำขอหมดอายุแล้ว" };
    }
    return null;
  }
  async vote(
    tx: Transaction,
    actor: Actor,
    d: { requestId: string; roundId: string; choice: "yes" | "no" },
    now: number,
  ): Promise<Reply> {
    const { r, story, other } = await this.bundle(tx, d.requestId);
    await this.member(tx, actor, r.topicId);
    const voteRef = this.ref(
      `requests/${r.id}/voteRounds/${r.currentVoteRoundId}/votes/${actor.uid}`,
    );
    const saved = await tx.get(voteRef);
    now = this.clock();
    // Do not throw after writing expiry: return a failure to commit the terminal transition first.
    if (r.status !== "pending" || now >= r.expiresAt)
      return this.expired(tx, r, story, now)!;
    if (r.submittedByUid === actor.uid)
      fail("ไม่สามารถโหวตคำขอของตนเอง", "permission-denied");
    if (d.roundId !== r.currentVoteRoundId)
      fail("คำขอเปลี่ยนแปลงแล้ว กรุณาอ่านและโหวตรอบใหม่");
    const delta = voteDelta(
      r.yesCount,
      r.noCount,
      saved.get("choice") ?? null,
      d.choice,
    );
    if (!delta.changed)
      return { requestId: r.id, status: r.status, changed: false };
    const next = {
      ...r,
      yesCount: delta.yesCount,
      noCount: delta.noCount,
      lastVoteChangedAt: now,
      expiresAt: expiry(r.kind, r.submittedAt, now),
    };
    let status = outcome(next.yesCount, next.noCount, r.requiredVotes);
    if (status === "approved" && r.kind !== "HIDE") {
      if (
        (r.kind === "EDIT" &&
          (story.status !== "published" ||
            story.activeRevisionId !== r.baseRevisionId)) ||
        story.status === "hidden"
      ) {
        this.settle(tx, next, story, "cancelled", now);
        return {
          failure: "stale",
          message: "เวอร์ชันต้นทางเปลี่ยนหรือเรื่องราวถูกซ่อนแล้ว",
        };
      }
      const base = story.activeRevisionId
        ? ((
            await tx.get(
              this.ref(
                `stories/${story.id}/revisions/${story.activeRevisionId}`,
              ),
            )
          ).data() as Content)
        : undefined;
      // A formerly valid anchor may since have been hidden or changed. Reject publication safely.
      try {
        await this.validateContent(
          tx,
          r.proposal!,
          r.topicId,
          r.storyId,
          r.submittedByUid,
          base,
        );
      } catch (error) {
        if (!(error instanceof HttpsError)) throw error;
        status = "rejected";
        next.reason = `เผยแพร่ไม่ได้: ${error.message}`;
      }
    }
    tx.set(voteRef, {
      uid: actor.uid,
      choice: d.choice,
      changedAt: now,
      roundId: r.currentVoteRoundId,
    });
    if (status === "pending") tx.update(this.ref(`requests/${r.id}`), next);
    else this.settle(tx, next, story, status, now, other);
    return { requestId: r.id, status, changed: true };
  }
  async update(
    tx: Transaction,
    actor: Actor,
    d: { requestId: string; roundId: string; content: Content },
    now: number,
  ): Promise<Reply> {
    const { r, story } = await this.bundle(tx, d.requestId);
    const { n } = await this.member(tx, actor, r.topicId);
    now = this.clock();
    if (r.status !== "pending" || now >= r.expiresAt)
      return this.expired(tx, r, story, now)!;
    if (r.submittedByUid !== actor.uid)
      fail("แก้ไขได้เฉพาะคำขอของตนเอง", "permission-denied");
    if (r.kind === "HIDE" || d.roundId !== r.currentVoteRoundId)
      fail("คำขอไม่รองรับการแก้ไขนี้หรือรอบเปลี่ยนแล้ว");
    if (stable(d.content) === stable(r.proposal))
      fail("เนื้อหาไม่มีการเปลี่ยนแปลง");
    const base = story.activeRevisionId
      ? ((
          await tx.get(
            this.ref(`stories/${story.id}/revisions/${story.activeRevisionId}`),
          )
        ).data() as Content)
      : undefined;
    await this.validateContent(
      tx,
      d.content,
      r.topicId,
      r.storyId,
      actor.uid,
      base,
    );
    const next = {
      ...r,
      proposal: d.content,
      interestSnapshot: n,
      requiredVotes: requiredVotes(r.kind, n) ?? 0,
      yesCount: 0,
      noCount: 0,
      currentVoteRoundId: randomUUID(),
      submittedAt: now,
      lastVoteChangedAt: now,
      expiresAt: expiry(r.kind, now),
      version: r.version + 1,
    };
    this.archiveRound(tx, r, now, "revised");
    this.bindMedia(tx, d.content, story.id);
    if (next.requiredVotes === 0) this.settle(tx, next, story, "approved", now);
    else tx.update(this.ref(`requests/${r.id}`), next);
    return {
      requestId: r.id,
      status: next.requiredVotes === 0 ? "approved" : "pending",
      roundId: next.currentVoteRoundId,
    };
  }
  async cancel(
    tx: Transaction,
    actor: Actor,
    d: { requestId: string; roundId: string },
    now: number,
  ): Promise<Reply> {
    const { r, story } = await this.bundle(tx, d.requestId);
    await this.member(tx, actor, r.topicId);
    now = this.clock();
    if (r.status !== "pending" || now >= r.expiresAt)
      return this.expired(tx, r, story, now)!;
    if (actor.uid !== r.submittedByUid)
      fail("ยกเลิกได้เฉพาะคำขอของตนเอง", "permission-denied");
    if (r.currentVoteRoundId !== d.roundId) fail("รอบคำขอเปลี่ยนแล้ว");
    this.settle(tx, r, story, "cancelled", now);
    return { requestId: r.id, status: "cancelled" };
  }
  async override(
    tx: Transaction,
    actor: Actor,
    d: { storyId: string; reason: string },
    hide: boolean,
    now: number,
  ): Promise<Reply> {
    const s = await tx.get(this.ref(`stories/${d.storyId}`));
    if (!s.exists) fail("ไม่พบเรื่องราว", "not-found");
    const story = s.data() as Story;
    await this.member(tx, actor, story.topicId);
    const requests = await tx.get(
      this.db
        .collection("requests")
        .where("storyId", "==", story.id)
        .where("status", "==", "pending")
        .limit(4),
    );
    const rs = requests.docs.map((x) => x.data() as Request);
    if (hide) {
      this.hide(tx, story, now);
      for (const r of rs) {
        this.archiveRound(tx, r, now, "privileged_hide");
        tx.update(this.ref(`requests/${r.id}`), {
          status: "cancelled",
          settledAt: now,
          reason: d.reason,
        });
      }
    } else {
      const r = rs.find((x) => x.kind === "CREATE");
      if (!r || now >= r.expiresAt || story.status !== "pending")
        fail("ไม่มีคำขอสร้างที่ยังรออนุมัติ");
      await this.validateContent(
        tx,
        r.proposal!,
        story.topicId,
        story.id,
        r.submittedByUid,
      );
      this.settle(tx, { ...r, reason: d.reason }, story, "approved", now);
    }
    return {
      storyId: story.id,
      status: hide ? "hidden" : "published",
      privileged: true,
      reason: d.reason,
    };
  }
  async entity(
    tx: Transaction,
    actor: Actor,
    d: z.infer<typeof entitySchema>,
    now: number,
    opId: string,
  ): Promise<Reply> {
    await this.member(tx, actor, d.topicId);
    const id = `e_${opId}`;
    tx.create(this.ref(`namedEntities/${id}`), {
      ...d,
      id,
      createdAt: now,
      createdByUid: actor.uid,
    });
    return { entityId: id };
  }
  async expireDueRequests(): Promise<number> {
    const now = this.clock();
    let changed = 0;
    const due = await this.db
      .collection("requests")
      .where("status", "==", "pending")
      .where("expiresAt", "<=", now)
      .orderBy("expiresAt")
      .limit(100)
      .get();
    for (const doc of due.docs) {
      const expired = await this.retryTransaction(async (tx) => {
        const { r, story } = await this.bundle(tx, doc.id);
        if (r.status !== "pending" || now < r.expiresAt) return false;
        this.settle(tx, r, story, "expired", now);
        tx.create(this.ref(`auditLog/expiry_${r.id}_${r.currentVoteRoundId}`), {
          actorUid: "system",
          action: "expire",
          at: now,
          objectId: r.id,
        });
        return true;
      });
      if (expired) changed++;
    }
    return changed;
  }
}
