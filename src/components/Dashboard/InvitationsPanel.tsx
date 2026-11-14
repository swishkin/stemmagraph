import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Link2, QrCode, RefreshCw, Send, UserPlus, Users, X, AlertCircle, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { getAccountAdminApi, getInvitationAdminApi } from '../../lib/adapters';
import type {
  AdminAccount,
  CreatedInvitation,
  InvitationRecord,
  InvitationTypeValue,
  TreeMembershipRecord,
  TreeRoleValue,
} from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';
import { useAuthStore } from '../../store/authStore';
import { buildInvitationShareText, buildWhatsAppUrl, normalizeWhatsAppPhone } from '../../lib/share/whatsapp';

/**
 * Owner panel for invitations and tree membership (P2-3 AC-6).
 *
 * Three blocks: create an invitation link (personal or family), the
 * invitation list with computed status and revoke, and the tree member
 * list with role management. The server owns every decision
 * (FORBIDDEN_TREE, TREE_LAST_OWNER_GUARD, INVITATION_* codes); this
 * component renders the honest server messages verbatim.
 *
 * Copy discipline (R-74.6): the invite text never promises full tree
 * access and never suggests the server sends anything. The channel field
 * records the owner's intent only; sharing happens outside the app.
 *
 * WhatsApp path (P2-4 AC-3, ADR 0005): when the channel is 'wa' the panel
 * shows an optional phone input plus a share button. The button creates
 * the invitation through the same P2-3 API (payload carries the channel
 * intent only), composes the four-field text client-side, and opens
 * wa.me in a new tab. The typed phone lives in local component state
 * only: it is never sent to the server, never persisted, and it dies
 * with the panel when the owner closes it (the parent unmounts us).
 */
