#!/usr/bin/env node
/**
 * Read-only Nanoka collector. No credentials, no dependencies, no deployment.
 * Node >= 20. Raw response bytes are retained; projections never replace them.
 * Endpoint sources and limits are documented in ../reference and ../docs.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const pointerEscape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');

export function atPointer(value, pointer = '') {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) throw new Error('recordsPointer must be a JSON Pointer');
  let current = value;
  for (const part of pointer.slice(1).split('/')) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) {
      throw new Error(`JSON Pointer not found: ${pointer}`);
    }
    current = current[key];
  }
  return current;
}

/** IDs stay strings, including leading zeros. Nothing is silently filtered as an MC. */
export function extractIds(data, definition) {
  const records = atPointer(data, definition.recordsPointer ?? '');
  const pattern = new RegExp(definition.idPattern ?? '^[0-9]+$');
  const rejected = [];
  const ids = [];
  const add = id => {
    if (typeof id === 'number' && !Number.isSafeInteger(id)) {
      rejected.push({ value: String(id), reason: 'unsafe-numeric-id; use original JSON and a lossless parser' });
      return;
    }
    if ((typeof id !== 'number' && typeof id !== 'string') || !pattern.test(String(id))) {
      rejected.push({ value: String(id), reason: 'unexpected-id-shape' });
      return;
    }
    ids.push(String(id));
  };
  if (Array.isArray(records)) {
    for (const entry of records) add(object(entry) ? entry[definition.idField ?? 'id'] : undefined);
  } else if (object(records)) {
    for (const key of Object.keys(records)) add(key);
  } else {
    throw new Error('Index is not a record dictionary or array; inspect raw JSON and configure recordsPointer');
  }
  const unique = [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return { ids: unique, rejected, duplicatedIds: ids.length - unique.length };
}

export function inspectJson(data) {
  const types = Object.create(null);
  let nodes = 0;
  let leaves = 0;
  let unsafeNumberCount = 0;
  const stack = [data];
  while (stack.length) {
    const value = stack.pop();
    nodes++;
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    types[type] = (types[type] ?? 0) + 1;
    if (type === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) unsafeNumberCount++;
    if (value !== null && typeof value === 'object') {
      const values = Object.values(value);
      if (values.length === 0) leaves++;
      for (const child of values) stack.push(child);
    } else leaves++;
  }
  return { nodes, leaves, types, unsafeNumberCount, topLevelKeys: object(data) ? Object.keys(data) : null };
}

export function validateDataUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error(`Disallowed URL: ${value}`);
  const isStatic = url.hostname === 'static.nanoka.cc' &&
    (url.pathname === '/manifest.json' || url.pathname.startsWith('/zzz/'));
  const isSite = url.hostname === 'zzz.nanoka.cc';
  if (!isStatic && !isSite) throw new Error(`Not a permitted Nanoka ZZZ data origin/path: ${value}`);
  if ([...url.searchParams.keys()].some(key => /token|secret|password|cookie|authorization|api.?key|^uid$/i.test(key))) {
    throw new Error('Credential-like query parameter refused');
  }
  url.hash = '';
  return url.href;
}

export function fillTemplate(template, variables) {
  const result = template.replace(/\{(version|lang|id)\}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined || value === '') throw new Error(`Missing template variable ${key}`);
    if (!/^[A-Za-z0-9._+-]+$/.test(String(value)) || String(value).includes('..')) {
      throw new Error(`Unsafe template segment for ${key}`);
    }
    return encodeURIComponent(String(value));
  });
  if (/\{[^}]+\}/.test(result)) throw new Error(`Unknown template placeholder: ${result}`);
  return result;
}

