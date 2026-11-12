import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// i18n must initialize before the first render so Indonesian strings are
// available synchronously on first paint.
import { i18n } from './lib/i18n';
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from './lib/theme';
import './index.css';

// Reflect the active language on the document as soon as we boot
document.documentElement.lang = i18n.language;

// Apply the stored theme before the first paint so dark mode doesn't
// flash light on load.
try {
  applyTheme(resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY)));
} catch {
  // storage blocked: default light theme stands
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
