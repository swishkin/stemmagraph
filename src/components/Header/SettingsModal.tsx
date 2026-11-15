import React from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';
import { type AppTheme } from '../../lib/theme';
import { usePrefsStore } from '../../store/prefsStore';

interface SettingsModalProps {
  onClose: () => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

/**
 * App settings: appearance (light/dark theme) and language. Both
 * choices are persisted on the user's account (prefsStore), so they
 * follow the account across browsers and devices; localStorage only
 * caches the last value for an instant first paint.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, theme, onThemeChange }) => {
  const { t, i18n } = useTranslation();
  const { setLanguage, setTheme } = usePrefsStore();

  const handleTheme = (next: AppTheme) => {
    setTheme(next);
    onThemeChange(next);
  };

  const handleLanguage = (language: AppLanguage) => {
    if (language !== i18n.language) {
      setLanguage(language);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/40 cursor-default"
        aria-label={t('settings.close')}
        onClick={onClose}
        style={{ outline: 'none' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('settings.close')}
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-8">
          {/* Appearance */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.appearance')}</h3>
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => handleTheme('light')}
                aria-pressed={theme === 'light'}
                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('settings.light')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('settings.dark')}</span>
              </button>
            </div>
          </section>

          {/* Language */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.language')}</h3>
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
              {SUPPORTED_LANGUAGES.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLanguage(code)}
                  aria-pressed={i18n.language === code}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold uppercase transition-colors ${
                    i18n.language === code
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </section>

          <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.scopeNote')}</p>
        </div>
      </div>
    </div>
  );
};
