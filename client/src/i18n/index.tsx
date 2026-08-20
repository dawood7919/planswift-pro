import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar, type TranslationKey } from "./ar";
import { en } from "./en";
import type { AppLocale, UnitSystem } from "./format";

type TranslationValues = Record<string, string | number>;
type I18nContextValue = { locale: AppLocale; direction: "rtl" | "ltr"; unitSystem: UnitSystem; setLocale: (locale: AppLocale) => void; setUnitSystem: (system: UnitSystem) => void; t: (key: TranslationKey, values?: TranslationValues) => string };
const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const catalogues = { ar, en } as const;

function interpolate(template: string, values?: TranslationValues) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values?.[key] === undefined ? match : String(values[key]));
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => (localStorage.getItem("takeoff-locale") as AppLocale) || "ar");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => (localStorage.getItem("takeoff-unit-system") as UnitSystem) || "metric");
  const direction = locale === "ar" ? "rtl" : "ltr";
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    localStorage.setItem("takeoff-locale", locale);
  }, [direction, locale]);
  useEffect(() => { localStorage.setItem("takeoff-unit-system", unitSystem); }, [unitSystem]);
  const value = useMemo<I18nContextValue>(() => ({ locale, direction, unitSystem, setLocale, setUnitSystem, t: (key, values) => interpolate(catalogues[locale][key], values) }), [direction, locale, unitSystem]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18N_CONTEXT_REQUIRED");
  return context;
}
