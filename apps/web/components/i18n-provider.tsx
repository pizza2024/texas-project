"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { getStoredLocale } from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const locale = getStoredLocale();
    const init = async () => {
      if (i18n.language !== locale) {
        await i18n.changeLanguage(locale);
      }
      setReady(true);
    };
    void init();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>{ready ? children : children}</I18nextProvider>
  );
}
