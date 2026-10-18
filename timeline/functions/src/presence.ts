import { createHash } from "node:crypto";
import { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

export const PRESENCE_LEASE_MS = 120_000;
const MAX_CONNECTIONS = 64;
const MAX_BROWSERS = 256;
export const presenceInput = z.object({
  visitorKey: z.string().regex(/^[a-f0-9]{64}$/),
  connectionId: z.string().uuid(),
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  action: z.enum(["heartbeat", "leave"]),
}).strict();
interface Connection {
  personKey: string;
  expiresAt: number;
  sequence: number;
  closed: boolean;
}
interface Visitor {
  connections: Record<string, Connection>;
  identityKeys: string[];
  expiresAt: number;
}
interface Person { leases: Record<string, number>; signedIn: boolean }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

// Guests are deduplicated per browser. A signed-in browser suppresses its old
// guest tabs, and the same account on several browsers contributes one person.
export function presenceContributions(connections: Record<string, Connection>, now: number) {
  const live = Object.values(connections).filter(c => !c.closed && c.expiresAt > now);
  const members = live.filter(c => c.personKey.startsWith("m_"));
  const result: Record<string, number> = {};
  for (const c of members.length ? members : live)
    result[c.personKey] = Math.max(result[c.personKey] || 0, c.expiresAt);
  return result;
}

export class PresenceService {
  constructor(readonly db: Firestore, readonly clock: () => number = Date.now, readonly prefix = "") {}

  async update(uid: string | null, input: unknown) {
    const data = presenceInput.parse(input);
    const visitorHash = digest(data.visitorKey);
    await this.reconcile(visitorHash, { ...data, personKey: uid ? `m_${digest(uid)}` : `g_${visitorHash}` });
    return { ok: true, leaseMs: PRESENCE_LEASE_MS };
  }

  private async reconcile(visitorHash: string, update?: z.infer<typeof presenceInput> & { personKey: string }) {
    return this.db.runTransaction(async tx => {
      const now = this.clock();
      const visitorRef = this.db.doc(`${this.prefix}presenceVisitors/${visitorHash}`);
      const snapshot = await tx.get(visitorRef);
      const previous = snapshot.data() as Visitor | undefined;
      if (!update && (!previous || previous.expiresAt > now)) return false;
      const connections: Record<string, Connection> = { ...previous?.connections };
      // Retain a closed connection for one lease so a delayed heartbeat cannot
      // resurrect a tab after its pagehide/leave request has already arrived.
      const oldConnection = update ? connections[update.connectionId] : undefined;
      if (update && oldConnection && (update.sequence <= oldConnection.sequence || oldConnection.closed)) return false;
      for (const [key, c] of Object.entries(connections))
        if (c.expiresAt <= now) delete connections[key];
      if (update) {
        if (!connections[update.connectionId] && Object.keys(connections).length >= MAX_CONNECTIONS)
          throw new HttpsError("resource-exhausted", "เปิดหน้าเว็บพร้อมกันมากเกินไป");
        connections[update.connectionId] = {
          personKey: update.personKey,
          sequence: update.sequence,
          closed: update.action === "leave",
          expiresAt: now + PRESENCE_LEASE_MS,
        };
      }
      const contributions = presenceContributions(connections, now);
      const keys = [...new Set([...(previous?.identityKeys || []), ...Object.keys(contributions)])].sort();
      const people = keys.length ? await tx.getAll(...keys.map(key => this.db.doc(`${this.prefix}presencePeople/${key}`))) : [];
      let totalDelta = 0, memberDelta = 0;
      const nextPeople = people.map((person, i) => {
        const value = person.data() as Person | undefined;
        const leases = Object.fromEntries(Object.entries(value?.leases || {}).filter(([browser, until]) => browser !== visitorHash && until > now));
        if (contributions[keys[i]]) leases[visitorHash] = contributions[keys[i]];
        if (Object.keys(leases).length > MAX_BROWSERS)
          throw new HttpsError("resource-exhausted", "มีอุปกรณ์เชื่อมต่อบัญชีนี้มากเกินไป");
        const signedIn = keys[i].startsWith("m_");
        const delta = Number(Object.keys(leases).length > 0) - Number(person.exists);
        totalDelta += delta;
        if (signedIn) memberDelta += delta;
        return { ref: person.ref, leases, signedIn };
      });
      const statsRef = this.db.doc(`${this.prefix}siteStats/online`);
      const stats = totalDelta || memberDelta ? await tx.get(statsRef) : null;
      // All reads precede writes, including on retries and account switches.
      for (const p of nextPeople) {
        if (Object.keys(p.leases).length) tx.set(p.ref, { leases: p.leases, signedIn: p.signedIn });
        else tx.delete(p.ref);
      }
      if (Object.keys(connections).length)
        tx.set(visitorRef, { connections, identityKeys: Object.keys(contributions), expiresAt: Math.min(...Object.values(connections).map(c => c.expiresAt)) });
      else tx.delete(visitorRef);
      if (stats) {
        const total = (stats.get("total") || 0) + totalDelta;
        const signedIn = (stats.get("signedIn") || 0) + memberDelta;
        if (total < 0 || signedIn < 0 || signedIn > total) throw Error("Invalid presence counters");
        tx.set(statsRef, { total, signedIn, updatedAt: now });
      }
      return true;
    }, { maxAttempts: 20 });
  }

  async expireStale(limit = 100) {
    const stale = await this.db.collection(`${this.prefix}presenceVisitors`).where("expiresAt", "<=", this.clock()).limit(limit).get();
    let expired = 0;
    for (const visitor of stale.docs) if (await this.reconcile(visitor.id)) expired++;
    return expired;
  }
}
