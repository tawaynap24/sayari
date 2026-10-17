#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256, writeJson } from './nanoka-sync.mjs';
import { evidenceDirectory } from './evidence.mjs';
const out = await evidenceDirectory(), origin = process.env.SAYARI_TEST_ORIGIN ?? 'http://127.0.0.1:4173';
const pointerBytes = await fs.readFile('dist/nanoka/current.json'), pointer = JSON.parse(pointerBytes);
const catalogFile = path.join('dist/nanoka', pointer.catalog), catalogBytes = await fs.readFile(catalogFile), catalog = JSON.parse(catalogBytes);
const unique = new Map(catalog.resources.filter(r => r.file).map(r => [r.sha256, r]));
const problems = [];
for (const resource of unique.values()) {
  const bytes = await fs.readFile(path.join(path.dirname(catalogFile), resource.file));
  if (sha256(bytes) !== resource.sha256 || bytes.length !== resource.bytes) problems.push({ type: 'dist_object_mismatch', file: resource.file });
}
const checks = [];
for (const url of ['/', '/game/zenless-zone-zero', '/game/zenless-zone-zero/database?category=weapon', '/nanoka/current.json', '/nanoka/discovery.json', `/nanoka/${pointer.catalog}`, '/nanoka/DOES-NOT-EXIST-TEST.json']) {
  const response = await fetch(origin + url, { signal: AbortSignal.timeout(15000) }), bytes = Buffer.from(await response.arrayBuffer());
  const row = { path: url, status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: sha256(bytes) };
  checks.push(row);
  if (url.includes('DOES-NOT-EXIST')) continue;
  if (!response.ok) problems.push({ type: 'http_failure', ...row });
  if (url === '/nanoka/current.json' && row.sha256 !== sha256(pointerBytes)) problems.push({ type: 'served_pointer_mismatch' });
  if (url === `/nanoka/${pointer.catalog}` && row.sha256 !== sha256(catalogBytes)) problems.push({ type: 'served_catalog_mismatch' });
  if (url === '/nanoka/discovery.json' && row.sha256 !== sha256(await fs.readFile('public/nanoka/discovery.json'))) problems.push({ type: 'served_discovery_mismatch' });
  if (url.startsWith('/nanoka/') && !/application\/json/i.test(row.contentType ?? '')) problems.push({ type: 'json_content_type', ...row });
}
await writeJson(path.join(out, 'HOSTING_VERIFICATION.json'), { runId: catalog.runId, verifiedAt: new Date().toISOString(), origin, passed: problems.length === 0, uniqueDistObjectsVerified: unique.size, checks, problems, limitations: ['Local Vite production preview, not a Firebase emulator or production deploy. Firebase rewrite/cache header rules were checked against official documentation but not executed on Firebase in this task.', 'A missing JSON request may receive the Vite SPA HTML fallback in preview. The application rejects non-JSON responses; Firebase config scopes rewrites to game routes so /nanoka is excluded.'] });
console.log(JSON.stringify({ runId: catalog.runId, origin, uniqueDistObjectsVerified: unique.size, checks, problems }, null, 2));
if (problems.length) process.exitCode = 2;
