/** Synthetic edge cases only; never exported as game data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { createHash, webcrypto } from 'node:crypto';

async function moduleText(file) {
  return ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
}
const dataModule = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const modelUrl = dataModule(await moduleText('src/features/nanoka/model.ts'));
const model = await import(modelUrl);
const clientUrl = dataModule((await moduleText('src/features/nanoka/client.ts')).replace("'./model'", JSON.stringify(modelUrl)));
const { SnapshotClient, loadSnapshot } = await import(clientUrl);
globalThis.window = { location: { origin: 'http://localhost:5173' } };
globalThis.crypto ??= webcrypto;
const definition = { key: 'test_only', idField: 'id', recordsPointer: '/records' };

test('projection keeps every indexed record and leaves its original source intact', () => {
  const raw = { records: { '001': { en: 'TEST ONLY', rank: 0, flag: false, tags: [], future: null }, '002': false, '003': null, '004': '' } };
  const before = JSON.stringify(raw);
  const entities = model.entitiesFromIndex(raw, definition, 'ja', null);
  assert.deepEqual(entities.map(e => e.id), ['001', '002', '003', '004']);
  assert.equal(entities[0].rank, '0');
  assert.equal(entities[0].resolvedLanguage, 'en');
  assert.equal(entities[1].raw, false);
  assert.equal(JSON.stringify(raw), before);
});
test('all leaf paths preserve empty containers, zero, false, null and escaped keys', () => {
  const raw = { zero: 0, no: false, nil: null, array: [], object: {}, string: '', 'a/b': { '~tag': ['x', 'last'] } };
  const leaves = model.fieldLeaves(raw);
  assert.equal(leaves.length, 8);
  for (const leaf of leaves) assert.deepEqual(model.atPointer(raw, leaf.path), leaf.value);
  assert.ok(leaves.some(l => l.path === '/a~1b/~0tag/1' && l.value === 'last'));
  assert.throws(() => model.atPointer({}, '/toString'));
});
test('locale resolution and resource resolution disclose English fallback', () => {
  assert.deepEqual(model.localizedName({ en: 'Test', ja: '' }, 'ja', '001'), { name: 'Test', resolved: 'en' });
  const english = { dataset: 'test', version: 'test-v', language: 'en', kind: 'detail', id: '001' };
  assert.equal(model.findResource({ resources: [english] }, 'test', 'test-v', 'ko', 'detail', '001'), english);
  assert.equal(model.findResource({ resources: [english] }, 'test', 'other-v', 'en', 'detail', '001'), undefined);
});
test('links and asset URLs reject executable, credential, cross-game and external URLs', () => {
  for (const url of ['javascript:alert(1)', '//evil.test/x', 'https://u:p@zzz.nanoka.cc/', 'https://zzz.nanoka.cc/?uid=1', 'https://static.nanoka.cc:444/x']) assert.equal(model.safeSourceUrl(url), null);
  for (const icon of ['https://evil.test/x.webp', 'https://static.nanoka.cc/assets/hsr/x.webp', 'bad<script>', '../']) assert.equal(model.assetUrl(icon), null);
  assert.equal(model.assetUrl('UI/Items/IconCoin.png'), 'https://static.nanoka.cc/assets/zzz/IconCoin.webp');
  assert.match(model.plainText('<script>TEST</script>'), /<script>/); // React escapes the remaining literal markup.
});
test('unsafe integer display tells the reader to use raw rather than rounding silently', () => {
  assert.match(model.displayNumber(9007199254740993), /JavaScript/);
  assert.equal(model.displayNumber(0), '0');
});

function sourceFor(raw) {
  const hash = createHash('sha256').update(raw).digest('hex');
  return { dataset: 'test_only', kind: 'detail', version: 'test-v', language: 'en', id: '001', url: 'https://static.nanoka.cc/zzz/test-v/en/test/001.json', status: 'fetched', file: `objects/${hash}.json`, sha256: hash, bytes: Buffer.byteLength(raw) };
}
test('client deduplicates requests, verifies hashes, and retains original bytes including BOM', async () => {
  const raw = Buffer.from('\uFEFF {"zero":0,"no":false,"nil":null}\n');
  const source = sourceFor(raw);
  let calls = 0;
  globalThis.fetch = async () => { calls++; await new Promise(r => setTimeout(r, 10)); return new Response(raw, { headers: { 'Content-Type': 'application/json' } }); };
  const client = new SnapshotClient('http://localhost:5173/nanoka/snapshots/test/catalog.json');
  const [a, b] = await Promise.all([client.resource(source), client.resource(source)]);
  assert.equal(calls, 1); assert.equal(a.parsed.zero, 0); assert.equal(b.parsed.no, false);
  assert.deepEqual(Buffer.from(a.originalBytes), raw);
  await client.resource(source); assert.equal(calls, 1);
});
test('client rejects HTML, HTTP errors, damaged hashes and unsafe paths', async () => {
  const raw = '{"test":true}'; const source = sourceFor(raw);
  const client = () => new SnapshotClient('http://localhost:5173/nanoka/snapshots/test/catalog.json');
  globalThis.fetch = async () => new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(client().resource(source), /JSON/);
  globalThis.fetch = async () => new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(client().resource(source), /404/);
  globalThis.fetch = async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(client().resource(source), /SHA-256/);
  await assert.rejects(client().resource({ ...source, file: '../../private.json' }));
});
test('snapshot pointer cannot fetch a catalog outside local nanoka assets', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ schemaVersion: 1, provider: 'Nanoka ZZZ', runId: 'test', catalog: 'https://evil.test/catalog.json' }), { headers: { 'Content-Type': 'application/json' } }); };
  await assert.rejects(loadSnapshot(new AbortController().signal));
  assert.equal(calls, 1);
});
