import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidLanguage, isValidTheme, applyUserPrefs } from './prefsStore';

vi.mock('@/lib/i18n', () => ({
  changeAppLanguage: vi.fn().mockResolvedValue(undefined),
  SUPPORTED_LANGUAGES: ['id', 'en'],
}));

vi.mock('@/lib/adapters', () => ({
  getUserProfileApi: vi.fn().mockReturnValue(null),
}));

// Minimal DOM stand-ins so the real setTheme (localStorage + <html>
// class) can run in the node environment.
const setupDom = () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  const classList = {
    classes: new Set<string>(),
    toggle(name: string, force?: boolean) {
      if (force === undefined) {
        if (this.classes.has(name)) {
          this.classes.delete(name);
        } else {
          this.classes.add(name);
        }
      } else if (force) {
        this.classes.add(name);
      } else {
        this.classes.delete(name);
      }
    },
  };
  vi.stubGlobal('document', { documentElement: { classList } });
  return { storage, classList };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('prefs guards', () => {
  it('accepts only the supported language codes', () => {
    expect(isValidLanguage('id')).toBe(true);
    expect(isValidLanguage('en')).toBe(true);
    expect(isValidLanguage('fr')).toBe(false);
    expect(isValidLanguage(null)).toBe(false);
    expect(isValidLanguage(undefined)).toBe(false);
    expect(isValidLanguage('EN')).toBe(false);
    expect(isValidLanguage(1)).toBe(false);
  });

  it('accepts only light/dark themes', () => {
    expect(isValidTheme('light')).toBe(true);
    expect(isValidTheme('dark')).toBe(true);
    expect(isValidTheme('blue')).toBe(false);
    expect(isValidTheme(null)).toBe(false);
    expect(isValidTheme(undefined)).toBe(false);
    expect(isValidTheme('Dark')).toBe(false);
  });
});

describe('applyUserPrefs (session reconcile)', () => {
  it('applies a stored dark theme + en language to the browser', async () => {
    const { storage, classList } = setupDom();
    const { changeAppLanguage } = await import('@/lib/i18n');

    applyUserPrefs({ language: 'en', theme: 'dark' });

    expect(storage.get('stemmagraph.theme')).toBe('dark');
    expect(classList.classes.has('dark')).toBe(true);
    expect(changeAppLanguage).toHaveBeenCalledWith('en');
  });

  it('ignores absent preferences (user never picked) and keeps the browser state', async () => {
    const { storage, classList } = setupDom();
    // Simulate a browser that already has cached choices.
    storage.set('stemmagraph.theme', 'dark');
    classList.classes.add('dark');
    const { changeAppLanguage } = await import('@/lib/i18n');

    applyUserPrefs({});

    expect(storage.get('stemmagraph.theme')).toBe('dark');
    expect(classList.classes.has('dark')).toBe(true);
    expect(changeAppLanguage).not.toHaveBeenCalled();
  });

  it('ignores invalid stored values instead of corrupting the UI', async () => {
    const { storage, classList } = setupDom();
    const { changeAppLanguage } = await import('@/lib/i18n');

    applyUserPrefs({ language: 'fr', theme: 'blue' });

    expect(storage.has('stemmagraph.theme')).toBe(false);
    expect(classList.classes.has('dark')).toBe(false);
    expect(changeAppLanguage).not.toHaveBeenCalled();
  });

  it('switches a cached dark browser to a stored light theme', async () => {
    const { storage, classList } = setupDom();
    storage.set('stemmagraph.theme', 'dark');
    classList.classes.add('dark');

    applyUserPrefs({ language: null, theme: 'light' });

    expect(storage.get('stemmagraph.theme')).toBe('light');
    expect(classList.classes.has('dark')).toBe(false);
  });
});
