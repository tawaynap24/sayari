#!/usr/bin/env node
/** Read-only, exhaustive raw/hash/ID/path audit of the published real snapshot. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import ts from 'typescript';
import { sha256, inspectJson, writeJson, fillTemplate } from './nanoka-sync.mjs';
import { evidenceDirectory } from './evidence.mjs';

const evidenceDir = await evidenceDirectory();
const pointer = JSON.parse(await fs.readFile('public/nanoka/current.json', 'utf8'));
const catalogFile = path.resolve('public/nanoka', pointer.catalog);
const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
const catalogDir = path.dirname(catalogFile);
const compiled = ts.transpileModule(await fs.readFile('src/features/nanoka/model.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const seen = new Map();
const fields = [], problems = [], matrix = [];
await fs.mkdir(path.join(evidenceDir, 'field-paths'), { recursive: true });
for (const resource of catalog.resources) {
  if (!model.resourceAvailable(resource)) { problems.push({ type: 'unavailable', url: resource.url, status: resource.status }); continue; }
  const objectFile = path.resolve(catalogDir, resource.file);
  if (!objectFile.startsWith(`${catalogDir}${path.sep}`)) throw new Error('Invalid resource path');
  const bytes = await fs.readFile(objectFile);
  if (sha256(bytes) !== resource.sha256 || bytes.length !== resource.bytes) throw new Error(`Raw hash/bytes mismatch: ${resource.url}`);
  let info = seen.get(resource.sha256);
  if (!info) {
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const leaves = model.fieldLeaves(raw);
    const shape = inspectJson(raw);
    if (shape.leaves !== leaves.length) throw new Error(`Leaf count mismatch: ${resource.url}`);
    const mappedPaths = [], genericFallbackPaths = [];
    for (const leaf of leaves) {
      const first = leaf.path.split('/')[1]?.replace(/~1/g, '/').replace(/~0/g, '~');
      (resource.kind === 'detail' && (model.SPECIALIZED_KEYS.has(first) || ['rank', 'class'].includes(first)) ? mappedPaths : genericFallbackPaths).push(leaf.path);
      // Every full pointer must resolve to the same value; also covers escaped keys and empty objects.
      if (model.atPointer(raw, leaf.path) !== leaf.value) throw new Error(`Pointer cannot be reached: ${leaf.path}`);
    }
    const report = { sha256: resource.sha256, nodes: shape.nodes, leaves: leaves.length, types: shape.types, mappedPaths, genericFallbackPaths, droppedPaths: [] };
    const relative = `field-paths/${resource.sha256}.json.gz`;
    const serialized = Buffer.from(JSON.stringify(report));
    let unchanged = false;
    try { unchanged = gunzipSync(await fs.readFile(path.join(evidenceDir, relative))).equals(serialized); }
    catch (error) { if (error.code !== 'ENOENT' && !error.code?.startsWith('Z_')) throw error; }
    if (!unchanged) await fs.writeFile(path.join(evidenceDir, relative), gzipSync(serialized, { level: 9 }));
    info = { raw, nodes: shape.nodes, leaves: leaves.length, mappedLeafCount: mappedPaths.length, genericLeafCount: genericFallbackPaths.length, unsafeNumberCount: shape.unsafeNumberCount, pathReport: relative };
    seen.set(resource.sha256, info);
  }
  const parts = new URL(resource.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (resource.version && (parts[0] !== 'zzz' || parts[1] !== resource.version)) problems.push({ type: 'version_provenance', url: resource.url });
  const definition = catalog.definitions.find(d => d.key === resource.dataset);
  const template = resource.kind === 'index' ? definition?.indexPath : resource.kind === 'detail' ? definition?.detailPath : null;
  if (template) {
    const expectedPath = decodeURIComponent(fillTemplate(template, { version: resource.version, lang: resource.language, id: resource.id }));
    if (decodeURIComponent(new URL(resource.url).pathname) !== expectedPath) problems.push({ type: 'endpoint_template_provenance', url: resource.url, expectedPath });
  }
  if (!resource.fetchedAt || !resource.sha256) problems.push({ type: 'missing_provenance', url: resource.url });
  fields.push({ resourceURL: resource.url, version: resource.version, locale: resource.language, id: resource.id, sha256: resource.sha256, bytes: resource.bytes, nodes: info.nodes, leaves: info.leaves, mappedLeafCount: info.mappedLeafCount, genericFallbackLeafCount: info.genericLeafCount, droppedPaths: [], pathReport: info.pathReport, unsafeNumberCount: info.unsafeNumberCount });
}
for (const inventory of catalog.inventory) {
  const def = catalog.definitions.find(d => d.key === inventory.dataset);
  const source = catalog.resources.find(r => r.url === inventory.url);
  const entities = model.entitiesFromIndex(seen.get(source.sha256).raw, def, inventory.language ?? 'en', inventory.language);
  const adapted = new Set(entities.map(e => e.id));
  const dropped = inventory.ids.filter(id => !adapted.has(id));
  const unexpected = entities.map(e => e.id).filter(id => !inventory.ids.includes(id));
  if (dropped.length || unexpected.length || adapted.size !== entities.length) problems.push({ type: 'adapter_id_mismatch', dataset: inventory.dataset, version: inventory.version, language: inventory.language, dropped, unexpected });
  for (const language of def.detailPath ? (def.localizedDetail ? (def.localizedIndex ? [inventory.language] : catalog.languages) : [null]) : [inventory.language]) {
    const expected = new Set(inventory.ids);
    const details = catalog.resources.filter(r => r.kind === 'detail' && r.dataset === inventory.dataset && r.version === inventory.version && r.language === language);
    const usable = new Set(details.filter(model.resourceAvailable).map(r => r.id));
    const missing = def.detailPath ? [...expected].filter(id => !usable.has(id)) : [];
    const extra = details.filter(r => !expected.has(r.id)).map(r => r.id);
    const row = { dataset: inventory.dataset, version: inventory.version, locale: language, expectedCount: expected.size, adaptedCount: entities.length, detailExpected: Boolean(def.detailPath), usableDetails: usable.size, missingIds: missing, unexpectedIds: extra };
    matrix.push(row);
    if (missing.length || extra.length) problems.push({ type: 'detail_id_mismatch', ...row });
  }
}
await writeJson(path.join(evidenceDir, 'FIELD_COVERAGE.json'), { runId: catalog.runId, auditedAt: new Date().toISOString(), method: 'All published raw objects hashed; every leaf enumerated and JSON Pointer round-tripped using the application adapter. Full path lists are gzip JSON files referenced by pathReport. UI paths are reachable on demand, not simultaneously rendered.', resources: fields, uniqueObjects: seen.size, droppedPathCount: 0 });
await writeJson(path.join(evidenceDir, 'ENDPOINT_COVERAGE.json'), { runId: catalog.runId, auditedAt: new Date().toISOString(), coverage: catalog.coverage, matrix, problems });
console.log(JSON.stringify({ runId: catalog.runId, resources: fields.length, uniqueObjects: seen.size, matrixRows: matrix.length, problems: problems.length, evidenceDir }, null, 2));
if (problems.length) process.exitCode = 2;
