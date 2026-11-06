import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { fr } from "./fr";
import { mg } from "./mg";

export type Locale = "fr" | "mg";
export type TKey = keyof typeof fr;
type Values = Record<string, string | number>;

const STORAGE_KEY = "zay-locale";
const DICTIONARIES: Record<Locale, Record<TKey, string>> = { fr, mg };
const PLACEHOLDER = /\{(\w+)\}/g;

const translate = (locale: Locale, key: TKey, values?: Values) =>
  DICTIONARIES[locale][key].replace(PLACEHOLDER, (_, name: string) =>
    String(values?.[name] ?? "")
  );

interface I18n {
  /** For a code coming from the server, like a reason or an error. */
  has: (key: string) => key is TKey;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TKey, values?: Values) => string;
}

const I18nContext = createContext<I18n | null>(null);

const isKey = (key: string): key is TKey => key in fr;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "fr" || stored === "mg") {
          setLocaleState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      has: isKey,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
