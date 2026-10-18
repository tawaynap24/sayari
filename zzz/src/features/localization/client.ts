import type { Resource } from '../nanoka/types';
import type { LocalizationManifest, Overlay } from './model';

const pending = new Map<string, Promise<LocalizationManifest>>();
const overlays = new Map<string, Promise<Overlay>>();
let cachedBytes = 0;
export function refreshLocalization() { pending.clear(); overlays.clear(); cachedBytes = 0; }
function localPath(value: string, pattern: RegExp): string {
  if (!pattern.test(value)) throw new Error('ตำแหน่งไฟล์คำแปลไม่ถูกต้อง');
  return new URL(`/localization/${value}`, window.location.origin).href;
}
async function read(url: string, expected?: { sha256: string; bytes: number }, noStore = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), cache: noStore ? 'no-store' : 'default' });
  if (!response.ok || !/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error(`โหลดคำแปลไม่สำเร็จ (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 16 * 1024 * 1024) throw new Error('ไฟล์คำแปลเกินขนาดที่รองรับ');
  if (expected) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== expected.sha256 || bytes.byteLength !== expected.bytes) throw new Error('คำแปลไม่ผ่านการตรวจ SHA-256/ขนาด');
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function loadLocalization(runId: string): Promise<LocalizationManifest> {
  if (!pending.has(runId)) pending.set(runId, (async () => {
    const pointer = await read(new URL('/localization/current.json', window.location.origin).href, undefined, true);
    if (pointer.schemaVersion !== 1 || pointer.provider !== 'ZenlessData' || pointer.nanokaRunId !== runId || typeof pointer.manifest !== 'string' || !/^[a-f0-9]{64}$/.test(pointer.sha256) || !Number.isSafeInteger(pointer.bytes)) throw new Error('ชุดคำแปลไม่ตรงกับ Nanoka snapshot นี้');
    const manifest = await read(localPath(pointer.manifest, /^releases\/[a-f0-9]{64}\/manifest\.json$/), pointer);
    if (manifest.schemaVersion !== 1 || manifest.nanokaRunId !== runId || manifest.sourceRevision !== pointer.sourceRevision || !manifest.source || !manifest.resources || !manifest.versions || !Array.isArray(manifest.coverage)) throw new Error('โครงสร้างชุดคำแปลไม่ถูกต้อง');
    return manifest as LocalizationManifest;
  })().catch(error => { pending.delete(runId); throw error; }));
  return pending.get(runId)!;
}
export async function loadOverlay(manifest: LocalizationManifest, resource: Resource): Promise<Overlay | null> {
  if (!resource.version || !manifest.versions[resource.version]?.compatible) return null;
  const entry = manifest.resources[`${resource.version}:${resource.dataset}:${resource.sha256}`];
  if (!entry) return null;
  if (entry.version !== resource.version || entry.dataset !== resource.dataset || entry.file !== `objects/${entry.sha256}.json`) throw new Error('คำแปลอ้างถึง resource คนละชุด');
  const url = localPath(entry.file, /^objects\/[a-f0-9]{64}\.json$/);
  if (!overlays.has(url)) {
    if (overlays.size >= 24 || cachedBytes + entry.bytes > 24 * 1024 * 1024) { overlays.clear(); cachedBytes = 0; }
    cachedBytes += entry.bytes;
    const request = (async () => {
      const value = await read(url, entry);
      if (value.schemaVersion !== 1 || value.nanokaRunId !== manifest.nanokaRunId || value.sourceRevision !== manifest.sourceRevision || value.resourceSha256 !== resource.sha256 || value.version !== resource.version || !value.translations || !value.entities) throw new Error('คำแปลไม่ตรงกับข้อมูลต้นฉบับ');
      return value as Overlay;
    })().catch(error => { if (overlays.get(url) === request) { overlays.delete(url); cachedBytes = Math.max(0, cachedBytes - entry.bytes); } throw error; });
    overlays.set(url, request);
  }
  return overlays.get(url)!;
}
