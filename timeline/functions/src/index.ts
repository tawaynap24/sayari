import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { ZodError } from "zod";
import { TimelineService } from "./service";
import { PresenceService } from "./presence";
import { SessionService } from "./session";
import {
  cleanupOrphans,
  finalizeUpload,
  prepareUpload,
  readMedia,
} from "./media";
initializeApp();
const db = getFirestore();
const service = new TimelineService(db);
const presence = new PresenceService(db);
const sessions = new SessionService(db);
const region = "asia-southeast1";
export const timelineSession = onCall(
  { region, enforceAppCheck: process.env.TIMELINE_ENFORCE_APP_CHECK === "true", maxInstances: 10 },
  async req => {
    if (!req.auth || req.auth.token.firebase?.sign_in_provider === "anonymous")
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบ");
    if (!req.data || req.data.action !== "renew" || Object.keys(req.data).length !== 1)
      throw new HttpsError("invalid-argument", "ข้อมูล session ไม่ถูกต้อง");
    return sessions.renew({ uid: req.auth.uid, auth_time: req.auth.token.auth_time });
  },
);
export const timelinePresence = onCall(
  { region, enforceAppCheck: process.env.TIMELINE_ENFORCE_APP_CHECK === "true", maxInstances: 10 },
  async req => {
    try {
      if (req.auth && req.data?.action !== "leave") await sessions.require({ uid: req.auth.uid, auth_time: req.auth.token.auth_time });
      const uid = req.auth && req.auth.token.firebase?.sign_in_provider !== "anonymous" ? req.auth.uid : null;
      const result = await presence.update(uid, req.data);
      await presence.expireStale();
      return result;
    } catch (error) {
      if (error instanceof ZodError) throw new HttpsError("invalid-argument", "ข้อมูลสถานะผู้ใช้งานไม่ถูกต้อง");
      throw error;
    }
  },
);
export const expireTimelinePresence = onSchedule(
  { region, schedule: "* * * * *", timeZone: "UTC", maxInstances: 1 },
  async () => { logger.info("timeline presence expiry", { expired: await presence.expireStale() }); },
);
export const timelineApi = onCall(
  {
    region,
    enforceAppCheck: process.env.TIMELINE_ENFORCE_APP_CHECK === "true",
    maxInstances: 10,
  },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบ");
    await sessions.require({ uid: req.auth.uid, auth_time: req.auth.token.auth_time });
    if (req.auth.token.firebase?.sign_in_provider === "anonymous")
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบด้วยบัญชีอีเมล");
    const actor = {
      uid: req.auth.uid,
      label:
        typeof req.auth.token.name === "string"
          ? req.auth.token.name.slice(0, 80)
          : `สมาชิก ${req.auth.uid.slice(-6)}`,
      privileged: req.auth.token.timelineModerator === true,
    };
    try {
      if (req.data?.action === "prepareUpload")
        return await prepareUpload(db, actor, req.data.data);
      if (req.data?.action === "finalizeUpload")
        return await finalizeUpload(db, actor, req.data.data);
      return await service.run(actor, req.data);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof ZodError)
        throw new HttpsError(
          "invalid-argument",
          error.issues
            .map((i) => i.message)
            .slice(0, 3)
            .join(" / "),
        );
      logger.error("timeline mutation failed", {
        action: req.data?.action,
        error,
      });
      throw new HttpsError("internal", "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }
  },
);
export const expireTimelineRequests = onSchedule(
  { region, schedule: "every 5 minutes", timeZone: "UTC", maxInstances: 1 },
  async () => {
    logger.info("timeline expiry", {
      expired: await service.expireDueRequests(),
    });
  },
);
export const cleanTimelineMedia = onSchedule(
  { region, schedule: "every 24 hours", timeZone: "UTC", maxInstances: 1 },
  async () => {
    logger.info("timeline media cleanup", {
      removed: await cleanupOrphans(db),
    });
  },
);
export const timelineMedia = onRequest(
  { region, cors: true, maxInstances: 10 },
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
    if (req.method !== "GET") {
      res.status(405).end();
      return;
    }
    try {
      let uid: string | undefined;
      const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (bearer) {
        const token = await getAuth().verifyIdToken(bearer);
        await sessions.require(token);
        uid = token.uid;
      }
      const { m } = await readMedia(db, String(req.query.id || ""), uid);
      if (m.kind === "docx") {
        res.type("application/json").send({ text: m.docText });
        return;
      }
      res.type(m.mimeType);
      res.set("Content-Disposition", "inline");
      const [bytes] = await getStorage()
        .bucket()
        .file(m.validatedPath)
        .download();
      res.send(bytes);
    } catch (error) {
      const code =
        error instanceof HttpsError && error.code === "not-found" ? 404 : 403;
      res.status(code).json({ error: "ไม่สามารถเปิดสื่อนี้ได้" });
    }
  },
);
