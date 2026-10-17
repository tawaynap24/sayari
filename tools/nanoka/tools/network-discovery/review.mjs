import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, writeJson, writeAtomic, validateDataUrl } from '../../scripts/nanoka-sync.mjs';
const root = process.cwd();
const out = path.join(root, '.nanoka', 'review');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
await context.route('**/*', route => {
  const r = route.request();
  const u = new URL(r.url());
  if (!['GET', 'HEAD'].includes(r.method()) || !['zzz.nanoka.cc', 'static.nanoka.cc'].includes(u.hostname) || ['image', 'font', 'media'].includes(r.resourceType())) return route.abort();
  return route.continue();
});
const page = await context.newPage();
const records = [];
const reviews = [];
const pending = new Set();
let sourcePage = '';
page.on('response', response => {
  let url;
  try { url = validateDataUrl(response.url()); } catch { return; }
  if (!/json/i.test(response.headers()['content-type'] ?? '') && !/\.json(?:\?|$)/i.test(url)) return;
  const pageUrl = sourcePage;
  const job = (async () => {
    const row = { url, status: response.status(), isJson: false, pageUrl, observedAt: new Date().toISOString() };
    records.push(row);
    if (!response.ok()) return;
    try {
      const bytes = await response.body();
      JSON.parse(bytes.toString('utf8'));
      row.isJson = true; row.sha256 = sha256(bytes); row.file = `bodies/${row.sha256}.json`;
      await writeAtomic(path.join(out, row.file), bytes);
    } catch (error) { row.error = error.message; }
  })();
  pending.add(job); job.finally(() => pending.delete(job)).catch(() => {});
});
async function inspect(url) {
  sourcePage = url;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('select').first().waitFor({ state: 'attached', timeout: 25000 });
  await page.waitForTimeout(1400);
  if ([401, 403, 429].includes(response?.status())) throw new Error(`HTTP ${response.status()} at ${url}`);
  const review = { url, status: response?.status(), at: new Date().toISOString(), title: await page.title(), controls: [], tabs: [], buttons: [], images: [], embeddedUrls: [] };
  review.controls = await page.locator('select').evaluateAll(elements => elements.map(el => ({ value: el.value, options: [...el.options].map(o => ({ value: o.value, label: o.textContent })) })));
  review.buttons = await page.locator('button').evaluateAll(elements => elements.map(e => e.textContent?.trim()).filter(Boolean));
  review.images = await page.locator('img').evaluateAll(elements => elements.slice(0, 20).map(e => ({ src: e.src, alt: e.alt })));
  review.embeddedUrls = await page.locator('script[data-sveltekit-fetched]').evaluateAll(elements => elements.map(e => e.getAttribute('data-url')));
  const tabs = page.getByRole('tab');
  for (let i = 0, count = await tabs.count(); i < count && i < 40; i++) {
    const tab = tabs.nth(i);
    const label = await tab.innerText();
    if (await tab.isVisible()) { await tab.click(); await page.waitForTimeout(500); review.tabs.push(label); }
  }
  reviews.push(review);
  console.log(JSON.stringify({ url, title: review.title, tabs: review.tabs, buttons: review.buttons.slice(-35) }));
  await writeJson(path.join(out, 'review-progress.json'), { reviews, records });
  return review;
}
try {
  const rootReview = await inspect('https://zzz.nanoka.cc/');
  const languages = rootReview.controls[0]?.options.map(o => o.value) ?? [];
  const versions = rootReview.controls[1]?.options.filter(o => /live|latest/.test(o.label)).map(o => o.value) ?? [];
  for (const version of versions) {
    await page.locator('select').nth(1).selectOption(version, { force: true }); await page.waitForTimeout(1000);
    for (const language of languages) {
      await page.locator('select').nth(0).selectOption(language, { force: true }); await page.waitForTimeout(1000);
      reviews.push({ kind: 'global_selector', version, language, title: await page.title(), url: page.url(), at: new Date().toISOString() });
    }
  }
  await page.locator('select').nth(0).selectOption('en', { force: true }); await page.waitForTimeout(700);
  const routes = ['character', 'weapon', 'bangboo', 'equipment', 'item', 'monster', 'achievement', 'shiyu', 'hollow', 'diff', 'boss', 'simul', 'hard'];
  for (const route of routes) {
    const review = await inspect(`https://zzz.nanoka.cc/${route}`);
    if (route === 'hollow') {
      for (const label of review.buttons.filter(t => /resoni|gear|tactic|card|curio|lost|wither|invest|potential/i.test(t))) {
        const button = page.getByRole('button', { name: label, exact: true }).first();
        if (await button.isVisible()) { await button.click(); await page.waitForTimeout(700); review.tabs.push(label); }
      }
    }
  }
  const observed = JSON.parse(await fs.readFile(path.join(root, '.nanoka/discovery/observed-urls.json'), 'utf8'));
  const detailUrls = observed.pageOutcomes.filter(r => new URL(r.url).pathname.split('/').filter(Boolean).length === 2).map(r => r.url);
  for (const url of detailUrls) await inspect(url);
  await Promise.allSettled([...pending]);
  await writeJson(path.join(out, 'observed-urls.json'), { schemaVersion: 1, createdAt: new Date().toISOString(), records, reviews, selectorLanguages: languages, selectorVersions: versions });
} finally { await writeJson(path.join(out, 'review-progress.json'), { reviews, records }); await browser.close(); }
