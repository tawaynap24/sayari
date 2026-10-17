#!/usr/bin/env node
/** A single fresh public manifest request, independently of the collector's normal cache. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonCollector, writeJson } from './nanoka-sync.mjs';
import { evidenceDirectory } from './evidence.mjs';
const out = await evidenceDirectory();
const runId = JSON.parse(await fs.readFile('.nanoka/latest-run.json', 'utf8')).runId;
const catalog = JSON.parse(await fs.readFile(path.join('.nanoka/runs', runId, 'catalog.json'), 'utf8'));
if (catalog.coverage.mode !== 'sync') throw new Error('Verify a completed sync, not a probe.');
const defaults = JSON.parse(await fs.readFile('tools/nanoka/reference/sync.defaults.json', 'utf8'));
const client = new JsonCollector({ ...defaults, output: '.nanoka/manifest-recheck', refresh: true, maxRequests: 1, maxAttempts: 1 });
const result = await client.get('https://static.nanoka.cc/manifest.json', { dataset: 'manifest', kind: 'manifest', version: null, language: null, id: null, referenceUrl: 'https://zzz.nanoka.cc/' });
const changes = [];
if (!['fetched', 'cache'].includes(result.record.status) || !result.data?.zzz) changes.push({ type: 'manifest_unavailable', status: result.record.status, error: result.record.error });
else {
  for (const channel of ['live', 'latest']) {
    const selected = catalog.versions.find(v => v.channels.includes(channel));
    if (selected && selected.version !== result.data.zzz[channel]) changes.push({ channel, selected: selected.version, now: result.data.zzz[channel] });
  }
  await fs.copyFile(path.join('.nanoka/manifest-recheck', result.record.file), path.join(out, 'manifest-recheck-body.json'));
}
const report = { runId, checkedAt: new Date().toISOString(), source: result.record, selectedVersions: catalog.versions, currentChannels: result.data?.zzz ? { live: result.data.zzz.live, latest: result.data.zzz.latest } : null, matchesSelectedChannels: changes.length === 0, changes, note: 'One no-cache upstream request. This verifies channel selection at check time, not a perpetual real-time guarantee.' };
await writeJson(path.join(out, 'MANIFEST_RECHECK.json'), report);
console.log(JSON.stringify(report, null, 2));
if (changes.length) process.exitCode = 2;
