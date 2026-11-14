import React from 'react';
import { useTranslation } from 'react-i18next';

export const Legend: React.FC = () => {
  const { t } = useTranslation('canvas');
  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">{t('controls.legendTab')}</div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-gray-900"></div>
          <span>{t('controls.male')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-pink-200 rounded bg-white dark:bg-gray-900"></div>
          <span>{t('controls.female')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800"></div>
          <span>{t('controls.deceased')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-0.5 bg-gray-600"></div>
          <span>{t('controls.familyRelationship')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-full text-xs flex items-center justify-center">💍</div>
          <span>{t('controls.married')}</span>
        </div>
      </div>
    </div>
  );
};