export function selectVersions(manifest, channels = ['live', 'latest'], explicit = [], all = false) {
  if (!object(manifest?.zzz)) throw new Error('Manifest is missing zzz; do not invent a version');
  const zzz = manifest.zzz;
  if (!Array.isArray(zzz.available) || !zzz.available.every(v => typeof v === 'string')) {
    throw new Error('zzz.available is not a string array; inspect manifest schema');
  }
  const chosen = all ? [...zzz.available] : explicit.length ? [...explicit] : channels.map(channel => {
    if (!['live', 'latest'].includes(channel)) throw new Error(`Unknown channel ${channel}`);
    const value = zzz[channel];
    if (typeof value !== 'string' || !value) throw new Error(`zzz.${channel} missing; no silent fallback`);
    return value;
  });
  const allowed = new Set([...zzz.available, zzz.live, zzz.latest]);
  for (const value of chosen) {
    if (!allowed.has(value)) throw new Error(`Version not published in the manifest: ${value}`);
    fillTemplate('{version}', { version: value });
  }
  const versions = [...new Set(chosen)].map(version => ({
    version, channels: ['live', 'latest'].filter(key => zzz[key] === version),
  }));
  if (!versions.length) throw new Error('No versions selected');
  return versions;
}

export function retryAfterMs(value, time = Date.now()) {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.ceil(Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - time) : null;
}

export async function writeJson(file, value) {
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
export async function writeAtomic(file, value, { renameImpl = fs.rename, sleepImpl = sleep } = {}) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, value);
  try {
    for (let attempt = 0; ; attempt++) {
      try { await renameImpl(tmp, file); break; }
      catch (error) {
        // Windows scanners/watchers may briefly lock the destination. Keep the
        // previous pointer valid until an atomic replacement succeeds.
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 6) throw error;
        await sleepImpl(Math.min(1000, 100 * 2 ** attempt));
      }
    }
  } catch (error) { await fs.unlink(tmp).catch(() => {}); throw error; }
}
export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

async function readLimited(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error(`BODY_TOO_LARGE: declared ${declared}`);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error(`BODY_TOO_LARGE: >${maxBytes}`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, bytes);
  } finally { reader.releaseLock(); }
}

