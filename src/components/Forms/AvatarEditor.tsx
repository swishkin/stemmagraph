import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fileToAvatarDataUrl, memberAvatarSource } from '../../lib/avatar';

interface AvatarEditorProps {
  /** Current photo (a URL or an uploaded data URL). */
  photoUrl?: string | null;
  /** Member email; when set and no photo exists, the Gravatar is previewed. */
  email?: string | null;
  /** Name used for the initials fallback in the preview. */
  name?: string;
  gender?: 'male' | 'female';
  onPhotoUrlChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Shared avatar editor for the add and edit member dialogs (kept in parity).
 *
 * Two ways to set a photo: upload (downscaled to a small data URL, which is
 * stored as the photoUrl — there is no upload endpoint) or paste a URL. When
 * no photo is set but an email exists, the member's Gravatar is shown live.
 */
export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  photoUrl,
  email,
  name = '',
  gender = 'male',
  onPhotoUrlChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const source = memberAvatarSource({ photoUrl: photoUrl ?? undefined, email: email ?? undefined });
  const showPhoto = Boolean(source) && !avatarFailed;
  // An uploaded photo is a data URL: don't dump it into the URL field.
  const isDataUrl = (photoUrl ?? '').startsWith('data:');
  const urlValue = isDataUrl ? '' : (photoUrl ?? '');

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarFailed(false);
      onPhotoUrlChange(dataUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const genderBg = gender === 'male' ? 'bg-blue-400' : 'bg-pink-400';

  return (
    <div data-testid="avatar-editor">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('avatar.label')}
      </span>
      <div className="flex items-start space-x-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
          {showPhoto ? (
            <img
              src={source!}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white text-xl font-bold ${genderBg}`}>
              {name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          {/* Upload + remove */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={disabled || isProcessing}
            data-testid="avatar-file-input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="avatar-upload-button"
            >
              <ImagePlus className="w-4 h-4" />
              <span>{isProcessing ? t('avatar.uploading') : t('avatar.upload')}</span>
            </button>
            {(photoUrl || email) && (
              <button
                type="button"
                onClick={() => {
                  setAvatarFailed(false);
                  onPhotoUrlChange(null);
                }}
                disabled={disabled}
                className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="avatar-remove-button"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('avatar.remove')}</span>
              </button>
            )}
          </div>

          {/* Photo URL */}
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={urlValue}
              onChange={(e) => {
                setAvatarFailed(false);
                onPhotoUrlChange(e.target.value.trim() || null);
              }}
              placeholder={isDataUrl ? t('avatar.uploadedPhoto') : t('avatar.photoUrl')}
              disabled={disabled}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="avatar-url-input"
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">{t('avatar.hint')}</p>
        </div>
      </div>
    </div>
  );
};
