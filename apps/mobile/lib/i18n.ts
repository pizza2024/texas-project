import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

const STORAGE_KEY = 'app_language';

export type LocaleCode = 'zh-CN' | 'en-US';

export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English (US)' },
] as const;

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
};

// 获取保存的语言
export async function getStoredLocale(): Promise<LocaleCode> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
      return stored as LocaleCode;
    }
  } catch {
    // ignore
  }
  return 'zh-CN'; // default
}

// 保存语言选择
export async function saveLocale(code: LocaleCode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

// 初始化 i18n
export async function initI18n(): Promise<void> {
  const lng = await getStoredLocale();

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng,
      fallbackLng: 'zh-CN',
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v3',
    });
}

export default i18n;
