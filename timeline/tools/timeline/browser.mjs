import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { cleanupTopicFixtures } from "./fixtures.mjs";
await fs.mkdir("evidence/timeline", { recursive: true });
const require = createRequire(
  new URL("../../functions/package.json", import.meta.url),
);
const { initializeApp } = require("firebase-admin/app"),
  { getFirestore } = require("firebase-admin/firestore"),
  { getAuth } = require("firebase-admin/auth"),
  { getStorage } = require("firebase-admin/storage"),
  { TimelineService } = require("./lib/service.js");
Object.assign(process.env, {
  GCLOUD_PROJECT: "demo-timeline",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
});
initializeApp({ projectId: "demo-timeline", storageBucket: "demo-timeline.appspot.com" });
const db = getFirestore(),
  svc = new TimelineService(db);
const runId = Date.now().toString(36),
  topicId = `browser-${runId}`,
  emptyTopicId = `browser-${runId}empty`,
  owner = {
    uid: `browser_owner_${runId}`,
    label: "ผู้เขียนทดสอบ",
    privileged: false,
  };
const act = (i) => ({
  uid: i === 0 ? owner.uid : `browser_v${i}_${runId}`,
  label: `ผู้โหวตทดสอบ ${i}`,
  privileged: false,
});
const call = (a, action, data) =>
  svc.run(a, { action, data, operationId: randomUUID() });
const body =
  "เรื่องราวสังเคราะห์สำหรับทดสอบ Timeline ใน Emulator เท่านั้น ไม่ใช่เนื้อหาอย่างเป็นทางการ";
const base = {
  titleTh: "เรื่องทดสอบที่เผยแพร่แล้ว",
  summaryTh: "ข้อมูลทดสอบ",
  bodyTh: body,
  time: { type: "exact", at: { year: "10", precision: "year" } },
  namedEntityIds: [],
  sources: [],
  media: [],
  gameVersion: "test",
  locale: "th-TH",
};
const voterEmail = `voter-${runId}@example.test`,
  password = "Test-only-12345";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: false,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174",
  url = `${origin}/timeline/${topicId}`;
const results = [],
  errors = [],
  downloads = [],
  guestQueries = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("download", (d) => downloads.push(d.suggestedFilename()));
let guest = true;
page.on("request", (r) => {
  if (
    guest &&
    /firestore/.test(r.url()) &&
    /requests|interests|topicStats/.test(r.postData() || "")
  )
    guestQueries.push(r.postData());
});
async function run(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: "PASS", ms: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.stack });
    console.error(`FAIL ${name}: ${e.message}`);
    await page
      .screenshot({
        path: `evidence/timeline/browser-fail-${results.length}.png`,
        fullPage: true,
      })
      .catch(() => {});
  }
  await fs.writeFile(
    "evidence/timeline/browser.json",
    JSON.stringify(
      { runId, topicId, origin, results, errors, downloads, guestQueries },
      null,
      2,
    ),
  );
}
const present = async (text) =>
  page.getByText(text, { exact: true }).first().waitFor();
