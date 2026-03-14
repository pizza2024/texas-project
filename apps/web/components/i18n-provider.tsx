'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { getStoredLocale } from '@/lib/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const locale = getStoredLocale();
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale).then(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  // Render with default language before locale is loaded from localStorage
  // to avoid hydration mismatch; text will update once locale resolves
  return <I18nextProvider i18n={i18n}>{ready ? children : children}</I18nextProvider>;
}
