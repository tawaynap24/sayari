import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { getToken } from "firebase/app-check";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { appCheck, configured, db, functions, presenceEndpoint } from "./client";

interface Counts { signedIn: number; total: number }
let memoryVisitorKey: string | undefined;
function visitorKey() {
  if (memoryVisitorKey) return memoryVisitorKey;
  try {
    const stored = localStorage.getItem("timeline.visitor");
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return memoryVisitorKey = stored;
  } catch { /* Private/storage-disabled browsers use an in-memory identity. */ }
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem("timeline.visitor", key); } catch { /* Memory fallback. */ }
  return memoryVisitorKey = key;
}

export default function OnlinePresence({ user, authReady }: { user: User | null; authReady: boolean }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverSnapshot, setServerSnapshot] = useState(false);
  useEffect(() => {
    if (!configured) return;
    return onSnapshot(doc(db, "siteStats/online"), { includeMetadataChanges: true }, snapshot => {
      setServerSnapshot(!snapshot.metadata.fromCache);
      const data = snapshot.data();
      setCounts(data && Number.isInteger(data.total) && Number.isInteger(data.signedIn) ? data as Counts : null);
    }, () => { setServerSnapshot(false); });
  }, []);

  useEffect(() => {
    if (!configured || !authReady) return;
    let key: string | undefined;
    const keyPromise = (navigator.locks ? navigator.locks.request("timeline.visitor", () => visitorKey()) : Promise.resolve(visitorKey())).then(value => { key = value; return value; });
    let connectionId = crypto.randomUUID(), sequence = 0;
    let disposed = false, paused = false, inFlight = false, again = false;
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    const call = httpsCallable(functions, "timelinePresence", { timeout: 15_000 });
    setConnected(false);
    async function heartbeat() {
      if (disposed || paused || !navigator.onLine) return;
      if (inFlight) { again = true; return; }
      inFlight = true;
      const id = connectionId;
      const requestSequence = ++sequence;
      try {
        const visitor = await keyPromise;
        const token = user ? await user.getIdToken() : null;
        const appToken = appCheck ? (await getToken(appCheck)).token : null;
        if (disposed || paused || id !== connectionId) return;
        headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(appToken ? { "X-Firebase-AppCheck": appToken } : {}),
        };
        await call({ visitorKey: visitor, connectionId: id, sequence: requestSequence, action: "heartbeat" });
        if (!disposed && !paused && id === connectionId) setConnected(true);
      } catch {
        if (!disposed) setConnected(false);
      } finally {
        inFlight = false;
        if (again) { again = false; void heartbeat(); }
      }
    }
    function leave() {
      if (paused) return;
      paused = true;
      setConnected(false);
      if (!key) return;
      // The callable wire protocol lets pagehide use keepalive, including Auth
      // and App Check tokens. Expiry is the fallback if the network is gone.
      void fetch(presenceEndpoint, {
        method: "POST", headers, keepalive: true,
        body: JSON.stringify({ data: { visitorKey: key, connectionId, sequence: ++sequence, action: "leave" } }),
      }).catch(() => {});
    }
    function restore() {
      if (paused) { connectionId = crypto.randomUUID(); sequence = 0; paused = false; }
      void heartbeat();
    }
    function visibility() { if (document.visibilityState === "visible") void heartbeat(); }
    function offline() { setConnected(false); }
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 30_000);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    window.addEventListener("online", restore);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      leave(); disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("online", restore);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [user, authReady]);

  const live = configured && connected && serverSnapshot && counts !== null;
  const number = (value: number | undefined) => live && value !== undefined ? value.toLocaleString("th-TH") : "—";
  return (
    <div className="tl-presence" role="group" aria-label="ผู้ใช้ออนไลน์" title={live ? "ผู้ที่กำลังใช้งาน Timeline" : "กำลังเชื่อมต่อสถานะออนไลน์"} data-presence-status={live ? "live" : "connecting"}>
      <span className="tl-presence-dot" aria-hidden="true" />
      <span className="tl-presence-stat"><span>เข้าสู่ระบบ</span><strong data-online-members>{number(counts?.signedIn)} <small>คน</small></strong></span>
      <span className="tl-presence-stat"><span>ออนไลน์ทั้งหมด</span><strong data-online-total>{number(counts?.total)} <small>คน</small></strong></span>
    </div>
  );
}
