import { useEffect, useState } from 'react';

/**
 * Reactively reports whether the app is in dark mode.
 *
 * The theme itself is a class on <html> (see index.ts); this hook lets
 * components react to changes without a global store. It observes the
 * class attribute so any writer (UserMenu, SettingsModal) is covered.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document === 'undefined'
      ? false
      : document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
