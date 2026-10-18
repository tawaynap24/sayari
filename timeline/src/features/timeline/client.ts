import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { createAuthSession } from "./sessionController";
const env = import.meta.env;
export const emulated =
  env.VITE_FIREBASE_EMULATORS === "true" ||
  (env.DEV && !env.VITE_FIREBASE_API_KEY);
export const configured =
  emulated ||
  !!(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID &&
    env.VITE_FIREBASE_STORAGE_BUCKET
  );
const projectId = emulated
  ? "demo-timeline"
  : env.VITE_FIREBASE_PROJECT_ID;
const app = initializeApp(
  {
    apiKey: emulated
      ? "demo-api-key"
      : env.VITE_FIREBASE_API_KEY || "unconfigured",
    projectId: projectId || "unconfigured",
    authDomain: emulated
      ? "demo-timeline.firebaseapp.com"
      : env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: emulated
      ? "demo-timeline.appspot.com"
      : env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: emulated ? "demo-timeline" : env.VITE_FIREBASE_APP_ID,
  },
  "timeline",
);
export const auth = getAuth(app),
  db = getFirestore(app),
  functions = getFunctions(app, "asia-southeast1"),
  storage = getStorage(app);
if (emulated) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
export const authSession = createAuthSession(auth, db, functions);
if (import.meta.hot) import.meta.hot.dispose(() => authSession.dispose());
export const appCheck = !emulated && env.VITE_FIREBASE_APPCHECK_SITE_KEY
  ? initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.VITE_FIREBASE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  }) : null;
export async function api<T = Record<string, unknown>>(
  action: string,
  data: unknown,
  operationId = crypto.randomUUID(),
): Promise<T> {
  const fn = httpsCallable(functions, "timelineApi");
  return (await fn({ action, data, operationId })).data as T;
}
export const mediaEndpoint = emulated
  ? "http://127.0.0.1:5001/demo-timeline/asia-southeast1/timelineMedia"
  : `https://asia-southeast1-${projectId}.cloudfunctions.net/timelineMedia`;
export const presenceEndpoint = emulated
  ? "http://127.0.0.1:5001/demo-timeline/asia-southeast1/timelinePresence"
  : `https://asia-southeast1-${projectId}.cloudfunctions.net/timelinePresence`;
export function errorText(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const messages: Record<string, string> = {
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/email-already-in-use": "อีเมลนี้มีบัญชีแล้ว",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/network-request-failed": "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้",
    "auth/too-many-requests": "ลองหลายครั้งเกินไป กรุณารอสักครู่",
    "auth/web-storage-unsupported": "เบราว์เซอร์ไม่อนุญาตให้จดจำบัญชี กรุณาเปิดการใช้พื้นที่จัดเก็บของเว็บไซต์",
    "auth/unsupported-persistence-type": "เบราว์เซอร์นี้ไม่รองรับการจดจำบัญชี",
    "permission-denied": "คุณไม่มีสิทธิ์อ่านข้อมูลนี้",
    unavailable: "เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่",
    "functions/unavailable": "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่",
  };
  return messages[e.code || ""] || e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
