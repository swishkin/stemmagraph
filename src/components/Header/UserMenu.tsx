import React, { useState } from 'react';
import { User, LogOut, Settings, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { getAccountAdminApi } from '../../lib/adapters';
import { isAdminUser } from '../../lib/account-states/adminView';
import { AdminPanel } from '../Admin/AdminPanel';
import { ProfileModal } from './ProfileModal';
import { SettingsModal } from './SettingsModal';
import { resolveTheme, setTheme, THEME_STORAGE_KEY, type AppTheme } from '../../lib/theme';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Current theme for the Settings modal; the actual application to
  // <html> + persistence happens in lib/theme on every change.
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'light';
    }
  });

  if (!user) return null;

  // AC-5d: the admin entry exists only for an active owner on an adapter
  // with server-backed accounts. Everyone else never sees the surface.
  const canAdmin = getAccountAdminApi() !== null && isAdminUser(user);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  const openAdminPanel = () => {
    setIsOpen(false);
    setIsAdminOpen(true);
  };

  const openProfile = () => {
    setIsOpen(false);
    setIsProfileOpen(true);
  };

  const openSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleThemeChange = (next: AppTheme) => {
    setTheme(next); // persist + apply the class on <html>
    setThemeState(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-sm font-medium">
              {user.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-10 bg-transparent border-none cursor-default"
            aria-label={t('userMenu.close')}
            onClick={() => setIsOpen(false)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            style={{ outline: 'none' }}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
            
            <div className="py-2">
              <button
                onClick={openProfile}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>{t('userMenu.profile')}</span>
              </button>
              
              <button
                onClick={openSettings}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>{t('userMenu.settings')}</span>
              </button>

              {canAdmin && (
                <button
                  onClick={openAdminPanel}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('userMenu.admin')}</span>
                </button>
              )}

              <hr className="my-2" />
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('userMenu.signOut')}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      )}
    </div>
  );
};