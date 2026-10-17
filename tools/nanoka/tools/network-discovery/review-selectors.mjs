/** Bounded follow-up of version-comparison and local sort controls observed in review.mjs. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, validateDataUrl, writeAtomic, writeJson } from '../../scripts/nanoka-sync.mjs';
const latestRun = JSON.parse(await fs.readFile('.nanoka/latest-run.json', 'utf8'));
const probe = JSON.parse(await fs.readFile(`.nanoka/runs/${latestRun.runId}/catalog.json`, 'utf8'));
const live = probe.versions.find(v => v.channels.includes('live')).version;
const latest = probe.versions.find(v => v.channels.includes('latest')).version;
const previous = JSON.parse(await fs.readFile('.nanoka/review/observed-urls.json', 'utf8'));
const filtersOnly = process.argv.includes('--filters-only');
const out = filtersOnly ? '.nanoka/filter-review' : '.nanoka/selector-review';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const records = [], controls = [], pending = new Set();
let sourcePage = '';
await context.route('**/*', route => {
  const r = route.request(), u = new URL(r.url());
  return !['GET', 'HEAD'].includes(r.method()) || !['zzz.nanoka.cc', 'static.nanoka.cc'].includes(u.hostname) || ['image', 'font', 'media'].includes(r.resourceType()) ? route.abort() : route.continue();
});
const page = await context.newPage();
page.on('response', response => {
  let url; try { url = validateDataUrl(response.url()); } catch { return; }
  if (!/json/i.test(response.headers()['content-type'] ?? '') && !/\.json(?:\?|$)/i.test(url)) return;
  const row = { url, status: response.status(), pageUrl: sourcePage, observedAt: new Date().toISOString(), isJson: false };
  records.push(row);
  const job = (async () => {
    if (!response.ok()) return;
    try { const bytes = await response.body(); JSON.parse(bytes.toString('utf8')); row.isJson = true; row.sha256 = sha256(bytes); row.file = `bodies/${row.sha256}.json`; await writeAtomic(path.join(out, row.file), bytes); }
    catch (error) { row.error = error.message; }
  })();
  pending.add(job); job.finally(() => pending.delete(job)).catch(() => {});
});
try {
  const targets = filtersOnly ? [] : previous.reviews.filter(r => r.controls?.length > 2).map(r => r.url);
  for (const original of targets) {
    let url = original;
    const family = new URL(url).pathname.split('/').filter(Boolean)[0];
    if (new URL(url).pathname.split('/').filter(Boolean).length === 2) {
      const inventory = probe.inventory.find(i => i.dataset === family && i.version === live);
      if (inventory?.ids.length) url = `https://zzz.nanoka.cc/${family}/${inventory.ids[0]}`;
    }
    sourcePage = url;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok()) throw new Error(`Page HTTP ${response?.status()}: ${url}`);
    await page.locator('select').nth(2).waitFor({ state: 'attached', timeout: 25000 });
    await page.waitForTimeout(700);
    const count = await page.locator('select').count();
    for (let i = 2; i < count; i++) {
      const selector = page.locator('select').nth(i);
      const values = await selector.locator('option').evaluateAll(options => options.map(o => o.value));
      const isVersion = values.includes(live) || values.includes(latest);
      for (const value of isVersion ? values.filter(v => [live, latest].includes(v)) : values) {
        await selector.selectOption(value, { force: true }); await page.waitForTimeout(650);
        controls.push({ pageUrl: url, selectorIndex: i, value, kind: isVersion ? 'selected_scope_version_comparison' : 'local_sort', at: new Date().toISOString() });
      }
    }
    console.log(JSON.stringify({ url, selectors: count - 2 }));
  }
  for (const family of ['character', 'weapon', 'bangboo', 'equipment', 'item', 'monster', 'achievement', 'hollow', 'diff', 'simul/201']) {
    sourcePage = `https://zzz.nanoka.cc/${family}`;
    const response = await page.goto(sourcePage, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()}: ${sourcePage}`);
    await page.locator('select').first().waitFor({ state: 'attached', timeout: 25000 }); await page.waitForTimeout(600);
    const names = await page.getByRole('button').evaluateAll(buttons => buttons.map(b => b.textContent?.trim()).filter(Boolean));
    const reviewed = [];
    for (const label of [...new Set(names)]) {
      if (/download|incomplete|complete achievement|endgame|^reset$/i.test(label)) continue;
      if (family === 'achievement' && !/\d+\s*\/\s*\d+.*\d+\s*\/\s*\d+/.test(label)) continue; // groups only, no personal completion toggles
      // CSS text matching avoids duplicating an image's alt text in the accessible name.
      const escaped = label.trim().split(/\s+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      const button = page.locator('button').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first();
      if (!await button.isVisible()) continue;
      await button.click(); await page.waitForTimeout(250);
      controls.push({ pageUrl: sourcePage, label, kind: family.startsWith('simul/') ? 'stage_selection' : 'category_filter_or_tab', at: new Date().toISOString() });
      reviewed.push(label);
    }
    console.log(JSON.stringify({ url: sourcePage, filterButtons: reviewed.length }));
  }
  await Promise.allSettled([...pending]);
  await writeJson(path.join(out, 'observed-urls.json'), { schemaVersion: 1, reviewedAt: new Date().toISOString(), selectedScope: [live, latest], controls, records, note: 'Historical comparison options intentionally excluded from downloaded scope. Source shapes preserve all levels; local level controls do not define extra datasets.' });
} finally { await browser.close(); }
