import type { Catalog, Resource, ResourceData, Snapshot } from './types';
import { asObject, resourceAvailable } from './model';

const objectPattern = /^objects\/[a-f0-9]{64}\.json$/;
function localUrl(relative: string, base: string): string {
  const url = new URL(relative, base);
  const root = new URL('/nanoka/', window.location.origin);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error('ตำแหน่ง snapshot ไม่ถูกต้อง');
  return url.href;
}
async function readJson(url: string, signal?: AbortSignal, noStore = false) {
  const response = await fetch(url, { signal, cache: noStore ? 'no-store' : 'default' });
  if (!response.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${response.status})`);
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('ได้รับข้อมูลที่ไม่ใช่ JSON');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('ข้อมูลมีขนาดเกินขอบเขตที่รองรับ');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { raw, parsed: JSON.parse(raw), bytes };
}
export async function loadSnapshot(signal: AbortSignal): Promise<Snapshot> {
  const pointerUrl = new URL('/nanoka/current.json', window.location.origin).href;
  const { parsed: pointer } = await readJson(pointerUrl, signal, true);
  if (pointer.schemaVersion !== 1 || pointer.provider !== 'Nanoka ZZZ' || typeof pointer.catalog !== 'string' || typeof pointer.runId !== 'string') throw new Error('โครงสร้าง snapshot pointer ไม่ถูกต้อง');
  const catalogUrl = localUrl(pointer.catalog, pointerUrl);
  const { parsed } = await readJson(catalogUrl, signal);
  if (parsed.schemaVersion !== 1 || parsed.provider !== 'Nanoka ZZZ' || parsed.runId !== pointer.runId || !Array.isArray(parsed.definitions) || !Array.isArray(parsed.resources) || !Array.isArray(parsed.versions) || !Array.isArray(parsed.languages) || !asObject(parsed.manifest).zzz || !parsed.coverage) throw new Error('โครงสร้าง catalog ไม่ตรงกับ snapshot');
  let discovery: Snapshot['discovery'] = null;
  try {
    const response = await readJson(new URL('/nanoka/discovery.json', window.location.origin).href, signal, true);
    if (response.parsed.runId === pointer.runId && typeof response.parsed.status === 'string' && Array.isArray(response.parsed.categories) && Array.isArray(response.parsed.notes)) discovery = response.parsed;
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return { catalog: parsed as Catalog, catalogUrl, publishedAt: pointer.publishedAt, discovery };
}
export class SnapshotClient {
  private cache = new Map<string, ResourceData>();
  private requests = new Map<string, Promise<ResourceData>>();
  private bytes = 0;
  constructor(private catalogUrl: string) {}
  async resource(source: Resource): Promise<ResourceData> {
    const unavailable = source.error || 'ยังไม่มีข้อมูล resource นี้ใน snapshot';
    if (!resourceAvailable(source)) throw new Error(unavailable);
    if (!objectPattern.test(source.file!) || source.file !== `objects/${source.sha256}.json`) throw new Error('รูปแบบ path/hash ของข้อมูลไม่ถูกต้อง');
    const url = localUrl(source.file!, this.catalogUrl);
    const cached = this.cache.get(url);
    if (cached) { this.cache.delete(url); this.cache.set(url, cached); return { ...cached, source }; }
    const pending = this.requests.get(url);
    if (pending) return { ...await pending, source };
    const request = (async () => {
      const loaded = await readJson(url, AbortSignal.timeout(25000));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', loaded.bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== source.sha256 || (source.bytes !== undefined && source.bytes !== loaded.bytes.byteLength)) throw new Error('ข้อมูล snapshot ไม่ผ่านการตรวจ SHA-256/ขนาด');
      const result: ResourceData = { raw: loaded.raw, originalBytes: loaded.bytes, parsed: loaded.parsed, source };
      this.cache.set(url, result); this.bytes += loaded.bytes.byteLength;
      while (this.cache.size > 24 || this.bytes > 24 * 1024 * 1024) {
        const first = this.cache.entries().next().value as [string, ResourceData] | undefined;
        if (!first) break;
        this.bytes -= first[1].originalBytes.byteLength; this.cache.delete(first[0]);
      }
      return result;
    })().finally(() => this.requests.delete(url));
    this.requests.set(url, request);
    return request;
  }
}
