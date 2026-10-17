#!/usr/bin/env node
/** Export a checked collector run into static assets; does not build or deploy. */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readJson, writeJson, writeAtomic, sha256 } from './nanoka-sync.mjs';

export async function exportSnapshot({ out, dest, runId, allowPartial = false }) {
  if (!out || !dest) throw new Error('--out and --dest must be explicit');
  const source = path.resolve(out);
  const target = path.resolve(dest);
  const chosen = runId ?? (await readJson(path.join(source, 'latest-run.json'))).runId;
  if (!/^[A-Za-z0-9._-]+$/.test(chosen) || chosen.includes('..')) throw new Error('Unsafe run ID');
  const catalog = await readJson(path.join(source, 'runs', chosen, 'catalog.json'));
  if (catalog.runId !== chosen) throw new Error('Run ID mismatch');
  if (catalog.coverage.mode !== 'sync' && !allowPartial) throw new Error('A probe is not a complete snapshot');
  if (!catalog.coverage.registeredScopeComplete && !allowPartial) throw new Error('Partial run refused. Inspect coverage; --allow-partial must be an explicit diagnostic choice.');
  const successful = catalog.resources.filter(r => ['fetched','cache'].includes(r.status));
  if (!successful.length || !catalog.manifest || !catalog.versions.length) throw new Error('No usable versioned data; do not publish an empty/mock database');
  const snapshotDir = path.join(target, 'snapshots', chosen);
  let existing = null;
  try { existing = await readJson(path.join(snapshotDir, 'catalog.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const publishedSource = { ...catalog, storageNote: 'resource.file is relative to this catalog.json URL' };
  if (existing && Object.keys(publishedSource).some(key => JSON.stringify(existing[key]) !== JSON.stringify(publishedSource[key]))) throw new Error('An immutable published run cannot be changed; export a new collector run.');
  const seen = new Set();
  for (const row of successful) {
    if (!/^[a-f0-9]{64}$/.test(row.sha256) || row.file !== `objects/${row.sha256}.json`) throw new Error('Unexpected object path/hash');
    if (seen.has(row.file)) continue;
    seen.add(row.file);
    const bytes = await fs.readFile(path.join(source, row.file));
    if (sha256(bytes) !== row.sha256) throw new Error(`Hash mismatch: ${row.file}`);
    // Resume a failed pointer replace without rewriting checked immutable files.
    try {
      if (sha256(await fs.readFile(path.join(snapshotDir, row.file))) === row.sha256) continue;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeAtomic(path.join(snapshotDir, row.file), bytes);
  }
  const published = existing ?? { ...publishedSource, publishedAt: new Date().toISOString(),
    publicationWarnings: [
      'Data is a local snapshot, not real-time.',
      'Registered-scope completion is not proof that every provider endpoint was discovered.',
      ...(catalog.coverage.registeredScopeComplete ? [] : ['This is an explicitly published partial diagnostic snapshot.']),
    ] };
  await writeJson(path.join(snapshotDir, 'catalog.json'), published);
  await writeJson(path.join(snapshotDir, 'coverage.json'), catalog.coverage);
  const pointer = { schemaVersion: 1, provider: 'Nanoka ZZZ', runId: chosen,
    catalog: `snapshots/${chosen}/catalog.json`, publishedAt: published.publishedAt,
    dataStatus: catalog.coverage.status, referenceUrl: 'https://zzz.nanoka.cc/' };
  // Only update the pointer after every successful object has been checked and copied.
  await writeJson(path.join(target, 'current.json'), pointer);
  console.log(JSON.stringify({ target, runId: chosen, objectsCopied: seen.size, pointer }, null, 2));
  return pointer;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = {};
    for (let i=2; i<process.argv.length; i++) {
      const key=process.argv[i];
      if (key==='--allow-partial') { options.allowPartial=true; continue; }
      const name={'--out':'out','--dest':'dest','--run':'runId'}[key];
      if (!name || !process.argv[i+1] || process.argv[i+1].startsWith('--')) throw new Error(`Invalid option ${key}`);
      options[name]=process.argv[++i];
    }
    await exportSnapshot(options);
  } catch (error) { console.error(error.stack ?? error); process.exitCode=1; }
}
