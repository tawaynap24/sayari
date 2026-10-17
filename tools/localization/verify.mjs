/** Verify published overlays against real, pinned source data and the actual frontend transformer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { json, sha256, save } from './source.mjs';
import { leaves, createResolver, normalize } from './mapping.mjs';

const evidence='evidence/localization-th';
const pointer=await json('public/localization/current.json'), manifestBytes=await fs.readFile(path.join('public/localization',pointer.manifest));
assert.equal(sha256(manifestBytes),pointer.sha256);assert.equal(manifestBytes.length,pointer.bytes);
const manifest=JSON.parse(manifestBytes), np=await json('public/nanoka/current.json'), catalogPath=path.join('public/nanoka',np.catalog), catalog=await json(catalogPath), root=path.dirname(catalogPath);
assert.equal(manifest.nanokaRunId,catalog.runId);
const lock=await json('.nanoka/localization/source-lock.json'), english=Object.create(null),thai=Object.create(null),fileForKey=Object.create(null),tables={};
for(const file of lock.files){const bytes=await fs.readFile(file.local);assert.equal(sha256(bytes),file.sha256);if(file.path.startsWith('FileCfg/'))tables[path.basename(file.path,'TemplateTb.json')]=JSON.parse(bytes);}
for(const lang of ['EN','TH'])for(const suffix of ['TemplateTb.json','OverwriteTemplateTb.json']){const file=lock.files.find(f=>f.path===`TextMap/TextMap_${lang}${suffix}`);for(const [key,value]of Object.entries(await json(file.local))){(lang==='EN'?english:thai)[key]=value;if(lang==='TH')fileForKey[key]=file.path;}}
const resolve=createResolver(tables,english,thai,fileForKey);
const moduleText=ts.transpileModule(await fs.readFile('src/features/localization/model.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const {applyOverlay}=await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const verification={at:new Date().toISOString(),nanokaRunId:catalog.runId,sourceRevision:manifest.sourceRevision,resources:0,translatedStringOccurrences:0,numericLeavesCompared:0,changedNumericLeaves:0,changedNonTextLeaves:0,sourceProofsChecked:0,publicBytes:0,maxOverlayBytes:0,categories:{},protectedFiles:[],samples:{}};
for(const [resourceKey,entry] of Object.entries(manifest.resources)){
  const source=catalog.resources.find(r=>`${r.version}:${r.dataset}:${r.sha256}`===resourceKey&&(r.language==='en'||r.language===null));assert.ok(source,resourceKey);
  assert.equal(manifest.versions[source.version].compatible,true);
  const bytes=await fs.readFile(path.join('public/localization',entry.file));assert.equal(sha256(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
  const overlay=JSON.parse(bytes), originalBytes=await fs.readFile(path.join(root,source.file));assert.equal(sha256(originalBytes),source.sha256);
  const original=JSON.parse(originalBytes),before=JSON.stringify(original),translated=applyOverlay(original,overlay),afterLeaves=new Map(leaves(translated).map(x=>[x.path,x.value]));
  for(const leaf of leaves(original)){
    if(typeof leaf.value!=='string'){assert.deepEqual(afterLeaves.get(leaf.path),leaf.value);if(typeof leaf.value==='number')verification.numericLeavesCompared++;}
    else if(!Object.hasOwn(overlay.translations,leaf.path))assert.equal(afterLeaves.get(leaf.path),leaf.value);
  }
  assert.equal(JSON.stringify(original),before,'Raw original was mutated');
  for(const [at,value] of Object.entries(overlay.translations)){
    assert.equal(value.th,thai[value.translationKey]);assert.equal(normalize(value.en),normalize(english[value.translationKey]));
    const rows=tables[value.proof.table.replace('TemplateTb.json','')].IAEFFFFLKNB.filter(row=>String(row[value.proof.join])===value.proof.rowId);
    assert.ok(rows.some(row=>leaves(row).some(leaf=>leaf.path===value.proof.field&&leaf.value===value.translationKey)),`Missing real FileCfg proof: ${at}`);
    const def=catalog.definitions.find(d=>d.key===source.dataset);
    const relative=source.kind==='detail'?'':at.slice(def.recordsPointer.length+1).split('/')[0];
    const record=source.kind==='detail'?original:def.recordsPointer?def.recordsPointer.slice(1).split('/').reduce((node,k)=>node[k],original)[relative]:original[relative];
    const id=source.kind==='detail'?source.id:relative.replace(/~1/g,'/').replace(/~0/g,'~');
    const result=resolve(source.dataset,id,record).match(value.en);assert.ok(result,`Unverified entity/key ${resourceKey} ${at}`);assert.equal(result.th,value.th);
    verification.sourceProofsChecked++;
  }
  verification.resources++;verification.translatedStringOccurrences+=Object.keys(overlay.translations).length;verification.publicBytes+=bytes.length;verification.maxOverlayBytes=Math.max(verification.maxOverlayBytes,bytes.length);
  verification.categories[source.dataset]=(verification.categories[source.dataset]??0)+1;
  if(!verification.samples[source.dataset]&&source.kind==='detail')verification.samples[source.dataset]={id:source.id,version:source.version,resourceSha256:source.sha256,mapped:Object.keys(overlay.translations).length,examples:Object.entries(overlay.translations).filter(([,value])=>/[\u0E00-\u0E7F]/.test(value.th)).slice(0,2)};
}
const baseline=await json(path.join(evidence,'baseline.json'));
for(const [file,hash] of Object.entries(baseline.files)){assert.equal(sha256(await fs.readFile(file)),hash,`Protected file changed: ${file}`);verification.protectedFiles.push(file);}
const coverage=await json(path.join(evidence,'coverage.json'));
assert.equal(verification.translatedStringOccurrences,coverage.categories.reduce((n,c)=>n+c.mappedThai,0));
assert.ok(!coverage.categories.some(c=>!c.compatible&&c.mappedThai));
assert.ok(['character','weapon','equipment','bangboo','item','monster','achievement','item_all'].every(category=>verification.categories[category]>0));
verification.status='PASS';await save(path.join(evidence,'real-data-verification.json'),verification);
console.log(JSON.stringify(verification));
