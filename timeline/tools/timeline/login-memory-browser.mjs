import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
const runId = randomUUID(), password = `Local-only-${runId}`;
const emails = [1, 2].map(n => `login-memory-${n}-${runId}@example.test`);
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
const profile = path.resolve(`.timeline/login-memory-${runId}`);
const options = { channel: "msedge", headless: true, viewport: { width: 1280, height: 900 } };
let context, page;
const errors = [], results = [];
const loginButton = () => page.locator(".tl-header").getByRole("button", { name: "เข้าสู่ระบบ", exact: true });
const logoutButton = () => page.locator(".tl-header").getByRole("button", { name: "ออกจากระบบ", exact: true });
async function open() {
  context = await chromium.launchPersistentContext(profile, options);
  page = context.pages()[0]; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${origin}/timeline`);
}
async function form() { await loginButton().click(); return page.getByRole("dialog").locator("form"); }
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
async function autofill(email) {
  const f = await form();
  await f.locator('input[name="username"]').evaluate((input, value) => { input.value = value; }, email);
  await f.locator('input[name="password"]').evaluate((input, value) => { input.value = value; }, password);
  await f.locator('button[type="submit"]').click(); await logoutButton().waitFor({ timeout: 25000 });
}
try {
  for (const email of emails) {
    const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    assert.equal(r.status, 200);
  }
  await open();
  await check("minimal login form exposes password-manager fields and a working visibility toggle", async () => {
    const f = await form();
    assert.equal(await f.getAttribute("autocomplete"), "on");
    assert.equal(await f.getAttribute("method"), "post");
    assert.equal(await f.locator('input[name="username"]').getAttribute("autocomplete"), "username");
    assert.equal(await f.locator('input[name="password"]').getAttribute("autocomplete"), "current-password");
    assert.equal(await f.locator("small").count(), 0);
    assert.equal(await f.getByRole("button", { name: "ลืมรหัสผ่าน", exact: true }).count(), 0);
    await f.locator('input[name="password"]').fill(password);
    await f.getByRole("button", { name: "แสดงรหัสผ่าน", exact: true }).click();
    assert.equal(await f.locator('input[name="password"]').getAttribute("type"), "text");
    assert.equal(await f.locator('input[name="password"]').inputValue(), password);
    await f.getByRole("button", { name: "ซ่อนรหัสผ่าน", exact: true }).click();
    assert.equal(await f.locator('input[name="password"]').getAttribute("type"), "password");
    await page.keyboard.press("Escape");
  });
  await check("nonexistent email and wrong password show the same Thai error without raw Firebase text", async () => {
    const f = await form();
    for (const email of [`missing-${runId}@example.test`, emails[0]]) {
      await f.locator('input[name="username"]').fill(email);
      await f.locator('input[name="password"]').fill("wrong-password");
      await f.locator('button[type="submit"]').click();
      await f.getByRole("alert").waitFor();
      assert.equal(await f.getByRole("alert").innerText(), "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      await f.locator('button[type="submit"]').waitFor({ state: "visible" });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("timeline.lastLoginEmail")), null);
    await page.keyboard.press("Escape");
  });
  await check("browser autofill without React events submits the actual field values", async () => {
    await autofill(emails[0]);
    assert.equal(await page.evaluate(() => localStorage.getItem("timeline.lastLoginEmail")), emails[0]);
    await logoutButton().click(); await loginButton().waitFor(); await page.reload();
    const f = await form();
    assert.equal(await f.locator('input[name="username"]').inputValue(), emails[0]);
    assert.equal(await f.locator('input[name="password"]').inputValue(), "");
    await page.keyboard.press("Escape");
  });
  await check("reopening the browser remembers the newest successful email without storing passwords", async () => {
    await autofill(emails[1]); await logoutButton().click(); await loginButton().waitFor();
    await context.close(); context = undefined; await open();
    const f = await form(); assert.equal(await f.locator('input[name="username"]').inputValue(), emails[1]);
    const storage = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].join("\n"));
    assert.equal(storage.includes(password), false);
    await fs.mkdir("evidence/timeline", { recursive: true });
    await page.screenshot({ path: "evidence/timeline/login-remembered-email.png" });
  });
  await check("registration requires matching passwords and both eye buttons preserve typed values", async () => {
    await page.getByRole("button", { name: "ยังไม่มีบัญชี สมัครสมาชิก", exact: true }).click();
    const f = page.getByRole("dialog").locator("form");
    assert.equal(await f.locator("small").count(), 0);
    assert.equal(await f.locator('input[name="password"]').getAttribute("autocomplete"), "new-password");
    assert.equal(await f.locator('input[name="confirmPassword"]').getAttribute("autocomplete"), "new-password");
    await f.locator('input[name="displayName"]').fill("Confirmation test");
    await f.locator('input[name="username"]').fill(`registration-${runId}@example.test`);
    await f.locator('input[name="password"]').fill(password);
    await f.locator('input[name="confirmPassword"]').fill("different-password");
    let signups = 0;
    page.on("request", r => { if (r.url().includes("accounts:signUp")) signups++; });
    await f.locator('button[type="submit"]').click();
    assert.equal(await f.getByRole("alert").innerText(), "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    assert.equal(signups, 0);
    for (const name of ["password", "confirmPassword"]) {
      const input = f.locator(`input[name="${name}"]`), id = await input.getAttribute("id");
      const before = await input.inputValue(); await f.locator(`button[aria-controls="${id}"]`).click();
      assert.equal(await input.getAttribute("type"), "text"); assert.equal(await input.inputValue(), before);
      await f.locator(`button[aria-controls="${id}"]`).click();
    }
    await f.locator('input[name="confirmPassword"]').fill(password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "evidence/timeline/register-confirm-password.png" });
    await f.locator('button[type="submit"]').click(); await logoutButton().waitFor({ timeout: 25000 });
    assert.equal(signups, 1); assert.deepEqual(errors, []);
  });
  await check("new registration signs in automatically and retains its name and session after browser restart", async () => {
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await loginButton().count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("timeline.lastLoginEmail")), `registration-${runId}@example.test`);
    const lease = await page.evaluate(() => JSON.parse(localStorage.getItem("timeline.session") || "null"));
    assert.ok(lease?.uid && Math.abs(lease.expiresAt - Date.now() - 259200000) < 10000);
    await page.setViewportSize(options.viewport);
    assert.equal(await page.locator(".tl-account").innerText(), "Confirmation test");
    await page.reload(); await logoutButton().waitFor({ timeout: 25000 });
    assert.equal(await page.locator(".tl-account").innerText(), "Confirmation test");
    await context.close(); context = undefined; await open();
    await logoutButton().waitFor({ timeout: 25000 });
    assert.equal(await page.locator(".tl-account").innerText(), "Confirmation test");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("timeline.session")).uid), lease.uid);
  });
  await check("registration stays busy until a delayed site session is ready, then closes directly into logged-in UI", async () => {
    await logoutButton().click(); await loginButton().waitFor();
    await form(); await page.getByRole("button", { name: "ยังไม่มีบัญชี สมัครสมาชิก", exact: true }).click();
    const f = page.locator("#timeline-register-form");
    await f.locator('input[name="displayName"]').fill("Delayed registration");
    await f.locator('input[name="username"]').fill(`registration-delay-${runId}@example.test`);
    await f.locator('input[name="password"]').fill(password);
    await f.locator('input[name="confirmPassword"]').fill(password);
    let release, reached;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { reached = resolve; });
    const pattern = "**/timelineSession";
    const handler = async route => {
      if (route.request().method() === "POST") { reached(); await gate; }
      await route.continue();
    };
    const failSafe = setTimeout(release, 10000);
    await page.route(pattern, handler);
    try {
      await f.locator('button[type="submit"]').click();
      await requested;
      await page.waitForTimeout(350); // The API remains pending while Firebase signup/profile complete.
      assert.equal(await page.getByRole("dialog").count(), 1);
      assert.equal(await f.locator('button[type="submit"]').isDisabled(), true);
      release();
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 25000 });
      assert.equal(await logoutButton().count(), 1);
      assert.equal(await loginButton().count(), 0);
      assert.equal(await page.locator(".tl-account").innerText(), "Delayed registration");
      assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("timeline.session") || "null")?.uid));
      assert.deepEqual(errors, []);
    } finally {
      release(); clearTimeout(failSafe); await page.unroute(pattern, handler);
    }
  });
} finally {
  await context?.close(); await fs.mkdir("evidence/timeline", { recursive: true });
  await fs.writeFile("evidence/timeline/login-memory-browser.json", JSON.stringify({ at: new Date().toISOString(), results, errors, passwordManagerPrompt: "Native save prompts depend on browser settings; field semantics and native autofill submission were tested." }, null, 2));
}
