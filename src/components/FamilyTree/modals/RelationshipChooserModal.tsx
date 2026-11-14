import React, { useEffect, useState } from 'react';
import { X, Link2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FamilyMember } from '../../../types/family';

interface RelationshipChooserModalProps {
  /** What is being added, relative to the target member. */
  kind: 'spouse' | 'child' | 'parent';
  /** The member the relationship is being added for. */
  targetMember: FamilyMember;
  /** All members of the active tree (the select offers every other member). */
  members: FamilyMember[];
  onClose: () => void;
  /** "Create a new member instead": hands the flow to the original add path. */
  onCreateNew: () => void;
  /** Links the chosen existing member; resolves false when it failed. */
  onLinkExisting: (memberId: string) => Promise<boolean>;
}

/**
 * Add spouse/child/parent: first offer linking an EXISTING member (any
 * generation — the linked member's generation is aligned with the
 * relationship), then fall back to creating a new one.
 */
export const RelationshipChooserModal: React.FC<RelationshipChooserModalProps> = ({
  kind,
  targetMember,
  members,
  onClose,
  onCreateNew,
  onLinkExisting,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Escape closes the dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const titleKey =
    kind === 'spouse'
      ? 'relationshipChooser.titleSpouse'
      : kind === 'child'
        ? 'relationshipChooser.titleChild'
        : 'relationshipChooser.titleParent';

  const candidates = members.filter((m) => m.id !== targetMember.id);

  const handleLink = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    setError('');
    const ok = await onLinkExisting(selectedId);
    setBusy(false);
    if (!ok) setError(t('relationshipChooser.error'));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey, { name: targetMember.name })}
        data-testid="relationship-chooser"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t(titleKey, { name: targetMember.name })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label={t('memberEdit.closeModal')}
          >
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('relationshipChooser.existingHint')}
          </p>

          <label htmlFor="relationship-chooser-select" className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('relationshipChooser.existingSection')}
            </span>
            <select
              id="relationship-chooser-select"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setError('');
              }}
              disabled={busy}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="relationship-chooser-select"
            >
              <option value="" disabled>
                {t('relationshipChooser.selectPlaceholder')}
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} (gen. {candidate.generation})
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="relationship-chooser-error">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleLink}
            disabled={!selectedId || busy}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="relationship-chooser-link"
          >
            {busy && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <Link2 className="w-4 h-4" />
            <span>{t('relationshipChooser.link')}</span>
          </button>

          <hr className="border-gray-200 dark:border-gray-800" />

          <button
            type="button"
            onClick={onCreateNew}
            disabled={busy}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            data-testid="relationship-chooser-create"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('relationshipChooser.createNew')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
