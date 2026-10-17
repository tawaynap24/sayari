/** ID joins verified against pinned ZenlessData FileCfg rows. No global name matching. */
export const TABLES = [
  'AvatarBase', 'AvatarBattle', 'AvatarSkillDes', 'AvatarPassiveSkillDes', 'AvatarTalent', 'AvatarSkinBase',
  'PartnerConfig', 'AvatarProfession', 'CampConst', 'DamageElementConfig', 'Property',
  'Weapon', 'WeaponTalent', 'BuddyBase', 'BuddyUI', 'BuddySkillLevelUp', 'EquipmentSuit', 'Item',
  'MonsterCardConfig', 'Achievement', 'AbyssS2Relic', 'AbyssS2RelicBranch', 'NounPrompts',
];
export const normalize = value => value.normalize('NFC').replace(/<\/?(?:color|size|b|i|u)(?:=[^>]*)?>/gi, '').replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim();
export const escapePointer = key => key.replace(/~/g, '~0').replace(/\//g, '~1');
export function leaves(value, path = '') {
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => leaves(child, `${path}/${escapePointer(key)}`));
  return [{ path, value }];
}
export function versionFamily(value) { return /^(\d+\.\d+)(?:\.|\+|$)/.exec(value)?.[1] ?? null; }
export function sourceVersion(message) {
  const found = /\b(OSPROD|CNPROD)Win(\d+\.\d+\.\d+)_R(\d+)_S(\d+)_D(\d+)/.exec(message);
  if (!found) throw new Error('Unrecognized source version; refusing publication');
  return { region: found[1], gameVersion: found[2], revisionBuild: found[3], staticBuild: found[4], dataBuild: found[5] };
}
export function validateTextMap(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length || Object.values(value).some(v => typeof v !== 'string')) throw new Error('TextMap must be a nonempty UTF-8 string dictionary');
  return value;
}
export function textField(path) {
  const keys = path.split('/').filter(Boolean);
  if (keys.some(k => ['ja', 'ko', 'zh'].includes(k))) return false;
  if (keys.some(k => /^(?:icon\d*|image\d*|.*_path|code_name|codename|tags?|format|url|referenceUrl)$/i.test(k))) return false;
  return keys.some(k => /^(?:name\d*|title|desc\d*|description|story|.*_desc|.*_name|impressions?|impression_[fm]|trust_lv|birthday|unlock_condition|camp|weapon_type|element_type|special_element_type|hit_type|branch|skill)$/i.test(k));
}
export function eligibleText(path, value) {
  return typeof value === 'string' && (textField(path) || path === '' || path === '/en')
    && !/^\s*[+-]?\d+(?:[.,]\d+)?%?\s*$/.test(value)
    && !/^\{(?:Skill|Buff|Property):[^{}]+\}$/.test(value)
    && !/^(?:\s*<IconMap:[A-Za-z0-9_]+>\s*[;,]?\s*)+$/.test(value);
}
export function createResolver(tables, english, thai, fileForKey) {
  const indexed = new Map();
  for (const name of TABLES) {
    const rows = tables[name]?.IAEFFFFLKNB;
    if (!Array.isArray(rows) || !rows.length) throw new Error(`Unsupported FileCfg schema: ${name}`);
    indexed.set(name, rows);
  }
  const tableIndex = new Map();
  function rows(name, field, id) {
    const indexKey = `${name}:${field}`;
    if (!tableIndex.has(indexKey)) {
      const map = new Map();
      for (const row of indexed.get(name) ?? []) {
        if (!Object.hasOwn(row, field)) throw new Error(`FileCfg schema changed: ${name}.${field}`);
        const key = String(row[field]); if (!map.has(key)) map.set(key, []); map.get(key).push(row);
      }
      tableIndex.set(indexKey, map);
    }
    return tableIndex.get(indexKey).get(String(id)) ?? [];
  }
  const cache = new Map();
  return function context(dataset, id, record) {
    const name = typeof record === 'string' ? record : record?.en?.name ?? (typeof record?.en === 'string' ? record.en : record?.name ?? record?.title);
    const cacheKey = `${dataset}:${id}:${JSON.stringify([name,record?.camp,record?.weapon_type,record?.element_type,record?.special_element_type])}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const candidates = new Map();
    function add(name, field, value) {
      for (const row of rows(name, field, value)) for (const leaf of leaves(row)) {
        if (typeof leaf.value === 'string' && Object.hasOwn(english, leaf.value)) candidates.set(leaf.value, { table: `${name}TemplateTb.json`, rowId: String(value), field: leaf.path, join: field });
      }
    }
    if (dataset === 'character') {
      add('AvatarBase', 'PFOAJKNPCHL', id);
      for (const name of ['AvatarSkillDes', 'AvatarPassiveSkillDes', 'AvatarTalent', 'AvatarSkinBase', 'PartnerConfig']) add(name, 'PBNPPFFJCGN', id);
    } else if (dataset === 'weapon') {
      add('Weapon', 'HJOEBMMFOMB', id); add('WeaponTalent', 'HGFJOGONPJG', id); add('Item', 'PFOAJKNPCHL', id);
    } else if (dataset === 'bangboo') {
      add('BuddyBase', 'PFOAJKNPCHL', id); add('BuddyUI', 'PFOAJKNPCHL', id); add('BuddySkillLevelUp', 'APMMJLNHAMB', id);
    } else if (dataset === 'equipment') add('EquipmentSuit', 'PFOAJKNPCHL', id);
    else if (['item', 'item_all', 'hollow_card', 'hollow_tpp', 'hollow_gg', 'hollow_resonium'].includes(dataset)) {
      add('Item', 'PFOAJKNPCHL', id);
      if (dataset === 'hollow_tpp') { add('AbyssS2Relic', 'HJOEBMMFOMB', id); add('AbyssS2RelicBranch', 'HJOEBMMFOMB', id); }
    } else if (dataset === 'monster') add('MonsterCardConfig', 'PFOAJKNPCHL', id);
    else if (dataset === 'achievement') add('Achievement', 'JGKGGKEGMJO', id);
    else if (dataset === 'noun') add('NounPrompts', 'BCDKJDPPJEI', id);
    // A join alone is insufficient: corroborate the entity's English display name.
    const identityVerified = typeof name === 'string' && [...candidates.keys()].some(key => normalize(english[key]) === normalize(name));
    const base = { identityVerified, match: () => null };
    if (!identityVerified) { cache.set(cacheKey, base); return base; }
    // Facet/property keys join through IDs explicitly present in this entity, never by label.
    for (const [key, table, field] of [['camp', 'CampConst', 'OOOHMBMDLBI'], ['weapon_type', 'AvatarProfession', 'NJGDHJBKNAJ'], ['element_type', 'DamageElementConfig', 'OAPPMOAPGKN'], ['special_element_type', 'DamageElementConfig', 'OAPPMOAPGKN']]) {
      for (const value of Object.keys(record?.[key] ?? {})) add(table, field, value);
    }
    for (const leaf of leaves(record)) if (/\/(?:prop|property)$/.test(leaf.path) && typeof leaf.value === 'number' && Number.isSafeInteger(leaf.value)) add('Property', 'PFOAJKNPCHL', leaf.value);
    const byEnglish = new Map();
    for (const [key, proof] of candidates) {
      const normalized = normalize(english[key]); if (!normalized) continue;
      if (!byEnglish.has(normalized)) byEnglish.set(normalized, []);
      byEnglish.get(normalized).push({ key, proof });
    }
    const result = { identityVerified, match(value) {
      // Exact English content validation is mandatory even after the ID/foreign-key join.
      const possible = byEnglish.get(normalize(value)) ?? [];
      const valid = possible.filter(({key}) => typeof thai[key] === 'string' && thai[key].trim() && !/^(?:PlaceHolder|TODO|N\/A)$/i.test(thai[key]));
      const translations = new Set(valid.map(({key}) => normalize(thai[key])));
      if (translations.size !== 1) return null;
      const {key, proof} = valid.sort((a,b) => a.key.localeCompare(b.key))[0];
      // A Thai field that silently drops/adds placeholders is not compatible.
      const tokens = s => [...s.matchAll(/\{\d+(?::[^{}]+)?\}/g)].map(m => m[0]).sort().join('|');
      if (tokens(english[key]) !== tokens(thai[key])) return null;
      return { th: thai[key], en: value, translationKey: key, sourceFile: fileForKey[key], proof };
    }};
    cache.set(cacheKey, result); return result;
  };
}
