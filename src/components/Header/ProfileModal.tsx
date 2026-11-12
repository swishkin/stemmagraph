import React, { useState } from 'react';
import { User, KeyRound, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getUserProfileApi, AdapterError } from '../../lib/adapters';
import { useTranslation } from 'react-i18next';

interface ProfileModalProps {
  onClose: () => void;
}

/**
 * Self-service account page: profile fields, password change, and
 * account deletion. All writes go through the UserProfileApi
 * (REST adapter only) — mock/supabase show an unavailable note.
 * Deletion re-verifies the password on the server before it proceeds.
 */
export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, updateUser, logout } = useAuthStore();
  const { t } = useTranslation();
  const profileApi = getUserProfileApi();

  // ── Profile fields ──
  const [name, setName] = useState(user?.name ?? '');
  const [familyName, setFamilyName] = useState(user?.familyName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // ── Deletion ──
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileApi) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const updated = await profileApi.updateProfile({
        name,
        familyName: familyName || null,
        email,
        avatar: avatar || null,
      });
      updateUser(updated);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof AdapterError ? err.message : t('profile.saveFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileApi) return;
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const updated = await profileApi.changePassword(currentPassword, newPassword);
      updateUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err instanceof AdapterError ? err.message : t('profile.saveFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileApi) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await profileApi.deleteAccount(deletePassword);
      // 204: account gone. Sign out and leave.
      logout();
      onClose();
    } catch (err) {
      setDeleteError(
        err instanceof AdapterError ? err.message : t('profile.deleteFailed'),
      );
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/40 cursor-default"
        aria-label={t('profile.close')}
        onClick={onClose}
        style={{ outline: 'none' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('profile.title')}
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('profile.title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {user.name} {user.familyName ?? ''} · {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('profile.close')}
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-8">
          {!profileApi && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-700 rounded-lg p-3">
              {t('profile.unavailable')}
            </p>
          )}

          {/* Profile fields */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('profile.sectionProfile')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.familyName')}</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.avatar')}</label>
                <input
                  type="url"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="https://…"
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {profileError && <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>}
            {profileSaved && <p className="text-sm text-green-600 dark:text-green-400">{t('profile.saved')}</p>}
            <button
              type="submit"
              disabled={!profileApi || savingProfile}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {t('profile.save')}
            </button>
          </form>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Password */}
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('profile.sectionPassword')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('profile.confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
            {passwordSaved && <p className="text-sm text-green-600 dark:text-green-400">{t('profile.passwordChanged')}</p>}
            <button
              type="submit"
              disabled={!profileApi || savingPassword}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {t('profile.changePassword')}
            </button>
          </form>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Danger zone */}
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <div className="flex items-center space-x-2">
              <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{t('profile.sectionDanger')}</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.deleteWarning')}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                required
                placeholder={t('profile.deletePasswordPlaceholder')}
                className="border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent sm:w-72"
              />
              <button
                type="submit"
                disabled={!profileApi || deleting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {t('profile.deleteAccount')}
              </button>
            </div>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};