const absent = async (locator) => assert.equal(await locator.count(), 0);
const capture = (name) => page.screenshot({
  path: `evidence/timeline/${name}.png`,
  fullPage: true,
});
async function close() {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ปิด", exact: true })
    .click();
}
async function sendForm() {
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).click();
  await d.getByRole("button", { name: "ส่งเรื่องราว", exact: true }).click();
  await d.waitFor({ state: "hidden" });
}
let memberUid, pendingId;
try {
  await db.doc(`topics/${topicId}`).set({
    id: topicId,
    slug: topicId,
    categoryId: "test",
    displayNames: { "th-TH": "หัวข้อทดสอบ Browser" },
    descriptionTh: "SYNTHETIC — Emulator only",
    calendar: { id: "browser-symbolic" },
    publishedCount: 0,
  });
  await db.doc(`topicStats/${topicId}`).set({ interestCount: 49, graphVersion: 0 });
  await db.doc(`topics/${emptyTopicId}`).set({
    id: emptyTopicId, slug: emptyTopicId, categoryId: "test",
    displayNames: { "th-TH": "หัวข้อทดสอบว่าง" }, descriptionTh: "SYNTHETIC — Emulator only",
    calendar: { id: "browser-symbolic" }, publishedCount: 0,
  });
  await db.doc(`topicStats/${emptyTopicId}`).set({ interestCount: 0, graphVersion: 0 });
  const batch = db.batch();
  for (let i = 0; i < 49; i++)
    batch.set(db.doc(`topics/${topicId}/interests/${act(i).uid}`), {
      uid: act(i).uid,
      followedAt: Date.now(),
    });
  await batch.commit();
  await call(owner, "createStory", { topicId, content: base });
  for (let i = 1; i <= 4; i++)
    await call(owner, "createStory", {
      topicId,
      content: { ...base, titleTh: `เรื่องทดสอบร่วมเวลา ${i}` },
    });
  await call(owner, "createStory", {
    topicId,
    content: {
      ...base,
      titleTh: "เรื่องทดสอบปี 20",
      time: { type: "exact", at: { year: "20", precision: "year" } },
    },
  });
  await getAuth().createUser({
    uid: act(1).uid,
    email: voterEmail,
    password,
    displayName: act(1).label,
  });
  await run(
    "guest deep link: public content, no follow count/write/request query",
    async () => {
      await page.goto(url);
      await page.locator(".tl-story-title").first().waitFor();
      await absent(page.getByRole("switch"));
      await absent(
        page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }),
      );
      await absent(page.getByText(/ผู้สนใจ .* บัญชี/));
      assert.equal(guestQueries.length, 0);
      await page.screenshot({
        path: "evidence/timeline/guest-desktop.png",
        fullPage: true,
      });
    },
  );
  await run(
    "same-time grouping, newest3+N preview and marker selects every story",
    async () => {
      const marker = page.locator(".tl-marker").filter({ hasText: "5" });
      await marker.focus();
      await present("เรื่องราวล่าสุด ณ จุดนี้");
      assert.equal(await page.locator(".tl-tooltip li").count(), 3);
      await present("+2 เรื่องราว");
      await capture("marker-hover");
      await marker.click();
      assert.equal(await page.locator(".tl-story").count(), 5);
      await page
        .getByRole("button", { name: "แสดงทุกเรื่องราว", exact: true })
        .click();
    },
  );
  await run(
    "equal/time modes, keyboard pan, zoom/clusters and fit",
    async () => {
      await page
        .getByRole("button", { name: "ระยะตามเวลา", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "ระยะตามเวลา", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.ok(
        (await page.locator(".tl-delta").allTextContents()).includes("10 ปี"),
      );
      const axis = page.locator(".tl-axis");
      await axis.focus();
      const before = await page
        .locator(".tl-marker-wrap")
        .first()
        .getAttribute("style");
      await page.keyboard.press("ArrowRight");
      assert.notEqual(
        await page.locator(".tl-marker-wrap").first().getAttribute("style"),
        before,
      );
      for (let i = 0; i < 8; i++)
        await page.getByRole("button", { name: "ซูมออก", exact: true }).click();
      assert.equal(await page.locator(".tl-marker").count(), 1);
      await capture("time-scale-cluster");
      for (let i = 0; i < 8; i++)
        await page
          .getByRole("button", { name: "ซูมเข้า", exact: true })
          .click();
      await page.getByRole("button", { name: "พอดีจอ", exact: true }).click();
      assert.ok((await page.locator(".tl-marker").count()) >= 2);
    },
  );
  await run(
    "real registration gates signed nonfollower, explicit follow persists",
    async () => {
      guest = false;
      await page
        .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
        .click();
      await page
        .getByRole("button", { name: "ยังไม่มีบัญชี สมัครสมาชิก", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d.getByLabel("ชื่อที่แสดงต่อสาธารณะ").fill("สมาชิกทดสอบ UI");
      await d
        .getByLabel("อีเมล", { exact: true })
        .fill(`member-${runId}@example.test`);
      await d.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
      await d.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(password);
      await d.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "สนใจหัวข้อนี้", exact: true })
        .waitFor();
      await absent(page.locator(".tl-story"));
      await absent(page.locator(".tl-axis"));
      await capture("member-not-followed");
      assert.equal(
        (await db.doc(`topicStats/${topicId}`).get()).get("interestCount"),
        49,
      );
      await page.reload();
      await page
        .getByRole("button", { name: "สนใจหัวข้อนี้", exact: true })
        .click();
      await page
        .getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true })
        .waitFor();
      assert.equal(
        (await db.doc(`topicStats/${topicId}`).get()).get("interestCount"),
        50,
      );
      memberUid = (
        await getAuth().getUserByEmail(`member-${runId}@example.test`)
      ).uid;
      assert.equal(await page.getByRole("switch").isChecked(), false);
      await capture("member-toggle-off");
    },
  );
  await run(
    "form uploads image/PDF, aliases/sources and creates pending at50",
    async () => {
      await page
        .getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d
        .getByLabel("ชื่อเรื่อง", { exact: true })
        .fill("เรื่องใหม่จาก Browser");
      await d.getByLabel("เนื้อเรื่อง", { exact: true }).fill(body);
      await d.getByLabel("รูปแบบเวลา", { exact: true }).selectOption("exact");
      await d.getByLabel("ปี", { exact: true }).fill("30");
      await d.getByText("เพิ่มชื่อเฉพาะในหัวข้อ", { exact: true }).click();
      await d.getByLabel("ชื่อไทย", { exact: true }).fill("ชื่อทดสอบ");
      await d
        .getByLabel("ชื่ออังกฤษ (ถ้ามี)", { exact: true })
        .fill("Test Name");
      await d
        .getByLabel("นามแฝง แยกด้วยจุลภาค", { exact: true })
        .fill("ชื่ออื่น, นามแฝง");
      await d
        .getByRole("button", { name: "บันทึกชื่อเฉพาะ", exact: true })
        .click();
      await d
        .getByRole("checkbox", { name: "ชื่อทดสอบ / Test Name", exact: true })
        .waitFor();
      await d
        .getByRole("button", { name: "เพิ่มแหล่งอ้างอิง", exact: true })
        .click();
      await d
        .getByLabel("ชื่อแหล่งอ้างอิง", { exact: true })
        .fill("แหล่งทดสอบ");
      const sources = d.getByRole("group", { name: "แหล่งอ้างอิง", exact: true });
      const firstSource = sources.locator(".tl-attachment").first();
      assert.deepEqual(await firstSource.locator("option").allTextContents(), ["เนื้อเรื่องหลัก", "เนื้อเรื่องตัวละคร", "เควสย่อย", "วิดีโอ", "อื่นๆ"]);
      for (const name of ["บท", "ภารกิจ", "เวอร์ชัน", "หมายเหตุ"]) await absent(sources.getByLabel(name, { exact: true }));
      for (const kind of ["main_story", "character_story", "side_quest"]) {
        await firstSource.getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption(kind);
        await absent(firstSource.getByLabel("URL แหล่งอ้างอิง", { exact: true }));
        await absent(firstSource.getByLabel("นาทีที่", { exact: true }));
        await absent(firstSource.getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }));
      }
      await firstSource.getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption("video");
      await firstSource
        .getByLabel("URL แหล่งอ้างอิง", { exact: true })
        .fill("https://example.com/reference");
      await firstSource.getByLabel("นาทีที่", { exact: true }).fill("12:30");
      await firstSource.getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption("side_quest");
      await absent(firstSource.getByLabel("URL แหล่งอ้างอิง", { exact: true }));
      await firstSource.getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption("video");
      assert.equal(await firstSource.getByLabel("URL แหล่งอ้างอิง", { exact: true }).inputValue(), "https://example.com/reference");
      await sources.getByRole("button", { name: "เพิ่มแหล่งอ้างอิง", exact: true }).click();
      const otherSource = sources.locator(".tl-attachment").nth(1);
      await otherSource.getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption("other");
      await otherSource.getByLabel("ชื่อแหล่งอ้างอิง", { exact: true }).fill("หลักฐานชุมชน");
      assert.equal(await otherSource.getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }).evaluate(input => input.checkValidity()), false);
      await otherSource.getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }).fill("หนังสือรวมเรื่องราว");
      await absent(otherSource.getByLabel("URL แหล่งอ้างอิง", { exact: true }));
      await absent(otherSource.getByLabel("นาทีที่", { exact: true }));
      await sources.scrollIntoViewIfNeeded();
      await page.screenshot({ path: "evidence/timeline/reference-fields.png", fullPage: true });
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF7sAAAAASUVORK5CYII=",
        "base64",
      );
      const pdf = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      );
      await d.locator("input[type=file]").setInputFiles([
        { name: "fixture.png", mimeType: "image/png", buffer: png },
        { name: "fixture.pdf", mimeType: "application/pdf", buffer: pdf },
      ]);
      await d
        .getByLabel("คำอธิบายภาพ / ชื่อสื่อ")
        .nth(1)
        .waitFor({ timeout: 60000 });
      await d
        .getByRole("checkbox", { name: "ใช้เป็นภาพปก", exact: true })
        .check();
      await capture("create-form-media");
      await sendForm();
      const rs = await db
        .collection("requests")
        .where("topicId", "==", topicId)
        .where("submittedByUid", "==", memberUid)
        .get();
      assert.equal(rs.size, 1);
      pendingId = rs.docs[0].id;
      assert.equal(rs.docs[0].get("requiredVotes"), 5);
      assert.equal(rs.docs[0].get("proposal.media").length, 2);
      assert.deepEqual(rs.docs[0].get("proposal.sources").map(source => ({ kind: source.kind, originTh: source.originTh, url: source.url, timestampInVideo: source.timestampInVideo })), [
        { kind: "video", originTh: undefined, url: "https://example.com/reference", timestampInVideo: "12:30" },
        { kind: "other", originTh: "หนังสือรวมเรื่องราว", url: undefined, timestampInVideo: undefined },
      ]);
      assert.equal(await page.getByRole("switch").isChecked(), false);
      await absent(
        page.getByRole("button", { name: /คำขอเพิ่ม: เรื่องใหม่จาก Browser/ }),
      );
    },
  );
  await run(
    "overlay ghost opens proposal; self vote blocked; PDF inline with no download",
    async () => {
      await page.getByRole("switch").check();
      const ghost = page.getByRole("button", {
        name: /คำขอเพิ่ม: เรื่องใหม่จาก Browser/,
      });
      await ghost.waitFor();
      await capture("member-toggle-on-ghost");
      await ghost.click();
      await present("คุณเป็นผู้ส่งคำขอนี้ จึงโหวตคำขอของตนเองไม่ได้");
      await page
        .getByRole("button", { name: "เปิด PDF ในหน้านี้", exact: true })
        .click();
      await page.locator('canvas[data-rendered="true"]').waitFor();
      assert.equal(downloads.length, 0);
      await capture("inline-pdf");
      await close();
    },
  );
  await run(
    "pending edit prefilled all fields resets actual old votes and requires confirmation",
    async () => {
      for (let i = 1; i <= 4; i++) {
        const r = (await db.doc(`requests/${pendingId}`).get()).data();
        await call(act(i), "castVote", {
          requestId: pendingId,
          roundId: r.currentVoteRoundId,
          choice: "yes",
        });
      }
      await page
        .getByRole("link", { name: "คำขอปัจจุบัน", exact: true })
        .click();
      await page
        .locator(".tl-request-row")
        .filter({ hasText: "เรื่องใหม่จาก Browser" })
        .click();
      await page
        .getByRole("button", { name: "แก้ไขคำขอ / เริ่มโหวตใหม่", exact: true })
        .click();
      const d = page.getByRole("dialog");
      assert.equal(
        await d.getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(),
        "เรื่องใหม่จาก Browser",
      );
      assert.equal(await d.getByLabel("คำอธิบายภาพ / ชื่อสื่อ").count(), 2);
      assert.equal(
        await d.getByLabel("ชื่อแหล่งอ้างอิง", { exact: true }).first().inputValue(),
        "แหล่งทดสอบ",
      );
      assert.equal(await d.getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }).inputValue(), "หนังสือรวมเรื่องราว");
      assert.equal(await d.getByLabel("นาทีที่", { exact: true }).inputValue(), "12:30");
      await d
        .getByLabel("ชื่อเรื่อง", { exact: true })
        .fill("เรื่องใหม่แก้ไขแล้ว");
      await d
        .getByRole("checkbox", {
          name: "ยืนยันล้างคะแนนและเริ่มรอบใหม่",
          exact: true,
        })
        .check();
      await capture("pending-edit-form");
      await sendForm();
      const r = (await db.doc(`requests/${pendingId}`).get()).data();
      assert.equal(r.yesCount, 0);
      assert.equal(r.version, 2);
    },
  );
  await run(
    "different account real UI yes/no switch then approval publishes",
    async () => {
      await page
        .getByRole("button", { name: "ออกจากระบบ", exact: true })
        .click();
      await page
        .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d.getByLabel("อีเมล", { exact: true }).fill(voterEmail);
      await d.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
      await d.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      await page
        .getByRole("link", { name: "คำขอปัจจุบัน", exact: true })
        .click();
      await page
        .locator(".tl-request-row")
        .filter({ hasText: "เรื่องใหม่แก้ไขแล้ว" })
        .click();
      await page
        .getByRole("button", {
          name: "เห็นด้วยกับการเพิ่มเรื่องราว",
          exact: true,
        })
        .click();
      await present("คะแนนของคุณในรอบนี้: เห็นด้วย");
      await page
        .getByRole("button", { name: "ไม่เห็นด้วย", exact: true })
        .click();
      await present("คะแนนของคุณในรอบนี้: ไม่เห็นด้วย");
      let r = (await db.doc(`requests/${pendingId}`).get()).data();
      assert.equal(r.yesCount, 0);
      assert.equal(r.noCount, 1);
      await page
        .getByRole("button", {
          name: "เห็นด้วยกับการเพิ่มเรื่องราว",
          exact: true,
        })
        .click();
      await present("คะแนนของคุณในรอบนี้: เห็นด้วย");
      for (let i = 2; i <= 5; i++) {
        r = (await db.doc(`requests/${pendingId}`).get()).data();
        await call(act(i), "castVote", {
          requestId: pendingId,
          roundId: r.currentVoteRoundId,
          choice: "yes",
        });
      }
      await page.getByText(/อนุมัติแล้ว · ผู้เสนอ/).waitFor();
      await close();
      await page.getByRole("link", { name: "เส้นเวลา", exact: true }).click();
      await page
        .getByRole("button", { name: /เรื่องใหม่แก้ไขแล้ว/ })
        .last()
        .waitFor();
      assert.equal(await page.getByRole("switch").isChecked(), false);
    },
  );
  await run(
    "published edit/hide badge toggles, full prefill, public version history and hide",
    async () => {
      const r = (await db.doc(`requests/${pendingId}`).get()).data(),
        s = (await db.doc(`publicStories/${r.storyId}`).get()).data();
      await page
        .getByRole("button", { name: /เรื่องใหม่แก้ไขแล้ว/ })
        .last()
        .click();
      const card = page.locator(`[data-story-id="${r.storyId}"]`);
      await card.getByRole("button", { name: "ขอแก้ไข", exact: true }).click();
      const d = page.getByRole("dialog");
      assert.equal(
        await d.getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(),
        s.titleTh,
      );
      assert.equal(await d.getByLabel("คำอธิบายภาพ / ชื่อสื่อ").count(), 2);
      await d
        .getByLabel("ชื่อเรื่อง", { exact: true })
        .fill("เวอร์ชันสองจาก UI");
      await capture("published-edit-form");
      await sendForm();
      const edit = (
        await db
          .collection("requests")
          .where("storyId", "==", r.storyId)
          .where("kind", "==", "EDIT")
          .get()
      ).docs[0];
      await page.getByRole("switch").check();
      await page.getByRole("button", { name: /คำขอแก้ไข/ }).waitFor();
      await capture("edit-warning-badge");
      for (let i = 2; i <= 6; i++)
        await call(act(i), "castVote", {
          requestId: edit.id,
          roundId: edit.get("currentVoteRoundId"),
          choice: "yes",
        });
      await page
        .getByRole("button", { name: /เวอร์ชันสองจาก UI/ })
        .last()
        .click();
      await card
        .getByRole("button", { name: "ประวัติการแก้ไข", exact: true })
        .click();
      await card.getByText(/เวอร์ชัน 1 ·/).waitFor();
      await card.getByRole("button", { name: "ขอซ่อน", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("เหตุผล", { exact: true })
        .fill("ทดสอบซ่อนจาก Browser");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "ขอซ่อนเรื่องราว", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: /คำขอซ่อน/ }).waitFor();
      await capture("hide-x-badge");
      await page.getByRole("switch").uncheck();
      await absent(page.getByRole("button", { name: /คำขอซ่อน/ }));
      const hide = (
        await db
          .collection("requests")
          .where("storyId", "==", r.storyId)
          .where("kind", "==", "HIDE")
          .get()
      ).docs[0];
      for (let i = 2; i <= 6; i++)
        await call(act(i), "castVote", {
          requestId: hide.id,
          roundId: hide.get("currentVoteRoundId"),
          choice: "yes",
        });
      await card.waitFor({ state: "hidden" });
    },
  );
  await run(
    "request hub cursor pagination, type filters, own cancellation and client upload cap",
    async () => {
      await page
        .getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d.getByLabel("ชื่อเรื่อง", { exact: true }).fill("คำขอที่จะยกเลิก");
      await d.getByLabel("เนื้อเรื่อง", { exact: true }).fill(body);
      await d
        .locator("input[type=file]")
        .setInputFiles({
          name: "too-large.png",
          mimeType: "image/png",
          buffer: Buffer.alloc(5_000_001),
        });
      await d
        .getByText("รองรับภาพและ PDF ขนาดไม่เกิน 5 MB ต่อไฟล์", {
          exact: true,
        })
        .waitFor();
      await sendForm();
      await page
        .getByRole("link", { name: "คำขอปัจจุบัน", exact: true })
        .click();
      await page
        .locator(".tl-request-row")
        .filter({ hasText: "คำขอที่จะยกเลิก" })
        .click();
      await page
        .getByRole("button", { name: "ยกเลิกคำขอ", exact: true })
        .click();
      await page
        .getByRole("button", { name: "ยืนยันยกเลิก", exact: true })
        .click();
      await page.getByText(/ยกเลิก · ผู้เสนอ/).waitFor();
      await close();
      for (let i = 0; i < 65; i++)
        await call(owner, "createStory", {
          topicId,
          content: { ...base, titleTh: `คำขอทดสอบแบ่งหน้า ${i}` },
        });
      await page.reload();
      await page.locator(".tl-request-row").first().waitFor();
      assert.equal(await page.locator(".tl-request-row").count(), 60);
      await page
        .getByRole("button", { name: "โหลดคำขอเพิ่มเติม", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll(".tl-request-row").length === 65,
      );
      await call(owner, "createStory", {
        topicId,
        content: { ...base, titleTh: "คำขอใหม่ระหว่างเปิดหน้าสอง" },
      });
      await page.waitForFunction(
        () => document.querySelectorAll(".tl-request-row").length === 66,
      );
      await page.getByLabel("กรองคำขอ", { exact: true }).selectOption("EDIT");
      await present("ไม่มีคำขอในหมวดนี้");
      await page.getByLabel("กรองคำขอ", { exact: true }).selectOption("OTHER");
      await present("ไม่มีคำขอในหมวดนี้");
      await page.getByLabel("กรองคำขอ", { exact: true }).selectOption("CREATE");
      await page.locator(".tl-request-row").first().waitFor();
      assert.equal(await page.locator(".tl-request-row").count(), 60);
      await capture("requests-filter");
      await page.getByRole("link", { name: "เส้นเวลา", exact: true }).click();
    },
  );
  await run(
    "mobile viewport, empty topic and deep-link Hosting rewrite",
    async () => {
      await page
        .getByRole("button", { name: "ออกจากระบบ", exact: true })
        .click();
      guest = true;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await page.locator(".tl-marker").first().waitFor();
      await page.locator(".tl-marker").first().click();
      await page
        .getByRole("button", { name: "ปิดตัวอย่าง", exact: true })
        .click();
      const bounds = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
      await page.screenshot({
        path: "evidence/timeline/mobile.png",
        fullPage: true,
      });
      await page.goto(`${origin}/timeline/${emptyTopicId}`);
      await present("ยังไม่มีเรื่องราวที่เผยแพร่");
      assert.equal(await page.locator(".tl-marker").count(), 0);
      const response = await fetch(
        `http://127.0.0.1:5000/timeline/${emptyTopicId}/story/no-such-story`,
      );
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes('id="root"'));
    },
  );
  await run("real touch tap/pan/pinch and keyboard dialog Escape", async () => {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await mobile.newPage();
    try {
      await p.goto(url);
      await p.locator(".tl-marker").first().waitFor();
      await p.locator(".tl-marker").first().tap();
      assert.equal(await p.locator(".tl-story").count(), 5);
      const axis = p.locator(".tl-axis");
      await axis.scrollIntoViewIfNeeded();
      const box = await axis.boundingBox();
      const cdp = await mobile.newCDPSession(p);
      const before = await p
        .locator(".tl-marker-wrap")
        .first()
        .getAttribute("style");
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + 180, y: box.y + 70, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: box.x + 250, y: box.y + 70, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.notEqual(
        await p.locator(".tl-marker-wrap").first().getAttribute("style"),
        before,
      );
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: box.x + 90, y: box.y + 80, id: 1 },
          { x: box.x + 190, y: box.y + 80, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: box.x + 50, y: box.y + 80, id: 1 },
          { x: box.x + 240, y: box.y + 80, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await p.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).tap();
      await p.getByRole("dialog").waitFor();
      await p.keyboard.press("Escape");
      await p.getByRole("dialog").waitFor({ state: "hidden" });
    } finally {
      await mobile.close();
    }
  });
  await run(
    "no uncaught frontend exceptions or forced document downloads",
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(downloads, []);
      assert.deepEqual(guestQueries, []);
    },
  );
} finally {
  try {
    await browser.close();
  } finally {
    try {
      await cleanupTopicFixtures(db, [topicId, emptyTopicId], getStorage().bucket());
      assert.equal((await db.doc(`topics/${topicId}`).get()).exists, false);
      assert.equal((await db.doc(`topics/${emptyTopicId}`).get()).exists, false);
      console.log("PASS cleaned browser topic fixture");
    } finally {
      await db.terminate();
    }
  }
}
console.log(
  `${results.filter((r) => r.status === "PASS").length}/${results.length} browser scenarios PASS`,
);
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
