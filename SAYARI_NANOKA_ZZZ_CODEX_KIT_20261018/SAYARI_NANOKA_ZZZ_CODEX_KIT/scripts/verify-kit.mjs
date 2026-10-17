#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try {
  const manifest=JSON.parse(await fs.readFile(path.join(root,'MANIFEST_SHA256.json'),'utf8'));
  const errors=[];
  for(const entry of manifest.files) {
    if(entry.path.startsWith('/')||entry.path.includes('..')||entry.path.includes('\\'))throw new Error('Unsafe manifest path');
    try {
      const bytes=await fs.readFile(path.join(root,entry.path));
      const hash=createHash('sha256').update(bytes).digest('hex');
      if(bytes.byteLength!==entry.bytes||hash!==entry.sha256)errors.push({file:entry.path,error:'size/hash mismatch'});
    }catch(error){errors.push({file:entry.path,error:error.message});}
  }
  console.log(JSON.stringify({status:errors.length?'FAILED':'PASS',verifiedFiles:manifest.files.length,errors,
    note:'Integrity of the listed kit files only. Not a live API or project UI verification.'},null,2));
  process.exitCode=errors.length?1:0;
}catch(error){console.error(error.message);process.exitCode=1;}
