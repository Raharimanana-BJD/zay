import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { fr, type LandingCopy } from "./fr";
import { mg } from "./mg";

export type LandingLang = "fr" | "mg";

const STORAGE_KEY = "zay.landing.lang";
const DEFAULT_LANG: LandingLang = "fr";
const COPIES: Record<LandingLang, LandingCopy> = { fr, mg };

export const isLang = (value: unknown): value is LandingLang =>
  value === "fr" || value === "mg";

/** Storage can be missing or throw (private mode, blocked site data). */
function readStoredLang(): LandingLang | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeLang(lang: LandingLang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The choice simply isn't remembered.
  }
}

interface LandingLanguage {
  copy: LandingCopy;
  lang: LandingLang;
  setLang: (lang: LandingLang) => void;
}

const LandingLanguageContext = createContext<LandingLanguage | null>(null);

/**
 * The server always renders French. The stored choice is applied after the
 * first render, so the markup matches during hydration (spec 0007).
 */
export function LandingLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LandingLang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (stored) {
      setLangState(stored);
    }
    // The rest of the web app is French: restore it when leaving the page.
    return () => {
      document.documentElement.lang = DEFAULT_LANG;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: LandingLang) => {
    setLangState(next);
    storeLang(next);
  }, []);

  const value = useMemo(
    () => ({ copy: COPIES[lang], lang, setLang }),
    [lang, setLang]
  );

  return (
    <LandingLanguageContext.Provider value={value}>
      {children}
    </LandingLanguageContext.Provider>
  );
}

export function useLandingLanguage(): LandingLanguage {
  const context = useContext(LandingLanguageContext);
  if (!context) {
    throw new Error(
      "useLandingLanguage must be used inside LandingLanguageProvider"
    );
  }
  return context;
}
