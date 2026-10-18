import type { ResourceData } from '../nanoka/types';
import type { LocalizedResourceState } from './hooks';
import { safeLocalizationUrl } from './model';
import { useLanguage } from './context';

export function LocalizationReference({ state, data, recordId }: { state: LocalizedResourceState; data: ResourceData | null; recordId?: string }) {
  const { locale } = useLanguage(); const thai = locale === 'th-TH';
  if (!data) return null;
  const counts = recordId ? state.overlay?.entities[recordId] : state.overlay ? Object.values(state.overlay.entities).reduce((total, next) => ({ mapped: total.mapped + next.mapped, fallback: total.fallback + next.fallback, missing: total.missing + next.missing }), { mapped: 0, fallback: 0, missing: 0 }) : undefined;
  const source = state.manifest?.source;
  const compatible = data.source.version && state.manifest?.versions[data.source.version]?.compatible;
  const repository = safeLocalizationUrl(source?.repository);
  return <aside className="nk-localization-status" aria-label={thai ? 'สถานะภาษาและที่มา' : 'Language and sources'} data-localization-status={state.loading ? 'loading' : state.error ? 'error' : state.language !== 'th' ? 'original' : counts?.mapped ? 'localized' : 'fallback'}>
    <b>{state.language === 'th' ? 'ไทย · Thai' : state.language.toUpperCase()}</b>
    <span>{state.loading ? (thai ? 'กำลังโหลดคำแปลที่ตรวจสอบแล้ว…' : 'Loading verified translations…') : state.language !== 'th' ? (thai ? 'ข้อความต้นฉบับจาก Nanoka' : 'Original Nanoka text') : counts ? (thai ? `ข้อความไทย ${counts.mapped.toLocaleString()} · English fallback ${counts.fallback.toLocaleString()} · ไม่มีข้อความ ${counts.missing.toLocaleString()}` : `Thai source ${counts.mapped.toLocaleString()} · English fallback ${counts.fallback.toLocaleString()} · Missing ${counts.missing.toLocaleString()}`) : (thai ? 'English fallback · ยังไม่มีคำแปลที่ยืนยันสำหรับข้อมูลนี้' : 'English fallback · no verified translation for this data')}</span>
    {state.error && <span role="status">{thai ? 'คำแปลยังไม่พร้อม ใช้ภาษาอังกฤษจาก Nanoka' : 'Translations unavailable; using Nanoka English'} · {state.error}</span>}
    {state.language === 'th' && source && !compatible && <span>{thai ? `ชุดคำแปล ${source.gameVersion} ยังไม่รองรับข้อมูล ${data.source.version}` : `Translation source ${source.gameVersion} does not cover game data ${data.source.version}`}</span>}
    <details><summary>{thai ? 'แหล่งข้อมูลและสถานะคำแปล' : 'Data sources and translation status'}</summary><dl>
      <dt>Game Data</dt><dd>Nanoka ZZZ</dd><dt>Localization</dt><dd>{repository ? <a href={repository} target="_blank" rel="noopener noreferrer">ZenlessData · Dimbreath / Mero ↗</a> : state.language === 'th' ? (thai ? 'ยังโหลด metadata ไม่สำเร็จ' : 'Metadata unavailable') : 'ZenlessData (Thai only)'}</dd>
      <dt>Language</dt><dd>{state.language === 'th' ? 'Thai + English fallback' : state.language.toUpperCase()}</dd><dt>Game Version</dt><dd>{data.source.version ?? '—'}</dd>
      {source && <><dt>Localization Version</dt><dd>{source.gameVersion} · {source.region}</dd><dt>Source Revision</dt><dd>{state.manifest!.sourceRevision}</dd><dt>Data Updated</dt><dd>{source.committedAt ? new Date(source.committedAt).toLocaleString(locale) : (thai ? 'ต้นทางไม่ระบุ' : 'Not provided')}</dd>
        <dt>{thai ? 'ไฟล์ข้อความที่อ้างอิง' : 'Referenced text files'}</dt><dd>{source.files.filter(file => file.path.startsWith('TextMap/TextMap_TH')).map(file => { const safe = safeLocalizationUrl(file.url); return safe ? <div key={file.path}><a href={safe} target="_blank" rel="noopener noreferrer">{file.path} ↗</a><small> · {file.fetchedAt ? new Date(file.fetchedAt).toLocaleString(locale) : '—'}</small></div> : null; })}</dd></>}
      <dt>Fallback</dt><dd>{thai ? 'ใช้เฉพาะคีย์ที่ตรวจ ID และข้อความอังกฤษแล้ว ส่วนที่จับคู่ไม่ได้ใช้ Nanoka English ค่าตัวเลขและ Raw ใช้ต้นฉบับเสมอ' : 'Only verified ID joins and matching English fields are translated. Other fields use Nanoka English. Numeric values and raw downloads always retain the source.'}</dd>
    </dl></details>
  </aside>;
}
