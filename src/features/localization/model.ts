import type { Json } from '../nanoka/types';

export type SiteLocale = 'th-TH' | 'en-US';
export const LANGUAGE_STORAGE_KEY = 'sayari.locale';
export interface DataSourceReference {
  provider: string; url: string; gameVersion?: string; sourceRevision?: string; fetchedAt?: string;
}
export interface LocalizedText {
  th?: string; en: string; translationKey: string; sourceFile: string;
  proof: { table: string; rowId: string; field: string; join: string };
}
export interface Overlay {
  schemaVersion: number; nanokaRunId: string; sourceRevision: string; resourceSha256: string; version: string;
  translations: Record<string, LocalizedText>;
  entities: Record<string, { mapped: number; fallback: number; missing: number }>;
}
export interface LocalizationManifest {
  schemaVersion: number; provider: string; generatedAt: string; nanokaRunId: string; sourceRevision: string;
  source: { repository: string; gameVersion: string; region: string; committedAt: string | null;
    files: (DataSourceReference & { path: string; bytes: number; sha256: string })[] };
  versions: Record<string, { compatible: boolean; sourceGameVersion: string; region: string }>;
  resources: Record<string, { file: string; sha256: string; bytes: number; dataset: string; version: string }>;
  coverage: { version: string; category: string; textOccurrences: number; mappedThai: number; englishFallback: number; missing: number }[];
}
export function storedLocale(storage: Pick<Storage, 'getItem'> | null): SiteLocale {
  try { return storage?.getItem(LANGUAGE_STORAGE_KEY) === 'en-US' ? 'en-US' : 'th-TH'; } catch { return 'th-TH'; }
}
export function formatText(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\d+)\}/g, (original, key: string) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : original);
}
/** Copy only verified string leaves. Numeric/calculation data and original raw objects are immutable. */
export function applyOverlay(raw: Json, overlay: Overlay): Json {
  const visit = (value: Json, path: string): Json => {
    if (typeof value === 'string') {
      const localized = Object.prototype.hasOwnProperty.call(overlay.translations, path) ? overlay.translations[path] : undefined;
      if (!localized) return value;
      if (localized.en !== value || typeof localized.th !== 'string' || !localized.th.trim()) throw new Error('คำแปลไม่ตรงกับข้อความต้นฉบับ');
      return localized.th;
    }
    if (Array.isArray(value)) return value.map((child, index) => visit(child, `${path}/${index}`));
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)]));
    return value;
  };
  return visit(raw, '');
}
export function safeLocalizationUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://git.mero.moe' && !url.username && !url.password && /^\/dimbreath\/ZenlessData(?:\/|$)/.test(url.pathname) && !url.search ? url.href : null;
  } catch { return null; }
}
