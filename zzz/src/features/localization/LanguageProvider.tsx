import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select } from '@mui/material';
import { LanguageContext, useLanguage } from './context';
import { LANGUAGE_STORAGE_KEY, storedLocale } from './model';
import type { SiteLocale } from './model';
import './style.css';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, changeLocale] = useState<SiteLocale>(() => { try { return storedLocale(window.localStorage); } catch { return 'th-TH'; } });
  const [revision, setRevision] = useState(0);
  const value = useMemo(() => ({ locale, revision, setLocale(next: SiteLocale) {
    changeLocale(next); setRevision(value => value + 1);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* The in-memory setting still works when storage is blocked. */ }
  } }), [locale, revision]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) { changeLocale(storedLocale(event.storageArea)); setRevision(value => value + 1); } };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, []);
  return <LanguageContext.Provider value={value}>{children}<SiteSettings /></LanguageContext.Provider>;
}
function SiteSettings() {
  const { locale, setLocale } = useLanguage(); const [open, setOpen] = useState(false); const thai = locale === 'th-TH';
  return <><button className="zzz-settings-button" aria-label={thai ? 'ตั้งค่าเว็บไซต์' : 'Website settings'} onClick={() => setOpen(true)}>⚙ {thai ? 'ตั้งค่า' : 'Settings'}</button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { background: '#141414', color: '#f5f5f5', border: '1px solid #3b3b3b' } }}>
      <DialogTitle>{thai ? 'ตั้งค่าเว็บไซต์' : 'Website settings'}</DialogTitle><DialogContent><label htmlFor="zzz-site-language">{thai ? 'ภาษา' : 'Language'}</label>
        <Select id="zzz-site-language" inputProps={{ 'aria-label': thai ? 'ภาษาเว็บไซต์' : 'Website language' }} value={locale} onChange={event => setLocale(event.target.value as SiteLocale)} fullWidth sx={{ mt: 1, color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: '#777' }, '.MuiSvgIcon-root': { color: '#fff' } }}>
          <MenuItem value="th-TH">ไทย</MenuItem><MenuItem value="en-US">English</MenuItem>
        </Select><p className="zzz-language-help">{thai ? 'ข้อมูลเกมใช้คำแปลจาก ZenlessData เฉพาะส่วนที่ตรวจสอบได้ ส่วนที่ยังไม่มีคำแปลจะแสดงภาษาอังกฤษจาก Nanoka' : 'Verified ZenlessData translations are available in Thai. Unmatched fields use the original Nanoka English text.'}</p>
      </DialogContent><DialogActions><Button onClick={() => setOpen(false)} sx={{ color: '#d6f85b' }}>{thai ? 'เสร็จสิ้น' : 'Done'}</Button></DialogActions>
    </Dialog></>;
}
