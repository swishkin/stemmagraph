import React from 'react';
import { Users, TreePine, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../../store/familyStore';

interface StatsPopupProps {
  onClosed: () => void;
}

/**
 * Statistics as a compact two-column popup (replaces the old side panel):
 * column 1 = members / generations / gender, column 2 = age / location.
 * Rendered inside the top bar's Statistics button wrapper (relative).
 */
export const StatsPopup: React.FC<StatsPopupProps> = ({ onClosed }) => {
  const { t } = useTranslation();
  const { stats } = useFamilyStore();

  return (
    <>
      {/* Accessible backdrop for closing the popup */}
      <button
        type="button"
        className="fixed inset-0 z-40 bg-transparent border-none outline-hidden cursor-default"
        onClick={onClosed}
        aria-label={t('treeView.closeStatistics')}
        tabIndex={-1}
      />
      <div
        className="absolute top-full right-0 mt-2 z-50 w-[26rem] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-4 grid grid-cols-2 gap-6"
        role="dialog"
        aria-label={t('statsSidebar.title')}
        data-testid="stats-popup"
      >
        {/* Column 1: members / generations / gender */}
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-center space-x-3">
            <Users className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('statsSidebar.totalMembers')}
              </p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalMembers}</p>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg flex items-center space-x-3">
            <TreePine className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('statsSidebar.generations')}
              </p>
              <p className="text-2xl font-bold text-green-600">
                {stats.totalGenerations}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('statsSidebar.genderDistribution')}
            </h3>
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-blue-600">{stats.maleCount}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {t('statsSidebar.male')}
                </div>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/20 p-2 rounded-lg text-center">
                <div className="text-lg font-bold text-pink-600">{stats.femaleCount}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {t('statsSidebar.female')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: age / location */}
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('statsSidebar.ageDistribution')}
            </h3>
            <div className="space-y-1">
              {Object.entries(stats.ageDistribution).map(([range, count]) => (
                <div key={range} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('statsSidebar.years', { range })}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('statsSidebar.locations')}
            </h3>
            <div className="space-y-1">
              {Object.entries(stats.locationDistribution).map(([location, count]) => (
                <div key={location} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-1 min-w-0">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {location}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
