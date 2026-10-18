import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { API, REPOSITORY, download, tree, json, save, sha256 } from './source.mjs';
import { TABLES, createResolver, leaves, eligibleText, sourceVersion, versionFamily, validateTextMap, escapePointer } from './mapping.mjs';

const defaultCache = '.nanoka/localization';
async function immutable(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try { const old = await fs.readFile(file); if (!old.equals(bytes)) throw new Error(`Immutable output differs: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await fs.writeFile(file, bytes, { flag: 'wx' }); }
}
function pointer(value, at) {
  for (const key of (at ? at.slice(1).split('/') : []).map(x => x.replace(/~1/g,'/').replace(/~0/g,'~'))) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value,key)) throw new Error(`Invalid records pointer ${at}`);
    value=value[key];
  }
  return value;
}
export async function acquire({ cache = defaultCache, revision, offline = false } = {}) {
  if (offline) return json(path.join(cache, 'source-lock.json'));
  const head = await download(`${API}/branches/master`, path.join(cache, 'head.json'), { refresh: true });
  const commit = revision ?? head.data.commit.id;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a full pinned Git revision');
  const commitResult = await download(`${API}/git/commits/${commit}`, path.join(cache, `${commit}-commit.json`));
  const commitData=commitResult.data.commit;
  const version = sourceVersion(commitData?.message);
  const root = await download(`${API}/contents/?ref=${commit}`, path.join(cache, `${commit}-root.json`));
  if (!Array.isArray(root.data)) throw new Error('Repository root is not a file listing');
  const directory = name => { const found=root.data.find(x=>x.name===name&&x.type==='dir'); if(!found)throw new Error(`Missing ${name}`); return found.sha; };
  const [fileTree,textTree] = await Promise.all([tree(directory('FileCfg'), cache), tree(directory('TextMap'), cache)]);
  const entries = [
    ...['TH','EN'].flatMap(lang => [`TextMap_${lang}TemplateTb.json`, `TextMap_${lang}OverwriteTemplateTb.json`, `TextMap_Login_${lang}TemplateTb.json`].map(name => ({ folder:'TextMap', entry: textTree.find(f=>f.path===name) }))),
    ...TABLES.map(name => ({ folder: 'FileCfg', entry: fileTree.find(f=>f.path===`${name}TemplateTb.json`) })),
  ];
  const files = [];
  // Sequential downloads keep upstream load bounded. The pinned blob cache avoids repeat transfers.
  for (const {folder,entry} of entries) {
    if (!entry) throw new Error(`Required source file is absent; refusing publication`);
    const relative=`${folder}/${entry.path}`, local=path.join(cache,commit,relative);
    const result=await download(`${REPOSITORY}/raw/commit/${commit}/${relative}`,local,{expectedBytes:entry.size,expectedGitSha:entry.sha});
    if(folder==='TextMap')validateTextMap(result.data);
    files.push({...result.metadata,local,path:relative});
    console.log(`Validated ${relative} (${result.metadata.bytes} bytes)`);
  }
  const directoryPage=await download(`${REPOSITORY}/src/commit/${commit}/TextMap`,path.join(cache,commit,'TextMap-directory.html'),{text:true});
  const history=[];
  for(const name of ['TextMap_THTemplateTb.json','TextMap_THOverwriteTemplateTb.json','TextMap_Login_THTemplateTb.json','TextMap_ENTemplateTb.json','TextMap_ENOverwriteTemplateTb.json']) {
    // The pinned public directory includes each file's actual last-change commit.
    // File-history API calls can be very slow on this repository; no guessed version is used.
    const row=directoryPage.data.match(new RegExp(`<tr[^>]+data-entryname="${name.replaceAll('.','\\.')}"[^>]*>[\\s\\S]*?</tr>`))?.[0];
    const lastCommit=row?.match(/href="\/dimbreath\/ZenlessData\/commit\/([a-f0-9]{40})"[^>]*>([^<]+)<\/a>/);
    if(!lastCommit)throw new Error('Cannot verify TextMap file version from pinned directory');
    const info=sourceVersion(lastCommit[2]);
    if(versionFamily(info.gameVersion)!==versionFamily(version.gameVersion))throw new Error('TextMap/repository version families differ');
    history.push({path:`TextMap/${name}`,sourceRevision:lastCommit[1],message:lastCommit[2],...info,committedAt:row.match(/datetime="([^"]+)"/)?.[1]??null,evidenceUrl:directoryPage.metadata.url});
  }
  const readmeEntry=root.data.find(x=>x.name==='README.md');
  const readme=await download(`${REPOSITORY}/raw/commit/${commit}/README.md`,path.join(cache,commit,'README.md'),{text:true,expectedBytes:readmeEntry.size,expectedGitSha:readmeEntry.sha});
  const lock={schemaVersion:1,provider:'ZenlessData',repository:REPOSITORY,sourceRevision:commit,commitMessage:commitData.message,committedAt:commitData.committer?.date??null,...version,files,history,credits:{readme:readme.metadata.url,requestedCredit:'Thanks to Dimbreath and Mero',licenseFileFound:root.data.some(x=>/^licen[sc]e/i.test(x.name)),note:'Repository README requests attribution. No separate data redistribution license was found at the repository root; game text belongs to its respective owners. This project is independent of HoYoverse, Nanoka, and ZenlessData.'}};
  await save(path.join(cache,'source-lock.json'),lock);return lock;
}

export async function generate({ cache=defaultCache, dest='public/localization', evidence='evidence/localization-th', lock }={}) {
  lock??=await json(path.join(cache,'source-lock.json'));
  const english=Object.create(null),thai=Object.create(null),fileForKey=Object.create(null),tables={};
  for(const file of lock.files) {
    const bytes=await fs.readFile(file.local);
    if(sha256(bytes)!==file.sha256||bytes.length!==file.bytes)throw new Error(`Source cache failed integrity: ${file.path}`);
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(file.path.startsWith('FileCfg/'))tables[path.basename(file.path,'TemplateTb.json')]=data;
  }
  // Explicit priority: base -> overwrite. Login is separate and is not merged into gameplay keys.
  for(const lang of ['EN','TH'])for(const suffix of ['TemplateTb.json','OverwriteTemplateTb.json']){
    const file=lock.files.find(f=>f.path===`TextMap/TextMap_${lang}${suffix}`);
    const data=validateTextMap(await json(file.local));
    for(const [key,value] of Object.entries(data)){(lang==='EN'?english:thai)[key]=value;if(lang==='TH')fileForKey[key]=file.path;}
  }
  const resolve=createResolver(tables,english,thai,fileForKey);
  const nanokaPointer=await json('public/nanoka/current.json'), catalogFile=path.join('public/nanoka',nanokaPointer.catalog), catalog=await json(catalogFile), root=path.dirname(catalogFile);
  if(!catalog.coverage.registeredScopeComplete||catalog.runId!==nanokaPointer.runId)throw new Error('A validated Nanoka snapshot is required');
  const manifest={schemaVersion:1,provider:'ZenlessData',generatedAt:new Date().toISOString(),nanokaRunId:catalog.runId,sourceRevision:lock.sourceRevision,source:lock,versions:{},resources:{},coverage:[]};
  const unmapped=[], numericAudit={resources:0, numericLeaves:0, changedNumericLeaves:0};
  const report=new Map();
  for(const {version,channels} of catalog.versions)manifest.versions[version]={channels,compatible:versionFamily(version)===versionFamily(lock.gameVersion),policy:'Same major.minor family AND verified entity ID/name AND exact English text per field; cross-family reuse disabled',sourceGameVersion:lock.gameVersion,region:lock.region};
  const resources=catalog.resources.filter(r=>['index','detail'].includes(r.kind)&&(r.language===null||r.language==='en')&&manifest.versions[r.version]);
  for(const resource of resources){
    const definition=catalog.definitions.find(d=>d.key===resource.dataset);if(!definition)throw new Error('Unknown Nanoka dataset');
    const key=`${resource.version}:${resource.dataset}`;
    if(!report.has(key))report.set(key,{version:resource.version,category:resource.dataset,compatible:manifest.versions[resource.version].compatible,resources:0,entityOccurrences:0,entitiesWithThai:0,textOccurrences:0,mappedThai:0,thaiScriptOccurrences:0,englishFallback:0,missing:0});
    const counts=report.get(key);counts.resources++;
    const bytes=await fs.readFile(path.join(root,resource.file));if(sha256(bytes)!==resource.sha256)throw new Error('Nanoka raw data changed');
    const raw=JSON.parse(bytes), translations=Object.create(null);
    const records=resource.kind==='detail'?[[resource.id,raw,'']]:Object.entries(pointer(raw,definition.recordsPointer)).map(([id,record])=>[Array.isArray(pointer(raw,definition.recordsPointer))?String(record[definition.idField]):id,record,`${definition.recordsPointer}/${escapePointer(id)}`]);
    const entityCounts=Object.create(null);
    for(const [id,record,base] of records){
      counts.entityOccurrences++;let mapped=0, fallback=0, missing=0;
      const context=counts.compatible?resolve(resource.dataset,id,record):null;
      for(const leaf of leaves(record)){
        if(!eligibleText(leaf.path,leaf.value))continue;
        counts.textOccurrences++;const at=`${base}${leaf.path}`;
        const noText=!leaf.value.trim()||/^(?:PlaceHolder|TODO|N\/A)$/i.test(leaf.value)||/^(?:Item_|Avatar_|UI_)[A-Za-z0-9_]+$/.test(leaf.value);
        const translated=!noText&&context?.match(leaf.value);
        if(translated){translations[at]=translated;counts.mappedThai++;mapped++;if(/[\u0E00-\u0E7F]/.test(translated.th))counts.thaiScriptOccurrences++;}
        else {const reason=!counts.compatible?'version_family_mismatch':noText?'empty_or_source_key':!context?.identityVerified?'unverified_entity_join':'no_unambiguous_compatible_text_key';
          if(noText){counts.missing++;missing++;}else{counts.englishFallback++;fallback++;}
          unmapped.push({dataset:resource.dataset,version:resource.version,id,resourceSha256:resource.sha256,path:at,reason});
        }
      }
      entityCounts[id]={mapped,fallback,missing};if(mapped)counts.entitiesWithThai++;
    }
    numericAudit.resources++;numericAudit.numericLeaves+=leaves(raw).filter(x=>typeof x.value==='number').length;
    // The output is a string-only overlay: all Nanoka numeric/scaling leaves stay in their original resource.
    if(Object.keys(translations).length){
      const overlay={schemaVersion:1,nanokaRunId:catalog.runId,sourceRevision:lock.sourceRevision,resourceSha256:resource.sha256,version:resource.version,translations,entities:entityCounts};
      const buffer=Buffer.from(JSON.stringify(overlay)),hash=sha256(buffer);await immutable(path.join(dest,'objects',`${hash}.json`),buffer);
      manifest.resources[`${resource.version}:${resource.dataset}:${resource.sha256}`]={file:`objects/${hash}.json`,sha256:hash,bytes:buffer.length,dataset:resource.dataset,version:resource.version};
    }
  }
  manifest.coverage=[...report.values()];
  if(!manifest.coverage.some(x=>x.category==='character'&&x.mappedThai>0))throw new Error('No verified agent translations; previous release retained');
  // Paths are private build/cache details, not browser source references.
  manifest.source={...lock,files:lock.files.map(({local,...file})=>file)};
  const buffer=Buffer.from(JSON.stringify(manifest)),hash=sha256(buffer),file=`releases/${hash}/manifest.json`;
  await immutable(path.join(dest,file),buffer);
  await fs.mkdir(evidence,{recursive:true});
  await fs.writeFile(path.join(evidence,'unmapped.json.gz'),gzipSync(Buffer.from(JSON.stringify(unmapped))));
  const coverage={generatedAt:manifest.generatedAt,nanokaRunId:catalog.runId,sourceRevision:lock.sourceRevision,method:'Count every human-readable string leaf (names/descriptions/stories/facets) once per English/multilingual index or detail resource and version. Repeated text in index/detail or levels is counted again. Icons, code names, tags, formats, numeric-only strings, calculation directives, icon-only controls and non-English locale branches are excluded. Thai coverage means a validated TH TextMap value, including intentional English/proper names; thaiScriptOccurrences counts actual Thai script separately. Empty/placeholder/source-key fields count as missing. All other untranslated eligible strings count as English fallback.',categories:manifest.coverage,numericAudit,unmappedFile:'unmapped.json.gz',unmappedOccurrences:unmapped.length};
  await save(path.join(evidence,'coverage.json'),coverage);await save(path.join(evidence,'source-report.json'),manifest.source);
  // Publication happens last. Any acquisition/mapping/schema/integrity failure leaves current.json intact.
  await save(path.join(dest,'current.json'),{schemaVersion:1,provider:'ZenlessData',manifest:file,sha256:hash,bytes:buffer.length,nanokaRunId:catalog.runId,sourceRevision:lock.sourceRevision,publishedAt:manifest.generatedAt});
  console.log(JSON.stringify({published:file,resources:Object.keys(manifest.resources).length,coverage:manifest.coverage,numericAudit}));return {manifest,coverage};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);let revision,offline=false;
  while(args.length){const arg=args.shift();if(arg==='--offline')offline=true;else if(arg==='--revision')revision=args.shift();else throw new Error(`Unknown argument ${arg}`);}
  const lock=await acquire({revision,offline});await generate({lock});
}
