import { HttpsError } from "firebase-functions/v2/https";
import { Firestore } from "firebase-admin/firestore";
import { SESSION_MAX_AGE_MS, sessionIsCurrent } from "./domain/session";

interface SessionToken { uid: string; auth_time?: unknown }
function expired(): never {
  throw new HttpsError("unauthenticated", "session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
}
export class SessionService {
  constructor(readonly db: Firestore, readonly clock: () => number = Date.now) {}
  ref(token: SessionToken) {
    if (typeof token.auth_time !== "number" || !Number.isSafeInteger(token.auth_time) || token.auth_time < 0) expired();
    return this.db.doc(`users/${token.uid}/authSessions/${token.auth_time}`);
  }
  async renew(token: SessionToken) {
    const ref = this.ref(token);
    return this.db.runTransaction(async tx => {
      const now = this.clock();
      const snapshot = await tx.get(ref);
      // Once a stored lease has expired, refreshing an old Firebase token must
      // not reopen it. A new password login supplies a fresh auth_time instead.
      if (snapshot.exists ? snapshot.get("expiresAt") <= now : !sessionIsCurrent(token.auth_time, now)) expired();
      const expiresAt = Math.max(now + SESSION_MAX_AGE_MS, snapshot.get("expiresAt") || 0);
      tx.set(ref, { authTime: token.auth_time, lastSeenAt: now, expiresAt });
      return { expiresAt, serverNow: now };
    });
  }
  async require(token: SessionToken) {
    const snapshot = await this.ref(token).get();
    if (!snapshot.exists || snapshot.get("expiresAt") <= this.clock()) expired();
  }
}
