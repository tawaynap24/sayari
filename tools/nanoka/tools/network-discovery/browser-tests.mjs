/** One headless browser, sequential scenarios. Injected failures/fixtures stay in the test context. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evidenceDirectory } from '../../scripts/evidence.mjs';
const origin = process.env.SAYARI_TEST_ORIGIN ?? 'http://127.0.0.1:5174';
const out = await evidenceDirectory(), shots = path.join(out, 'screenshots');
await fs.mkdir(shots, { recursive: true });
const pointer = JSON.parse(await fs.readFile('public/nanoka/current.json', 'utf8'));
const catalog = JSON.parse(await fs.readFile(path.join('public/nanoka', pointer.catalog), 'utf8'));
const objectRoot = path.dirname(path.join('public/nanoka', pointer.catalog));
const live = catalog.versions.find(v => v.channels.includes('live')).version;
const latest = catalog.versions.find(v => v.channels.includes('latest')).version;
const base = '/game/zenless-zone-zero/database';
const sha = b => createHash('sha256').update(b).digest('hex');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [], pageErrors = [], sourceJsonRequests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
context.on('request', r => { if (/nanoka\.cc/.test(r.url()) && /\.json(?:\?|$)/.test(r.url())) sourceJsonRequests.push(r.url()); });
const page = await context.newPage();
page.on('pageerror', e => pageErrors.push(e.message));
page.setDefaultTimeout(12000);
async function go(page, query = '') { await page.goto(`${origin}${base}${query}`, { waitUntil: 'domcontentloaded' }); await page.locator('.nk-layout').waitFor({ timeout: 25000 }); }
async function shot(page, name, fullPage = false) {
  await page.waitForFunction(() => [...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).every(i => i.complete), undefined, { timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: path.join(shots, name), fullPage, animations: 'disabled', timeout: 15000 });
}
async function focusArea(page, selector) { await page.locator(selector).first().evaluate(el => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - 20))); await page.waitForTimeout(180); }
async function visible(locator) { await locator.first().waitFor({ state: 'visible' }); }
async function noOverflow(page) { const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })); assert.ok(size.document <= size.viewport + 1, JSON.stringify(size)); }
async function run(name, kind, fn) {
  const startedAt = new Date().toISOString();
  try { const detail = await fn(); results.push({ name, kind, status: 'PASS', startedAt, detail }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, kind, status: 'FAIL', startedAt, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); try { await shot(page, `FAIL-${results.length}.png`); } catch {} }
  await fs.writeFile(path.join(out, 'BROWSER_TEST_RESULTS.json'), JSON.stringify({ runId: catalog.runId, origin, results, pageErrors, sourceJsonRequests }, null, 2));
}
try {
  await run('Home → database and calculator input regression; black base preserved', 'REAL_APP', async () => {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByText('ฐานข้อมูล Zenless Zone Zero', { exact: true }).click();
    await visible(page.locator('.nk-entity-card'));
    await page.getByRole('link', { name: 'เครื่องคำนวณ', exact: true }).click();
    await visible(page.getByText('Name: Piper', { exact: true }));
    const card = page.locator('.default-card').filter({ has: page.getByText('Name: Piper', { exact: true }) }).first();
    await card.locator('input').nth(0).fill('20');
    await visible(card.getByText('Mons Resist Mul: 0.8', { exact: true }));
    await card.locator('input').nth(1).fill('1000');
    assert.equal(await card.locator('input').nth(1).inputValue(), '1000');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)');
  });
  await run('Live list search, rarity/group filters and pagination reach the last record', 'REAL_DATA', async () => {
    await go(page);
    await visible(page.locator('.nk-entity-card'));
    const count = catalog.inventory.find(i => i.dataset === 'character' && i.version === live).count;
    assert.equal(await page.locator('.nk-entity-card').count(), Math.min(24, count));
    await page.getByRole('button', { name: 'หน้าสุดท้าย', exact: true }).click();
    assert.equal(await page.locator('.nk-entity-card').count(), count % 24 || 24);
    await page.getByLabel('ค้นหาชื่อหรือ ID', { exact: true }).fill('1011');
    assert.equal(await page.locator('.nk-entity-card').count(), 1);
    await page.getByLabel('ค้นหาชื่อหรือ ID', { exact: true }).fill('');
    const rank = await page.getByLabel('กรองระดับ', { exact: true }).locator('option').nth(1).getAttribute('value');
    await page.getByLabel('กรองระดับ', { exact: true }).selectOption(rank);
    assert.ok(await page.locator('.nk-entity-card').count() > 0);
    await page.getByLabel('กรองระดับ', { exact: true }).selectOption('');
    await page.getByLabel('กรองกลุ่ม', { exact: true }).selectOption({ index: 1 });
    assert.ok(await page.locator('.nk-entity-card').count() > 0);
    await go(page);
    // Let every real card image finish for the full-page artifact; production remains lazy.
    await page.locator('.nk-entity-card img').evaluateAll(images => images.forEach(i => { i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.querySelectorAll('.nk-entity-card img')].every(i => i.complete), undefined, { timeout: 8000 }).catch(() => {});
    await shot(page, 'database-overview-1440.png', true);
  });
  await run('Agent sections, every level option, field search, source and exact raw download', 'REAL_DATA', async () => {
    await go(page, '?category=character&id=1011');
    await visible(page.getByRole('tab', { name: 'ค่าสถานะ', exact: true }));
    await page.getByRole('tab', { name: 'ค่าสถานะ', exact: true }).click();
    assert.ok(await page.locator('.nk-stat-grid > div').count() > 0);
    await page.getByRole('tab', { name: 'สกิล', exact: true }).click();
    const options = await page.locator('.nk-level-select option').allTextContents();
    for (let i = 0; i < options.length; i++) await page.locator('.nk-level-select select').selectOption({ index: i });
    await page.locator('.nk-level-select select').selectOption({ index: 0 });
    assert.ok(await page.locator('.nk-reading-cards article').count() > 0);
    await focusArea(page, '.nk-detail-hero'); await shot(page, 'agent-detail-1440.png');
    await page.getByRole('tab', { name: 'Raw / Explorer', exact: true }).click();
    const resource = catalog.resources.find(r => r.dataset === 'character' && r.version === live && r.language === 'en' && r.id === '1011');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลด JSON เต็ม ↓', exact: true }).click();
    const file = await downloaded, bytes = await fs.readFile(await file.path());
    assert.equal(sha(bytes), resource.sha256); assert.equal(bytes.length, resource.bytes);
    await page.getByRole('button', { name: 'แสดงข้อความต้นฉบับครบทั้งหมด', exact: true }).click();
    assert.equal(await page.locator('.nk-raw-text').textContent(), bytes.toString('utf8'));
    const source = page.locator('.nk-source'); await source.locator('summary').click();
    assert.ok((await source.textContent()).includes(resource.url));
    assert.ok((await source.textContent()).includes(resource.sha256));
    await page.getByRole('tab', { name: 'การเติบโตทุกระดับ', exact: true }).click();
    await page.locator('summary').filter({ has: page.getByText('materials', { exact: true }) }).first().click();
    await page.getByRole('button', { name: /Denny.*#10/ }).first().click();
    assert.equal(new URL(page.url()).searchParams.get('id'), '10');
    await visible(page.getByRole('tab', { name: 'ภาพรวม', exact: true }));
    return { downloadHash: resource.sha256, bytes: bytes.length, skillOptions: options.length };
  });
  await run('Version and language controls, history and direct link reload', 'REAL_DATA', async () => {
    await go(page);
    await page.getByLabel('เวอร์ชันข้อมูล', { exact: true }).selectOption(latest);
    await visible(page.locator('.nk-entity-card'));
    await page.getByLabel('ค้นหาชื่อหรือ ID', { exact: true }).fill('1641');
    assert.equal(await page.locator('.nk-entity-card').count(), 1);
    await page.getByLabel('เวอร์ชันข้อมูล', { exact: true }).selectOption(live);
    await visible(page.getByText('ไม่พบรายการที่ตรงกับตัวกรอง', { exact: true }));
    await go(page, '?category=character&id=1011&lang=ja');
    await visible(page.getByRole('tab', { name: 'ภาพรวม', exact: true }));
    const resource = catalog.resources.find(r => r.dataset === 'character' && r.version === live && r.language === 'ja' && r.id === '1011');
    const raw = JSON.parse(await fs.readFile(path.join(objectRoot, resource.file), 'utf8'));
    assert.equal(await page.locator('.nk-detail-hero h2').textContent(), raw.name);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tab', { name: 'ภาพรวม', exact: true }));
    assert.equal(await page.locator('.nk-detail-hero h2').textContent(), raw.name);
    const historical = catalog.manifest.zzz.available.find(v => !catalog.versions.some(x => x.version === v));
    if (historical) { await page.getByLabel('เวอร์ชันข้อมูล', { exact: true }).selectOption(historical); await visible(page.getByText('เวอร์ชันนี้ยังไม่ได้ดาวน์โหลด', { exact: true })); }
  });
  await run('Every registered category opens a real list and structured detail', 'REAL_DATA', async () => {
    const checked = [];
    for (const def of catalog.definitions) {
      const inventory = catalog.inventory.find(i => i.dataset === def.key && i.version === latest && (!i.language || i.language === 'en'));
      await go(page, `?category=${def.key}&version=${encodeURIComponent(latest)}`);
      if (!inventory?.count) { await visible(page.getByText('ต้นทางส่งรายการว่างที่อ่านได้สำเร็จ', { exact: true })); checked.push({ dataset: def.key, count: 0 }); continue; }
      await visible(page.locator('.nk-entity-card'));
      await page.locator('.nk-entity-card').first().click();
      await visible(page.getByRole('tab', { name: 'ภาพรวม', exact: true }));
      assert.ok(await page.locator('.nk-json-node, .nk-value-row').count() > 0);
      assert.ok(await page.locator('.nk-source').count() > 0);
      if (['weapon', 'equipment', 'monster', 'hollow_tpp', 'achievement'].includes(def.key)) {
        const reading = page.getByRole('tab', { name: /คำอธิบาย|โบนัส|ข้อมูลเพิ่มเติม/ }).first();
        if (await reading.count()) await reading.click();
        await focusArea(page, '.nk-detail-hero'); await shot(page, `${def.key}-detail-1440.png`);
      }
      checked.push({ dataset: def.key, count: inventory.count });
    }
    return checked;
  });
  await run('API Explorer paginates, searches and clears an old selection after locale changes', 'REAL_DATA', async () => {
    await go(page, '?view=api'); await visible(page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }));
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).first().click();
    await visible(page.locator('.nk-raw'));
    await page.getByLabel('ภาษาข้อมูล', { exact: true }).selectOption('ko');
    assert.equal(await page.locator('.nk-explorer-selected').count(), 0);
    await page.getByLabel('ค้นหา resource', { exact: true }).fill('/ko/character/1011.json');
    await page.getByRole('button', { name: 'ตรวจข้อมูล', exact: true }).click(); await visible(page.locator('.nk-raw'));
    await focusArea(page, '.nk-main-heading'); await shot(page, 'api-explorer-1440.png');
  });
  await run('Responsive 390/768/1440 layouts and keyboard dialog', 'REAL_APP', async () => {
    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height }); await go(page); await visible(page.locator('.nk-entity-card'));
      await noOverflow(page);
      await focusArea(page, '.nk-main-heading'); await shot(page, `database-${width}.png`);
      await page.getByRole('button', { name: 'ดูความครอบคลุมของข้อมูล ↗', exact: true }).click();
      await visible(page.getByRole('dialog'));
      await page.keyboard.press('Shift+Tab'); assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))));
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
      await go(page, '?category=character&id=1011'); await visible(page.getByRole('tab', { name: 'ภาพรวม', exact: true }));
      await page.getByRole('tab', { name: 'ภาพรวม', exact: true }).focus(); await page.keyboard.press('End');
      assert.equal(await page.getByRole('tab', { name: 'Raw / Explorer', exact: true }).getAttribute('aria-selected'), 'true');
      await noOverflow(page);
      if (width === 390) { await focusArea(page, '.nk-detail-hero'); await shot(page, 'agent-detail-mobile.png'); }
    }
  });
  await run('Delayed old locale response cannot replace the selected locale', 'REAL_DATA_DELAYED_TRANSPORT', async () => {
    const isolated = await browser.newContext(); const p = await isolated.newPage();
    try {
      const ja = catalog.resources.find(r => r.dataset === 'character' && r.version === live && r.language === 'ja' && r.id === '1011');
      const ko = catalog.resources.find(r => r.dataset === 'character' && r.version === live && r.language === 'ko' && r.id === '1011');
      await isolated.route(`**/${ja.file}`, async route => { await new Promise(r => setTimeout(r, 1100)); await route.continue(); });
      await go(p, '?category=character&id=1011&lang=en'); await visible(p.getByRole('tab', { name: 'ภาพรวม', exact: true }));
      await p.getByLabel('ภาษาข้อมูล', { exact: true }).selectOption('ja');
      await p.getByLabel('ภาษาข้อมูล', { exact: true }).selectOption('ko');
      await visible(p.getByRole('tab', { name: 'ภาพรวม', exact: true })); await p.waitForTimeout(1400);
      const raw = JSON.parse(await fs.readFile(path.join(objectRoot, ko.file), 'utf8'));
      assert.equal(await p.locator('.nk-detail-hero h2').textContent(), raw.name);
    } finally { await isolated.close(); }
  });
  await run('Delayed Live index cannot replace a selected Latest index', 'REAL_DATA_DELAYED_TRANSPORT', async () => {
    const isolated = await browser.newContext(); const p = await isolated.newPage();
    try {
      const old = catalog.resources.find(r => r.dataset === 'character' && r.version === live && r.kind === 'index');
      const current = catalog.inventory.find(i => i.dataset === 'character' && i.version === latest);
      await isolated.route(`**/${old.file}`, async route => { await new Promise(r => setTimeout(r, 1100)); await route.continue(); });
      await go(p); await p.getByLabel('เวอร์ชันข้อมูล', { exact: true }).selectOption(latest);
      await visible(p.locator('.nk-entity-card')); await p.waitForTimeout(1400);
      assert.equal(await p.getByLabel('เวอร์ชันข้อมูล', { exact: true }).inputValue(), latest);
      assert.ok((await p.locator('.nk-main-heading').textContent()).includes(String(current.count)));
    } finally { await isolated.close(); }
  });
  await run('Missing snapshot and HTML response display errors and retry successfully', 'INJECTED_FAILURE_ONLY', async () => {
    const isolated = await browser.newContext(); const p = await isolated.newPage();
    try {
      await isolated.route('**/nanoka/current.json', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      await p.goto(origin + base, { waitUntil: 'domcontentloaded' }); await visible(p.getByText('ยังเปิดชุดข้อมูลไม่ได้', { exact: true }));
      await shot(p, 'error-missing-snapshot-INJECTED.png');
      await isolated.unroute('**/nanoka/current.json');
      await isolated.route('**/nanoka/current.json', r => r.fulfill({ contentType: 'text/html', body: '<html>TEST failure</html>' }));
      await p.getByRole('button', { name: 'ลองโหลด snapshot อีกครั้ง', exact: true }).click(); await visible(p.getByText('ได้รับข้อมูลที่ไม่ใช่ JSON', { exact: true }));
      await isolated.unroute('**/nanoka/current.json');
      await p.getByRole('button', { name: 'ลองโหลด snapshot อีกครั้ง', exact: true }).click(); await visible(p.locator('.nk-entity-card'));
    } finally { await isolated.close(); }
  });
  await run('Image failures keep names and usable cards', 'INJECTED_IMAGE_FAILURE', async () => {
    const isolated = await browser.newContext(); const p = await isolated.newPage();
    try { await isolated.route('https://static.nanoka.cc/assets/**', r => r.abort()); await go(p); await visible(p.locator('.nk-entity-card')); await p.waitForTimeout(300); assert.ok(await p.locator('.nk-image span').count() > 0); assert.ok((await p.locator('.nk-card-name strong').first().textContent()).length > 0); }
    finally { await isolated.close(); }
  });
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
  assert.equal(sourceJsonRequests.length, 0, 'The application must load local snapshot JSON, not call upstream in the browser.');
} finally {
  await context.close(); await browser.close();
  await fs.writeFile(path.join(out, 'BROWSER_TEST_RESULTS.json'), JSON.stringify({ runId: catalog.runId, origin, finishedAt: new Date().toISOString(), results, pageErrors, sourceJsonRequests }, null, 2));
}
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
