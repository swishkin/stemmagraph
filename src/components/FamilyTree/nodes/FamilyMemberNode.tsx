import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  Heart,
  MapPin,
  Briefcase,
  ChevronsDown
} from 'lucide-react';
import type { FamilyMember } from '../../../types/family';
import { memberAvatarSource } from '../../../lib/avatar';

// Type alias (bukan interface): React Flow v12 mensyaratkan data node memenuhi
// Record<string, unknown>, yang hanya dipenuhi type alias via implicit index signature.
export type FamilyMemberNodeData = {
  member: FamilyMember;
  onEdit: (member: FamilyMember) => void;
  /**
   * Right-click (or Shift+F10 / ContextMenu key) requests the tree-level
   * context menu. The menu itself is rendered once by the tree component,
   * anchored at the cursor; each node only reports that it was targeted.
   */
  onContextMenuRequest: (memberId: string, x: number, y: number) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (memberId: string) => void;
  onAddParent: (memberId: string) => void;
  /** Optional fields stamped by the tier layout pass (layout/tierLayout). */
  tier?: number;
  generationY?: number;
  familyGroup?: string;
  /** S-09 AC2: jumlah keturunan tersembunyi di bawah cabang node ini. */
  hiddenDescendantCount?: number;
  /** S-09 AC2: buka cabang tersembunyi di bawah node ini. */
  onExpandBranch?: (memberId: string) => void;
}

/** Custom node type for React Flow v12: Node<data, type> as required by NodeProps. */
export type FamilyMemberFlowNode = Node<FamilyMemberNodeData, 'familyMember'>;

