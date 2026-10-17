import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadSnapshot, SnapshotClient } from '../../../../features/nanoka/client';
import { EntityImage, FieldSearch, JsonNode, OverviewFields, Pager, RawViewer, ReadableSection, SourceLink, SourceReference } from '../../../../features/nanoka/components';
import { useResource } from '../../../../features/nanoka/hooks';
import { asObject, assetUrl, availableVersions, CATEGORY_LABELS, CATEGORY_MARKS, entitiesFromIndex, findResource, localizedName, pointerKey, resourceAvailable, sectionLabel, SPECIALIZED_KEYS, text } from '../../../../features/nanoka/model';
import type { Entity, Json, Resource, ResourceData, Snapshot } from '../../../../features/nanoka/types';
import { useLanguage } from '../../../../features/localization/context';
import { useLocalizedResource } from '../../../../features/localization/hooks';
import { LocalizationReference } from '../../../../features/localization/components';
import { useUiText } from '../../../../features/localization/ui';
import { refreshLocalization } from '../../../../features/localization/client';
import './style.css';

const PAGE_SIZE = 24;
const identityKeys = new Set(['id', 'name', 'code_name', 'rarity', 'icon', 'weapon_type', 'element_type', 'special_element_type', 'hit_type', 'camp', 'gender', 'rank', 'class']);

