import { gameTextSegments } from './format';
import { useLanguage } from './context';
export function GameText({ value }: { value: string }) {
  const { locale } = useLanguage();
  if (/^(?:[A-Za-z][A-Za-z0-9]*_){2,}[A-Za-z0-9_]+$/.test(value)) return <span className="nk-muted">{locale === 'th-TH' ? 'ยังไม่มีข้อความจากต้นทาง' : 'Source text unavailable'}</span>;
  return <span className="nk-rich-text">{gameTextSegments(value).map((segment, index) => <span key={index} className={segment.icon ? 'nk-game-icon' : undefined} aria-label={segment.icon ? 'Game input' : undefined} style={{ color: segment.color, fontWeight: segment.bold ? 700 : undefined, fontStyle: segment.italic ? 'italic' : undefined, textDecoration: segment.underline ? 'underline' : undefined, fontSize: segment.size }}>{segment.text}</span>)}</span>;
}