export class JsonCollector {
  constructor(options) {
    this.options = options;
    this.output = path.resolve(options.output);
    this.fetch = options.fetchImpl ?? globalThis.fetch;
    this.sleep = options.sleepImpl ?? sleep;
    this.requests = 0;
    this.lastRequestAt = 0;
    this.blocked = new Map();
    this.results = new Map();
    this.records = [];
    this.attemptLog = options.attemptLog;
  }
  async log(event) {
    if (!this.attemptLog) return;
    await fs.mkdir(path.dirname(this.attemptLog), { recursive: true });
    await fs.appendFile(this.attemptLog, JSON.stringify(event) + '\n');
  }
  async cache(url) {
    if (this.options.refresh) return null;
    try {
      const record = await readJson(path.join(this.output, 'cache', `${sha256(url)}.json`));
      if (record.url !== url || !/^[a-f0-9]{64}$/.test(record.sha256)) return null;
      if (record.file !== `objects/${record.sha256}.json`) return null;
      const age = Date.now() - Date.parse(record.fetchedAt);
      if (!Number.isFinite(age) || age < 0 || age > this.options.cacheMaxAgeHours * 3600000) return null;
      const body = await fs.readFile(path.join(this.output, record.file));
      if (sha256(body) !== record.sha256) return null;
      return { record, data: JSON.parse(body.toString('utf8')), text: body.toString('utf8') };
    } catch { return null; }
  }
  async get(urlValue, context) {
    const url = validateDataUrl(urlValue);
    if (this.results.has(url)) return this.results.get(url);
    const cached = await this.cache(url);
    if (cached) {
      const record = { ...cached.record, ...context, url, status: 'cache', cacheReadAt: now(), checkedAt: null };
      const result = { ...cached, record };
      this.records.push(record); this.results.set(url, result);
      await this.log({ event: 'cache_read', url, at: now(), originalFetchedAt: record.fetchedAt, sha256: record.sha256 });
      return result;
    }
    const origin = new URL(url).origin;
    let record = { ...context, url, status: 'failed', httpStatus: null, file: null, fetchedAt: null, checkedAt: null };
    let text = null;
    let data = null;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      if (this.blocked.has(origin)) { record.status = 'blocked_origin'; record.error = this.blocked.get(origin); break; }
      if (this.requests >= this.options.maxRequests) { record.status = 'blocked_budget'; record.error = 'Request budget exhausted; increase explicitly and resume, not silently truncate'; break; }
      await this.sleep(Math.max(0, this.options.delayMs - (Date.now() - this.lastRequestAt)));
      this.requests++; this.lastRequestAt = Date.now();
      const started = now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      let retryDelay = null;
      try {
        const response = await this.fetch(url, {
          method: 'GET', redirect: 'error', signal: controller.signal,
          headers: { Accept: 'application/json,text/plain;q=0.9', 'User-Agent': 'ZZZNanokaDataCollector/1.0 (public-data; read-only)' },
        });
        record.httpStatus = response.status;
        record.checkedAt = started;
        record.headers = Object.fromEntries([
          'content-type', 'etag', 'last-modified', 'cache-control', 'age', 'date',
          'access-control-allow-origin', 'retry-after',
        ].map(key => [key, response.headers.get(key)]).filter(([, val]) => val !== null));
        if (!response.ok) {
          record.error = `HTTP_${response.status}`;
          if (response.body) await response.body.cancel();
          if ([401, 403].includes(response.status)) this.blocked.set(origin, record.error);
          if (response.status === 429 || response.status >= 500) {
            retryDelay = retryAfterMs(response.headers.get('retry-after')) ?? Math.min(30000, 1000 * 2 ** (attempt - 1));
            if (retryDelay > 120000 || (response.status === 429 && attempt === this.options.maxAttempts)) {
              this.blocked.set(origin, `Paused for throttling: ${record.error}`); retryDelay = null;
            }
          }
          await this.log({ event: 'http', url, attempt, startedAt: started, status: response.status, retryDelayMs: retryDelay });
          if (retryDelay !== null && attempt < this.options.maxAttempts) {
            clearTimeout(timer); await this.sleep(retryDelay); continue;
          }
          break;
        }
        const body = await readLimited(response, this.options.maxBodyBytes);
        text = body.toString('utf8');
        const hash = sha256(body);
        const file = `objects/${hash}.json`;
        // Validate as JSON but retain the original bytes, not a re-serialized value.
        try { data = JSON.parse(text); }
        catch {
          const failureFile = `failures/${hash}.txt`;
          await writeAtomic(path.join(this.output, failureFile), body);
          record.status = 'invalid_json'; record.failureFile = failureFile;
          record.error = 'HTTP succeeded but body is not JSON (may be an HTML challenge)';
          await this.log({ event: 'invalid_json', url, attempt, startedAt: started, status: response.status, failureFile });
          break;
        }
        await writeAtomic(path.join(this.output, file), body);
        record = { ...record, status: 'fetched', file, sha256: hash, bytes: body.byteLength,
          fetchedAt: now(), cacheReadAt: null, sourceUpdatedAt: null, jsonShape: inspectJson(data) };
        delete record.error;
        // Last-Modified is exposed separately, never fabricated as game-data update time.
        await writeJson(path.join(this.output, 'cache', `${sha256(url)}.json`), record);
        await this.log({ event: 'http', url, attempt, startedAt: started, status: response.status, sha256: hash, bytes: body.byteLength });
        break;
      } catch (error) {
        record.error = `${error.name}: ${error.message}`;
        record.checkedAt = started;
        await this.log({ event: 'request_error', url, attempt, startedAt: started, error: record.error });
        const noRetry = /BODY_TOO_LARGE|redirect|disallowed/i.test(record.error);
        if (!noRetry && attempt < this.options.maxAttempts) {
          clearTimeout(timer); await this.sleep(Math.min(10000, 1000 * 2 ** (attempt - 1))); continue;
        }
        break;
      } finally { clearTimeout(timer); }
    }
    const result = { record, data, text };
    this.records.push(record); this.results.set(url, result);
    return result;
  }
}

