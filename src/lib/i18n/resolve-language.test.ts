// Tests for the initial-UI-language resolution (VITE_UI_LANG support).
//
// Precedence: a language the user picked in this browser (localStorage)
// always wins; next the deployment-level VITE_UI_LANG build default;
// finally the built-in default 'id'. Invalid values fall through.

import { describe, expect, it } from 'vitest';
import { resolveInitialLanguage } from './index';

describe('resolveInitialLanguage', () => {
  it('prefers the stored user choice over the env default', () => {
    expect(resolveInitialLanguage('en', 'id')).toBe('en');
    expect(resolveInitialLanguage('id', 'en')).toBe('id');
  });

  it('falls back to the env default when nothing is stored', () => {
    expect(resolveInitialLanguage(null, 'en')).toBe('en');
    expect(resolveInitialLanguage(null, 'id')).toBe('id');
  });

  it('ignores an invalid stored value', () => {
    expect(resolveInitialLanguage('fr', 'en')).toBe('en');
    expect(resolveInitialLanguage('FR', undefined)).toBe('id');
  });

  it('ignores an invalid env value', () => {
    expect(resolveInitialLanguage(null, 'fr')).toBe('id');
    expect(resolveInitialLanguage(null, 'EN')).toBe('id');
  });

  it('falls back to the built-in default', () => {
    expect(resolveInitialLanguage(null, undefined)).toBe('id');
    expect(resolveInitialLanguage('', undefined)).toBe('id');
  });
});
