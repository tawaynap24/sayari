/** Synthetic renderer/error fixtures. NEVER written under public/ or counted as live coverage. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evidenceDirectory } from '../../scripts/evidence.mjs';
const origin = process.env.ZZZ_TEST_ORIGIN ?? 'http://127.0.0.1:5173';
const out = await evidenceDirectory(), shots = path.join(out, 'screenshots');
await fs.mkdir(shots, { recursive: true });
const base = '/game/zenless-zone-zero/database';
const hash = value => createHash('sha256').update(value).digest('hex');
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
function fixture({ empty = false, nullRecord = false, missingDetail = false, brokenHash = false, invalidManifest = false } = {}) {
  const value = { TEST_ONLY: { id: 'TEST_ONLY', name: 'TEST ONLY — synthetic renderer fixture', stats: { zero: 0 }, materials: { '999999': 0 }, future_unknown: { zero: 0, no: false, nil: null, emptyArray: [], emptyObject: {}, emptyString: '', 'a/b~c': '<img src=x onerror="window.TEST_EXECUTED=true"><script>window.TEST_EXECUTED=true</script>', large: 'UNSAFE_NUMBER_TOKEN', longArray: Array.from({ length: 65 }, (_, i) => `TEST-END-${i}`) } } };
  const raw = JSON.stringify(empty ? {} : nullRecord ? { TEST_ONLY: null } : value).replace('"UNSAFE_NUMBER_TOKEN"', '9007199254740993');
  const digest = hash(raw), file = `objects/${digest}.json`, stamp = '2000-01-01T00:00:00.000Z';
  const index = { dataset: 'fixture_test', kind: 'index', version: 'TEST_ONLY', language: 'en', id: null, url: 'https://static.nanoka.cc/zzz/TEST_ONLY/en/TEST_ONLY.json', referenceUrl: 'https://zzz.nanoka.cc/', status: 'fetched', file, sha256: digest, bytes: Buffer.byteLength(raw), fetchedAt: stamp, checkedAt: stamp, jsonShape: { unsafeNumberCount: empty ? 0 : 1 } };
  const catalog = { schemaVersion: 1, provider: 'Nanoka ZZZ', runId: 'TEST_ONLY', generatedAt: stamp, manifest: invalidManifest ? {} : { zzz: { live: 'TEST_ONLY', latest: 'TEST_ONLY', available: ['TEST_ONLY'] } }, versions: [{ version: 'TEST_ONLY', channels: ['live', 'latest'] }], languages: ['en', 'ja'], definitions: [{ key: 'fixture_test', label: 'TEST ONLY fixtures', detailPath: missingDetail ? '/TEST_ONLY/{id}' : null, localizedIndex: true, localizedDetail: true, recordsPointer: '', idField: 'id', referenceList: 'https://zzz.nanoka.cc/' }], resources: [index], inventory: [{ dataset: 'fixture_test', version: 'TEST_ONLY', language: 'en', count: empty ? 0 : 1, ids: empty ? [] : ['TEST_ONLY'] }], coverage: { status: 'SYNTHETIC_TEST_ONLY', registeredScopeComplete: false, entireProviderApiComplete: false, successfulResources: 1, failedResources: missingDetail ? 1 : 0, issues: [] } };
  if (missingDetail) catalog.resources.push({ ...index, kind: 'detail', id: 'TEST_ONLY', url: 'https://static.nanoka.cc/zzz/TEST_ONLY/en/TEST_ONLY/TEST_ONLY.json', file: null, sha256: undefined, status: 'failed', httpStatus: 503, error: 'TEST ONLY injected HTTP 503' });
  return { raw: brokenHash ? '{}' : raw, catalog, file };
}
async function scenario(name, settings, fn) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const data = fixture(settings), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route(`${origin}/nanoka/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    let body;
    if (pathname.endsWith('/current.json')) { if (settings.delay) await new Promise(r => setTimeout(r, 1200)); body = JSON.stringify({ schemaVersion: 1, provider: 'Nanoka ZZZ', runId: 'TEST_ONLY', catalog: 'snapshots/TEST_ONLY/catalog.json', publishedAt: '2000-01-01T00:00:00Z' }); }
    else if (pathname.endsWith('/catalog.json')) body = JSON.stringify(data.catalog);
    else if (pathname.endsWith(data.file)) body = data.raw;
    else if (pathname.endsWith('/discovery.json')) body = JSON.stringify({ runId: 'TEST_ONLY', status: 'SYNTHETIC_TEST_ONLY', categories: [], notes: ['TEST ONLY fixture. Not live game coverage.'] });
    else return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    await route.fulfill({ contentType: 'application/json', body });
  });
  try {
    await page.goto(`${origin}${base}?category=fixture_test${settings.list || settings.invalidManifest ? '' : '&id=TEST_ONLY'}${settings.fallback ? '&lang=ja' : ''}`, { waitUntil: 'domcontentloaded' });
    await fn(page, data);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    results.push({ name, kind: 'SYNTHETIC_TEST_ONLY', status: 'PASS' }); console.log(`PASS ${name}`);
  } catch (error) { results.push({ name, kind: 'SYNTHETIC_TEST_ONLY', status: 'FAIL', error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); await fs.writeFile(path.join(out, 'BROWSER_EDGE_TEST_RESULTS.json'), JSON.stringify({ note: 'All scenarios are injected tests, not live game/API evidence.', origin, results }, null, 2)); }
}
try {
  await scenario('Unknown fields retain 0/false/null/empty containers; literal HTML never executes; array tail reachable', {}, async (page, data) => {
    await page.getByRole('tab', { name: /ข้อมูลเพิ่มเติมจาก API/ }).click();
    const future = page.locator('summary').filter({ has: page.getByText('future_unknown', { exact: true }) }).first(); await future.click();
    for (const text of ['false', 'null', '[]', '{}', 'ข้อความว่าง']) await page.getByText(text, { exact: true }).first().waitFor();
    assert.equal(await page.locator('.nk-detail-content img, .nk-detail-content script').count(), 0);
    assert.equal(await page.evaluate(() => window.TEST_EXECUTED), undefined);
    await page.getByText(/ตัวเลขเกินความแม่นยำของ JavaScript/).waitFor();
    const summary = page.locator('summary').filter({ has: page.getByText('longArray', { exact: true }) }).first(); await summary.click();
    const array = summary.locator('..'); await array.getByRole('button', { name: 'หน้าสุดท้าย', exact: true }).click();
    await page.getByText('TEST-END-64', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Raw / Explorer', exact: true }).click();
    await page.getByRole('button', { name: 'แสดงข้อความต้นฉบับครบทั้งหมด', exact: true }).click();
    assert.ok((await page.locator('.nk-raw-text').textContent()).includes('9007199254740993'));
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'ดาวน์โหลด JSON เต็ม ↓', exact: true }).click();
    assert.equal(hash(await fs.readFile(await (await download).path())), hash(data.raw));
    await page.getByLabel('ค้นหา field หรือค่าทุกตำแหน่ง', { exact: true }).fill('/future_unknown/longArray/64');
    await page.locator('.nk-search-matches').getByText('TEST-END-64', { exact: true }).waitFor();
  });
  await scenario('Requested JA fallback to EN is explicitly disclosed', { fallback: true }, async page => { await page.getByText('ไม่มีข้อมูลภาษาที่เลือก — กำลังแสดง EN', { exact: true }).waitFor(); });
  await scenario('A null selected record does not fall back to searching the entire resource', { nullRecord: true }, async page => {
    await page.getByRole('tab', { name: 'Raw / Explorer', exact: true }).click();
    await page.getByLabel('ค้นหา field หรือค่าทุกตำแหน่ง', { exact: true }).fill('TEST_ONLY');
    await page.getByText('0 ผลลัพธ์', { exact: true }).waitFor();
  });
  await scenario('Valid empty differs from request failure', { empty: true, list: true }, async page => { await page.getByText('ต้นทางส่งรายการว่างที่อ่านได้สำเร็จ', { exact: true }).waitFor(); assert.equal(await page.getByRole('alert').count(), 0); });
  await scenario('Failed detail keeps the indexed record and explicit error; partial badge visible', { missingDetail: true }, async page => {
    await page.getByText(/TEST ONLY injected HTTP 503/).waitFor(); await page.getByText('ข้อมูลยังมีขอบเขตที่ต้องตรวจเพิ่มเติม', { exact: true }).waitFor();
    await page.evaluate(() => { const banner = document.createElement('div'); banner.textContent = 'TEST ONLY · injected HTTP 503'; banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffd353;color:#000;padding:8px;z-index:9999;text-align:center'; document.body.append(banner); });
    await page.locator('.nk-detail-hero').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(shots, 'partial-detail-INJECTED-TEST-ONLY.png') });
    await page.getByRole('button', { name: '← กลับไปรายการ', exact: true }).click(); await page.locator('.nk-entity-card').first().waitFor();
  });
  await scenario('Unresolved material keeps its ID and zero quantity', {}, async page => { await page.getByRole('tab', { name: 'วัสดุ', exact: true }).click(); await page.getByText('วัสดุ #999999 · ยังจับคู่ชื่อไม่ได้', { exact: true }).waitFor(); await page.getByText('0', { exact: true }).first().waitFor(); });
  await scenario('Damaged object refuses display', { brokenHash: true, list: true }, async page => { await page.getByText(/ไม่ผ่านการตรวจ SHA-256/).waitFor(); });
  await scenario('Changed manifest schema refuses a misleading database', { invalidManifest: true }, async page => { await page.getByText('ยังเปิดชุดข้อมูลไม่ได้', { exact: true }).waitFor(); await page.getByText('โครงสร้าง catalog ไม่ตรงกับ snapshot', { exact: true }).waitFor(); });
  await scenario('Loading state is shown while the pointer is pending', { delay: true, list: true }, async page => { await page.getByText('กำลังตรวจและโหลดชุดข้อมูล…', { exact: true }).waitFor(); await page.locator('.nk-entity-card').first().waitFor(); });
} finally { await browser.close(); }
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
