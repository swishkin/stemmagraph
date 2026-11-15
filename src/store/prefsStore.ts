import { create } from 'zustand';
import { getUserProfileApi } from '@/lib/adapters';
import type { AuthUser } from '@/lib/adapters';
import {
  changeAppLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from '@/lib/i18n';
import { setTheme, type AppTheme } from '@/lib/theme';

// Per-user UI preferences (language + theme), persisted on the account
// so a choice follows the user across browsers and devices.
//
// localStorage stays in the loop as a *cache* only: it makes the first
// paint instant (theme applied before render, language resolved
// synchronously). The database is the source of truth — whenever a
// session loads (restore, login, or a different account logging in on
// the same browser), applyFromUser reconciles the browser with the
// stored account values.

export const isValidLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

export const isValidTheme = (value: unknown): value is AppTheme =>
  value === 'light' || value === 'dark';

/**
 * Reconciles the browser with a user's stored preferences. Values are
 * applied only when present: a null/absent preference means the user
 * never picked one, in which case the browser keeps whatever it has
 * (its built-in default or a previous guest choice).
 */
export const applyUserPrefs = (user: Pick<AuthUser, 'language' | 'theme'>): void => {
  if (isValidTheme(user.theme)) setTheme(user.theme);
  if (isValidLanguage(user.language)) void changeAppLanguage(user.language);
};

interface PrefsState {
  /** Apply a (re)loaded account's stored preferences to this browser. */
  applyFromUser: (user: Pick<AuthUser, 'language' | 'theme'>) => void;
  /** Switch language: applies locally and persists to the account. */
  setLanguage: (language: AppLanguage) => void;
  /** Switch theme: applies locally and persists to the account. */
  setTheme: (theme: AppTheme) => void;
}

export const usePrefsStore = create<PrefsState>(() => ({
  applyFromUser: applyUserPrefs,

  setLanguage: (language) => {
    // Local first (immediate UI switch + cache), then the account.
    // Adapters without server-backed accounts (mock) skip the sync.
    void changeAppLanguage(language);
    const api = getUserProfileApi();
    if (api) void api.updateProfile({ language }).catch(() => undefined);
  },

  setTheme: (theme) => {
    setTheme(theme);
    const api = getUserProfileApi();
    if (api) void api.updateProfile({ theme }).catch(() => undefined);
  },
}));
