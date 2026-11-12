import { describe, expect, it } from 'vitest';
import { resolveTheme, THEME_STORAGE_KEY, type AppTheme } from './index';

describe('resolveTheme', () => {
  it('accepts a stored dark or light value', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('falls back to light for missing or invalid values', () => {
    expect(resolveTheme(null)).toBe('light');
    expect(resolveTheme('')).toBe('light');
    expect(resolveTheme('blue')).toBe('light');
    expect(resolveTheme('DARK')).toBe('light');
  });
});

describe('THEME_STORAGE_KEY', () => {
  it('is a namespaced key so it cannot collide with app data', () => {
    expect(THEME_STORAGE_KEY).toBe('stemmagraph.theme');
  });

  it('only stores the two valid theme values', () => {
    const themes: AppTheme[] = ['light', 'dark'];
    expect(themes).toHaveLength(2);
    for (const t of themes) {
      expect(resolveTheme(t)).toBe(t);
    }
  });
});
