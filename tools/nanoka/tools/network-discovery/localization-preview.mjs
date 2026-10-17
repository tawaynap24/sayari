import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const origin=process.env.SAYARI_PREVIEW_ORIGIN??'http://127.0.0.1:4173',sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const pointer=await read('public/localization/current.json'),manifest=await read(path.join('public/localization',pointer.manifest));
const checked=[];
for(const relative of ['current.json',pointer.manifest,...new Set(Object.values(manifest.resources).map(e=>e.file))]){
  const bytes=await fs.readFile(path.join('public/localization',relative)),dist=await fs.readFile(path.join('dist/localization',relative));assert.equal(sha(dist),sha(bytes));checked.push({file:relative,bytes:dist.length,sha256:sha(dist)});
}
const responses=[];
for(const route of ['/','/game/zenless-zone-zero','/game/zenless-zone-zero/database','/localization/current.json',`/localization/${pointer.manifest}`,...Object.values(manifest.resources).slice(0,4).map(e=>`/localization/${e.file}`)]){
  const r=await fetch(origin+route),bytes=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type');assert.equal(r.status,200);if(route.endsWith('.json')){assert.match(type,/application\/json/);assert.ok(JSON.parse(bytes));}else assert.match(type,/text\/html/);responses.push({route,status:r.status,contentType:type,bytes:bytes.length});
}
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'en-US'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/game/zenless-zone-zero/database?category=character&id=1011',{waitUntil:'domcontentloaded'});await page.locator('.nk-localization-status[data-localization-status="localized"]').waitFor({timeout:30000});assert.equal(await page.locator('html').getAttribute('lang'),'th-TH');await page.getByRole('tab',{name:'สกิล',exact:true}).click();assert.ok((await page.locator('.nk-reading-cards').textContent()).includes('ความเสียหายกายภาพ'));await page.locator('.nk-readable').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/localization-th/screenshots/production-agent-th.png',animations:'disabled'});assert.deepEqual(errors,[]);
}finally{await browser.close()}
const result={at:new Date().toISOString(),status:'PASS',mode:'LOCAL_PRODUCTION_PREVIEW_ONLY',deployed:false,origin,nanokaRunId:manifest.nanokaRunId,sourceRevision:manifest.sourceRevision,localizedFilesCopiedAndHashed:checked.length,files:checked,http:responses,pageErrors:errors};await fs.writeFile('evidence/localization-th/production-preview.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,files:checked.length,routes:responses.length}));
