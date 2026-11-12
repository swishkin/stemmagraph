import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';

// UI language switcher. Shared by the dashboard header and the family
// tree header so the language can be changed from anywhere in the app.
export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleSwitch = (language: AppLanguage) => {
    if (language !== i18n.language) {
      void changeAppLanguage(language);
    }
  };

  return (
    <div
      className="flex rounded-lg border border-gray-300 overflow-hidden"
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
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
};
