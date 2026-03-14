import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';
import ja from '../locales/ja.json';
import de from '../locales/de.json';
import fil from '../locales/fil.json';

export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fil', label: 'Filipino' },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code'];

export const LOCALE_STORAGE_KEY = 'texas-locale';

export function getStoredLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'zh-CN';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.some((l) => l.code === stored)) {
    return stored as LocaleCode;
  }
  // Fallback to browser language
  const lang = navigator.language;
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK') || lang.startsWith('zh-MO')) return 'zh-TW';
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fil') || lang.startsWith('tl')) return 'fil';
  if (lang.startsWith('en')) return 'en';
  return 'zh-CN';
}

export function saveLocale(code: LocaleCode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      ja: { translation: ja },
      de: { translation: de },
      fil: { translation: fil },
    },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