export const FamilyMemberNode = memo(({ data, selected }: NodeProps<FamilyMemberFlowNode>) => {
  const { member, onEdit, onContextMenuRequest } = data;
  const { t } = useTranslation('canvas');
  // Gravatar (or a bad photo URL) can 404: fall back to initials instead of
  // a broken image. Reset when the source changes.
  const avatarSource = memberAvatarSource(member);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = avatarSource && !avatarFailed;

  const calculateAge = () => {
    const birthYear = new Date(member.birthDate).getFullYear();
    const getCurrentYear = () => {
      if (member.isAlive) {
        return new Date().getFullYear();
      }
      return member.deathDate ? new Date(member.deathDate).getFullYear() : new Date().getFullYear();
    };
    const endYear = getCurrentYear();
    return endYear - birthYear;
  };

  const getYearDisplay = () => {
    const birthYear = new Date(member.birthDate).getFullYear();
    const deathYear = member.deathDate ? new Date(member.deathDate).getFullYear() : null;

    if (deathYear) {
      return `(${birthYear}-${deathYear})`;
    }
    return `(${birthYear})`;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenuRequest(member.id, e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEdit(member);
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      // No cursor position for keyboard users: open at the card's corner.
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onContextMenuRequest(member.id, rect.right - 8, rect.bottom - 8);
    }
  };

  // Helper function to get card border class. The hover lift lives on the
  // WRAPPER below (card + corner badges move as one unit, so the badges
  // never shift relative to the card).
  const getCardBorderClass = () => {
    const baseClasses = 'w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border-2 transition-all duration-200 cursor-pointer group';
    const selectedClass = selected ? 'border-blue-500 shadow-xl' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600';
    const genderClass = member.gender === 'male' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-pink-500';
    const aliveClass = !member.isAlive ? 'opacity-75 bg-gray-50 dark:bg-gray-800' : '';

    return `${baseClasses} ${selectedClass} ${genderClass} ${aliveClass}`;
  };

  // Helper function to get generation badge color
  const getGenerationBadgeClass = () => {
    const baseClass = 'w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center text-white shadow-xs';
    const colorClass = member.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500';
    return `${baseClass} ${colorClass}`;
  };

  /**
   * Gets the appropriate background color class for the member's avatar
   * @returns CSS class string for avatar background
   */
  const getAvatarBackgroundClass = (): string => {
    return member.gender === 'male' ? 'bg-blue-400' : 'bg-pink-400';
  };

  /**
   * Gets the complete CSS class string for the avatar container
   * @returns Complete CSS class string including avatar styles
   */
  const getAvatarContainerClass = (): string => {
    const baseClasses = 'w-full h-full flex items-center justify-center text-white font-bold text-xl';
    const backgroundClass = getAvatarBackgroundClass();
    return `${baseClasses} ${backgroundClass}`;
  };

  return (
    <div className="relative">
      {/* Connection handles - positioned for bracket + side connections.
          Handle ids let the tree decide what a dragged connection means:
          right→left links two same-tier people (spouse); bottom→top links
          a parent tier to a child tier. */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="w-4 h-4 bg-gray-400 border-2 border-white"
        style={{ top: -8 }}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 bg-gray-400 border-2 border-white"
        style={{ bottom: -8 }}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="w-4 h-4 bg-gray-400 border-2 border-white"
        style={{ left: -8 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="w-4 h-4 bg-gray-400 border-2 border-white"
        style={{ right: -8 }}
      />

      {/* Card + corner badges share one hover transform: the badges lift
          with the card and never shrink inward relative to it. */}
      <div className="relative transition-all duration-200 hover:-translate-y-1">
        {/* Main card */}
        <button
          type="button"
          className={getCardBorderClass()}
          onContextMenu={handleContextMenu}
          onDoubleClick={() => onEdit(member)}
          onKeyDown={handleKeyDown}
          aria-label={[
            t('node.ariaFamilyMember', { name: member.name }),
            t('node.ariaYearsOld', { age: calculateAge() }),
            t('node.ariaGeneration', { generation: member.generation }),
            member.profession ?? null
          ].filter(Boolean).join(', ')}
          aria-describedby={`member-details-${member.id}`}
          tabIndex={0}
        >
          {/* Photo and basic info - Updated layout */}
          <div className="p-4">
            {/* Photo */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-xs">
                {showAvatar ? (
                  <img
                    src={avatarSource!}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className={getAvatarContainerClass()}>
                    {member.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Member info - New layout as per image */}
            <div className="text-center space-y-1" id={`member-details-${member.id}`}>
              {/* Nickname first (if exists) */}
              {member.nickname && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  ({member.nickname})
                </p>
              )}

              {/* Full name */}
              <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                {member.name}
              </h3>

              {/* Birth year and age */}
              <div className="space-y-0.5">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {getYearDisplay()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {calculateAge()} years
                </p>
              </div>
            </div>

            {/* Additional info (profession/location) - Enhanced spacing */}
            {(member.profession || member.currentLocation) && (
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 text-center">
                  {member.profession && (
                    <div className="flex items-center justify-center space-x-1">
                      <Briefcase className="w-3 h-3" />
                      <span className="truncate max-w-32">{member.profession}</span>
                    </div>
                  )}

                  {member.currentLocation && (
                    <div className="flex items-center justify-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-32">{member.currentLocation}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Generation badge - top left corner (inside the hover unit) */}
        <div className="absolute -top-2 -left-2">
          <div className={getGenerationBadgeClass()}>
            {member.generation}
          </div>
        </div>

        {/* Status indicators - top right (inside the hover unit) */}
        <div className="absolute -top-2 -right-2 flex space-x-1">
          {member.maritalStatus === 'married' && (
            <div className="w-6 h-6 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
              <Heart className="w-3 h-3 text-white" />
            </div>
          )}
          {!member.isAlive && (
            <div className="w-6 h-6 bg-gray-600 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs">✕</span>
            </div>
          )}
        </div>
      </div>

      {/* S-09 AC2: indikator keturunan tersembunyi + kontrol expand per cabang */}
      {typeof data.hiddenDescendantCount === 'number' &&
        data.hiddenDescendantCount > 0 &&
        data.onExpandBranch && (
          <button
            type="button"
            className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 z-20"
            onClick={(e) => {
              e.stopPropagation();
              data.onExpandBranch?.(member.id);
            }}
            aria-label={t('generations.expandBranch', { count: data.hiddenDescendantCount })}
            title={t('generations.hiddenDescendants', { count: data.hiddenDescendantCount })}
          >
            <ChevronsDown className="w-3 h-3" aria-hidden="true" />
            {data.hiddenDescendantCount}
          </button>
        )}
    </div>
  );
});

FamilyMemberNode.displayName = 'FamilyMemberNode';
