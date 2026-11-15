// UI theme (light/dark). The choice persists on the user's account
// (see src/store/prefsStore) and is applied as a `dark` class on
// <html>, which Tailwind's dark: variants key off. localStorage acts
// as a local cache so the very first paint (before the session is
// restored) already shows the right theme.

export type AppTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'stemmagraph.theme';

/** Pure resolver: stored value wins when valid, otherwise light. */
export const resolveTheme = (stored: string | null): AppTheme =>
  stored === 'dark' || stored === 'light' ? stored : 'light';

/** Toggles the `dark` class on <html>. Safe to call before render. */
export const applyTheme = (theme: AppTheme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

/** Persists and applies the theme; returns the stored value. */
export const setTheme = (theme: AppTheme): void => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // persistence is best effort; the switch itself still applies
  }
  applyTheme(theme);
};
