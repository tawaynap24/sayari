#!/usr/bin/env node
/** Observe public GET/JSON traffic. This is bounded reconnaissance, NOT exhaustive sign-off. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson, writeAtomic, sha256, validateDataUrl } from '../../scripts/nanoka-sync.mjs';

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const options = { out: '.nanoka/discovery', maxPages: 40, waitMs: 2000, channel: null, headed: false };
for (let i=2; i<process.argv.length; i++) {
  const arg=process.argv[i];
  if(arg==='--headed') { options.headed=true; continue; }
  const key={'--out':'out','--max-pages':'maxPages','--wait-ms':'waitMs','--channel':'channel','--playwright-module':'playwrightModule'}[arg];
  if(!key || !process.argv[i+1] || process.argv[i+1].startsWith('--')) throw new Error(`Invalid option ${arg}`);
  options[key]=['maxPages','waitMs'].includes(key)?Number(process.argv[++i]):process.argv[++i];
}
if(!Number.isInteger(options.maxPages)||options.maxPages<1||!Number.isFinite(options.waitMs)||options.waitMs<0) throw new Error('Invalid limits');
const out=path.resolve(options.out);
await fs.mkdir(out,{recursive:true});
let playwright;
try {
  if(options.playwrightModule) playwright=await import(options.playwrightModule);
  else {
    try { playwright=await import('playwright'); }
    catch { playwright=await import('@playwright/test'); }
  }
} catch {
  await writeJson(path.join(out,'DISCOVERY_BLOCKED.json'),{at:new Date().toISOString(),reason:'Playwright module not available; see docs/07. Do not mark discovery complete.'});
  throw new Error('No Playwright module. Reuse the Codex browser tool, or install a reviewed Playwright version inside tools/network-discovery, then rerun.');
}
const chromium=playwright.chromium ?? playwright.default?.chromium;
if(!chromium) throw new Error('Selected module does not export chromium');
const browser=await chromium.launch({headless:!options.headed,...(options.channel?{channel:options.channel}:{})});
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();
const definitions=await JSON.parse(await fs.readFile(path.join(kit,'reference/discovery-review.template.json'),'utf8'));
const queue=definitions.routes.map(r=>r.url);
const visited=new Set();
const allLinks=new Set(queue);
const sampledDetails=new Set();
const records=[];
const pageOutcomes=[];
const blockedRequests=[];
const pending=new Set();
let activePageUrl='https://zzz.nanoka.cc/';
let haltReason=null;
const timestamp=()=>new Date().toISOString();
function permitted(url) {try{return validateDataUrl(url);}catch{return null;}}
// GET/HEAD only. Do not send forms, login data, or speculative write requests.
await context.route('**/*',async route=>{
  const request=route.request();
  if(!['GET','HEAD'].includes(request.method())) {
    blockedRequests.push({url:request.url(),method:request.method(),reason:'observer is read-only'});
    return route.abort();
  }
  if(['image','font','media'].includes(request.resourceType())) return route.abort();
  return route.continue();
});
page.on('response',response=>{
  const url=permitted(response.url());
  if(!url) return;
  const request=response.request();
  const type=request.resourceType();
  const headers=response.headers();
  const likelyJson=/json/i.test(headers['content-type']??'') || /\.json(?:\?|$)/i.test(url);
  if(!likelyJson) return;
  const sourcePage=activePageUrl;
  const task=(async()=>{
    const row={url,status:response.status(),method:request.method(),resourceType:type,pageUrl:sourcePage,observedAt:timestamp(),contentType:headers['content-type']??null,isJson:false};
    records.push(row);
    if([401,403,429].includes(row.status)) haltReason=`Upstream returned HTTP ${row.status}; no bypass attempted`;
    if(row.status<200||row.status>=300) return;
    if(Number(headers['content-length']??0)>33554432) {row.error='Body too large for observer; use reviewed collector limit';return;}
    try {
      const body=await response.body();
      if(body.byteLength>33554432) {row.error='Body exceeds 32 MiB; not saved';return;}
      JSON.parse(body.toString('utf8'));
      row.isJson=true;row.sha256=sha256(body);row.bytes=body.byteLength;
      row.file=`bodies/${row.sha256}.json`;
      await writeAtomic(path.join(out,row.file),body);
    } catch(error) {row.error=error.message;}
  })();
  pending.add(task);task.finally(()=>pending.delete(task)).catch(()=>{});
});
page.on('requestfailed',request=>{
  const url=permitted(request.url());
  if(url&&/\.json(?:\?|$)/i.test(url)) records.push({url,status:null,isJson:false,pageUrl:activePageUrl,observedAt:timestamp(),resourceType:request.resourceType(),error:request.failure()?.errorText??'request failed'});
});
try {
  while(queue.length&&visited.size<options.maxPages&&!haltReason) {
    const url=queue.shift();if(visited.has(url))continue;
    visited.add(url);activePageUrl=url;
    const outcome={url,visitedAt:timestamp(),status:null,allSelectorsInspected:false};
    pageOutcomes.push(outcome);
    try {
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      outcome.status=response?.status()??null;
      if([401,403,429].includes(outcome.status)){haltReason=`Page HTTP ${outcome.status}`;break;}
      await page.waitForTimeout(options.waitMs);
      outcome.title=await page.title();
      const controls=await page.locator('select, [role="tab"], [role="combobox"]').evaluateAll(elements=>elements.map(el=>({tag:el.tagName,role:el.getAttribute('role'),text:el.textContent?.trim().slice(0,600)??'',ariaLabel:el.getAttribute('aria-label')})));
      outcome.controlsNeedingReview=controls;
      const links=await page.locator('a[href]').evaluateAll(elements=>elements.map(el=>el.href));
      outcome.internalLinks=[];
      for(const link of links) {
        let parsed;try{parsed=new URL(link);}catch{continue;}
        if(parsed.origin!=='https://zzz.nanoka.cc')continue;
        parsed.hash='';
        if(/login|auth|account|logout/i.test(parsed.pathname))continue;
        const clean=parsed.href;allLinks.add(clean);outcome.internalLinks.push(clean);
        const parts=parsed.pathname.split('/').filter(Boolean);
        if(parts.length<=1&&!parsed.search) {if(!visited.has(clean)&&!queue.includes(clean))queue.push(clean);}
        else if(parts.length===2&&!sampledDetails.has(parts[0])) {
          sampledDetails.add(parts[0]);if(!visited.has(clean)&&!queue.includes(clean))queue.push(clean);
        }
      }
    }catch(error){outcome.error=error.message;}
    await page.waitForTimeout(500);
  }
  await Promise.allSettled([...pending]);
}finally {
  await writeJson(path.join(out,'observed-urls.json'),{schemaVersion:1,createdAt:timestamp(),records,pageOutcomes,blockedRequests,haltReason,
    remainingQueuedPages:queue.filter(url=>!visited.has(url)),allInternalLinks:[...allLinks],
    status:'AUTOMATIC_CAPTURE_ONLY_REQUIRES_MANUAL_SELECTOR_AND_FAMILY_REVIEW',
    warning:'Only automatically visited links and one detail sample per route family. Tabs, filters, language/version selectors and detail enumeration are NOT fully covered. Do not use this as full discovery sign-off.'});
  await browser.close();
}
console.log(`Observed ${records.length} candidate JSON responses across ${visited.size} pages. Review ${out}/observed-urls.json.`);
if(haltReason)process.exitCode=2;
