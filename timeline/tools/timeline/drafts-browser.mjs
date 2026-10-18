import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { cleanupTopicFixtures } from "./fixtures.mjs";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore"), { getAuth } = require("firebase-admin/auth"), { getStorage } = require("firebase-admin/storage"), { TimelineService } = require("./lib/service.js");
Object.assign(process.env, { GCLOUD_PROJECT: "demo-timeline", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" });
initializeApp({ projectId: "demo-timeline", storageBucket: "demo-timeline.appspot.com" });
const db = getFirestore(), bucket = getStorage().bucket(), svc = new TimelineService(db), runId = Date.now().toString(36);
const topics = ["a", "b"].map(n => `browser-${runId}draft${n}`), accounts = [], password = "Local-only-12345", results = [], errors = [];
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
if (origin !== "http://127.0.0.1:5174") throw Error("Draft tests require local Vite and demo emulators");
const profile = path.resolve(`.timeline/drafts-browser-${runId}`), png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF7sAAAAASUVORK5CYII=", "base64");
let context, page;
const dialog = () => page.getByRole("dialog");
const key = (index = 0, topic = topics[0]) => `timeline.draft.v1:demo-timeline:${accounts[index].localId}:${topic}:create`;
const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null"), key());
const files = (draftKey = key()) => page.evaluate(async k => {
  const { loadDraftFiles } = await import("/src/features/timeline/draftUploads.ts");
  return (await loadDraftFiles(k)).map(file => ({ id: file.id, mediaId: file.mediaId, name: file.file.name, size: file.file.size, generation: file.generation }));
}, draftKey);
async function poll(read, accept) {
  for (let n = 0; n < 120; n++) { const value = await read(); if (accept(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error("Timed out waiting for durable draft state");
}
async function launch() {
  context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, viewport: { width: 1280, height: 1000 } });
  page = context.pages()[0]; page.setDefaultTimeout(25000); page.on("pageerror", e => errors.push(e.message));
}
async function login(index) {
  await page.locator(".tl-header").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await dialog().locator('input[name="username"]').fill(accounts[index].email);
  await dialog().locator('input[name="password"]').fill(password);
  await dialog().locator('button[type="submit"]').click();
  await page.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true }).waitFor();
}
async function add() { await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).click(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor(); }
async function upload(name) {
  await dialog().locator('input[type="file"]').setInputFiles({ name, mimeType: "image/png", buffer: png });
}
async function ready(count) {
  await poll(async () => ({ count: await dialog().getByLabel("คำอธิบายภาพ / ชื่อสื่อ", { exact: true }).count(), enabled: await dialog().getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).isEnabled() }), state => state.count === count && state.enabled);
}
async function close() { await dialog().getByRole("button", { name: "ปิด", exact: true }).click(); await dialog().waitFor({ state: "hidden" }); }
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
function hold(action, afterServer = true) {
  let release, reached, used = false;
  const gate = new Promise(resolve => { release = resolve; }), requested = new Promise(resolve => { reached = resolve; });
  const handler = async route => {
    const request = route.request();
    if (request.method() !== "POST" || request.postDataJSON()?.data?.action !== action || used) { await route.continue(); return; }
    used = true;
    if (afterServer) {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      reached((await response.json()).result); await gate;
      await route.fulfill({ response }).catch(() => {});
    } else { reached(); await gate; await route.continue().catch(() => {}); }
  };
  return { handler, release, requested, failSafe: setTimeout(() => release(), 45000) };
}
try {
  await fs.mkdir("evidence/timeline", { recursive: true });
  for (const topic of topics) await db.doc(`topics/${topic}`).set({ id: topic, slug: topic, categoryId: "test", displayNames: { "th-TH": "Draft test" }, descriptionTh: "SYNTHETIC — Emulator only", calendar: { id: "browser-symbolic" }, publishedCount: 0, interestCount: 0 });
  for (const index of [0, 1]) {
    const email = `draft-${runId}-${index}@example.test`;
    const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    const account = await response.json(); assert.ok(account.localId); accounts.push({ ...account, email });
    for (const topicId of topics) await svc.run({ uid: account.localId, label: "Draft author", privileged: false }, { action: "followTopic", data: { topicId }, operationId: randomUUID() });
  }
  await launch(); await page.goto(`${origin}/timeline/${topics[0]}`); await login(0); await add();
  await check("file-input cancel, empty selection, Escape and backdrop clicks keep the story dialog and typed values", async () => {
    await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ฉบับร่างค้างไว้");
    await dialog().getByLabel("เนื้อเรื่อง", { exact: true }).fill("ข้อความที่ต้องกลับมาเสมอ");
    await dialog().locator('input[type="file"]').dispatchEvent("cancel", { bubbles: true });
    await dialog().locator('input[type="file"]').setInputFiles([]);
    await page.keyboard.press("Escape"); await page.mouse.click(3, 3);
    assert.equal(await dialog().isVisible(), true);
    assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), "ฉบับร่างค้างไว้");
    for (const name of ["เวอร์ชันเรื่องราว / เกม", "ภาษาเรื่องราว", "ชนิดลิงก์", "ลิงก์ HTTPS"])
      assert.equal(await dialog().getByLabel(name, { exact: true }).count(), 0);
    assert.equal(await dialog().getByRole("button", { name: "เพิ่มลิงก์", exact: true }).count(), 0);
  });
  await check("refresh restores incomplete time/reference/name drafts; a different topic stays isolated", async () => {
    await dialog().getByLabel("รูปแบบเวลา", { exact: true }).selectOption("exact"); await dialog().getByLabel("ปี", { exact: true }).fill("-");
    await dialog().getByRole("button", { name: "เพิ่มแหล่งอ้างอิง", exact: true }).click();
    await dialog().getByLabel("ประเภทแหล่งอ้างอิง", { exact: true }).selectOption("other");
    await dialog().getByLabel("ชื่อแหล่งอ้างอิง", { exact: true }).fill("แหล่งอ้างอิงค้าง");
    await dialog().getByText("เพิ่มชื่อเฉพาะในหัวข้อ", { exact: true }).click(); await dialog().getByLabel("ชื่อไทย", { exact: true }).fill("ชื่อที่ยังไม่บันทึก");
    await page.reload(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor();
    assert.equal(await dialog().getByLabel("ปี", { exact: true }).inputValue(), "-");
    assert.equal(await dialog().getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }).inputValue(), "");
    await dialog().getByText("เพิ่มชื่อเฉพาะในหัวข้อ", { exact: true }).click(); assert.equal(await dialog().getByLabel("ชื่อไทย", { exact: true }).inputValue(), "ชื่อที่ยังไม่บันทึก");
    await dialog().getByLabel("ปี", { exact: true }).fill("42"); await dialog().getByLabel("แหล่งอ้างอิงมาจากไหน", { exact: true }).fill("หนังสือทดสอบ");
    await page.goto(`${origin}/timeline/${topics[1]}`); await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).waitFor(); assert.equal(await dialog().count(), 0);
    await add(); assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), ""); await close();
    await page.goto(`${origin}/timeline/${topics[0]}`); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor();
    assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), "ฉบับร่างค้างไว้");
  });
  await check("DOCX is rejected before upload and supported files are backed up with captions and cover settings", async () => {
    assert.equal((await dialog().locator('input[type="file"]').getAttribute("accept")).includes("wordprocessingml"), false);
    await dialog().locator('input[type="file"]').setInputFiles({ name: "blocked.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK-not-supported") });
    await dialog().getByText("รองรับภาพและ PDF ขนาดไม่เกิน 5 MB ต่อไฟล์", { exact: true }).waitFor();
    assert.equal((await db.collection("media").where("topicId", "==", topics[0]).get()).size, 0);
    await upload("recover.png"); await ready(1);
    await dialog().getByLabel("คำอธิบายภาพ / ชื่อสื่อ", { exact: true }).fill("คำบรรยายค้าง"); await dialog().getByRole("checkbox", { name: "ใช้เป็นภาพปก", exact: true }).check();
    assert.equal((await files()).length, 1); assert.equal((await files())[0].size, png.length);
  });
  await check("closing and reopening the browser recovers the same draft and attachment without duplicate media", async () => {
    const before = (await saved()).content.media[0].id;
    await context.close(); await launch(); await page.goto(`${origin}/timeline/${topics[0]}`); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor(); await ready(1);
    assert.equal((await saved()).content.media[0].id, before);
    assert.equal(await dialog().getByLabel("คำอธิบายภาพ / ชื่อสื่อ", { exact: true }).inputValue(), "คำบรรยายค้าง");
    assert.equal(await dialog().getByRole("checkbox", { name: "ใช้เป็นภาพปก", exact: true }).isChecked(), true);
  });
  await check("refresh after a lost upload-finalization response resumes the queued file exactly once", async () => {
    const paused = hold("finalizeUpload"); await page.route("**/timelineApi", paused.handler);
    try {
      await dialog().locator('input[type="file"]').setInputFiles(["interrupted-a.png", "interrupted-b.png"].map(name => ({ name, mimeType: "image/png", buffer: png })));
      const result = await paused.requested;
      assert.equal((await db.doc(`media/${result.id}`).get()).get("status"), "ready");
      await page.reload(); paused.release(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor(); await ready(3);
      assert.equal((await saved()).content.media.filter(media => media.id === result.id).length, 1);
      assert.deepEqual((await saved()).content.media.map(media => media.altTextTh), ["คำบรรยายค้าง", "interrupted-a.png", "interrupted-b.png"]);
      assert.equal((await db.collection("media").where("topicId", "==", topics[0]).get()).size, 3);
    } finally { paused.release(); clearTimeout(paused.failSafe); await page.unroute("**/timelineApi", paused.handler); }
  });
  await check("browser file backups recover an orphan cleaned by the server and preserve its metadata and position", async () => {
    const previous = (await saved()).content.media[0], descriptor = db.doc(`media/${previous.id}`), data = (await descriptor.get()).data();
    assert.equal(data.ownerUid, accounts[0].localId); assert.equal(data.topicId, topics[0]);
    for (const filePath of [data.path, data.validatedPath].filter(Boolean)) await bucket.file(filePath).delete({ ignoreNotFound: true });
    await descriptor.update({ status: "deleted", deletedAt: Date.now() });
    await page.reload(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor(); await ready(3);
    const recovered = (await saved()).content.media; assert.equal(recovered.length, 3); assert.notEqual(recovered[0].id, previous.id);
    assert.equal(recovered[0].altTextTh, previous.altTextTh); assert.equal(recovered[0].cover, true);
    const replacement = (await db.doc(`media/${recovered[0].id}`).get()).data();
    assert.deepEqual((await bucket.file(replacement.validatedPath).download())[0], png);
  });
  await check("preview removes the footer copy and keeps Edit/Send on one row on desktop and mobile; manual close discards the draft", async () => {
    await dialog().getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).click();
    assert.equal(await dialog().getByText("เรื่องราวและแหล่งอ้างอิงที่ชุมชนส่งมา", { exact: true }).count(), 0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const edit = await dialog().getByRole("button", { name: "กลับไปแก้ไข", exact: true }).boundingBox(), send = await dialog().getByRole("button", { name: "ส่งเรื่องราว", exact: true }).boundingBox();
      assert.ok(Math.abs(edit.y - send.y) < 2 && edit.x < send.x);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await dialog().getByRole("button", { name: "ส่งเรื่องราว", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `evidence/timeline/draft-preview-${width}.png` });
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    await dialog().getByRole("button", { name: "กลับไปแก้ไข", exact: true }).click(); await ready(3); await close();
    assert.equal(await saved(), null); await poll(() => files(), value => value.length === 0);
    await page.reload(); await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).waitFor(); assert.equal(await dialog().count(), 0);
  });
  await check("draft recovery cannot leak between accounts on the same browser profile", async () => {
    await add(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ฉบับร่างบัญชีแรก");
    await page.goto(`${origin}/timeline`); await page.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true }).click(); await login(1);
    await page.goto(`${origin}/timeline/${topics[0]}`); await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).waitFor(); assert.equal(await dialog().count(), 0);
    await add(); assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), ""); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ฉบับร่างบัญชีที่สอง");
    await page.goto(`${origin}/timeline`); await page.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true }).click(); await login(0);
    await page.goto(`${origin}/timeline/${topics[0]}`); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor();
    assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), "ฉบับร่างบัญชีแรก"); await close();
  });
  await check("successful confirmation clears the local draft and file backup", async () => {
    await add(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ส่งฉบับร่างสำเร็จ"); await dialog().getByLabel("เนื้อเรื่อง", { exact: true }).fill("Synthetic submitted draft");
    await upload("submitted.png"); await ready(1); await dialog().getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).click(); await dialog().getByRole("button", { name: "ส่งเรื่องราว", exact: true }).click(); await dialog().waitFor({ state: "hidden" });
    assert.equal(await saved(), null); await poll(() => files(), value => value.length === 0);
    await page.reload(); await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).waitFor(); assert.equal(await dialog().count(), 0);
  });
  await check("refresh after a lost story submission response retries its saved operation without publishing twice", async () => {
    await add(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ส่งซ้ำอย่างปลอดภัย"); await dialog().getByLabel("เนื้อเรื่อง", { exact: true }).fill("Synthetic retry draft"); await dialog().getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).click();
    const paused = hold("createStory"); await page.route("**/timelineApi", paused.handler);
    try {
      await dialog().getByRole("button", { name: "ส่งเรื่องราว", exact: true }).click(); const committed = await paused.requested;
      const operation = (await saved()).operation.id;
      await page.reload(); paused.release(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).waitFor(); assert.equal((await saved()).operation.id, operation);
      await dialog().getByRole("button", { name: "ตรวจสอบก่อนส่ง", exact: true }).click(); await dialog().getByRole("button", { name: "ส่งเรื่องราว", exact: true }).click(); await dialog().waitFor({ state: "hidden" });
      const stories = await db.collection("publicStories").where("topicId", "==", topics[0]).get();
      const matches = stories.docs.filter(doc => doc.get("titleTh") === "ส่งซ้ำอย่างปลอดภัย"); assert.equal(matches.length, 1); assert.equal(matches[0].id, committed.storyId);
    } finally { paused.release(); clearTimeout(paused.failSafe); await page.unroute("**/timelineApi", paused.handler); }
  });
  await check("manual close while prepare is pending cannot resurrect the discarded draft or file backup", async () => {
    await add(); const paused = hold("prepareUpload", false); await page.route("**/timelineApi", paused.handler);
    try {
      await upload("discarded.png"); await paused.requested; await close(); paused.release();
      await poll(() => files(), value => value.length === 0); assert.equal(await saved(), null);
      await page.reload(); await page.getByRole("button", { name: "＋ เพิ่มเรื่องราว", exact: true }).waitFor(); assert.equal(await dialog().count(), 0);
    } finally { paused.release(); clearTimeout(paused.failSafe); await page.unroute("**/timelineApi", paused.handler); }
  });
  await check("browser quota failure is visible without closing the form or losing in-memory input", async () => {
    await page.evaluate(() => {
      window.__draftSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith("timeline.draft.v1:")) throw new DOMException("Quota", "QuotaExceededError"); return window.__draftSetItem.call(this, key, value); };
    });
    await add(); await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).fill("ยังพิมพ์ได้แม้พื้นที่เต็ม");
    await dialog().getByText("เบราว์เซอร์บันทึกฉบับร่างไม่ได้ ข้อมูลอาจไม่กลับมาหลังรีเฟรช", { exact: true }).waitFor();
    assert.equal(await dialog().getByLabel("ชื่อเรื่อง", { exact: true }).inputValue(), "ยังพิมพ์ได้แม้พื้นที่เต็ม"); await close();
    await page.evaluate(() => { Storage.prototype.setItem = window.__draftSetItem; }); assert.deepEqual(errors, []);
  });
} catch (e) {
  console.error(e.stack); process.exitCode = 1;
  await page?.screenshot({ path: "evidence/timeline/drafts-browser-fail.png", fullPage: true }).catch(() => {});
} finally {
  await context?.close(); await cleanupTopicFixtures(db, topics, bucket);
  for (const account of accounts) {
    await db.recursiveDelete(db.doc(`users/${account.localId}`)); await db.doc(`writeLimits/${account.localId}`).delete(); await db.doc(`uploadLimits/${account.localId}`).delete(); await getAuth().deleteUser(account.localId);
    const audits = await db.collection("auditLog").where("actorUid", "==", account.localId).get(); for (const audit of audits.docs) await audit.ref.delete();
  }
  await fs.writeFile("evidence/timeline/drafts-browser.json", JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2)); await db.terminate();
}
console.log(`${results.filter(result => result.status === "PASS").length}/${results.length} draft browser scenarios PASS`);
