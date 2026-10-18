/** Synthetic edge cases only. Real-source validation is performed separately by verify.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { TABLES, createResolver, sourceVersion, versionFamily, validateTextMap, textField } from './mapping.mjs';
import { validateSourceUrl } from './source.mjs';
import { generate } from './sync.mjs';
async function moduleFrom(file) { return import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`); }
const model=await moduleFrom('src/features/localization/model.ts');
const format=await moduleFrom('src/features/localization/format.ts');
function resolver({thai={name:'ชื่อ',skill:'สกิล {0}'},english={name:'Test Agent',skill:'Test skill {0}'},extra=[]}={}) {
  const row={PFOAJKNPCHL:1011,PBNPPFFJCGN:1011,name:'name',skill:'skill'};
  const tables=Object.fromEntries(TABLES.map(name=>[name,{IAEFFFFLKNB:[{...row}]}]));
  tables.AvatarBase.IAEFFFFLKNB.push(...extra);
  return createResolver(tables,english,thai,Object.fromEntries(Object.keys(thai).map(k=>[k,'TextMap/TextMap_THTemplateTb.json'])));
}
test('Thai is the default with absent, invalid, or inaccessible browser storage',()=>{
  assert.equal(model.storedLocale(null),'th-TH');
  assert.equal(model.storedLocale({getItem:()=>null}),'th-TH');
  assert.equal(model.storedLocale({getItem:()=>{throw new Error('blocked')}}),'th-TH');
  assert.equal(model.storedLocale({getItem:()=>'ja-JP'}),'th-TH');
  assert.equal(model.storedLocale({getItem:()=>'en-US'}),'en-US');
});
test('an ID/foreign-key join plus matching English text is required',()=>{
  const resolve=resolver();
  assert.equal(resolve('character','1011',{name:'Test Agent'}).match('Test skill {0}').th,'สกิล {0}');
  assert.equal(resolve('character','9999',{name:'Test Agent'}).identityVerified,false);
  assert.equal(resolve('character','1011',{name:'A different agent'}).identityVerified,false);
  assert.equal(resolve('unknown_dataset','1011',{name:'Test Agent'}).identityVerified,false);
});
test('similar names and changed English descriptions never produce a translation',()=>{
  const context=resolver()('character','1011',{name:'Test Agent'});
  assert.equal(context.match('Test skill {1}'),null);
  assert.equal(context.match('Test Agent 2'),null);
});
test('conflicting translations and missing Thai values fall back',()=>{
  const resolve=resolver({english:{name:'Test Agent',skill:'Test skill {0}',other:'Test skill {0}'},thai:{name:'ชื่อ',skill:'สกิล {0}',other:'ต่างกัน {0}'},extra:[{PFOAJKNPCHL:1011,key:'other'}]});
  assert.equal(resolve('character','1011',{name:'Test Agent'}).match('Test skill {0}'),null);
  assert.equal(resolver({thai:{name:'ชื่อ'}})('character','1011',{name:'Test Agent'}).match('Test skill {0}'),null);
});
test('missing or changed placeholders are incompatible',()=>{
  assert.equal(resolver({thai:{name:'ชื่อ',skill:'สกิล {1}'}})('character','1011',{name:'Test Agent'}).match('Test skill {0}'),null);
  assert.equal(model.formatText('{0} / {1}\n{0}',{'0':0}),'0 / {1}\n0');
  assert.equal(model.formatText('{0}',{'0':'<script>'}),'<script>');
});
test('only original string leaves change; zero, false, null, arrays, numbers and raw remain intact',()=>{
  const raw={name:'Test',stats:{attack:0,growth:12345},flag:false,nil:null,empty:[],numericString:'1200','a/b':{'~key':'Hello'}};
  const before=JSON.stringify(raw);
  const overlay={translations:{'/name':{en:'Test',th:'ชื่อ'},'/a~1b/~0key':{en:'Hello',th:'สวัสดี'},'/stats/attack':{en:0,th:'invalid'} }};
  const translated=model.applyOverlay(raw,overlay);
  assert.equal(translated.name,'ชื่อ');assert.equal(translated['a/b']['~key'],'สวัสดี');assert.deepEqual(translated.stats,raw.stats);assert.equal(translated.numericString,'1200');assert.equal(translated.flag,false);assert.equal(translated.nil,null);assert.deepEqual(translated.empty,[]);assert.equal(JSON.stringify(raw),before);
  assert.throws(()=>model.applyOverlay(raw,{translations:{'/name':{en:'Wrong',th:'ผิด'}}}),/ต้นฉบับ/);
});
test('game markup is allowlisted; executable tags, CSS and malformed tags remain literal',()=>{
  const segments=format.gameTextSegments('<color=#2BAD00><b>ไทย {0}</b></color>\\n<IconMap:Icon_Normal><img src=x onerror=alert(1)><color=url(javascript:x)>bad</color>');
  assert.ok(segments.some(s=>s.text==='ไทย {0}'&&s.bold&&s.color==='#2BAD00'));
  assert.ok(segments.some(s=>s.text==='\n'));
  assert.ok(segments.some(s=>s.icon));
  assert.ok(segments.some(s=>s.text.includes('<img')));
  assert.ok(segments.some(s=>s.text.includes('<color=url')));
  assert.ok(segments.every(s=>s.color===undefined||/^#[a-f0-9]{6}$/i.test(s.color)));
});
test('version validation distinguishes OS/CN metadata and forbids inferred versions',()=>{
  assert.equal(sourceVersion('CNPRODWin3.2.0_R19437730_S19159270_D19437730').region,'CNPROD');
  assert.equal(sourceVersion('OSPRODWin3.2.0_R18779629_S18779629_D18761130').gameVersion,'3.2.0');
  assert.throws(()=>sourceVersion('latest'));
  assert.equal(versionFamily('3.3.12+19629936'),'3.3');assert.equal(versionFamily('3.2'),'3.2');assert.equal(versionFamily('latest'),null);
});
test('schema and URL validation reject invalid sources',()=>{
  for(const value of [[],{},null,{x:1}])assert.throws(()=>validateTextMap(value));
  assert.deepEqual(validateTextMap({x:'ไทย'}),{x:'ไทย'});
  for(const value of ['https://evil.test/data','https://u:p@git.mero.moe/dimbreath/ZenlessData/raw/x','http://git.mero.moe/dimbreath/ZenlessData/raw/x'])assert.throws(()=>validateSourceUrl(value));
  assert.equal(model.safeLocalizationUrl('javascript:alert(1)'),null);
  assert.equal(model.safeLocalizationUrl('https://git.mero.moe/dimbreath/ZenlessData'),'https://git.mero.moe/dimbreath/ZenlessData');
});
test('coverage excludes technical fields and non-English source branches',()=>{
  assert.equal(textField('/skill/basic/description/0/desc'),true);assert.equal(textField('/camp/1'),true);
  for(const p of ['/icon','/ja/name','/code_name','/stats/tags/0','/base_property/format'])assert.equal(textField(p),false);
});
test('invalid source acquisition cannot replace the last published localization',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'zzz-localization-test-'));const absolute=await fs.realpath(root);const temp=await fs.realpath(os.tmpdir());assert.ok(absolute.startsWith(temp+path.sep)&&path.basename(absolute).startsWith('zzz-localization-test-'));t.after(()=>fs.rm(absolute,{recursive:true,force:true}));
  const dest=path.join(root,'public');await fs.mkdir(dest);await fs.writeFile(path.join(dest,'current.json'),'PREVIOUS_VALIDATED_POINTER');
  const source=path.join(root,'corrupt.json');await fs.writeFile(source,'BROKEN');
  await assert.rejects(generate({dest,evidence:path.join(root,'evidence'),lock:{files:[{local:source,path:'FileCfg/ItemTemplateTb.json',bytes:6,sha256:'wrong'}]}}),/integrity/);
  assert.equal(await fs.readFile(path.join(dest,'current.json'),'utf8'),'PREVIOUS_VALIDATED_POINTER');
});
