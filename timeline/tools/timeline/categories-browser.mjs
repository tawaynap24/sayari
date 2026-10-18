import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { cleanupTopicFixtures } from "./fixtures.mjs";
import { chromium } from "playwright";
const expected = [["genshin-impact", "Genshin Impact"], ["honkai-star-rail", "Honkai: Star Rail"], ["zenless-zone-zero", "Zenless Zone Zero"], ["wuthering-waves", "Wuthering Waves"], ["arknights-endfield", "Arknights: Endfield"]];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const origin = process.env.TIMELINE_TEST_ORIGIN || "http://127.0.0.1:5174";
const errors = [], results = [];
page.on("pageerror", e => errors.push(e.message));
async function check(name, work) {
  try { await work(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, status: "FAIL", error: e.stack }); throw e; }
}
try {
  await fs.mkdir("evidence/timeline", { recursive: true });
  await page.goto(`${origin}/timeline`);
  await page.locator(".tl-topic-card").first().waitFor();
  await check("five games appear in requested order without category filters or creation controls", async () => {
    assert.deepEqual(await page.locator(".tl-topic-card h2").allTextContents(), expected.map(([, name]) => name));
    assert.deepEqual(await page.locator(".tl-topic-number").allTextContents(), ["01", "02", "03", "04", "05"]);
    assert.equal(await page.locator(".tl-categories").count(), 0);
    assert.equal(await page.locator(".tl-topic-arrow").count(), 0);
    const number = await page.locator(".tl-topic-number").first().evaluate(node => ({ size: parseFloat(getComputedStyle(node).fontSize), weight: Number(getComputedStyle(node).fontWeight) }));
    assert.ok(number.size >= 30 && number.weight >= 800);
    assert.equal(await page.getByText(/SYNTHETIC|หัวข้อทดสอบ|สร้างหมวดหมู่|เพิ่มหมวดหมู่/).count(), 0);
    assert.equal(await page.locator('.tl-topic-card[href="/timeline/community"]').count(), 0);
  });
  await check("all five games share live patch artwork between cards and Timeline headers, including mobile", async () => {
    for (const [id, name] of expected) {
      const card = page.locator(`.tl-topic-card[href="/timeline/${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator(".tl-topic-cover").waitFor({ timeout: 45000 });
      await card.locator(".tl-topic-cover").evaluate(img => img.decode());
      const image = await card.locator(".tl-topic-cover").evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, url: img.currentSrc, hidden: img.hidden }));
      assert.ok(image.width >= 640 && image.height >= 240 && !image.hidden, `${id}: real official patch artwork ${image.width}x${image.height}`);
      assert.ok(image.url.startsWith("https://") && !image.url.includes("playstation.com"));
      const metadata = await card.locator(".tl-topic-metadata").innerText();
      assert.match(metadata, /\d+\.\d+/);
      assert.match(metadata, /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} น\./);
      assert.ok(!metadata.includes("กำลังตรวจสอบ"));
      await card.focus(); await page.keyboard.press("Enter");
      await page.locator(".tl-topic-hero h1").waitFor();
      assert.equal(await page.locator(".tl-topic-hero h1").innerText(), name);
      const hero = page.locator(".tl-topic-hero"), cover = hero.locator(".tl-topic-cover");
      await cover.waitFor({ timeout: 45000 }); await cover.evaluate(img => img.decode());
      assert.equal(await cover.getAttribute("src"), image.url);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const bounds = await hero.evaluate(node => {
          const img = node.querySelector(".tl-topic-cover"), image = img.getBoundingClientRect();
          const art = node.querySelector(".tl-topic-art").getBoundingClientRect(), frame = node.getBoundingClientRect();
          const title = node.querySelector("h1").getBoundingClientRect();
          const scale = Math.min(image.width / img.naturalWidth, image.height / img.naturalHeight);
          return { height: frame.height, paintedHeight: img.naturalHeight * scale, rightGap: art.right - image.right,
            titleInside: title.left >= frame.left && title.right <= frame.right && title.bottom <= frame.bottom,
            decorative: node.querySelector(".tl-topic-art").getAttribute("aria-hidden"), hidden: img.hidden };
        });
        assert.ok(Math.abs(bounds.height - bounds.paintedHeight) < 1 && Math.abs(bounds.rightGap) < 1, `${id} hero fills height at ${width}px`);
        assert.ok(bounds.titleInside && !bounds.hidden);
        assert.equal(bounds.decorative, "true");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (id === "genshin-impact" && width !== 320) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: `evidence/timeline/game-hero-${width}.png`, fullPage: true });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/timeline`); await page.locator(".tl-topic-card").first().waitFor();
    }
  });
  await check("a direct game link retains a readable Timeline header when artwork cannot load", async () => {
    const src = await page.locator('.tl-topic-card[href="/timeline/genshin-impact"] .tl-topic-cover').getAttribute("src");
    const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await fallback.route(src, route => route.abort());
      await fallback.goto(`${origin}/timeline/genshin-impact`);
      await fallback.waitForFunction(() => document.querySelector(".tl-topic-hero .tl-topic-cover")?.hidden === true);
      assert.equal(await fallback.locator(".tl-topic-hero h1").innerText(), "Genshin Impact");
      assert.equal(await fallback.locator(".tl-breadcrumb a").getAttribute("href"), "/timeline");
      assert.equal(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await fallback.close(); }
  });
  await check("responsive columns keep actual artwork at full card height without vertical gaps or page overflow", async () => {
    for (const width of [1440, 1200, 1199, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const columns = width >= 1200 ? 2 : 1;
      const grid = await page.locator(".tl-topics").boundingBox();
      for (const card of await page.locator(".tl-topic-card").all()) {
        await card.scrollIntoViewIfNeeded(); await card.locator(".tl-topic-cover").evaluate(img => img.decode());
        const bounds = await card.evaluate(node => {
          const img = node.querySelector(".tl-topic-cover"), frame = node.getBoundingClientRect(), image = img.getBoundingClientRect();
          const art = node.querySelector(".tl-topic-art").getBoundingClientRect();
          const metadata = node.querySelector(".tl-topic-metadata").getBoundingClientRect();
          const ambient = node.querySelector(".tl-topic-ambience"), background = ambient.getBoundingClientRect();
          // Check the painted bitmap, not just the <img> box: contain can leave
          // vertical gaps when a max-width restriction shrinks a wide banner.
          const scale = Math.min(image.width / img.naturalWidth, image.height / img.naturalHeight);
          return { frameWidth: frame.width, imageWidth: image.width, frameHeight: frame.height, imageHeight: image.height,
            artHeight: art.height, rightGap: art.right - image.right, fit: getComputedStyle(img).objectFit, mask: getComputedStyle(img).maskImage,
            paintedHeight: img.naturalHeight * scale, expectedWidth: img.naturalWidth * art.height / img.naturalHeight,
            clipsOverflow: getComputedStyle(node.querySelector(".tl-topic-art")).overflow === "hidden",
            metadataInside: metadata.left >= frame.left && metadata.right <= frame.right && metadata.bottom <= frame.bottom,
            backgroundWidth: background.width, backgroundHeight: background.height, blur: getComputedStyle(ambient).filter };
        });
        assert.equal(bounds.fit, "contain");
        assert.ok(Math.abs(bounds.artHeight - bounds.imageHeight) < 1);
        assert.ok(Math.abs(bounds.artHeight - bounds.paintedHeight) < 1, `painted image fills height at ${width}px`);
        assert.ok(Math.abs(bounds.imageWidth - bounds.expectedWidth) < 1, `natural image proportions at ${width}px`);
        assert.ok(Math.abs(bounds.rightGap) < 1 && bounds.clipsOverflow);
        assert.ok(bounds.mask.includes("linear-gradient") && bounds.mask.includes("rgba(0, 0, 0, 0)"));
        assert.ok(bounds.backgroundWidth >= bounds.frameWidth && bounds.backgroundHeight >= bounds.frameHeight && bounds.blur.includes("blur"));
        assert.ok(Math.abs(grid.width / columns - bounds.frameWidth) < 1);
        assert.ok(bounds.metadataInside);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const cards = await page.locator(".tl-topic-card").evaluateAll(nodes => nodes.map(node => {
        const bounds = node.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, right: bounds.right, width: bounds.width };
      }));
      for (let i = 0; i < cards.length; i++) {
        assert.ok(Math.abs(cards[i].x - (columns === 2 && i % 2 ? cards[0].right : cards[0].x)) < 1);
        if (columns === 2 && i % 2) assert.ok(Math.abs(cards[i].y - cards[i - 1].y) < 1);
        else if (i >= columns) assert.ok(cards[i].y > cards[i - columns].y);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `evidence/timeline/categories-${width}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
  });
  await check("public interest count deduplicates follows and updates live alongside the timeline time", async () => {
    if (origin !== "http://127.0.0.1:5174") throw Error("Fixture UI check requires the local Vite server");
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    const require = createRequire(new URL("../../functions/package.json", import.meta.url));
    const { initializeApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
    const { TimelineService } = require("./lib/service.js");
    const { randomUUID } = await import("node:crypto");
    const app = initializeApp({ projectId: "demo-timeline" }, `row-${Date.now()}`), db = getFirestore(app);
    const id = `browser-${Date.now().toString(36)}row`, ref = db.doc(`topics/${id}`);
    const fixturePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const catalog = JSON.parse(await fs.readFile("src/features/timeline/gameCatalog.json", "utf8"));
    catalog[0].id = id;
    let intercepted = false;
    // Only this browser sees the fixture in place of the first catalog entry.
    // The real five game topics and their public timestamps remain untouched.
    await fixturePage.route("**/src/features/timeline/gameCatalog.json*", route => {
      intercepted = true;
      return route.fulfill({ contentType: "application/javascript", body: `export default ${JSON.stringify(catalog)};` });
    });
    try {
      await ref.set({ id, slug: id, categoryId: "test", displayNames: { "th-TH": "Genshin Impact" },
        descriptionTh: "SYNTHETIC — Emulator only", calendar: { id: "browser-symbolic" }, publishedCount: 0, interestCount: 0 });
      await fixturePage.goto(`${origin}/timeline`);
      const card = fixturePage.locator(`.tl-topic-card[href="/timeline/${id}"]`);
      await card.waitFor(); assert.ok(intercepted);
      assert.equal(await card.locator(".tl-topic-timeline-updated").count(), 0);
      assert.equal(await card.locator(".tl-topic-interest-count dd").innerText(), "0 คน");
      const service = new TimelineService(db), follower = { uid: `${id}_follower`, label: "Fixture follower", privileged: false };
      await Promise.all(Array.from({ length: 8 }, () => service.run(follower, { action: "followTopic", operationId: randomUUID(), data: { topicId: id } })));
      await fixturePage.waitForFunction(selector => document.querySelector(selector)?.textContent === "1 คน", ".tl-topic-interest-count dd");
      assert.equal((await db.doc(`topicStats/${id}`).get()).get("interestCount"), 1);
      assert.equal((await ref.get()).get("interestCount"), 1);
      assert.equal(await card.locator(".tl-topic-timeline-updated").count(), 0);
      await service.run({ ...follower, uid: `${id}_second` }, { action: "followTopic", operationId: randomUUID(), data: { topicId: id } });
      await fixturePage.waitForFunction(selector => document.querySelector(selector)?.textContent === "2 คน", ".tl-topic-interest-count dd");
      await ref.update({ publishedCount: 1, timelineUpdatedAt: Date.parse("2026-10-17T18:05:00Z") });
      await card.locator(".tl-topic-timeline-updated").waitFor();
      assert.equal(await card.locator(".tl-topic-timeline-updated time").innerText(), "18/10/2026 01:05 น.");
      await ref.update({ publishedCount: 0, timelineUpdatedAt: Date.parse("2026-10-17T18:06:00Z") });
      await fixturePage.waitForFunction(selector => document.querySelector(selector)?.textContent === "18/10/2026 01:06 น.", ".tl-topic-timeline-updated time");
      assert.equal(await card.locator(".tl-topic-timeline-updated").count(), 1);
      assert.equal(await fixturePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const width of [1440, 1200, 1199, 768, 390, 320]) {
        await fixturePage.setViewportSize({ width, height: 1000 });
        const layout = await card.evaluate(node => {
          const patch = node.querySelector(".tl-topic-patch-row").getBoundingClientRect();
          const community = node.querySelector(".tl-topic-community-row");
          const count = community.querySelector(".tl-topic-interest-count").getBoundingClientRect();
          const time = community.querySelector(".tl-topic-timeline-updated").getBoundingClientRect();
          return { patchBottom: patch.bottom, countTop: count.top, timeTop: time.top };
        });
        assert.ok(layout.countTop >= layout.patchBottom, `interest count below patch metadata at ${width}px`);
        if (width >= 768) assert.ok(Math.abs(layout.countTop - layout.timeTop) < 1, `interest count and timeline time share a row at ${width}px`);
        assert.equal(await fixturePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
    } finally {
      await fixturePage.close();
      await cleanupTopicFixtures(db, [id]); await db.terminate();
      const { deleteApp } = require("firebase-admin/app"); await deleteApp(app);
    }
  });
} finally {
  await browser.close();
  await fs.writeFile("evidence/timeline/categories-browser.json", JSON.stringify({ at: new Date().toISOString(), origin, results, errors }, null, 2));
}
