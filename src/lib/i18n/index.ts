import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

// Indonesian is the default language and ships eagerly in the main bundle,
// so the first paint never waits for a network fetch. English locale files
// are loaded lazily, one chunk per locale and namespace.
import idCommon from './locales/id/common.json';
import idCanvas from './locales/id/canvas.json';

export const LANGUAGE_STORAGE_KEY = 'stemmagraph.language';
export const SUPPORTED_LANGUAGES = ['id', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const isAppLanguage = (value: string | null | undefined): value is AppLanguage =>
  value === 'id' || value === 'en';

/**
 * Resolves the initial UI language.
 *
 * Precedence:
 * 1. The language the user picked in this browser (LANGUAGE_STORAGE_KEY) —
 *    an explicit personal choice always wins.
 * 2. VITE_UI_LANG — a deployment-level default language set at build time
 *    (e.g. `VITE_UI_LANG=en` for the Docker build), so a fresh browser
 *    session starts in the operator's preferred language.
 * 3. The built-in default 'id'.
 */
export const resolveInitialLanguage = (
  stored: string | null,
  env: string | undefined,
): AppLanguage => {
  if (isAppLanguage(stored)) return stored;
  if (isAppLanguage(env)) return env;
  return 'id';
};

const readStoredLanguage = (): AppLanguage => {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // localStorage can be blocked (private mode, disabled storage); keep default
  }
  return resolveInitialLanguage(stored, import.meta.env.VITE_UI_LANG);
};

export const i18n = createInstance();

void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) =>
      import(`./locales/${language}/${namespace}.json`)
    )
  )
  .init({
    lng: readStoredLanguage(),
    supportedLngs: ['id', 'en'],
    fallbackLng: 'id',
    fallbackNS: 'common',
    defaultNS: 'common',
    // Every namespace, explicitly. With an empty ns list i18next requests
    // NOTHING from the backend at init or on changeLanguage, so a fresh
    // 'en' session would silently fall back to the bundled Indonesian and
    // the lazy EN chunks would never load. Declaring them means init and
    // language switches fetch the missing language for each namespace.
    // Components still opt in per-namespace via useTranslation('canvas').
    ns: ['common', 'canvas', 'poster'],
    partialBundledLanguages: true,
    returnEmptyString: false,
    resources: {
      id: {
        common: idCommon,
        canvas: idCanvas,
      },
    },
    interpolation: {
      // React already escapes rendered strings
      escapeValue: false,
    },
    react: {
      // ID fallback strings are bundled, so t() always resolves synchronously
      // and the UI swaps in place once a lazy locale chunk arrives.
      useSuspense: false,
    },
  });

// Date rendering in scope components uses the active language, mirroring the
// original 'id-ID' formatting for Indonesian.
export const formatDate = (
  value: string | number | Date,
  language: string
): string =>
  new Intl.DateTimeFormat(
    language === 'en' ? 'en-US' : 'id-ID',
    { day: 'numeric', month: 'short', year: 'numeric' }
  ).format(new Date(value));

export const changeAppLanguage = (language: AppLanguage): Promise<void> =>
  i18n.changeLanguage(language).then(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // persistence is best effort; the switch itself already succeeded
    }
    document.documentElement.lang = language;
  });
