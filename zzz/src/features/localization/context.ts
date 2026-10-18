import { createContext, useContext } from 'react';
import type { SiteLocale } from './model';
export interface LanguageContextValue { locale: SiteLocale; revision: number; setLocale: (locale: SiteLocale) => void }
export const LanguageContext = createContext<LanguageContextValue>({ locale: 'th-TH', revision: 0, setLocale: () => {} });
export const useLanguage = () => useContext(LanguageContext);
