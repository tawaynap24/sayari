import { z } from "zod";
import type { Content, TimeSpec } from "./types";
import { comparePositions, resolveTimes } from "./time";
export const MAX_BYTES = 5_000_000;
export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,100}$/, "รหัสไม่ถูกต้อง");
const text = (max: number) => z.string().trim().max(max, "ข้อความยาวเกินกำหนด");
export function safeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|0\.|\[|169\.254\.)/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export function embedUrl(value: string): string | null {
  if (!safeUrl(value)) return null;
  const u = new URL(value);
  const youtube = [
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
  ];
  if (youtube.includes(u.hostname)) {
    const id =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") || u.pathname.split("/").at(-1);
    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }
  if (
    ["vimeo.com", "www.vimeo.com"].includes(u.hostname) &&
    /^\/\d+$/.test(u.pathname)
  )
    return `https://player.vimeo.com/video${u.pathname}`;
  return null;
}
const url = text(2000).refine(
  (v) => !v || safeUrl(v),
  "ใช้ลิงก์ HTTPS ที่ถูกต้องเท่านั้น",
);
const unit = z.enum(["year", "month", "day", "hour", "minute"]);
const coord = z
  .object({
    year: z
      .string()
      .regex(/^-?\d{1,60}$/)
      .optional(),
    month: z.number().int().min(1).max(10000).optional(),
    day: z.number().int().min(1).max(10000).optional(),
    hour: z.number().int().min(0).max(10000).optional(),
    minute: z.number().int().min(0).max(10000).optional(),
    eraId: text(100).optional(),
    precision: z.enum([
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "era",
      "unknown",
    ]),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (
      c.precision === "unknown" ||
      (c.precision === "era" ? !c.eraId : c[c.precision] === undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "กรุณาระบุเวลาตามความละเอียดที่เลือก",
      });
    const sequence = ["year", "month", "day", "hour", "minute"] as const;
    for (let i = 1; i < sequence.length; i++)
      if (c[sequence[i]] !== undefined && c[sequence[i - 1]] === undefined)
        ctx.addIssue({
          code: "custom",
          message: "กรุณาระบุหน่วยเวลาก่อนหน้าให้ครบ",
        });
    const precisionIndex = sequence.indexOf(
      c.precision as (typeof sequence)[number],
    );
    if (
      precisionIndex >= 0 &&
      sequence.slice(precisionIndex + 1).some((u) => c[u] !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "หน่วยเวลาละเอียดกว่าความละเอียดที่ระบุ",
      });
  });
export const timeSchema: z.ZodType<TimeSpec> = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("exact"), at: coord }).strict(),
    z
      .object({
        type: z.literal("approximate"),
        around: coord,
        noteTh: text(500).optional(),
      })
      .strict(),
    z.object({ type: z.literal("range"), from: coord, to: coord }).strict(),
    z
      .object({
        type: z.literal("relative"),
        anchorEventId: idSchema,
        relation: z.enum(["before", "after", "same_time", "during"]),
        offset: z
          .object({
            amount: z.string().regex(/^\d{1,60}$/),
            unit,
            approximate: z.boolean().optional(),
          })
          .strict()
          .optional(),
        noteTh: text(500).optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("unknown"),
        noteTh: text(500).optional(),
        eraId: text(100).optional(),
      })
      .strict(),
  ])
  .superRefine((t, ctx) => {
    if (
      t.type === "relative" &&
      t.offset &&
      ["same_time", "during"].includes(t.relation)
    )
      ctx.addIssue({
        code: "custom",
        message: "พร้อมกันหรือระหว่างไม่ใช้ระยะห่าง",
      });
    if (t.type === "range") {
      const ps = resolveTimes(
        [
          {
            id: "a",
            time: { type: "exact", at: t.from },
            titleTh: "",
            addedAt: 0,
          },
          {
            id: "b",
            time: { type: "exact", at: t.to },
            titleTh: "",
            addedAt: 0,
          },
        ],
        { id: "validation" },
      );
      if (comparePositions(ps.get("a")!, ps.get("b")!) > 0)
        ctx.addIssue({
          code: "custom",
          message: "เวลาเริ่มต้องไม่อยู่หลังเวลาสิ้นสุด",
        });
    }
  });
export const contentSchema: z.ZodType<Content> = z
  .object({
    titleTh: text(180).min(1, "กรุณาระบุชื่อเรื่อง"),
    summaryTh: text(1000),
    bodyTh: text(50000).min(1, "กรุณาระบุเนื้อเรื่อง"),
    time: timeSchema,
    namedEntityIds: z
      .array(idSchema)
      .max(30)
      .refine((a) => new Set(a).size === a.length, "ชื่อเฉพาะซ้ำ"),
    sources: z
      .array(
        z
          .object({
            id: idSchema,
            kind: z.enum([
              "main_story",
              "character_story",
              "side_quest",
              "in_game_quest",
              "dialogue",
              "item",
              "web",
              "video",
              "document",
              "other",
            ]),
            title: text(300).min(1),
            originTh: text(1000).optional(),
            url: url.optional(),
            chapter: text(300).optional(),
            quest: text(300).optional(),
            gameVersion: text(100).optional(),
            timestampInVideo: text(100).optional(),
            noteTh: text(1000).optional(),
          })
          .strict()
          .superRefine((source, ctx) => {
            if (source.kind === "other" && !source.originTh)
              ctx.addIssue({ code: "custom", path: ["originTh"], message: "กรุณาระบุว่าแหล่งอ้างอิงมาจากไหน" });
          }),
      )
      .max(30),
    media: z
      .array(
        z
          .object({
            id: idSchema,
            kind: z.enum(["image", "video", "pdf", "docx"]),
            url: url.optional(),
            altTextTh: text(500).optional(),
            sourceUrl: url.optional(),
            cover: z.boolean().optional(),
          })
          .strict()
          .superRefine((m, ctx) => {
            if (m.kind === "video" && (!m.url || !embedUrl(m.url)))
              ctx.addIssue({
                code: "custom",
                message: "วิดีโอรองรับลิงก์ YouTube หรือ Vimeo เท่านั้น",
              });
            if ((m.kind === "pdf" || m.kind === "docx") && m.url)
              ctx.addIssue({
                code: "custom",
                message: "เอกสารต้องอัปโหลดเพื่อตรวจสอบก่อน",
              });
          }),
      )
      .max(20)
      .refine(
        (ms) =>
          new Set(ms.map((m) => m.id)).size === ms.length &&
          ms.filter((m) => m.cover).length <= 1 &&
          ms.every((m) => !m.cover || m.kind === "image"),
        "สื่อซ้ำหรือภาพปกไม่ถูกต้อง",
      ),
    gameVersion: text(100),
    locale: text(30),
  })
  .strict();
export const entitySchema = z
  .object({
    topicId: idSchema,
    kind: z.enum(["character", "place", "organization", "faction", "other"]),
    names: z
      .record(z.string().max(30), text(200).min(1))
      .refine(
        (n) => !!n["th-TH"] && Object.keys(n).length <= 10,
        "ต้องมีชื่อภาษาไทย",
      ),
    aliases: z
      .record(z.string().max(30), z.array(text(200)).max(20))
      .refine((a) => Object.keys(a).length <= 10),
  })
  .strict();
