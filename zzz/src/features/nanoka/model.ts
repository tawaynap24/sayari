import type { Catalog, Dataset, Entity, Json, JsonObject, Resource } from './types';

export const CATEGORY_LABELS: Record<string, string> = {
  character: 'เอเจนต์', weapon: 'W-Engines', bangboo: 'Bangboo', equipment: 'Drive Discs',
  item: 'ไอเทมและวัสดุ', monster: 'ศัตรู', achievement: 'ความสำเร็จ', shiyu: 'Shiyu Defense',
  hollow: 'Hollow Zero', hollow_card: 'Hollow · Cards', hollow_tpp: 'Hollow · Tactical Prism',
  hollow_gg: 'Hollow · Gear', hollow_resonium: 'Hollow · Resonia',
  boss: 'Deadly Assault', simul: 'Threshold Simulation', hard: 'Annihilation Simulacrum',
  item_all: 'ไอเท็ม · รายละเอียดครบ', noun: 'คำศัพท์ในเกม',
  shiyu_versions: 'Shiyu · ฤดูกาล', boss_versions: 'Deadly Assault · ฤดูกาล', diff: 'การเปลี่ยนแปลงเวอร์ชัน',
};
export const CATEGORY_MARKS: Record<string, string> = {
  character: 'AG', weapon: 'WE', bangboo: 'BO', equipment: 'DD', item: 'IT', monster: 'EN',
  achievement: 'AC', shiyu: 'SD', hollow: 'HZ', hollow_card: 'HC', hollow_tpp: 'TP',
  hollow_gg: 'HG', hollow_resonium: 'HR', boss: 'DA', simul: 'BT', hard: 'AS',
  item_all: 'IF', noun: 'TX', shiyu_versions: 'SV', boss_versions: 'DV', diff: '∆',
};
export function asObject(value: Json | undefined): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function text(value: Json | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return displayNumber(value);
  if (typeof value === 'boolean') return String(value);
  return Object.values(value).filter(v => typeof v === 'string').join(' · ');
}
export function plainText(value: string): string {
  // Game formatting is displayed as text, never injected as HTML.
  return value.replace(/<\/?(?:color|size|b|i|u)(?:=[^>]*)?>/gi, '').replace(/\\n/g, '\n');
}
export const pointerKey = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1');
export function atPointer(value: Json, pointer = ''): Json {
  if (!pointer) return value;
  if (!pointer.startsWith('/')) throw new Error('JSON Pointer ไม่ถูกต้อง');
  let current = value;
  for (const part of pointer.slice(1).split('/')) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) throw new Error(`ไม่พบ ${pointer}`);
    current = (current as JsonObject)[key];
  }
  return current;
}
export function safeSourceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        !['static.nanoka.cc', 'zzz.nanoka.cc'].includes(u.hostname)) return null;
    if ([...u.searchParams.keys()].some(k => /token|secret|password|cookie|authorization|api.?key|^uid$/i.test(k))) return null;
    return u.href;
  } catch { return null; }
}
export function assetUrl(icon: Json | undefined): string | null {
  if (typeof icon !== 'string' || !icon) return null;
  if (/^https?:|^\/\//i.test(icon)) {
    const url = safeSourceUrl(icon);
    return url?.startsWith('https://static.nanoka.cc/assets/zzz/') ? url : null;
  }
  const name = icon.split('/').pop()?.replace(/\.[^.]+$/, '');
  if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) return null;
  // Basename -> WebP mapping verified against the client source and live assets.
  return `https://static.nanoka.cc/assets/zzz/${encodeURIComponent(name)}.webp`;
}
export function localizedName(raw: Json, language: string, id: string): { name: string; resolved: string | null } {
  const record = asObject(raw);
  const readable = (value: string) => value && !/^(?:[A-Za-z][A-Za-z0-9]*_){2,}[A-Za-z0-9_]+$/.test(value);
  for (const locale of [...new Set([language, 'en'])]) {
    const candidate = record[locale];
    const name = typeof candidate === 'string' ? candidate : text(asObject(candidate).name);
    if (readable(name)) return { name, resolved: locale };
  }
  return { name: [record.name, record.title, record.code_name, record.codename].map(text).find(readable) || `ID ${id}`, resolved: null };
}
export function entitiesFromIndex(parsed: Json, definition: Dataset, language: string, sourceLanguage: string | null): Entity[] {
  const records = atPointer(parsed, definition.recordsPointer);
  if (records === null || typeof records !== 'object') throw new Error('รูปแบบรายการไม่ถูกต้อง');
  const entries: [string, Json][] = Array.isArray(records)
    ? records.map((raw, i) => [text(asObject(raw)[definition.idField]) || String(i), raw])
    : Object.entries(records);
  return entries.map(([id, raw]) => {
    const record = asObject(raw);
    const name = localizedName(raw, language, id);
    const localized = asObject(record[language] ?? record.en);
    return {
      id, raw, name: name.name, resolvedLanguage: sourceLanguage ?? name.resolved,
      icon: assetUrl(record.icon ?? record.image ?? record.icon_path ?? record.image_path), rank: text(record.rank ?? record.rarity),
      group: text(record.element_type ?? record.element ?? record.class ?? record.type ?? record.camp ?? record.group ?? record.group_id),
      description: plainText(text(localized.desc2 ?? record.desc ?? record.description ?? record.story)),
    };
  });
}
export function findResource(catalog: Catalog, dataset: string, version: string, language: string, kind: string, id: string | null = null): Resource | undefined {
  const candidates = catalog.resources.filter(r => r.dataset === dataset && r.version === version && r.kind === kind && r.id === id);
  return candidates.find(r => r.language === language) ?? candidates.find(r => r.language === null) ?? candidates.find(r => r.language === 'en');
}
export function resourceAvailable(resource: Resource | undefined): resource is Resource {
  return Boolean(resource?.file && resource.sha256 && ['fetched', 'cache'].includes(resource.status));
}
export function availableVersions(manifest: Json): string[] {
  const list = asObject(asObject(manifest).zzz).available;
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
}
export function fieldLeaves(value: Json, base = ''): { path: string; value: Json }[] {
  const leaves: { path: string; value: Json }[] = [];
  const stack = [{ path: base, value }];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.value !== null && typeof node.value === 'object' && Object.keys(node.value).length) {
      for (const [key, child] of Object.entries(node.value).reverse()) stack.push({ path: `${node.path}/${pointerKey(key)}`, value: child });
    } else leaves.push(node);
  }
  return leaves;
}
export function displayNumber(value: number): string {
  return Number.isInteger(value) && !Number.isSafeInteger(value) ? 'ตัวเลขเกินความแม่นยำของ JavaScript — ดู raw ต้นฉบับ' : String(value);
}
export function sectionLabel(key: string): string {
  const labels: Record<string, string> = {
    stats: 'ค่าสถานะ', skill: 'สกิล', skill_list: 'รายการสกิล', skill_priority: 'ลำดับสกิล',
    passive: 'Core / Passive', talent: 'Mindscape', talents: 'Refinement', level: 'การเติบโตทุกระดับ',
    extra_level: 'การเลื่อนขั้น', level_exp: 'EXP ทุกระดับ', partner_info: 'โปรไฟล์และเรื่องราว',
    skin: 'รูปลักษณ์', potential: 'Potential', potential_detail: 'รายละเอียด Potential',
    base_property: 'ค่าสถานะหลัก', rand_property: 'ค่าสถานะรอง', stars: 'ระดับดาว', materials: 'วัสดุ',
    desc2: 'โบนัส / คำอธิบายเพิ่มเติม', desc4: 'โบนัส 4 ชิ้น', desc3: 'คำอธิบายย่อ', desc: 'คำอธิบาย',
    story: 'เรื่องราว', fairy_recommend: 'คำแนะนำจากต้นทาง', strategy: 'แนวทางจากต้นทาง',
  };
  return labels[key] ?? key;
}
export const SPECIALIZED_KEYS = new Set(['id', 'name', 'code_name', 'rarity', 'icon', 'weapon_type', 'element_type', 'special_element_type', 'hit_type', 'camp', 'gender', 'stats', 'skill', 'skill_list', 'skill_priority', 'passive', 'talent', 'talents', 'level', 'extra_level', 'level_exp', 'partner_info', 'skin', 'potential', 'potential_detail', 'base_property', 'rand_property', 'stars', 'materials', 'desc', 'desc2', 'desc3', 'desc4', 'story', 'fairy_recommend', 'strategy']);
