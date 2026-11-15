import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';
import { usePrefsStore } from '../../store/prefsStore';

// UI language switcher. Shared by the dashboard header and the family
// tree header so the language can be changed from anywhere in the app.
// The choice is persisted on the user's account (prefsStore); on the
// login page (no account) it stays a local browser choice.
export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const setLanguage = usePrefsStore((s) => s.setLanguage);

  const handleSwitch = (language: AppLanguage) => {
    if (language !== i18n.language) {
      setLanguage(language);
    }
  };

  return (
    <div
      className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden"
      role="group"
      aria-label={t('header.language')}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleSwitch(code)}
          aria-pressed={i18n.language === code}
          className={`px-2 py-1.5 text-xs font-semibold uppercase transition-colors ${
            i18n.language === code
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
};
