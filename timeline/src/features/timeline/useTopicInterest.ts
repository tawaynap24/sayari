import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { INTEREST_REFRESH_MS, interestIsCurrent, type Interest } from "../../../functions/src/domain/interest";
import { configured, functions } from "./client";
import { useDoc } from "./hooks";

/** Visiting this topic while visible renews only its existing membership. */
export function useTopicInterest(topicId: string | undefined, user: User | null) {
  const uid = user?.uid;
  const membership = useDoc<Interest>(uid && topicId ? `topics/${topicId}/interests/${uid}` : null);
  const exists = !!membership.value;
  const [clock, setClock] = useState({ now: Date.now(), offset: 0 });
  useEffect(() => {
    if (!configured || !uid || !topicId || !exists) return;
    let disposed = false, inFlight = false, lastSuccess = 0;
    const visit = httpsCallable<{ topicId: string }, { followed: boolean; serverNow: number }>(functions, "timelineTopicActivity", { timeout: 15_000 });
    async function recordVisit() {
      if (disposed || inFlight || document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastSuccess < 60_000) return;
      inFlight = true;
      try {
        const { data } = await visit({ topicId: topicId! });
        if (!disposed) {
          lastSuccess = Date.now();
          setClock({ now: data.serverNow, offset: data.serverNow - Date.now() });
        }
      } catch {
        // A failed/offline request cannot extend the server's membership lease.
        // Retry on the next foreground heartbeat or reconnection.
      } finally { inFlight = false; }
    }
    void recordVisit();
    const timer = window.setInterval(() => void recordVisit(), INTEREST_REFRESH_MS);
    window.addEventListener("focus", recordVisit);
    window.addEventListener("pageshow", recordVisit);
    window.addEventListener("online", recordVisit);
    document.addEventListener("visibilitychange", recordVisit);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", recordVisit);
      window.removeEventListener("pageshow", recordVisit);
      window.removeEventListener("online", recordVisit);
      document.removeEventListener("visibilitychange", recordVisit);
    };
  }, [uid, topicId, exists]);

  const expiresAt = membership.value?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return;
    const timer = window.setTimeout(() => setClock(c => ({ ...c, now: Date.now() + c.offset })), Math.max(0, expiresAt - Date.now() - clock.offset));
    return () => window.clearTimeout(timer);
  }, [expiresAt, clock.offset]);
  return { ...membership, followed: interestIsCurrent(membership.value, Math.max(clock.now, Date.now() + clock.offset)) };
}