export const InvitationsPanel: React.FC<{ treeId: string; treeName: string; onClose: () => void }> = ({
  treeId,
  treeName,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const invitationsApi = getInvitationAdminApi();
  const accountsApi = getAccountAdminApi();
  const user = useAuthStore((state) => state.user);

  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [members, setMembers] = useState<TreeMembershipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  // Creation form state.
  const [inviteType, setInviteType] = useState<InvitationTypeValue>('personal');
  const [grantedRole, setGrantedRole] = useState<TreeRoleValue>('viewer');
  const [channel, setChannel] = useState<'manual' | 'wa' | 'email'>('manual');
  const [maxUses, setMaxUses] = useState('20');
  const [isCreating, setIsCreating] = useState(false);

  // WhatsApp share state. Local only: the phone number must never reach the
  // server, the URL bar outside wa.me, or any store. Unmounting the panel on
  // close throws this state away, which is the documented reset (P2-4).
  const [waPhone, setWaPhone] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Add-existing-user form state. Local only, like waPhone: the chosen
  // email lives here until it is sent to the server (or the panel closes).
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<TreeRoleValue>('editor');
  const [isAdding, setIsAdding] = useState(false);

  // Full account list for the add-existing-user dropdown. Non-null when the
  // current user may list accounts (installation owner): the form then
  // offers a themed dropdown of all users by default. Null (list fetch
  // failed, e.g. a non-owner tree manager) falls back to the freeform
  // email field, which the server still verifies.
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);

  // Pending role changes: membershipId -> chosen role. A select change only
  // updates this map; the server is touched exclusively by the Save button.
  // Closing the panel with pending changes prompts Save / Don't save / Stay.
  const [pendingRoles, setPendingRoles] = useState<Record<string, TreeRoleValue>>({});
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);

  // QR code for the created link: generated locally on demand, never sent
  // anywhere. Toggled inline below the link row.
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

    // Fetch the account list for the add-existing-user dropdown. A null
  // result (fetch failed, e.g. a non-owner tree manager) makes the form
  // fall back to the freeform email field; the server verifies it either
  // way. Kept independent of the main load: a 403 on the list must not
  // fail the panel's invitations/members data.
  const loadAccounts = useCallback(async () => {
    // No api (non-server adapter): accounts stays null, which renders the
    // freeform fallback. Both branches below set state only after an await,
    // keeping the effect body free of synchronous setState.
    if (!accountsApi) return;
    try {
      setAccounts(await accountsApi.listAccounts());
    } catch {
      setAccounts(null);
    }
  }, [accountsApi]);

  const load = useCallback(async () => {
    if (!invitationsApi) return;
    void loadAccounts();
    try {
      const [invitationRows, memberRows] = await Promise.all([
        invitationsApi.listInvitations(treeId),
        invitationsApi.listTreeMembership(treeId),
      ]);
      setInvitations(invitationRows);
      setMembers(memberRows);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [invitationsApi, treeId, loadAccounts]);

  useEffect(() => {
    if (!invitationsApi) return;
    let cancelled = false;
    (async () => {
      try {
        // The account-list fetch is isolated (.catch -> null): a 403 for a
        // non-owner must not fail the panel's main data.
        const [invitationRows, memberRows, accountRows] = await Promise.all([
          invitationsApi.listInvitations(treeId),
          invitationsApi.listTreeMembership(treeId),
          accountsApi ? accountsApi.listAccounts().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setInvitations(invitationRows);
        setMembers(memberRows);
        setAccounts(accountRows);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationsApi, treeId, accountsApi]);

  // A personal invitation always grants viewer; editor needs family.
  const handleTypeChange = (next: InvitationTypeValue) => {
    setInviteType(next);
    if (next === 'personal') setGrantedRole('viewer');
  };

  const handleCreate = async () => {
    if (!invitationsApi) return;
    setIsCreating(true);
    setActionError(null);
    setCreated(null);
    setCopied(false);
    try {
      const input =
        inviteType === 'family'
          ? { type: inviteType, grantedRole, channel, maxUses: Number(maxUses) || undefined }
          : { type: inviteType, grantedRole: 'viewer' as const, channel };
      const record = await invitationsApi.createInvitation(treeId, input);
      setCreated(record);
      // A new link means the previous QR (if shown) is stale.
      setQrOpen(false);
      setQrDataUrl(null);
      setQrFailed(false);
      setInvitations(await invitationsApi.listInvitations(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!invitationsApi) return;
    setActionError(null);
    try {
      await invitationsApi.revokeInvitation(invitationId);
      setInvitations(await invitationsApi.listInvitations(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.revokeFailed'));
    }
  };

  // A select change only records the pending role — nothing hits the
  // server until Save is pressed (user request: changes must not apply
  // immediately on selection).
  const handleRoleChange = (membershipId: string, role: TreeRoleValue, savedRole: TreeRoleValue) => {
    setPendingRoles((prev) => {
      if (role === savedRole) {
        // Choosing the saved value again cancels the pending change.
        if (!(membershipId in prev)) return prev;
        const next = { ...prev };
        delete next[membershipId];
        return next;
      }
      if (prev[membershipId] === role) return prev;
      return { ...prev, [membershipId]: role };
    });
  };

  const hasUnsavedRoles = Object.keys(pendingRoles).length > 0;

  // Applies every pending role change. Returns true when all of them were
  // applied (the pending map is empty afterwards); on a failed update the
  // server message is shown and the failing entry stays pending.
  const savePendingRoles = async (): Promise<boolean> => {
    if (!invitationsApi || !hasUnsavedRoles) return true;
    setIsSavingRoles(true);
    setActionError(null);
    let failed = false;
    for (const [membershipId, role] of Object.entries(pendingRoles)) {
      try {
        await invitationsApi.updateTreeMembershipRole(treeId, membershipId, role);
      } catch (err) {
        failed = true;
        // TREE_LAST_OWNER_GUARD and friends arrive as honest server text.
        setActionError(err instanceof Error ? err.message : t('invitePanel.memberUpdateFailed'));
        break;
      }
    }
    const refreshed = await invitationsApi
      .listTreeMembership(treeId)
      .catch(() => null);
    if (refreshed) {
      setMembers(refreshed);
      // Drop pending entries the server now agrees with; keep any that
      // failed so they remain editable and re-savable.
      setPendingRoles((prev) => {
        const next: Record<string, TreeRoleValue> = {};
        for (const [id, role] of Object.entries(prev)) {
          const row = refreshed.find((r) => r.id === id);
          if (!row || row.role !== role) next[id] = role;
        }
        return next;
      });
    }
    setIsSavingRoles(false);
    return !failed;
  };

  const handleSaveAndClose = async () => {
    setShowClosePrompt(false);
    const ok = await savePendingRoles();
    if (ok) onClose();
  };

  // X close: with unsaved role changes, ask first (standard
  // save / don't-save prompt) instead of silently discarding them.
  const requestClose = () => {
    if (hasUnsavedRoles) {
      setShowClosePrompt(true);
    } else {
      onClose();
    }
  };

  // QR code for the created link, generated locally (nothing leaves the
  // browser). Generated on first open and cached until the link changes.
  const handleToggleQr = async () => {
    if (qrOpen) {
      setQrOpen(false);
      return;
    }
    if (!created) return;
    setQrOpen(true);
    if (qrDataUrl) return;
    try {
      const url = await QRCode.toDataURL(created.url, {
        width: 220,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      setQrFailed(true);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!invitationsApi) return;
    setActionError(null);
    try {
      await invitationsApi.removeTreeMembership(treeId, membershipId);
      setMembers(await invitationsApi.listTreeMembership(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.memberUpdateFailed'));
    }
  };

  // Add an already-registered user straight to this tree (no invite link). The
  // server answers USER_NOT_FOUND with honest text when the email has no
  // account on this installation.
  const handleAddExisting = async () => {
    if (!invitationsApi) return;
    const email = addEmail.trim();
    if (!email) {
      setActionError(
        accounts ? t('invitePanel.addExistingSelectRequired') : t('invitePanel.addExistingEmailRequired'),
      );
      return;
    }
    setIsAdding(true);
    setActionError(null);
    try {
      await invitationsApi.addTreeMember(treeId, email, addRole);
      setMembers(await invitationsApi.listTreeMembership(treeId));
      setAddEmail('');
      setAddRole('editor');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.memberUpdateFailed'));
    } finally {
      setIsAdding(false);
    }
  };

  // Dropdown options for the add-existing-user select: every account on the
  // installation, sorted by display name. Label shows name (email) plus a
  // status marker so pending/disabled accounts are recognizable. The value
  // is the email, which is what the membership endpoint expects.
  const accountOptions = useMemo(() => {
    if (!accounts) return [];
    return [...accounts]
      .sort((a, b) => `${a.name || a.email}`.localeCompare(`${b.name || b.email}`))
      .map((account) => {
        const base = account.name && account.name.trim() ? `${account.name} (${account.email})` : account.email;
        const status =
          account.status === 'active'
            ? ''
            : ` · ${t(`invitePanel.addExistingStatus.${account.status}`)}`;
        return { value: account.email, label: `${base}${status}` };
      });
  }, [accounts, t]);

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // WhatsApp share (P2-4 AC-3): create the invitation, compose the share
  // text, open wa.me. The phone is validated first so a typo cannot burn
  // an invitation that could then never be shared. The phone itself never
  // leaves this component; the API payload holds the channel only.
  const handleWhatsAppShare = async () => {
    if (!invitationsApi) return;
    setActionError(null);
    setCreated(null);
    setCopied(false);

    const trimmedPhone = waPhone.trim();
    if (trimmedPhone !== '') {
      try {
        normalizeWhatsAppPhone(trimmedPhone);
      } catch {
        setActionError(t('invitePanel.waPhoneInvalid'));
        return;
      }
    }

    const inviterName = user?.name?.trim() ?? '';
    if (inviterName === '') {
      setActionError(t('invitePanel.createFailed'));
      return;
    }

    setIsSharing(true);
    try {
      const input =
        inviteType === 'family'
          ? { type: inviteType, grantedRole, channel: 'wa' as const, maxUses: Number(maxUses) || undefined }
          : { type: inviteType, grantedRole: 'viewer' as const, channel: 'wa' as const };
      // P2-3 API as-is: the URL comes from the server response, never rebuilt here.
      const record = await invitationsApi.createInvitation(treeId, input);
      setCreated(record);
      // A new link means the previous QR (if shown) is stale.
      setQrOpen(false);
      setQrDataUrl(null);
      setQrFailed(false);
      setInvitations(await invitationsApi.listInvitations(treeId));

      const shareText = buildInvitationShareText({
        inviterName,
        treeName,
        inviteUrl: record.url,
        message: t('invitePanel.waTemplate', { inviterName, treeName }),
      });
      // Empty phone falls back to wa.me's contact-picker form inside the
      // builder, so the owner picks the recipient in their own WhatsApp.
      window.open(buildWhatsAppUrl(trimmedPhone, shareText), '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('invitePanel.createFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  const stateBadge = (state: InvitationRecord['state']) => {
    const palette: Record<InvitationRecord['state'], string> = {
      active: 'bg-green-100 dark:bg-green-900/40 text-green-800',
      expired: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      exhausted: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      revoked: 'bg-red-100 dark:bg-red-900/40 text-red-800',
      consumed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${palette[state]}`}>
        {t(`invitePanel.state.${state}`)}
      </span>
    );
  };

  if (!invitationsApi) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('invitePanel.unavailable')}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-100 dark:bg-gray-800 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {t('invitePanel.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="invitations-panel">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white dark:bg-gray-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('invitePanel.title', { treeName })}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void load();
              }}
              className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              title={t('invitePanel.refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestClose}
              aria-label={t('invitePanel.close')}
              className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {actionError && (
            <div className="flex items-start space-x-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800">{actionError}</p>
            </div>
          )}

          {/* Create invitation */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="mb-3 flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{t('invitePanel.createTitle')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('invitePanel.fieldType')}
                <select
                  value={inviteType}
                  onChange={(e) => handleTypeChange(e.target.value as InvitationTypeValue)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-900 dark:text-white px-2 py-2 text-sm"
                >
                  <option value="personal">{t('invite.type.personal')}</option>
                  <option value="family">{t('invite.type.family')}</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('invitePanel.fieldRole')}
                <select
                  value={grantedRole}
                  onChange={(e) => setGrantedRole(e.target.value as TreeRoleValue)}
                  disabled={inviteType === 'personal'}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-900 dark:text-white px-2 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
                >
                  <option value="viewer">{t('invitePanel.role.viewer')}</option>
                  <option value="editor" disabled={inviteType === 'personal'}>
                    {t('invitePanel.role.editor')}
                  </option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('invitePanel.fieldChannel')}
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as 'manual' | 'wa' | 'email')}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-900 dark:text-white px-2 py-2 text-sm"
                >
                  <option value="manual">{t('invitePanel.channel.manual')}</option>
                  <option value="wa">{t('invitePanel.channel.wa')}</option>
                  <option value="email">{t('invitePanel.channel.email')}</option>
                </select>
              </label>
              {inviteType === 'family' && (
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('invitePanel.fieldMaxUses')}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-900 dark:text-white px-2 py-2 text-sm"
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('invitePanel.createHint')}</p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="mt-3 flex items-center space-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              <span>{isCreating ? t('invitePanel.creating') : t('invitePanel.createAction')}</span>
            </button>

            {/* WhatsApp share block (P2-4 AC-3): optional phone, never stored. */}
            {channel === 'wa' && (
              <div className="mt-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3" data-testid="wa-share-block">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('invitePanel.waPhoneLabel')}
                  <input
                    type="text"
                    inputMode="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder={t('invitePanel.waPhonePlaceholder')}
                    autoComplete="off"
                    data-testid="wa-phone-input"
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-900 dark:text-white px-2 py-2 text-sm"
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('invitePanel.waPhoneNote')}</p>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  disabled={isSharing || isCreating}
                  data-testid="wa-share-button"
                  className="mt-2 flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSharing ? t('invitePanel.creating') : t('invitePanel.waShareAction')}</span>
                </button>
              </div>
            )}

            {/* The full link appears exactly once, here. */}
            {created && (
              <div className="mt-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3" data-testid="created-invitation">
                <p className="flex items-center space-x-1 text-xs font-medium text-green-900">
                  <CheckCircle className="h-4 w-4" />
                  <span>{t('invitePanel.createdOnce')}</span>
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <code className="flex-1 overflow-x-auto rounded bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200">
                    {created.url}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center space-x-1 rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copied ? t('invitePanel.copied') : t('invitePanel.copy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleQr()}
                    aria-expanded={qrOpen}
                    title={t('invitePanel.qr')}
                    className="flex items-center space-x-1 rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <QrCode className="h-3 w-3" />
                    <span>{t('invitePanel.qr')}</span>
                  </button>
                </div>
                {/* QR code expands inline below the link row (same inline-block
                    pattern as the WhatsApp share block above). */}
                {qrOpen && (
                  <div
                    className="mt-2 flex flex-col items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
                    data-testid="qr-block"
                  >
                    {qrDataUrl ? (
                      <>
                        <img src={qrDataUrl} alt={t('invitePanel.qrAlt')} className="h-[220px] w-[220px]" />
                        <p className="mt-1 w-full max-w-[220px] truncate text-center text-[11px] text-gray-500 dark:text-gray-400">
                          {created.url}
                        </p>
                      </>
                    ) : qrFailed ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{t('invitePanel.qrFailed')}</p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('invitePanel.loading')}</p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-green-800">{t('invitePanel.shareHint')}</p>
              </div>
            )}
          </section>

          {/* Invitation list */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{t('invitePanel.listTitle')}</h3>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('invitePanel.loading')}</p>
            ) : loadFailed ? (
              <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">{t('invitePanel.loadFailed')}</p>
            ) : invitations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('invitePanel.empty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(`invite.type.${invitation.type}`)} · {t(`invitePanel.role.${invitation.grantedRole}`)} ·{' '}
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{invitation.tokenMasked}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('invitePanel.uses', { used: invitation.usedCount, max: invitation.maxUses })} ·{' '}
                        {t('invitePanel.expires', { date: formatDate(invitation.expiresAt, i18n.language) })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center space-x-2">
                      {stateBadge(invitation.state)}
                      {invitation.state === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(invitation.id)}
                          className="rounded-lg border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-300 hover:bg-red-50"
                        >
                          {t('invitePanel.revoke')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tree membership */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span>{t('invitePanel.membersTitle')}</span>
              </h3>
              {/* Role selects only stage changes; this applies them. */}
              <button
                type="button"
                onClick={() => void savePendingRoles()}
                disabled={!hasUnsavedRoles || isSavingRoles}
                data-testid="save-roles"
                className="flex items-center space-x-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <span>{isSavingRoles ? t('invitePanel.saving') : t('invitePanel.saveChanges')}</span>
              </button>
            </div>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('invitePanel.loading')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {member.name}
                        {member.userStatus !== 'active' && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({t(`invitePanel.userStatus.${member.userStatus}`)})</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center space-x-2">
                      <select
                        value={pendingRoles[member.id] ?? member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as TreeRoleValue, member.role)}
                        disabled={isSavingRoles}
                        className={`rounded-lg border px-2 py-1 text-xs bg-white text-gray-900 dark:bg-gray-900 dark:text-white disabled:opacity-50 ${
                          pendingRoles[member.id]
                            ? 'border-amber-400 dark:border-amber-500'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                        title={t('invitePanel.changeRole')}
                      >
                        <option value="owner">{t('invitePanel.role.owner')}</option>
                        <option value="editor">{t('invitePanel.role.editor')}</option>
                        <option value="viewer">{t('invitePanel.role.viewer')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id)}
                        className="rounded-lg border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-700 dark:text-red-300 hover:bg-red-50"
                        title={t('invitePanel.removeMember')}
                      >
                        {t('invitePanel.remove')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add an existing user (no invite link). Owners of the
                installation get a dropdown of every account (fetched via
                the admin list); everyone else who can manage membership
                falls back to the freeform email field. The server
                verifies the choice either way (USER_NOT_FOUND). */}
            <form
              className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddExisting();
              }}
            >
              <p className="w-full text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('invitePanel.addExistingTitle')}
              </p>
              <label className="min-w-[200px] flex-1">
                {accounts ? (
                  <>
                    <span className="block text-xs text-gray-600 dark:text-gray-400">{t('invitePanel.addExistingSelect')}</span>
                    {/* Dropdown of all accounts (default for installation owners),
                        themed like the panel's other selects; the CSS in
                        index.css keeps the native popup readable in dark mode. */}
                    <select
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      disabled={isAdding}
                      data-testid="add-member-select"
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {t('invitePanel.addExistingSelectPlaceholder')}
                      </option>
                      {accountOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <span className="block text-xs text-gray-600 dark:text-gray-400">{t('invitePanel.addExistingEmail')}</span>
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      disabled={isAdding}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
                      autoComplete="off"
                      data-testid="add-member-email"
                    />
                  </>
                )}
              </label>
              <label>
                <span className="block text-xs text-gray-600 dark:text-gray-400">{t('invitePanel.addExistingRole')}</span>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as TreeRoleValue)}
                  className="mt-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
                >
                  <option value="owner">{t('invitePanel.role.owner')}</option>
                  <option value="editor">{t('invitePanel.role.editor')}</option>
                  <option value="viewer">{t('invitePanel.role.viewer')}</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={isAdding}
                data-testid="add-member-button"
                className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>{isAdding ? t('invitePanel.creating') : t('invitePanel.addExistingAction')}</span>
              </button>
              <p className="w-full text-xs text-gray-500 dark:text-gray-400">
                {accounts ? t('invitePanel.addExistingHintDropdown') : t('invitePanel.addExistingHint')}
              </p>
            </form>

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('invitePanel.membersHint')}</p>
          </section>
        </div>
      </div>

      {/* Unsaved role changes prompt (X close while changes are staged).
          Backdrop/Cancel keep the user on the panel — discarding data is
          always an explicit choice. */}
      {showClosePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/50 cursor-default"
            aria-label={t('invitePanel.stay')}
            onClick={() => setShowClosePrompt(false)}
            style={{ outline: 'none' }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={t('invitePanel.unsavedTitle')}
            className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-5"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('invitePanel.unsavedTitle')}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('invitePanel.unsavedMessage')}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClosePrompt(false)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t('invitePanel.stay')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingRoles({});
                  setShowClosePrompt(false);
                  onClose();
                }}
                className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t('invitePanel.discard')}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndClose()}
                disabled={isSavingRoles}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {t('invitePanel.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
