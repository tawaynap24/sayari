import { browserLocalPersistence, onIdTokenChanged, setPersistence, signOut, type Auth, type User } from "firebase/auth";
import { doc, onSnapshot, type Firestore } from "firebase/firestore";
import { httpsCallable, type Functions } from "firebase/functions";
import { sessionDeadline } from "../../../functions/src/domain/session";
import { rememberLoginEmail } from "./loginMemory";

interface AuthState { user: User | null; ready: boolean }
interface Lease { uid: string; authTime: number; expiresAt: number }
const CACHE_KEY = "timeline.session";
const FATAL_CODES = new Set(["functions/unauthenticated", "auth/user-token-expired", "auth/invalid-user-token", "auth/user-disabled", "auth/user-not-found"]);

export function createAuthSession(auth: Auth, db: Firestore, functions: Functions) {
  let snapshot: AuthState = { user: null, ready: false };
  const listeners = new Set<() => void>();
  let generation = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let lease: Lease | null = null, disposed = false, lastRenewedAt = 0;
  let authOff: (() => void) | undefined, leaseOff: (() => void) | undefined;
  let renewing: Promise<void> | null = null;
  const ready = setPersistence(auth, browserLocalPersistence);
  const renewCall = httpsCallable<{ action: string }, { expiresAt: number }>(functions, "timelineSession", { timeout: 15_000 });
  function publish(user: User | null) {
    if (user) rememberLoginEmail(user.email);
    snapshot = { user, ready: true };
    for (const listener of listeners) listener();
  }
  function cached(uid: string, authTime: number): Lease | null {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as Lease | null;
      return value?.uid === uid && value.authTime === authTime && Number.isSafeInteger(value.expiresAt) ? value : null;
    } catch { return null; }
  }
  function apply(value: Lease) {
    lease = value;
    clearTimeout(timer);
    timer = setTimeout(checkExpiry, Math.max(0, value.expiresAt - Date.now()));
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* Firebase reports unsupported persistence at login. */ }
  }
  function reset() {
    clearTimeout(timer); leaseOff?.(); leaseOff = undefined; lease = null;
  }
  function expire() {
    generation++; reset();
    try { localStorage.removeItem(CACHE_KEY); } catch { /* Storage may be unavailable. */ }
    publish(null);
    void signOut(auth).catch(() => {});
  }
  function checkExpiry() {
    if (!lease || auth.currentUser?.uid !== lease.uid) return;
    const shared = cached(lease.uid, lease.authTime);
    if (shared && shared.expiresAt > lease.expiresAt) apply(shared);
    if (lease && Date.now() >= lease.expiresAt) expire();
  }
  async function renewCurrent() {
    if (renewing) return renewing;
    const current = lease;
    if (!current || auth.currentUser?.uid !== current.uid) return;
    const version = generation;
    renewing = (async () => {
      try {
        const { data } = await renewCall({ action: "renew" });
        if (disposed || version !== generation || auth.currentUser?.uid !== current.uid) return;
        apply({ ...current, expiresAt: data.expiresAt });
        lastRenewedAt = Date.now();
      } catch (error) {
        if (version === generation && FATAL_CODES.has((error as { code?: string }).code || "")) expire();
        else checkExpiry();
      }
    })().finally(() => { renewing = null; });
    return renewing;
  }
  async function restore(user: User | null) {
    const version = ++generation;
    if (!user) {
      reset();
      try { localStorage.removeItem(CACHE_KEY); } catch { /* No storage. */ }
      publish(null); return;
    }
    let authTime: unknown;
    try { authTime = (await user.getIdTokenResult()).claims.auth_time; }
    catch (error) {
      if (FATAL_CODES.has((error as { code?: string }).code || "")) { if (version === generation) expire(); return; }
      const saved = Date.parse(user.metadata.lastSignInTime || "");
      authTime = Number.isFinite(saved) ? Math.floor(saved / 1000) : undefined;
    }
    if (disposed || version !== generation || auth.currentUser?.uid !== user.uid) return;
    if (typeof authTime !== "number" || !Number.isSafeInteger(authTime)) { expire(); return; }
    // An hourly Firebase token refresh is not a new visit and must not extend
    // the idle lease. Page entry/focus/interaction explicitly renew it instead.
    if (lease?.uid === user.uid && lease.authTime === authTime) { checkExpiry(); return; }
    reset();
    const stored = cached(user.uid, authTime);
    let expiresAt: number;
    try {
      expiresAt = (await renewCall({ action: "renew" })).data.expiresAt;
      lastRenewedAt = Date.now();
    } catch (error) {
      if (disposed || version !== generation) return;
      if (FATAL_CODES.has((error as { code?: string }).code || "")) { expire(); return; }
      const fallback = stored?.expiresAt ?? sessionDeadline(authTime);
      if (fallback === null || fallback <= Date.now()) { expire(); return; }
      expiresAt = fallback;
    }
    if (disposed || version !== generation || auth.currentUser?.uid !== user.uid) return;
    apply({ uid: user.uid, authTime, expiresAt });
    publish(user);
    leaseOff = onSnapshot(doc(db, `users/${user.uid}/authSessions/${authTime}`), s => {
      if (disposed || !lease || lease.uid !== user.uid || lease.authTime !== authTime) return;
      if (s.metadata.fromCache) return;
      if (!s.exists()) { expire(); return; }
      const deadline = s.get("expiresAt");
      if (Number.isSafeInteger(deadline)) {
        if (deadline <= Date.now()) expire();
        else if (deadline !== lease.expiresAt) apply({ ...lease, expiresAt: deadline });
      }
    }, () => { /* A transient listener failure does not destroy a valid cached login. */ });
  }
  function returned() {
    checkExpiry();
    if (document.visibilityState === "visible") void renewCurrent();
  }
  function visibility() { if (document.visibilityState === "visible") returned(); }
  function activity() { if (Date.now() - lastRenewedAt >= 60_000) returned(); }
  function storage(event: StorageEvent) {
    if (event.key !== CACHE_KEY || !lease) return;
    if (event.newValue === null) { expire(); return; }
    const shared = cached(lease.uid, lease.authTime);
    if (shared) { apply(shared); checkExpiry(); }
  }
  void ready.then(() => {
    if (!disposed) authOff = onIdTokenChanged(auth, user => { void restore(user).catch(() => { if (!disposed) publish(null); }); });
  }).catch(() => { if (!disposed) publish(null); });
  window.addEventListener("focus", returned);
  window.addEventListener("pageshow", returned);
  window.addEventListener("online", returned);
  window.addEventListener("storage", storage);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("pointerdown", activity, { passive: true });
  document.addEventListener("keydown", activity);
  return {
    ready,
    async completeSignIn(user: User) {
      await ready;
      // Firebase creates an authenticated account immediately, while restoring
      // this site's lease finishes asynchronously. Keep the form open until
      // subscribers can actually use the authenticated session.
      await new Promise<void>((resolve, reject) => {
        function finish(error?: Error) {
          clearTimeout(timeout);
          listeners.delete(check);
          if (error) reject(error); else resolve();
        }
        function check() {
          if (disposed || auth.currentUser?.uid !== user.uid) {
            finish(new Error("เข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง"));
          } else if (snapshot.ready && snapshot.user?.uid === user.uid) finish();
        }
        const timeout = setTimeout(() => finish(new Error("การเชื่อมต่อระบบเข้าสู่ระบบใช้เวลานาน กรุณาลองเข้าสู่ระบบอีกครั้ง")), 25_000);
        listeners.add(check);
        check();
      });
      if (disposed || auth.currentUser?.uid !== user.uid) throw new Error("เข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง");
      // Refresh subscribers after the registration display name was saved.
      publish(user);
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    dispose() {
      disposed = true; generation++; reset(); authOff?.(); listeners.clear();
      window.removeEventListener("focus", returned);
      window.removeEventListener("pageshow", returned);
      window.removeEventListener("online", returned);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", activity);
      document.removeEventListener("keydown", activity);
    },
  };
}