function isSuccess(record) { return ['fetched', 'cache'].includes(record.status); }
function checkDefinition(def) {
  if (!/^[A-Za-z0-9_-]+$/.test(def.key)) throw new Error('Invalid dataset key');
  if (typeof def.indexPath !== 'string' || !def.evidence?.sourceUrl) throw new Error(`Dataset ${def.key} needs path and source evidence`);
  if (new URL(def.referenceList).hostname !== 'zzz.nanoka.cc') throw new Error('Dataset reference must be Nanoka ZZZ');
  if (def.localizedIndex && !def.indexPath.includes('{lang}')) throw new Error('localizedIndex path must contain {lang}');
  if (def.detailPath && !def.detailPath.includes('{id}')) throw new Error('detailPath must contain {id}');
  if (def.localizedDetail && def.detailPath && !def.detailPath.includes('{lang}')) throw new Error('localizedDetail path must contain {lang}');
  // These paths are intentionally limited to the provider's ZZZ scope.
  if (!def.indexPath.startsWith('/zzz/')) throw new Error('Dataset indexPath must start with /zzz/');
  if (def.detailPath && !def.detailPath.startsWith('/zzz/')) throw new Error('detailPath must start with /zzz/');
}

export async function runSync(supplied = {}) {
  const defaults = await readJson(path.join(KIT, 'reference/sync.defaults.json'));
  const options = { ...defaults, mode: 'sync', output: '.nanoka', ...supplied };
  options.output = path.resolve(options.output);
  if (!['probe', 'sync'].includes(options.mode)) throw new Error('mode must be probe or sync');
  for (const key of ['maxAttempts','maxRequests','maxBodyBytes','timeoutMs']) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0 || !Number.isFinite(options.cacheMaxAgeHours) || options.cacheMaxAgeHours < 0) throw new Error('Invalid delay/cache age');
  if (options.concurrency !== 1) throw new Error('This collector deliberately uses one worker. It does not pretend to support concurrency.');
  options.languages = [...new Set(options.languages)];
  if (!options.languages.length || !options.languages.every(lang => /^[a-z]{2}(?:-[a-z]{2})?$/.test(lang))) throw new Error('Invalid language selection');
  const seed = await readJson(options.registry ?? path.join(KIT, 'reference/endpoints.seed.json'));
  const extension = options.extensions ? await readJson(options.extensions) : { datasets: [], rawUrls: [] };
  const definitions = [...seed.datasets, ...(extension.datasets ?? [])];
  definitions.forEach(checkDefinition);
  if (new Set(definitions.map(def => def.key)).size !== definitions.length) throw new Error('Duplicate dataset key; use a reviewed registry to replace a changed core endpoint');
  const runId = now().replaceAll(':', '-').replaceAll('.', '-') + '-' + randomUUID().slice(0, 8);
  const runDir = path.join(options.output, 'runs', runId);
  await fs.mkdir(runDir, { recursive: true });
  const client = new JsonCollector({ ...options, attemptLog: path.join(runDir, 'requests.jsonl') });
  const issues = [];
  const inventory = [];
  const detailPlan = [];
  const startedAt = now();
  let versions = [];
  let manifest = null;
  const manifestResult = await client.get(new URL(seed.manifestPath, seed.baseUrl).href,
    { dataset: 'manifest', kind: 'manifest', version: null, language: null, id: null, referenceUrl: seed.referenceUrl });
  if (isSuccess(manifestResult.record)) {
    manifest = manifestResult.data;
    try { versions = selectVersions(manifest, options.channels, options.versions ?? [], options.allVersions ?? false); }
    catch (error) { issues.push({ type: 'manifest_schema', error: error.message }); }
  } else issues.push({ type: 'manifest_unavailable', error: manifestResult.record.error });
  for (const { version } of versions) {
    for (const def of definitions) {
      for (const language of def.localizedIndex ? options.languages : [null]) {
        const url = new URL(fillTemplate(def.indexPath, { version, lang: language }), seed.baseUrl).href;
        const result = await client.get(url, { dataset: def.key, kind: 'index', version, language, id: null, referenceUrl: def.referenceList });
        if (!isSuccess(result.record)) { issues.push({ type: 'unresolved_index', dataset: def.key, version, language, url }); continue; }
        try {
          const found = extractIds(result.data, def);
          inventory.push({ dataset: def.key, version, language, url, count: found.ids.length, ids: found.ids, rejected: found.rejected, duplicatedIds: found.duplicatedIds });
          if (found.rejected.length || found.duplicatedIds || (!found.ids.length && !def.allowEmpty)) {
            issues.push({ type: 'index_schema_review_needed', dataset: def.key, version, language, rejected: found.rejected, count: found.ids.length, duplicatedIds: found.duplicatedIds });
          }
          if (def.detailPath) {
            const detailLanguages = def.localizedDetail ? (def.localizedIndex ? [language] : options.languages) : [null];
            for (const lang of detailLanguages) for (const id of found.ids) {
              detailPlan.push({ dataset: def.key, kind: 'detail', version, language: lang, id,
                url: new URL(fillTemplate(def.detailPath, { version, lang, id }), seed.baseUrl).href,
                referenceUrl: def.referenceDetail ? fillTemplate(def.referenceDetail, { version, lang, id }) : def.referenceList });
            }
          }
        } catch (error) { issues.push({ type: 'index_schema_error', dataset: def.key, version, language, url, error: error.message }); }
      }
    }
  }
  const uniquePlan = [...new Map(detailPlan.map(entry => [entry.url, entry])).values()];
  const plan = { runId, mode: options.mode, versions, languages: options.languages, inventory,
    discoveredDetailRequestCount: uniquePlan.length, details: uniquePlan,
    warning: 'Discovery count is limited by successfully read indexes. Missing indexes have unknown descendants.' };
  await writeJson(path.join(runDir, 'plan.json'), plan);
  if (options.mode === 'sync') {
    for (const [index, entry] of uniquePlan.entries()) {
      if (!options.quiet && (index % 25 === 0)) console.log(`[Nanoka] detail ${index + 1}/${uniquePlan.length}; requests=${client.requests}`);
      const result = await client.get(entry.url, entry);
      if (isSuccess(result.record)) {
        if (!object(result.data) || !Object.keys(result.data).length ||
            (Object.hasOwn(result.data, 'id') && String(result.data.id) !== entry.id)) {
          issues.push({ type: 'detail_schema_review_needed', url: entry.url, dataset: entry.dataset, id: entry.id });
        }
        if (object(result.data) && Object.hasOwn(result.data, 'error') && Object.keys(result.data).every(key => ['error','message','status','code'].includes(key))) {
          issues.push({ type: 'detail_error_payload', url: entry.url });
        }
      }
    }
    let rawUrls = [...(extension.rawUrls ?? [])];
    if (options.observed) {
      const observed = await readJson(options.observed);
      rawUrls = rawUrls.concat((observed.records ?? []).filter(row => row.isJson === true && row.status >= 200 && row.status < 300)
        .map(row => ({ url: row.url, referenceUrl: row.pageUrl ?? seed.referenceUrl, evidence: `Observed browser response at ${row.observedAt}`, sourceId: 'browser_observed' })));
    }
    for (const row of rawUrls) {
      if (!row.evidence) throw new Error('rawUrls entries need evidence; no guessed endpoints');
      const url = validateDataUrl(row.url);
      if (client.results.has(url)) continue;
      const parts = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const isVersioned = parts[0] === 'zzz' && parts.length >= 3;
      const version = isVersioned ? parts[1] : null;
      if (version && !versions.some(v => v.version === version)) {
        issues.push({ type: 'observed_out_of_selected_version', url, version, action: 'not fetched; select it explicitly if in scope' }); continue;
      }
      const referenceUrl = row.referenceUrl ?? seed.referenceUrl;
      if (new URL(referenceUrl).hostname !== 'zzz.nanoka.cc') throw new Error('rawUrls referenceUrl must be Nanoka ZZZ');
      await client.get(url, { dataset: row.dataset ?? 'observed', kind: 'raw', version,
        language: isVersioned && options.languages.includes(parts[2]) ? parts[2] : null,
        id: null, referenceUrl, evidence: row.evidence });
    }
  }
  const records = client.records;
  const failed = records.filter(row => !isSuccess(row));
  const unsafe = records.filter(row => row.jsonShape?.unsafeNumberCount > 0);
  if (unsafe.length) issues.push({ type: 'unsafe_numbers_require_lossless_ui', urls: unsafe.map(row => row.url), note: 'Original bytes are preserved; JSON.parse is insufficient for exact display of these values.' });
  const successful = records.length - failed.length;
  const registeredScopeComplete = options.mode === 'sync' && versions.length > 0 && !failed.length && !issues.length;
  const coverage = {
    runId, startedAt, finishedAt: now(), mode: options.mode,
    status: registeredScopeComplete ? 'REGISTERED_SCOPE_COMPLETE_DISCOVERY_SIGNOFF_REQUIRED' : options.mode === 'probe' ? 'PROBE_ONLY_NOT_FULL_SYNC' : 'PARTIAL_OR_BLOCKED',
    registeredScopeComplete, entireProviderApiComplete: false,
    entireProviderApiCompleteReason: 'No exhaustive provider OpenAPI catalog is assumed. Separate route/selector/family discovery and UI audit are mandatory.',
    selectedVersions: versions, selectedLanguages: options.languages,
    uniqueResourcesAttempted: records.length, successfulResources: successful, failedResources: failed.length,
    networkAttempts: client.requests, cachedResources: records.filter(row => row.status === 'cache').length,
    scheduledDetailResources: uniquePlan.length, issues, failures: failed,
    unattemptedDetailsInProbe: options.mode === 'probe' ? uniquePlan.length : 0,
    historicalVersionsDownloaded: Boolean(options.allVersions),
  };
  const catalog = { schemaVersion: 1, provider: 'Nanoka ZZZ', referenceUrl: seed.referenceUrl,
    runId, generatedAt: now(), manifest, versions, languages: options.languages, definitions,
    coverage, inventory, resources: records, storageNote: 'resource.file paths are relative to the collector output directory' };
  await writeJson(path.join(runDir, 'catalog.json'), catalog);
  await writeJson(path.join(runDir, 'coverage.json'), coverage);
  await writeJson(path.join(runDir, 'field-inventory.json'), records.filter(isSuccess).map(row => ({ url: row.url, file: row.file, sha256: row.sha256, ...row.jsonShape })));
  await writeJson(path.join(options.output, 'latest-run.json'), { runId, catalog: `runs/${runId}/catalog.json`, coverage: `runs/${runId}/coverage.json` });
  console.log(JSON.stringify({ runId, status: coverage.status, successful, failed: failed.length, issues: issues.length, output: runDir }, null, 2));
  return { catalog, coverage, runDir };
}

