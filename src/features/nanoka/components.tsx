import { useMemo, useState } from 'react';
import { asObject, displayNumber, fieldLeaves, plainText, pointerKey, safeSourceUrl, sectionLabel, text } from './model';
import type { Entity, Json, Resource, ResourceData } from './types';
import { GameText } from '../localization/GameText';
import { useLanguage } from '../localization/context';
import { useUiText } from '../localization/ui';

export function SourceLink({ url, children }: { url: string | undefined; children: React.ReactNode }) {
  const safe = safeSourceUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children} ↗</a> : <span>{children} (ไม่มีลิงก์ที่ยืนยันได้)</span>;
}
export function SourceReference({ source, requestedLanguage, channels, recordId }: { source: Resource; requestedLanguage: string; channels?: string[]; recordId?: string }) {
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ไม่ทราบ';
  return <details className="nk-source"><summary>ที่มาและความสดของข้อมูล <span>Nanoka ZZZ · {source.version ?? 'ไม่ระบุเวอร์ชัน'}</span></summary>
    <dl><dt>Dataset / ID</dt><dd>{source.dataset} / {recordId ?? source.id ?? 'ทั้งรายการ'}{recordId && !source.id ? ' (อยู่ใน resource รวม)' : ''}</dd>
      {channels && <><dt>Channel ของเวอร์ชันใน snapshot</dt><dd>{channels.join(' / ').toUpperCase() || 'historical'}</dd></>}
      <dt>ภาษาที่เลือก / resource</dt><dd>{requestedLanguage.toUpperCase()} / {source.language?.toUpperCase() ?? 'ไม่ระบุ / หลายภาษา'}</dd>
      <dt>ดึงจากต้นทางเมื่อ</dt><dd>{date(source.fetchedAt)}</dd><dt>อ่าน cache เมื่อ</dt><dd>{source.cacheReadAt ? date(source.cacheReadAt) : 'ไม่ได้อ่านจาก cache ในรอบ sync'}</dd>
      <dt>ต้นทางอัปเดตเมื่อ</dt><dd>{date(source.sourceUpdatedAt)}</dd><dt>HTTP / สถานะ</dt><dd>{source.httpStatus ?? '—'} / {source.status}</dd>
      <dt>SHA-256</dt><dd className="nk-hash">{source.sha256 ?? 'ไม่มี'}</dd><dt>Source JSON</dt><dd><SourceLink url={source.url}>{source.url}</SourceLink></dd>
      <dt>เว็บไซต์อ้างอิง</dt><dd><SourceLink url={source.referenceUrl}>เปิด Nanoka</SourceLink></dd></dl>
  </details>;
}
export function EntityImage({ src, name, large = false }: { src: string | null; name: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  return <div className={`nk-image${large ? ' nk-image-large' : ''}`}>
    {src && src !== failedUrl ? <img src={src} alt={name} loading="lazy" width={large ? 200 : 120} height={large ? 200 : 120} onError={() => setFailedUrl(src)} /> : <span aria-label={`ไม่มีภาพ ${name}`}>{name.slice(0, 2).toUpperCase()}</span>}
  </div>;
}
export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (page: number) => void }) {
  const { locale } = useLanguage(); const ui = useUiText();
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav className="nk-pager" aria-label="แบ่งหน้า"><span>{total.toLocaleString()} {locale === 'th-TH' ? 'รายการ · หน้า' : 'entries · page'} {page} / {pages}</span><div>
    <button disabled={page <= 1} onClick={() => onPage(1)} aria-label={ui('หน้าแรก')}>«</button>
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>{ui('ก่อนหน้า')}</button>
    <button disabled={page >= pages} onClick={() => onPage(page + 1)}>{ui('ถัดไป')}</button>
    <button disabled={page >= pages} onClick={() => onPage(pages)} aria-label={ui('หน้าสุดท้าย')}>»</button>
  </div></nav>;
}
function ValueText({ value }: { value: Json }) {
  if (value === null) return <span className="nk-null">null</span>;
  if (typeof value === 'boolean') return <code>{String(value)}</code>;
  if (typeof value === 'number') return <code>{displayNumber(value)}</code>;
  if (typeof value === 'string') return <span className="nk-text-value">{value === '' ? <i>ข้อความว่าง</i> : <GameText value={value} />}</span>;
  return <code>{Array.isArray(value) ? '[]' : '{}'}</code>;
}
export function JsonNode({ value, path = '', label = 'ข้อมูล', initialOpen = false, items, onMaterial }: {
  value: Json; path?: string; label?: string; initialOpen?: boolean; items?: Map<string, Entity>; onMaterial?: (id: string) => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  if (value === null || typeof value !== 'object') return <div className="nk-value-row"><span><code>{label}</code><small className="nk-primitive-meta">{value === null ? 'null' : typeof value} · {path || '/'}</small></span><ValueText value={value} /></div>;
  const entries = Object.entries(value);
  if (!entries.length) return <div className="nk-value-row"><code title={path}>{label}</code><ValueText value={value} /></div>;
  const material = /\/(?:materials|material|cost|reward)(?:\/|$)/i.test(path);
  return <details className="nk-json-node" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span>{label}</span><small>{Array.isArray(value) ? 'array' : 'object'} · {entries.length.toLocaleString()}</small></summary>
    {open && <div className="nk-node-content"><div className="nk-pointer"><code>{path || '/'}</code><button onClick={async () => { try { await navigator.clipboard.writeText(path); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก path'}</button></div>
      {entries.slice((page - 1) * 30, page * 30).map(([key, child]) => <div key={key}>
        {material && /^\d+$/.test(key) && <div className="nk-material">{items?.has(key) ? <button onClick={() => onMaterial?.(key)}>{items.get(key)!.name} <small>#{key}</small> ↗</button> : <span>วัสดุ #{key} · ยังจับคู่ชื่อไม่ได้</span>}</div>}
        <JsonNode value={child} path={`${path}/${pointerKey(key)}`} label={key} items={items} onMaterial={onMaterial} />
      </div>)}
      {entries.length > 30 && <Pager page={page} total={entries.length} size={30} onPage={setPage} />}
    </div>}
  </details>;
}
export function FieldSearch({ value }: { value: Json }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const search = query.trim().toLocaleLowerCase();
    return fieldLeaves(value).filter(node => `${node.path} ${JSON.stringify(node.value)}`.toLocaleLowerCase().includes(search));
  }, [value, query]);
  return <section className="nk-field-search"><label>ค้นหา field หรือค่าทุกตำแหน่ง<input value={query} placeholder="เช่น attack, /skill, Tags" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
    {query && <><p>{matches.length.toLocaleString()} ผลลัพธ์</p><div className="nk-search-matches">{matches.slice((page - 1) * 20, page * 20).map(node => <div key={node.path}><code>{node.path || '/'}</code><ValueText value={node.value} /></div>)}</div><Pager page={page} total={matches.length} size={20} onPage={setPage} /></>}
  </section>;
}
export function RawViewer({ data, selected }: { data: ResourceData; selected?: Json }) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  function download() {
    const url = URL.createObjectURL(new Blob([data.originalBytes], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${data.source.dataset}-${data.source.version ?? 'unknown'}-${data.source.language ?? 'multi'}-${data.source.id ?? data.source.kind}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="nk-raw"><div className="nk-row"><h3>ต้นฉบับจาก Nanoka</h3><div className="nk-actions"><button onClick={async () => { try { await navigator.clipboard.writeText(data.raw); setCopyStatus('คัดลอกแล้ว'); } catch { setCopyStatus('คัดลอกไม่สำเร็จ — ใช้ดาวน์โหลด'); } }}>{copyStatus || 'คัดลอก JSON เต็ม'}</button><button onClick={download}>ดาวน์โหลด JSON เต็ม ↓</button></div></div>
    <p className="nk-muted">{data.source.bytes?.toLocaleString()} bytes · เก็บข้อความต้นฉบับครบ · SHA-256 ตรวจแล้ว{selected !== undefined ? ' · resource นี้มีหลายรายการ' : ''}</p>
    {data.source.jsonShape?.unsafeNumberCount ? <div className="nk-notice">มีตัวเลขเกิน safe integer ใน resource นี้ ค่าตัวเลขใน structured view ไม่ถือว่า exact โปรดดู raw ต้นฉบับ</div> : null}
    {selected !== undefined && <JsonNode value={selected} label="รายการที่เลือก" initialOpen />}
    <FieldSearch value={selected !== undefined ? selected : data.parsed} />
    <button onClick={() => setExpanded(!expanded)}>{expanded ? 'ซ่อนข้อความต้นฉบับ' : 'แสดงข้อความต้นฉบับครบทั้งหมด'}</button>
    {expanded && <pre className="nk-raw-text" tabIndex={0}>{data.raw}</pre>}
    <JsonNode value={data.parsed} label="JSON tree ของ resource ทั้งหมด" />
  </section>;
}
export function OverviewFields({ value }: { value: Json }) {
  const object = asObject(value);
  const keys = ['id', 'name', 'code_name', 'rarity', 'weapon_type', 'element_type', 'special_element_type', 'hit_type', 'camp', 'gender', 'rank', 'class'];
  return <dl className="nk-overview-fields">{keys.filter(key => Object.prototype.hasOwnProperty.call(object, key)).map(key => <div key={key}><dt>{key}</dt><dd>{text(object[key]) || JSON.stringify(object[key])}</dd></div>)}</dl>;
}

/** A reading layer over the original record. The complete structured source stays below it. */
export function ReadableSection({ field, value, items, onMaterial }: { field: string; value: Json; items: Map<string, Entity>; onMaterial: (id: string) => void }) {
  const ui = useUiText();
  const record = asObject(value);
  const choices = field === 'passive' && Object.keys(asObject(record.level)).length ? asObject(record.level) : record;
  const selectable = ['skill', 'skill_list', 'level', 'extra_level', 'level_exp', 'talent', 'talents', 'stars', 'passive'].includes(field) && Object.keys(choices).length > 0;
  const [selected, setSelected] = useState(Object.keys(choices)[0] ?? '');
  const selectedValue = selectable ? choices[selected] : value;
  const descriptions: { path: string; name: string; desc: string }[] = [];
  const visit = (node: Json, path: string) => {
    if (node === null || typeof node !== 'object') return;
    const obj = asObject(node);
    const desc = typeof obj.desc === 'string' ? obj.desc : typeof obj.description === 'string' ? obj.description : '';
    // Calculation directives stay in the complete source tree, not in ordinary reading cards.
    const calculationReference = /^\{(?:Skill|Buff|Property):[^{}]+\}$/.test(desc);
    if (desc && !calculationReference && (typeof obj.name === 'string' || typeof obj.title === 'string')) descriptions.push({ path, name: text(obj.name ?? obj.title), desc });
    for (const [key, child] of Object.entries(node)) visit(child, `${path}/${pointerKey(key)}`);
  };
  if (selectedValue !== undefined) visit(selectedValue, `/${field}${selectable ? `/${field === 'passive' && record.level ? 'level/' : ''}${pointerKey(selected)}` : ''}`);
  const [readingPage, setReadingPage] = useState(1);
  const labels: Record<string, string> = { hp_max: 'HP', attack: 'ATK', defence: 'DEF', crit: 'CRIT Rate', crit_damage: 'CRIT DMG', break_stun: 'Impact', element_mystery: 'Anomaly Proficiency', element_abnormal_power: 'Anomaly Mastery', pen_delta: 'PEN', pen_rate: 'PEN Ratio', sp_recover: 'Energy Regen' };
  return <section className="nk-readable"><h3>{ui(sectionLabel(field))}</h3>
    {typeof value === 'string' && <p className="nk-reading-text">{value === '' ? <i>ต้นทางส่งข้อความว่าง</i> : <GameText value={value} />}</p>}
    {field === 'stats' && <><p className="nk-muted">ค่าตามต้นทาง · รักษาหน่วยและ scale เดิม โดยยังไม่คำนวณแปลงค่า</p><dl className="nk-stat-grid">{Object.entries(record).filter(([, v]) => v === null || typeof v !== 'object').map(([key, v]) => <div key={key}><dt>{labels[key] ?? key}<small>{key}</small></dt><dd><ValueText value={v} /></dd></div>)}</dl></>}
    {selectable && <label className="nk-level-select">เลือกส่วน / ระดับจากต้นทาง ({Object.keys(choices).length})<select value={selected} onChange={e => { setSelected(e.target.value); setReadingPage(1); }}>{Object.keys(choices).map(key => <option value={key} key={key}>{key}{text(asObject(choices[key]).name) ? ` · ${text(asObject(choices[key]).name)}` : ''}</option>)}</select></label>}
    {descriptions.length > 0 && <div className="nk-reading-cards">{descriptions.slice((readingPage - 1) * 12, readingPage * 12).map(d => <article key={d.path}><h4>{plainText(d.name)}</h4><p><GameText value={d.desc} /></p></article>)}{descriptions.length > 12 && <Pager page={readingPage} total={descriptions.length} size={12} onPage={setReadingPage} />}</div>}
    {selectable && selectedValue !== undefined && <JsonNode key={selected} value={selectedValue} path={`/${field}${field === 'passive' && record.level ? '/level' : ''}/${pointerKey(selected)}`} label={`รายละเอียด · ${selected}`} initialOpen items={items} onMaterial={onMaterial} />}
    {typeof value === 'string' ? <details className="nk-json-node"><summary>{field} · ดู field ต้นทาง</summary><div className="nk-node-content"><JsonNode value={value} path={`/${pointerKey(field)}`} label={field} /></div></details> : <JsonNode value={value} path={`/${pointerKey(field)}`} label={`${field} · ข้อมูลต้นทางทุกส่วน`} initialOpen={!selectable && field !== 'stats'} items={items} onMaterial={onMaterial} />}
  </section>;
}
