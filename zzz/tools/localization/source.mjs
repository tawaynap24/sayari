/** Build-time public-source downloader. Large TextMaps never enter the browser bundle. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const execute = promisify(execFile);
export const REPOSITORY = 'https://git.mero.moe/dimbreath/ZenlessData';
export const API = 'https://git.mero.moe/api/v1/repos/dimbreath/ZenlessData';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function json(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function save(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temporary, file);
}
export function validateSourceUrl(value) {
  const url = new URL(value);
  if (url.origin !== 'https://git.mero.moe' || !/^\/(?:api\/v1\/repos\/dimbreath\/ZenlessData(?:\/|$)|dimbreath\/ZenlessData\/)/.test(url.pathname) || url.username || url.password) throw new Error('Source URL is outside the public ZenlessData repository');
  return url.href;
}
export async function download(url, file, { expectedGitSha, expectedBytes, refresh = false, text = false } = {}) {
  validateSourceUrl(url);
  const metadataFile = `${file}.source.json`;
  async function validate(bytes) {
    if (expectedBytes !== undefined && bytes.length !== expectedBytes) throw new Error('Source size does not match repository tree');
    if (expectedGitSha && createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== expectedGitSha) throw new Error('Source bytes do not match pinned Git blob');
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return text ? decoded : JSON.parse(decoded);
  }
  if (!refresh) {
    try {
      const metadata = await json(metadataFile), bytes = await fs.readFile(file);
      if (metadata.url === url && metadata.sha256 === sha256(bytes)) return { data: await validate(bytes), metadata };
    } catch { /* Missing/corrupt cache is never published. */ }
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.download`, headersFile = `${temporary}.headers`;
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Curl handles large responses on Windows reliably. No shell, credentials, or cookies.
      await execute(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--silent', '--show-error', '--fail', '--max-time', expectedBytes > 20e6 ? '240' : '40', '--max-filesize', '160000000', '--compressed', '--dump-header', headersFile, '--output', temporary, url], { maxBuffer: 1024 * 1024 });
      const bytes = await fs.readFile(temporary), data = await validate(bytes);
      const headerText = await fs.readFile(headersFile, 'utf8');
      const httpStatus = Number([...headerText.matchAll(/^HTTP\/\S+\s+(\d{3})/gm)].at(-1)?.[1]);
      if (httpStatus !== 200) throw new Error(`Unexpected source status ${httpStatus}`);
      const headers = Object.fromEntries(headerText.split(/\r?\n/).map(line => { const i = line.indexOf(':'); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; }).filter(([key]) => ['content-type', 'content-length', 'etag', 'last-modified'].includes(key)));
      const metadata = { provider: 'ZenlessData', url, fetchedAt: new Date().toISOString(), httpStatus, encoding: 'utf-8', bytes: bytes.length, sha256: sha256(bytes), gitBlobSha: expectedGitSha ?? null, headers };
      await fs.rename(temporary, file);
      await save(metadataFile, metadata);
      return { data, metadata };
    } catch (error) {
      failure = error;
      if (/403|401|429/.test(error.message)) break;
    } finally { await fs.rm(headersFile, { force: true }); await fs.rm(temporary, { force: true }); }
  }
  throw new Error(`Download/validation failed: ${url}: ${failure?.message}`);
}
export async function tree(sha, cache) {
  const entries = [];
  for (let page = 1; ; page++) {
    const result = await download(`${API}/git/trees/${sha}?per_page=50&page=${page}`, path.join(cache, `tree-${sha}-50-${page}.json`));
    const value = result.data;
    if (!Array.isArray(value.tree) || value.sha !== sha || value.page !== page) throw new Error('Invalid/paginated Git tree');
    entries.push(...value.tree);
    if (entries.length >= value.total_count) break;
    if (!value.tree.length || page > 200) throw new Error('Incomplete Git tree');
  }
  return entries;
}