export function parseArgs(args) {
  const result = {};
  const mapping = { 'out':'output', 'registry':'registry', 'extensions':'extensions', 'observed':'observed',
    'delay-ms':'delayMs', 'timeout-ms':'timeoutMs', 'max-attempts':'maxAttempts', 'max-requests':'maxRequests',
    'max-body-bytes':'maxBodyBytes', 'cache-max-age-hours':'cacheMaxAgeHours', 'mode':'mode' };
  const numberKeys = new Set(['delayMs','timeoutMs','maxAttempts','maxRequests','maxBodyBytes','cacheMaxAgeHours']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--refresh','--all-versions','--quiet','--help'].includes(arg)) {
      result[{ '--refresh':'refresh', '--all-versions':'allVersions', '--quiet':'quiet', '--help':'help' }[arg]] = true; continue;
    }
    const value = args[++i];
    if (!arg.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error(`Missing/invalid value for ${arg}`);
    const key = arg.slice(2);
    if (['channels','languages','versions'].includes(key)) result[key] = value.split(',').filter(Boolean);
    else if (mapping[key]) result[mapping[key]] = numberKeys.has(mapping[key]) ? Number(value) : value;
    else throw new Error(`Unknown option ${arg}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('node nanoka-sync.mjs --mode probe|sync --out .nanoka [--channels live,latest] [--languages en,ja,ko,zh] [--versions EXACT1,EXACT2 | --all-versions] [--extensions FILE] [--observed FILE] [--refresh] [--max-requests 6000]');
    } else {
      const { coverage } = await runSync(options);
      process.exitCode = options.mode === 'probe' ? (coverage.failedResources || coverage.issues.length ? 2 : 0) : coverage.registeredScopeComplete ? 0 : 2;
    }
  } catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}
