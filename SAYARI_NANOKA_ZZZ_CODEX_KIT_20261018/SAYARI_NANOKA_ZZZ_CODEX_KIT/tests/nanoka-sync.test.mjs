/** Synthetic fixtures only. NEVER use these responses as application game data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonCollector, atPointer, extractIds, fillTemplate, inspectJson, parseArgs, readJson, retryAfterMs, runSync, selectVersions, sha256, validateDataUrl, writeJson } from '../scripts/nanoka-sync.mjs';
import { exportSnapshot } from '../scripts/export-for-vite.mjs';

async function temporary(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sayari-nanoka-test-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;
}
const jsonResponse=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
function options(output,fetchImpl,extra={}) {return {output,fetchImpl,delayMs:0,timeoutMs:1000,maxAttempts:2,maxRequests:100,maxBodyBytes:1024*1024,cacheMaxAgeHours:24,sleepImpl:async()=>{},...extra};}
const context={dataset:'test_only',kind:'raw',version:'0.0-test',language:'en',id:null,referenceUrl:'https://zzz.nanoka.cc/'};
const sourceUrl='https://static.nanoka.cc/zzz/0.0-test/en/item.json';
const manifest={zzz:{live:'0.0-test',latest:'0.0-test',available:['0.0-test','0.0-older']}};
const definition={key:'character',label:'TEST FIXTURE',required:true,localizedIndex:false,recordsPointer:'',idField:'id',idPattern:'^[0-9]+$',indexPath:'/zzz/{version}/character.json',detailPath:'/zzz/{version}/{lang}/character/{id}.json',localizedDetail:true,referenceList:'https://zzz.nanoka.cc/character',referenceDetail:'https://zzz.nanoka.cc/character/{id}',evidence:{sourceUrl:'https://zzz.nanoka.cc/',kind:'synthetic_test_only'}};

async function runFakeSync(t,brokenIndex=false) {
  const dir=await temporary(t);
  const registry=path.join(dir,'test-registry.json');
  await writeJson(registry,{baseUrl:'https://static.nanoka.cc',manifestPath:'/manifest.json',referenceUrl:'https://zzz.nanoka.cc/',datasets:[definition]});
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(url);
    const parsed=new URL(url);
    if(parsed.pathname==='/manifest.json')return jsonResponse(manifest);
    if(parsed.pathname.endsWith('/character.json'))return brokenIndex?jsonResponse({error:'test not found'},404):jsonResponse({'1011':{name:'TEST_ONLY_AGENT'},'2011':{name:'TEST_ONLY_MC'}});
    const id=parsed.pathname.split('/').at(-1).replace('.json','');
    return jsonResponse({id,name:'TEST_ONLY_DETAIL',stats:{Tags:['TEST_TAG'],atk:0},future_field:{active:false,value:null},empty:[]});
  };
  const result=await runSync(options(path.join(dir,'out'),fetchImpl,{registry,channels:['live','latest'],languages:['en','ja'],quiet:true,mode:'sync'}));
  return {dir,result,calls,out:path.join(dir,'out')};
}

test('template encodes +build, keeps ID as a string',()=>{
  assert.equal(fillTemplate('/zzz/{version}/{lang}/character/{id}.json',{version:'3.3.12+123',lang:'en',id:'001'}),'/zzz/3.3.12%2B123/en/character/001.json');
  assert.throws(()=>fillTemplate('{id}',{id:'../secret'}));
});
test('live/latest are deduplicated without inventing a version',()=>{
  assert.deepEqual(selectVersions(manifest),[{version:'0.0-test',channels:['live','latest']}]);
  assert.throws(()=>selectVersions({zzz:{available:[]}}),/missing/);
  assert.throws(()=>selectVersions(manifest,[],['not-published']),/not published/);
});
test('historical versions are opt-in',()=>{
  assert.equal(selectVersions(manifest).length,1);
  assert.equal(selectVersions(manifest,[],[],true).length,2);
});
test('IDs include MCs and leading zero IDs',()=>{
  const ids=extractIds({'2011':{},'2021':{},'001':{}},definition).ids;
  assert.ok(ids.includes('2011')&&ids.includes('2021')&&ids.includes('001'));
});
test('invalid index keys and unsafe IDs are reported, not silently hidden',()=>{
  const found=extractIds({'1011':{},meta:{}},definition);
  assert.equal(found.rejected.length,1);
  assert.equal(extractIds([{id:Number.MAX_SAFE_INTEGER+1}],definition).rejected.length,1);
});
test('JSON Pointer supports escaped property names and only own fields',()=>{
  assert.equal(atPointer({'a/b':{'~x':0}},'/a~1b/~0x'),0);
  assert.throws(()=>atPointer({},'/toString'));
  assert.throws(()=>atPointer({},'not-a-pointer'));
});
test('schema inspection does not drop null, false, zero, Tags or empty arrays',()=>{
  const data={zero:0,no:false,nil:null,empty:[],stats:{Tags:['keep']}};
  const before=JSON.stringify(data);const info=inspectJson(data);
  assert.equal(JSON.stringify(data),before);
  assert.equal(info.leaves,5);assert.ok(info.topLevelKeys.includes('stats'));
});
test('unsafe numbers are flagged while raw storage remains lossless',()=>{
  assert.equal(inspectJson(JSON.parse('{"large":9007199254740993}')).unsafeNumberCount,1);
});
test('URL allowlist refuses other games, credentials and unrelated origins',()=>{
  assert.equal(validateDataUrl(sourceUrl),sourceUrl);
  for(const url of ['https://evil.example/a.json','https://static.nanoka.cc/hsr/a.json','http://static.nanoka.cc/manifest.json','https://zzz.nanoka.cc/?token=secret','https://u:p@zzz.nanoka.cc/'])assert.throws(()=>validateDataUrl(url));
});
test('Retry-After parses both seconds and date',()=>{
  assert.equal(retryAfterMs('2'),2000);
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT',1000),9000);
  assert.equal(retryAfterMs('not-a-date'),null);
});
test('collector retains original bytes, without assigning sourceUpdatedAt',async t=>{
  const dir=await temporary(t);const raw=' { "zero":0, "large":9007199254740993 }\n';
  const client=new JsonCollector(options(dir,async()=>new Response(raw,{headers:{'Content-Type':'text/plain','Last-Modified':'Thu, 01 Jan 1970 00:00:10 GMT'}})));
  const result=await client.get(sourceUrl,context);
  assert.equal(result.record.status,'fetched');
  assert.equal(await fs.readFile(path.join(dir,result.record.file),'utf8'),raw);
  assert.equal(result.record.sourceUpdatedAt,null);
  assert.equal(result.record.jsonShape.unsafeNumberCount,1);
});
test('cache reuse preserves original fetchedAt and makes no upstream call',async t=>{
  const dir=await temporary(t);const first=new JsonCollector(options(dir,async()=>jsonResponse({id:'001'})));
  const a=await first.get(sourceUrl,context);
  const second=new JsonCollector(options(dir,async()=>{throw new Error('must not be called');}));
  const b=await second.get(sourceUrl,context);
  assert.equal(b.record.status,'cache');assert.equal(b.record.fetchedAt,a.record.fetchedAt);
  assert.equal(b.record.checkedAt,null);assert.equal(second.requests,0);
});
test('damaged cached object is rejected and fetched again',async t=>{
  const dir=await temporary(t);const a=await new JsonCollector(options(dir,async()=>jsonResponse({one:1}))).get(sourceUrl,context);
  await fs.writeFile(path.join(dir,a.record.file),'BROKEN');
  let calls=0;const client=new JsonCollector(options(dir,async()=>{calls++;return jsonResponse({one:1});}));
  const b=await client.get(sourceUrl,context);assert.equal(calls,1);assert.equal(b.record.status,'fetched');
});
test('HTML with HTTP 200 is not a successful JSON resource',async t=>{
  const dir=await temporary(t);const client=new JsonCollector(options(dir,async()=>new Response('<html>challenge</html>')));
  const result=await client.get(sourceUrl,context);assert.equal(result.record.status,'invalid_json');assert.equal(result.record.file,null);
});
test('403 stops subsequent network calls on that origin; no bypass',async t=>{
  const dir=await temporary(t);let calls=0;const client=new JsonCollector(options(dir,async()=>{calls++;return new Response('',{status:403});}));
  const a=await client.get(sourceUrl,context);const b=await client.get(sourceUrl.replace('item','other'),context);
  assert.equal(a.record.httpStatus,403);assert.equal(b.record.status,'blocked_origin');assert.equal(calls,1);
});
test('429 retries honor Retry-After and clear a recovered error',async t=>{
  const dir=await temporary(t);let calls=0;const delays=[];
  const client=new JsonCollector(options(dir,async()=>++calls===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):jsonResponse({ok:true}),{sleepImpl:async ms=>{delays.push(ms);}}));
  const result=await client.get(sourceUrl,context);assert.equal(result.record.status,'fetched');assert.equal(result.record.error,undefined);assert.ok(delays.includes(2000));
});
test('request budget exhaustion is explicit, not silently treated as complete',async t=>{
  const dir=await temporary(t);const client=new JsonCollector(options(dir,async()=>jsonResponse({ok:true}),{maxRequests:1}));
  await client.get(sourceUrl,context);const b=await client.get(sourceUrl.replace('item','other'),context);assert.equal(b.record.status,'blocked_budget');
});
test('body byte limit is enforced',async t=>{
  const dir=await temporary(t);const client=new JsonCollector(options(dir,async()=>jsonResponse({text:'x'.repeat(500)}),{maxBodyBytes:40}));
  const result=await client.get(sourceUrl,context);assert.equal(result.record.status,'failed');assert.match(result.record.error,/BODY_TOO_LARGE/);
});
test('fake full sync enumerates every ID in every selected language',async t=>{
  const {result,calls}=await runFakeSync(t);
  assert.equal(result.coverage.registeredScopeComplete,true);
  assert.equal(result.coverage.entireProviderApiComplete,false);
  assert.equal(result.coverage.scheduledDetailResources,4);
  assert.equal(calls.length,6); // manifest + index + 2 IDs x 2 languages
  assert.equal(result.catalog.resources.filter(r=>r.id==='2011').length,2);
});
test('missing index leaves unknown descendants and blocks completion',async t=>{
  const {result}=await runFakeSync(t,true);
  assert.equal(result.coverage.registeredScopeComplete,false);
  assert.ok(result.coverage.issues.some(i=>i.type==='unresolved_index'));
});
test('publisher verifies objects and only then exposes the pointer',async t=>{
  const {result,out,dir}=await runFakeSync(t);
  const dest=path.join(dir,'public','nanoka');
  const pointer=await exportSnapshot({out,dest});
  assert.equal(pointer.runId,result.catalog.runId);
  const published=await readJson(path.join(dest,pointer.catalog));
  const resource=published.resources.find(r=>r.kind==='detail');
  const bytes=await fs.readFile(path.join(dest,path.dirname(pointer.catalog),resource.file));
  assert.equal(sha256(bytes),resource.sha256);
  assert.deepEqual(JSON.parse(bytes).future_field,{active:false,value:null});
});
test('publisher refuses a partial snapshot by default',async t=>{
  const {out,dir}=await runFakeSync(t,true);
  await assert.rejects(exportSnapshot({out,dest:path.join(dir,'public','nanoka')}),/Partial run refused/);
});
test('CLI arguments are strict and split lists',()=>{
  assert.deepEqual(parseArgs(['--languages','en,ja','--max-requests','30','--refresh']),{languages:['en','ja'],maxRequests:30,refresh:true});
  assert.throws(()=>parseArgs(['--unknown','1']));assert.throws(()=>parseArgs(['--out']));
});
