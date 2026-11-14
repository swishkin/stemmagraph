import React from 'react';
import { BackgroundVariant } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { 
  Maximize, 
  ArrowUpDown, 
  ArrowLeftRight,
  RefreshCw,
  Grid3X3,
  Circle,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';

interface FamilyTreeControlsProps {
  onLayoutChange: (direction: 'TB' | 'LR') => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  currentLayout: 'TB' | 'LR';
  gridType?: BackgroundVariant;
  showGrid?: boolean;
  onGridTypeChange?: (type: BackgroundVariant) => void;
  onGridToggle?: (show: boolean) => void;
}

export const FamilyTreeControls: React.FC<FamilyTreeControlsProps> = ({
  onLayoutChange,
  onAutoLayout,
  onFitView,
  currentLayout,
  gridType = 'lines',
  showGrid = true,
  onGridTypeChange,
  onGridToggle,
}) => {
  const { t } = useTranslation('canvas');
  /**
   * Handles grid type change with proper type safety
   * @param type - The grid type to set
   */
  const handleGridTypeChange = (type: string) => {
    if (onGridTypeChange) {
      onGridTypeChange(type as BackgroundVariant);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-2 space-y-2">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2">{t('controls.layoutControls')}</div>
      
      {/* Layout direction buttons */}
      <div className="flex space-x-1">
        <button
          onClick={() => onLayoutChange('TB')}
          className={`p-2 rounded transition-colors ${
            currentLayout === 'TB'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          title={t('controls.tierLayout')}
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => onLayoutChange('LR')}
          className={`p-2 rounded transition-colors ${
            currentLayout === 'LR'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          title={t('controls.freeLayout')}
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      </div>

      {currentLayout === 'TB' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
          {t('controls.tierModeHint')}
        </div>
      )}

      <hr className="border-gray-200 dark:border-gray-800" />

      {/* Grid Controls */}
      {onGridTypeChange && onGridToggle && (
        <>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2">{t('controls.gridPattern')}</div>
          
          {/* Grid Toggle */}
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('controls.showGrid')}</span>
            <button
              onClick={() => onGridToggle(!showGrid)}
              className={`p-1 rounded transition-colors ${
                showGrid ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
              }`}
              title={showGrid ? t('controls.hideGrid') : t('controls.showGrid')}
            >
              {showGrid ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {/* Grid Type Buttons */}
          {showGrid && (
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => handleGridTypeChange('dots')}
                className={`p-2 rounded transition-colors ${
                  gridType === 'dots'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                title={t('controls.dotsGrid')}
              >
                <Circle className="w-4 h-4 mx-auto" />
              </button>
              
              <button
                onClick={() => handleGridTypeChange('lines')}
                className={`p-2 rounded transition-colors ${
                  gridType === 'lines'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                title={t('controls.linesGrid')}
              >
                <Grid3X3 className="w-4 h-4 mx-auto" />
              </button>
              
              <button
                onClick={() => handleGridTypeChange('cross')}
                className={`p-2 rounded transition-colors ${
                  gridType === 'cross'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                title={t('controls.crossGrid')}
              >
                <Plus className="w-4 h-4 mx-auto" />
              </button>
            </div>
          )}

          <hr className="border-gray-200 dark:border-gray-800" />
        </>
      )}

      {/* Action buttons */}
      <div className="space-y-1">
        <button
          onClick={onAutoLayout}
          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title={t('controls.autoLayout')}
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t('controls.autoLayout')}</span>
        </button>
        
        <button
          onClick={onFitView}
          className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title={t('controls.fitView')}
        >
          <Maximize className="w-4 h-4" />
          <span>{t('controls.fitView')}</span>
        </button>
      </div>
    </div>
  );
};