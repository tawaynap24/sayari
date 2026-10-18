import { FieldPath, Firestore, Transaction, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { count } from "./domain/policy";
import { interestActivity, interestIsCurrent, INTEREST_REFRESH_MS, type Interest } from "./domain/interest";

/** Membership leases are independent for each (topic, signed-in account). */
export class InterestService {
  constructor(readonly db: Firestore, readonly clock: () => number = Date.now) {}

  private async read(tx: Transaction, topicId: string, uid: string) {
    const [topic, member, stats] = await tx.getAll(
      this.db.doc(`topics/${topicId}`),
      this.db.doc(`topics/${topicId}/interests/${uid}`),
      this.db.doc(`topicStats/${topicId}`),
    );
    return { topic, member, stats };
  }

  async follow(tx: Transaction, uid: string, topicId: string, now: number) {
    const { topic, member, stats } = await this.read(tx, topicId, uid);
    if (!topic.exists) throw new HttpsError("not-found", "ไม่พบหัวข้อ");
    // Until swept, an expired document is still included in the stored count.
    // Explicit re-confirmation replaces it without counting the account twice.
    const n = count(stats.get("interestCount") ?? 0) + Number(!member.exists);
    const followedAt = member.exists && interestIsCurrent(member.data(), now)
      ? member.get("followedAt") ?? now : now;
    const activity = interestActivity(now);
    tx.set(member.ref, { uid, followedAt, ...activity });
    tx.set(this.db.doc(`users/${uid}/followedTopics/${topicId}`), { topicId, followedAt, ...activity });
    tx.set(stats.ref, { interestCount: n, graphVersion: stats.get("graphVersion") ?? 0 }, { merge: true });
    tx.update(topic.ref, { interestCount: n });
    return { topicId, followed: true, interestCount: n, ...activity };
  }

  private remove(tx: Transaction, topic: DocumentSnapshot, member: DocumentSnapshot, stats: DocumentSnapshot) {
    const topicId = topic.id;
    tx.delete(member.ref);
    tx.delete(this.db.doc(`users/${member.id}/followedTopics/${topicId}`));
    const n = Math.max(0, count(stats.get("interestCount") ?? 0) - 1);
    if (stats.exists) tx.update(stats.ref, { interestCount: n });
    if (topic.exists) tx.update(topic.ref, { interestCount: n });
  }

  async visit(uid: string, topicId: string) {
    return this.db.runTransaction(async tx => {
      const { topic, member, stats } = await this.read(tx, topicId, uid);
      const now = this.clock();
      if (!topic.exists) throw new HttpsError("not-found", "ไม่พบหัวข้อ");
      if (!member.exists) return { followed: false, serverNow: now };
      const value = member.data() as Interest;
      if (!interestIsCurrent(value, now)) {
        this.remove(tx, topic, member, stats);
        return { followed: false, serverNow: now };
      }
      if (value.expiresAt === undefined || value.lastActiveAt === undefined || now - value.lastActiveAt >= INTEREST_REFRESH_MS) {
        const activity = interestActivity(now);
        tx.update(member.ref, activity);
        tx.set(this.db.doc(`users/${uid}/followedTopics/${topicId}`), {
          topicId, followedAt: value.followedAt ?? now, ...activity,
        });
        return { followed: true, ...activity, serverNow: now };
      }
      return { followed: true, expiresAt: value.expiresAt, serverNow: now };
    }, { maxAttempts: 8 });
  }

  async expireMember(topicId: string, uid: string) {
    return this.db.runTransaction(async tx => {
      const { topic, member, stats } = await this.read(tx, topicId, uid);
      if (!member.exists || interestIsCurrent(member.data(), this.clock())) return false;
      this.remove(tx, topic, member, stats);
      return true;
    }, { maxAttempts: 8 });
  }

  async expireStale(limit = 200) {
    const stale = await this.db.collectionGroup("interests")
      .where("expiresAt", "<=", this.clock()).orderBy("expiresAt").limit(limit).get();
    let removed = 0;
    for (const member of stale.docs) {
      const path = member.ref.path.split("/");
      if (path.length !== 4 || path[0] !== "topics" || path[2] !== "interests") continue;
      if (await this.expireMember(path[1], member.id)) removed++;
    }
    return removed;
  }

  /** Bounded, resumable one-time upgrade: historical page visits were not recorded. */
  async migrateLegacyPage(limit = 200) {
    const checkpoint = this.db.doc("maintenance/interestActivityV1");
    const saved = (await checkpoint.get()).data();
    if (saved?.complete) return { initialized: 0, complete: true };
    let query = this.db.collectionGroup("interests").orderBy(FieldPath.documentId()).limit(limit);
    if (saved?.lastPath) query = query.startAfter(this.db.doc(saved.lastPath));
    const page = await query.get();
    let initialized = 0;
    for (const doc of page.docs) {
      const path = doc.ref.path.split("/");
      if (path.length !== 4 || path[0] !== "topics" || path[2] !== "interests") continue;
      const changed = await this.db.runTransaction(async tx => {
        const member = await tx.get(doc.ref);
        if (!member.exists || member.get("expiresAt") !== undefined) return false;
        const activity = interestActivity(this.clock());
        tx.update(member.ref, activity);
        tx.set(this.db.doc(`users/${member.id}/followedTopics/${path[1]}`), {
          topicId: path[1], followedAt: member.get("followedAt") ?? this.clock(), ...activity,
        });
        return true;
      });
      initialized += Number(changed);
    }
    const complete = page.size < limit;
    await checkpoint.set({ lastPath: page.docs.at(-1)?.ref.path ?? saved?.lastPath ?? null, complete, scannedAt: this.clock() });
    return { initialized, complete };
  }
}
