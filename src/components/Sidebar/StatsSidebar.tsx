import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, TreePine, MapPin } from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';

export const StatsSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { stats } = useFamilyStore();

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-6 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t('statsSidebar.title')}</h2>
      
      {/* Overview Stats */}
      <div className="space-y-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('statsSidebar.totalMembers')}</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalMembers}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center space-x-3">
            <TreePine className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('statsSidebar.generations')}</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalGenerations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gender Distribution */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('statsSidebar.genderDistribution')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">♂</div>
            <div className="text-2xl font-bold text-blue-600">{stats.maleCount}</div>
            <div className="text-sm text-gray-600">{t('statsSidebar.male')}</div>
          </div>
          <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-pink-600 mb-1">♀</div>
            <div className="text-2xl font-bold text-pink-600">{stats.femaleCount}</div>
            <div className="text-sm text-gray-600">{t('statsSidebar.female')}</div>
          </div>
        </div>
      </div>

      {/* Age Distribution */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('statsSidebar.ageDistribution')}</h3>
        <div className="space-y-3">
          {Object.entries(stats.ageDistribution).map(([range, count]) => (
            <div key={range} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('statsSidebar.years', { range })}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Location Distribution */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('statsSidebar.locations')}</h3>
        <div className="space-y-3">
          {Object.entries(stats.locationDistribution).map(([location, count]) => (
            <div key={location} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{location}</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};