export default function Database() {
  const { locale } = useLanguage(); const thai = locale === 'th-TH';
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null); setError('');
    loadSnapshot(controller.signal).then(data => { if (!controller.signal.aborted) setSnapshot(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [revision]);
  return <div className="nk-page">
    <header className="nk-topbar"><Link to="/" className="nk-brand">SAYARI<span>/ DATABASE</span></Link><nav><Link to="/">{thai ? 'หน้าหลัก' : 'Home'}</Link><Link to="/game/zenless-zone-zero">{thai ? 'เครื่องคำนวณ' : 'Calculator'}</Link><SourceLink url="https://zzz.nanoka.cc/">Nanoka ZZZ</SourceLink></nav></header>
    {!snapshot ? <main className="nk-initial"><div className="nk-eyebrow">ZENLESS ZONE ZERO</div><h1>ฐานข้อมูลเกม</h1>{error ? <><div role="alert" className="nk-notice"><h2>ยังเปิดชุดข้อมูลไม่ได้</h2><p>{error}</p><p>ไม่มีการใช้ข้อมูลจำลองแทนข้อมูลที่โหลดไม่สำเร็จ</p></div><button className="nk-primary" onClick={() => setRevision(r => r + 1)}>ลองโหลด snapshot อีกครั้ง</button></> : <div className="nk-loading" role="status">กำลังตรวจและโหลดชุดข้อมูล…</div>}</main>
      : <DatabaseView key={snapshot.catalog.runId} snapshot={snapshot} onRefresh={() => { refreshLocalization(); setRevision(r => r + 1); }} />}
    <footer className="nk-footer">SAYARI <span>Game Data: <SourceLink url="https://zzz.nanoka.cc/">Nanoka ZZZ</SourceLink> · Localization: <a href="https://git.mero.moe/dimbreath/ZenlessData" target="_blank" rel="noopener noreferrer">ZenlessData · Dimbreath / Mero ↗</a> · {thai ? 'ข้อมูล snapshot · เว็บไซต์อิสระจาก HoYoverse' : 'Snapshot data · Independent of HoYoverse'}</span></footer>
  </div>;
}

function DatabaseView({ snapshot, onRefresh }: { snapshot: Snapshot; onRefresh: () => void }) {
  const ui = useUiText();
  const { locale, revision: languageRevision, setLocale } = useLanguage(); const thai = locale === 'th-TH';
  const { catalog } = snapshot;
  const [params, setParams] = useSearchParams();
  const client = useMemo(() => new SnapshotClient(snapshot.catalogUrl), [snapshot.catalogUrl]);
  const datasetKey = params.get('category') || 'character';
  const definition = catalog.definitions.find(d => d.key === datasetKey);
  const live = catalog.versions.find(v => v.channels.includes('live'))?.version ?? catalog.versions[0]?.version ?? '';
  const version = params.get('version') || live;
  const language = params.get('lang') || (thai ? 'th' : 'en');
  const resourceLanguage = language === 'th' ? 'en' : language;
  const previousLanguageRevision = useRef(languageRevision);
  useEffect(() => {
    if (previousLanguageRevision.current === languageRevision) return;
    previousLanguageRevision.current = languageRevision;
    setParams(previous => { const next = new URLSearchParams(previous); next.set('lang', locale === 'th-TH' ? 'th' : 'en'); next.delete('page'); return next; });
  }, [locale, languageRevision, setParams]);
  const id = params.get('id') || '';
  const query = params.get('q') || '';
  const rank = params.get('rank') || '';
  const group = params.get('group') || '';
  const specialty = params.get('specialty') || '';
  const faction = params.get('faction') || '';
  const explorer = params.get('view') === 'api';
  const [coverageOpen, setCoverageOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!coverageOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () => [...(dialog?.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex="0"]') ?? [])];
    focusables()[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setCoverageOpen(false);
      if (event.key !== 'Tab') return;
      const elements = focusables();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [coverageOpen]);
  function update(values: Record<string, string | null>) {
    setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); } return next; });
  }
  const indexSource = findResource(catalog, datasetKey, version, resourceLanguage, 'index');
  const index = useResource(client, indexSource);
  const indexLocalized = useLocalizedResource(index.data, catalog.runId, language);
  const translatedNameIds = useMemo(() => new Set(Object.keys(indexLocalized.overlay?.translations ?? {}).filter(path => /\/(?:name|en)$|\/en\/name$/.test(path)).map(path => path.slice((definition?.recordsPointer.length ?? 0) + 1).split('/')[0])), [indexLocalized.overlay, definition]);
  const mapped = useMemo(() => {
    if (!index.data || indexLocalized.value === undefined || !definition) return { entities: [] as Entity[], error: '' };
    try { return { entities: entitiesFromIndex(indexLocalized.value, definition, resourceLanguage, index.data.source.language).map(entity => {
      const translatedName = translatedNameIds.has(pointerKey(entity.id));
      return { ...entity, resolvedLanguage: translatedName ? 'th' : entity.resolvedLanguage };
    }), error: '' }; }
    catch (reason) { return { entities: [] as Entity[], error: (reason as Error).message }; }
  }, [index.data, indexLocalized.value, translatedNameIds, definition, resourceLanguage]);
  const entities = mapped.entities;
  const facets = useMemo(() => new Map(entities.map(entity => {
    const raw = asObject(entity.raw);
    return [entity.id, { specialty: text(raw.weapon_type ?? raw.type), faction: text(raw.camp) }];
  })), [entities]);
  const selected = entities.find(e => e.id === id);
  const detailSource = id && definition?.detailPath ? findResource(catalog, datasetKey, version, resourceLanguage, 'detail', id) : undefined;
  const detail = useResource(client, detailSource);
  const detailLocalized = useLocalizedResource(detail.data, catalog.runId, language);
  const itemSource = id && datasetKey !== 'item' ? findResource(catalog, 'item', version, resourceLanguage, 'index') : undefined;
  const itemData = useResource(client, itemSource);
  const itemLocalized = useLocalizedResource(itemData.data, catalog.runId, language);
  const items = useMemo(() => {
    const def = catalog.definitions.find(d => d.key === 'item');
    if (!itemData.data || itemLocalized.value === undefined || !def) return new Map<string, Entity>();
    try { return new Map(entitiesFromIndex(itemLocalized.value, def, resourceLanguage, itemData.data.source.language).map(e => [e.id, e])); } catch { return new Map<string, Entity>(); }
  }, [catalog, itemData.data, itemLocalized.value, resourceLanguage]);
  const filtered = entities.filter(e => `${e.id} ${e.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!rank || e.rank === rank) && (!group || e.group === group) && (!specialty || facets.get(e.id)?.specialty === specialty) && (!faction || facets.get(e.id)?.faction === faction));
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const channels = catalog.versions.find(v => v.version === version)?.channels ?? [];
  const downloaded = catalog.versions.some(v => v.version === version);
  const versions = [...new Set([...availableVersions(catalog.manifest), ...catalog.versions.map(v => v.version)])];
  const datasetResources = catalog.resources.filter(r => r.dataset === datasetKey && r.version === version && (r.language === null || r.language === resourceLanguage));
  const failures = datasetResources.filter(r => !resourceAvailable(r)).length;
  const selectedInventory = catalog.inventory.find(i => i.dataset === datasetKey && i.version === version && (i.language === null || i.language === resourceLanguage));
  const usableDetails = datasetResources.filter(r => r.kind === 'detail' && resourceAvailable(r)).length;
  const dataReady = catalog.coverage.registeredScopeComplete && snapshot.discovery?.status === 'VERIFIED_PUBLIC_SCOPE';
  const detailValue = definition?.detailPath ? detailLocalized.value : selected?.raw;
  const rawData = definition?.detailPath ? detail.data : index.data;
  const originalSelected = useMemo(() => id && index.data && definition ? entitiesFromIndex(index.data.parsed, definition, resourceLanguage, index.data.source.language).find(entity => entity.id === id)?.raw : undefined, [id, index.data, definition, resourceLanguage]);
  const selectedName = detailValue ? localizedName(detailValue, resourceLanguage, id).name : selected?.name ?? `ID ${id}`;
  const selectedImage = detailValue ? assetUrl(asObject(detailValue).icon ?? asObject(detailValue).image_path ?? asObject(detailValue).icon_path) : null;
  return <>
    <section className="nk-hero"><div><div className="nk-eyebrow"><span className="nk-live-dot" /> GAME INTELLIGENCE / 01</div><h1>ZENLESS<br /><span>ZONE ZERO</span><b>{thai ? 'ฐานข้อมูลเกม' : 'Game Database'}</b></h1><p>สำรวจเอเจนต์ อุปกรณ์ และทุกข้อมูลที่ตรวจพบ<br />เลือกอ่านรายละเอียด พร้อมที่มาในทุก resource</p></div>
      <div className="nk-hero-stats"><div><strong>{catalog.definitions.length.toLocaleString()}</strong><span>หมวดข้อมูล</span></div><div><strong>{catalog.coverage.successfulResources.toLocaleString()}</strong><span>resources พร้อมใช้</span></div><div><strong>{catalog.languages.length}</strong><span>{thai ? 'ภาษาข้อมูลต้นฉบับ' : 'Source languages'}</span></div><button onClick={() => setCoverageOpen(true)}>ดูความครอบคลุมของข้อมูล ↗</button></div>
    </section>
    <div className="nk-snapshot-bar"><div><span className={`nk-badge ${channels.includes('live') ? 'nk-badge-live' : ''}`}>{channels.join(' / ').toUpperCase() || 'HISTORICAL'}</span><span>v{version}</span><span>{language.toUpperCase()}</span><span className="nk-muted">SNAPSHOT</span></div><button onClick={onRefresh}>↻ โหลด snapshot ที่เผยแพร่ล่าสุด</button></div>
    {!dataReady && <div className="nk-notice nk-coverage-warning" role="status"><b>ข้อมูลยังมีขอบเขตที่ต้องตรวจเพิ่มเติม</b><span>{catalog.coverage.registeredScopeComplete ? 'ดึงครบเฉพาะ registry ที่ระบุแล้ว' : 'มีข้อมูลบางส่วนไม่ครบ'} · {snapshot.discovery?.notes[0] ?? 'ยังไม่มี discovery sign-off ครบทุกหมวด'}</span><button onClick={() => setCoverageOpen(true)}>ดูรายละเอียด</button></div>}
    <div className="nk-layout"><aside className="nk-sidebar"><div className="nk-section-kicker">EXPLORE DATABASE</div><nav aria-label="หมวดข้อมูล">{catalog.definitions.map(d => {
      const inv = catalog.inventory.find(i => i.dataset === d.key && i.version === version && (i.language === null || i.language === resourceLanguage));
      return <button key={d.key} className={datasetKey === d.key && !explorer ? 'is-active' : ''} onClick={() => update({ category: d.key, id: null, view: null, page: null, q: null, rank: null, group: null, specialty: null, faction: null })}><span className="nk-category-mark">{CATEGORY_MARKS[d.key] ?? 'DB'}</span><span>{thai ? CATEGORY_LABELS[d.key] ?? d.label : d.label}</span><small>{inv?.count.toLocaleString() ?? '—'}</small></button>;
    })}<button className={explorer ? 'is-active' : ''} onClick={() => update({ view: 'api', id: null, page: null })}><span className="nk-category-mark">{'{ }'}</span><span>API Explorer</span></button></nav><div className="nk-sidebar-note">แหล่งข้อมูล<br /><SourceLink url="https://zzz.nanoka.cc/">Nanoka ZZZ</SourceLink><p>{thai ? 'ภาษาไทยจาก ZenlessData' : 'Game text in selected language'}<br />English fallback</p></div></aside>
      <main className="nk-main"><div className="nk-main-heading"><div><div className="nk-section-kicker">{explorer ? 'RESOURCE EXPLORER' : datasetKey.toUpperCase()}</div><h2>{explorer ? 'API Explorer' : thai ? CATEGORY_LABELS[datasetKey] ?? definition?.label ?? 'ไม่พบหมวดนี้' : definition?.label ?? 'Unknown category'}</h2></div><span className="nk-muted">{explorer ? 'ตรวจต้นฉบับและที่มา' : `${entities.length.toLocaleString()} รายการ`}</span></div>
        <div className="nk-controls"><label>{ui('เวอร์ชันข้อมูล')}<select aria-label="เวอร์ชันข้อมูล" value={version} onChange={e => update({ version: e.target.value, id: null, page: null })}>{versions.map(v => <option key={v} value={v}>{v}{catalog.versions.find(x => x.version === v)?.channels.length ? ` · ${catalog.versions.find(x => x.version === v)!.channels.join('/')}` : ' · ยังไม่ได้ดาวน์โหลด'}</option>)}</select></label><label>{thai ? 'ภาษาข้อมูล' : 'Data language'}<select aria-label="ภาษาข้อมูล" value={language} onChange={e => { update({ lang: e.target.value, page: null }); if (e.target.value === 'th' || e.target.value === 'en') setLocale(e.target.value === 'th' ? 'th-TH' : 'en-US'); }}><option value="th">ไทย · ZenlessData</option>{catalog.languages.map(l => <option key={l} value={l}>{({ en: 'English', ja: '日本語', ko: '한국어', zh: '中文' } as Record<string, string>)[l] ?? l.toUpperCase()}</option>)}</select></label>
          {!explorer && <label className="nk-search-label">ค้นหาชื่อหรือ ID<input aria-label="ค้นหาชื่อหรือ ID" value={query} placeholder={ui('ค้นหาฐานข้อมูล…')} onChange={e => update({ q: e.target.value, page: null })} /></label>}
        </div>
        {!explorer && definition && downloaded && <div className="nk-dataset-status"><span>IDs ใน index: <b>{selectedInventory?.count.toLocaleString() ?? 'ไม่ทราบ'}</b></span><span>{definition.detailPath ? `รายละเอียดพร้อมใช้: ${usableDetails.toLocaleString()} / ${selectedInventory?.count.toLocaleString() ?? 'ไม่ทราบ'}` : 'รายละเอียดใช้ข้อมูลจาก resource รายการ'}</span><span>ไม่สำเร็จ: {failures}</span><span>snapshot เผยแพร่ {new Date(snapshot.publishedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</span></div>}
        {!downloaded ? <div className="nk-empty"><b>เวอร์ชันนี้ยังไม่ได้ดาวน์โหลด</b><p>พบเวอร์ชันใน manifest แต่ยังไม่มีใน snapshot ที่เผยแพร่ เลือก Live หรือ Latest เพื่ออ่านข้อมูลที่พร้อมใช้</p><button onClick={() => update({ version: live })}>กลับไป Live</button></div>
          : explorer ? <Explorer key={`${version}:${language}`} snapshot={snapshot} client={client} version={version} language={resourceLanguage} />
          : !definition ? <div className="nk-empty" role="alert">ไม่พบหมวดข้อมูลที่เลือก</div>
          : index.error || mapped.error ? <div className="nk-empty" role="alert"><b>โหลดรายการไม่สำเร็จ</b><p>{index.error || mapped.error}</p></div>
          : !indexSource ? <div className="nk-empty"><b>ยังไม่มีรายการของหมวดนี้</b><p>ไม่พบ resource สำหรับเวอร์ชันและภาษาที่เลือก</p></div>
          : !index.data ? <div className="nk-loading" role="status">กำลังโหลดรายการ…</div>
          : id ? <section className="nk-detail"><button className="nk-back" onClick={() => update({ id: null })}>{ui('← กลับไปรายการ')}</button><div className="nk-detail-hero"><EntityImage src={selectedImage || selected?.icon || null} name={selectedName} large /><div><div className="nk-eyebrow">{definition.label} / #{id}</div><h2>{selectedName}</h2><span className="nk-badge">{language === 'th' ? 'TH · EN fallback' : rawData?.source.language?.toUpperCase() ?? language.toUpperCase()}</span>{rawData?.source.language && rawData.source.language !== resourceLanguage && <p className="nk-notice">ไม่มีข้อมูลภาษาที่เลือก — กำลังแสดง {rawData.source.language.toUpperCase()}</p>}</div></div>
            <LocalizationReference state={definition.detailPath ? detailLocalized : indexLocalized} data={rawData} recordId={id} />
            {!selected ? <div className="nk-notice" role="alert">ID นี้ไม่อยู่ในรายการที่ตรวจยืนยันสำหรับเวอร์ชัน/ภาษานี้</div>
              : definition.detailPath && !detailSource ? <div className="nk-notice">พบรายการใน index แต่ไม่มี detail ใน snapshot</div>
              : detail.error ? <div className="nk-notice" role="alert">{detail.error} · รายการจาก index ยังคงแสดงอยู่</div>
              : detailValue === undefined || !rawData ? <div className="nk-loading" role="status">กำลังโหลดรายละเอียด…</div>
              : <DetailContent originalValue={definition.detailPath ? detail.data?.parsed : originalSelected} key={`${version}:${datasetKey}:${language}:${id}:${rawData.source.url}`} value={detailValue} data={rawData} recordId={id} channels={channels} indexOnly={!definition.detailPath} items={items} requestedLanguage={language} onMaterial={materialId => update({ category: catalog.definitions.some(d => d.key === 'item_all') ? 'item_all' : 'item', id: materialId, q: null, rank: null, group: null, specialty: null, faction: null, page: null })} />}
          </section>
          : <>
            {index.data.source.language && index.data.source.language !== resourceLanguage && <div className="nk-notice">ไม่มีข้อมูลภาษาที่เลือก — กำลังแสดง {index.data.source.language.toUpperCase()}</div>}
            {failures > 0 && <div className="nk-notice">มี {failures} resources ที่ยังไม่พร้อมใช้ในหมวดนี้ รายการที่ขาดยังแสดงสถานะใน API Explorer</div>}
            <div className="nk-filter-row"><label>{ui('ระดับ')}<select aria-label="กรองระดับ" value={rank} onChange={e => update({ rank: e.target.value, page: null })}><option value="">{ui('ทั้งหมด')}</option>{[...new Set(entities.map(e => e.rank).filter(Boolean))].sort().map(r => <option value={r} key={r}>{r}</option>)}</select></label><label>{ui('กลุ่ม / ธาตุ')}<select aria-label="กรองกลุ่ม" value={group} onChange={e => update({ group: e.target.value, page: null })}><option value="">{ui('ทั้งหมด')}</option>{[...new Set(entities.map(e => e.group).filter(Boolean))].sort().map(g => <option key={g} value={g}>{g}</option>)}</select></label>{['character', 'weapon'].includes(datasetKey) && <label>{ui('ประเภท / Specialty')}<select aria-label="กรอง Specialty" value={specialty} onChange={e => update({ specialty: e.target.value, page: null })}><option value="">{ui('ทั้งหมด')}</option>{[...new Set([...facets.values()].map(f => f.specialty).filter(Boolean))].sort().map(v => <option key={v} value={v}>{v}</option>)}</select></label>}{datasetKey === 'character' && <label>{ui('ฝ่าย / Faction')}<select aria-label="กรอง Faction" value={faction} onChange={e => update({ faction: e.target.value, page: null })}><option value="">{ui('ทั้งหมด')}</option>{[...new Set([...facets.values()].map(f => f.faction).filter(Boolean))].sort().map(v => <option key={v} value={v}>{v}</option>)}</select></label>}<span>{filtered.length.toLocaleString()} ผลลัพธ์</span></div>
            <LocalizationReference state={indexLocalized} data={index.data} />
            {!filtered.length ? <div className="nk-empty">{entities.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ต้นทางส่งรายการว่างที่อ่านได้สำเร็จ'}</div> : <div className="nk-entity-grid">{filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(entity => <button key={entity.id} className="nk-entity-card" onClick={() => update({ id: entity.id })}><div className="nk-card-top"><small>#{entity.id}</small>{entity.rank && <span className={`nk-rank nk-rank-${entity.rank}`}>{entity.rank === '4' ? 'S' : entity.rank === '3' ? 'A' : entity.rank}</span>}</div><EntityImage src={entity.icon} name={entity.name} /><div className="nk-card-name"><strong>{entity.name}</strong><small>{entity.resolvedLanguage?.toUpperCase() ?? '—'} · {entity.group || definition.label}{facets.get(entity.id)?.specialty ? ` · type ${facets.get(entity.id)!.specialty}` : ''}{facets.get(entity.id)?.faction ? ` · faction ${facets.get(entity.id)!.faction}` : ''}</small>{entity.resolvedLanguage && entity.resolvedLanguage !== language && <em className="nk-card-fallback">ไม่มีภาษา {language.toUpperCase()} · แสดง {entity.resolvedLanguage.toUpperCase()}</em>}</div><span className="nk-card-arrow">↗</span></button>)}</div>}
            <Pager page={page} total={filtered.length} size={PAGE_SIZE} onPage={next => update({ page: String(next) })} />
            <SourceReference source={index.data.source} requestedLanguage={language} channels={channels} />
          </>}
      </main>
    </div>
    {coverageOpen && <div className="nk-dialog-backdrop" onClick={() => setCoverageOpen(false)}><section ref={dialogRef} className="nk-dialog" role="dialog" aria-modal="true" aria-label="ความครอบคลุมของข้อมูล" onClick={e => e.stopPropagation()}><div className="nk-row"><h2>ความครอบคลุมของข้อมูล</h2><button onClick={() => setCoverageOpen(false)} aria-label="ปิดรายละเอียดความครอบคลุม">ปิด ×</button></div><p>Registry: {catalog.coverage.status}</p><p>Discovery: {snapshot.discovery?.status ?? 'ยังไม่ตรวจครบ'}</p><p>สำเร็จ {catalog.coverage.successfulResources.toLocaleString()} · ไม่สำเร็จ {catalog.coverage.failedResources.toLocaleString()}</p>{snapshot.discovery?.notes.map(note => <p key={note}>{note}</p>)}<div className="nk-table-scroll"><table><thead><tr><th>Dataset</th><th>Version</th><th>Locale</th><th>IDs จาก index</th></tr></thead><tbody>{catalog.inventory.map(i => <tr key={`${i.dataset}:${i.version}:${i.language}`}><td>{i.dataset}</td><td>{i.version}</td><td>{i.language ?? 'multi'}</td><td>{i.count.toLocaleString()}</td></tr>)}</tbody></table></div>{snapshot.discovery?.categories.map(c => <p key={c.key}><b>{c.key}</b> · {c.status} · {c.note}</p>)}<p className="nk-muted">เผยแพร่ snapshot {new Date(snapshot.publishedAt).toLocaleString('th-TH')} · ไม่มีการอ้างว่าครอบคลุม private/hidden endpoints</p></section></div>}
  </>;
}

function DetailContent({ value, originalValue, data, recordId, channels, indexOnly, items, requestedLanguage, onMaterial }: { value: Json; originalValue?: Json; data: ResourceData; recordId: string; channels: string[]; indexOnly: boolean; items: Map<string, Entity>; requestedLanguage: string; onMaterial: (id: string) => void }) {
  const ui = useUiText();
  const [tab, setTab] = useState('overview');
  const record = asObject(value);
  const known = Object.keys(record).filter(k => !identityKeys.has(k) && SPECIALIZED_KEYS.has(k));
  const extra = Object.fromEntries(Object.entries(record).filter(([k]) => !identityKeys.has(k) && !SPECIALIZED_KEYS.has(k)));
  const identity = Object.fromEntries(Object.entries(record).filter(([k]) => identityKeys.has(k)));
  return <>{data.source.jsonShape?.unsafeNumberCount ? <div className="nk-notice">resource นี้มีตัวเลขเกิน safe integer · ใช้ Raw / Explorer เพื่ออ่านค่าต้นฉบับที่ exact</div> : null}<div className="nk-detail-tabs" role="tablist" aria-label="ส่วนของรายละเอียด" onKeyDown={event => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowRight' ? (current + 1) % buttons.length : event.key === 'ArrowLeft' ? (current - 1 + buttons.length) % buttons.length : -1;
    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click(); }
  }}><button role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>{ui('ภาพรวม')}</button>{known.map(key => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{ui(sectionLabel(key))}</button>)}{Object.keys(extra).length > 0 && <button role="tab" aria-selected={tab === 'extra'} onClick={() => setTab('extra')}>ข้อมูลเพิ่มเติมจาก API ({Object.keys(extra).length})</button>}<button role="tab" aria-selected={tab === 'raw'} onClick={() => setTab('raw')}>Raw / Explorer</button></div>
    <div className="nk-detail-content" role="tabpanel">{tab === 'overview' ? <><OverviewFields value={value} /><p className="nk-muted">เลือกส่วนด้านบนเพื่ออ่านสกิล ค่าสถานะ การเติบโต และข้อมูลทุกระดับที่ต้นทางส่งมา</p><JsonNode value={value === null || typeof value !== 'object' || Array.isArray(value) ? value : identity} label="ข้อมูลพื้นฐานทั้งหมด" initialOpen /><FieldSearch value={value} /></>
      : tab === 'raw' ? <RawViewer data={data} selected={indexOnly ? originalValue : undefined} />
      : tab === 'extra' ? <><h3>ข้อมูลเพิ่มเติมจาก API</h3><p className="nk-muted">รักษา field ที่ไม่อยู่ใน layout เฉพาะไว้ครบ</p>{Object.entries(extra).map(([key, v]) => <JsonNode key={key} value={v} path={`/${pointerKey(key)}`} label={key} items={items} onMaterial={onMaterial} />)}</>
      : <ReadableSection key={tab} field={tab} value={record[tab] ?? null} items={items} onMaterial={onMaterial} />}
    </div><SourceReference source={data.source} requestedLanguage={requestedLanguage} channels={channels} recordId={recordId} /></>;
}

function Explorer({ snapshot, client, version, language }: { snapshot: Snapshot; client: SnapshotClient; version: string; language: string }) {
  const ui = useUiText();
  const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1); const [selected, setSelected] = useState<Resource>();
  const data = useResource(client, selected);
  const rows = snapshot.catalog.resources.filter(r => (r.version === version || r.version === null) && (r.language === language || r.language === null) && (!status || (status === 'available' ? resourceAvailable(r) : !resourceAvailable(r))) && `${r.dataset} ${r.id ?? ''} ${r.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 25)));
  return <section><div className="nk-controls"><label className="nk-search-label">ค้นหา resource<input aria-label="ค้นหา resource" value={query} placeholder="Dataset, ID หรือ URL" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label><label>สถานะ<select aria-label="กรองสถานะ resource" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{ui('ทั้งหมด')}</option><option value="available">พร้อมใช้</option><option value="failed">ไม่สำเร็จ / ยังไม่พร้อม</option></select></label></div>
    <div className="nk-table-scroll"><table><thead><tr><th>Dataset / ID</th><th>สถานะ / HTTP</th><th>Source URL</th><th>Fetched / Cache read</th><th>Bytes / SHA-256</th><th>เปิด</th></tr></thead><tbody>{rows.slice((currentPage - 1) * 25, currentPage * 25).map(r => <tr key={r.url}><td><b>{r.dataset}</b><small>{r.kind} · {r.id ?? 'index'} · {r.language ?? 'multi'}<br />{r.version ?? 'unversioned'}</small></td><td><span className={`nk-badge ${resourceAvailable(r) ? 'nk-badge-live' : ''}`}>{r.status}</span><small>HTTP {r.httpStatus ?? '—'}<br />{r.error}</small></td><td className="nk-url"><SourceLink url={r.url}>{r.url}</SourceLink></td><td className="nk-table-date">{r.fetchedAt ? new Date(r.fetchedAt).toLocaleString('th-TH') : 'ไม่ทราบ'}<small>{r.cacheReadAt ? new Date(r.cacheReadAt).toLocaleString('th-TH') : 'ไม่ได้อ่าน cache'}</small></td><td>{r.bytes?.toLocaleString() ?? '—'}<code className="nk-table-hash">{r.sha256 ?? 'ไม่มี hash'}</code></td><td><button onClick={() => setSelected(r)}>ตรวจข้อมูล</button></td></tr>)}</tbody></table></div><Pager page={currentPage} total={rows.length} size={25} onPage={setPage} />
    {selected && <div className="nk-explorer-selected"><div className="nk-row"><h3>{selected.dataset} / {selected.id ?? selected.kind}</h3><button onClick={() => setSelected(undefined)}>ปิด</button></div>{data.error ? <div role="alert" className="nk-notice">{data.error}</div> : data.data ? <RawViewer data={data.data} /> : <div role="status">กำลังโหลด resource…</div>}<SourceReference source={selected} requestedLanguage={language} channels={snapshot.catalog.versions.find(v => v.version === selected.version)?.channels} /></div>}
  </section>;
}
