import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BackgroundVariant,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import type { FamilyMember } from '../../types/family';
import { FamilyMemberNode, type FamilyMemberFlowNode } from './nodes/FamilyMemberNode';
import { MarriageEdge } from './edges/MarriageEdge';
import { ParentChildEdge } from './edges/ParentChildEdge';
import { SiblingEdge } from './edges/SiblingEdge';
import { ExportControls } from './controls/ExportControls';
import { ImportControls } from './controls/ImportControls';
import { FamilyTreeControls } from './controls/FamilyTreeControls';
import { MemberEditModal } from './modals/MemberEditModal';
import { constrainNodeMovement } from './layout/tierLayout';
import { dagreTierEngine, getSnapGrid, type TierLayout } from './layout';
import {
  DEFAULT_GENERATION_LIMIT_STATE,
  applyGenerationLimit,
  collapseToDefaultLimit,
  countGenerationSpan,
  expandAllGenerations,
  expandBranch,
  groupMembersByGeneration,
  hydrateStableByKey,
  type GenerationLimitState,
  type HydrationSpec,
  type StableHydrationEntry,
} from './generations';
import { shouldOnlyRenderVisibleElements } from './generations';
import {
  Plus,
  BarChart3,
  Settings,
  Upload,
  Download,
  Trash2,
  Heart,
  Pencil,
  UserPlus,
  UserRoundPlus,
} from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';
import { useDarkMode } from '../../lib/theme/useDarkMode';
import { StatsPopup } from './controls/StatsPopup';
import { RelationshipChooserModal } from './modals/RelationshipChooserModal';

// Define custom node and edge types
const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNode,
};

const edgeTypes: EdgeTypes = {
  marriage: MarriageEdge,
  parentChild: ParentChildEdge,
  sibling: SiblingEdge,
};

// Layout engine diinjeksi via interface (S-09 AC1): komponen tidak
// mengimpor dagre langsung, semua compute ada di ./layout.
const layoutEngine = dagreTierEngine;

interface ReactFlowFamilyTreeProps {
  members: FamilyMember[];
  onMemberUpdate?: (member: FamilyMember) => void;
  onMemberAdd?: (member: Partial<FamilyMember>) => void;
  onMemberDelete?: (memberId: string) => void;
  /** Plain "Add member" (no relationship context), from the context menu. */
  onAddMember?: () => void;
  /** S-14 U3: id anggota yang wajib dibuat terlihat (expand + fitView). */
  revealMemberId?: string | null;
  /** S-14 U3: dipanggil setelah viewport dipusatkan ke anggota reveal. */
  onMemberRevealed?: () => void;
}

/**
 * Handler interaksi node; komponen menyuntikkan versi stabil (S-09 AC4+AC5).
 */
export interface MemberNodeHandlers {
  onEdit: (member: FamilyMember) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (memberId: string) => void;
  onAddParent: (memberId: string) => void;
  onContextMenuRequest: (memberId: string, x: number, y: number) => void;
}

/**
 * Converts one family member to a React Flow node.
 * Posisi {0,0}: akan diisi layout engine.
 */
const createMemberNode = (
  member: FamilyMember,
  handlers: MemberNodeHandlers
): FamilyMemberFlowNode => ({
  id: member.id,
  type: 'familyMember',
  position: { x: 0, y: 0 }, // Will be set by layout algorithm
  data: {
    member,
    onEdit: handlers.onEdit,
    onAddChild: handlers.onAddChild,
    onAddSpouse: handlers.onAddSpouse,
    onAddParent: handlers.onAddParent,
    onContextMenuRequest: handlers.onContextMenuRequest,
  },
  draggable: true,
});

/**
 * Creates edge hydration specs between family members (S-09 AC4).
 * sources = objek member yang menjadi dasar edge; selama referensinya
 * tidak berubah, edge lama dipakai ulang (tidak dibangun ulang).
 */
const createFamilyEdgeSpecs = (
  members: FamilyMember[]
): HydrationSpec<FamilyMember, Edge>[] => {
  const specs: HydrationSpec<FamilyMember, Edge>[] = [];
  const byId = new Map(members.map((member) => [member.id, member]));
  const siblingsMap = new Map<string, FamilyMember[]>();
  // QA put-1 Temuan-3: dedup edge marriage per pasangan. Kunci = id pasangan
  // terurut leksikografis, menggantikan banding member.id < spouse.id yang
  // gagal saat id baru lebih besar secara leksikografis.
  const marriageSeen = new Set<string>();

  members.forEach((member) => {
    // Create spouse connections (direct horizontal lines), satu edge per pasangan
    const spouseList = member.spouseIds ?? (member.spouseId ? [member.spouseId] : []);
    spouseList.forEach((rawSpouseId) => {
      const spouse = byId.get(rawSpouseId);
      if (!spouse) return;
      const [left, right] = member.id < spouse.id ? [member, spouse] : [spouse, member];
      const pairKey = `${left.id}|${right.id}`;
      if (marriageSeen.has(pairKey)) return;
      marriageSeen.add(pairKey);
      specs.push({
        key: `spouse-${left.id}-${right.id}`,
        sources: [left, right],
        build: () => ({
          id: `spouse-${left.id}-${right.id}`,
          source: left.id,
          target: right.id,
          type: 'marriage', // Uses simplified MarriageEdge
          data: { relationship: 'spouse' },
        }),
      });
    });

    // Create parent-child edges (bracket style)
    if (member.parentIds && member.parentIds.length > 0) {
      member.parentIds.forEach((parentId) => {
        const parent = byId.get(parentId);
        specs.push({
          key: `parent-${parentId}-${member.id}`,
          sources: [member, parent ?? member],
          build: () => ({
            id: `parent-${parentId}-${member.id}`,
            source: parentId,
            target: member.id,
            type: 'parentChild',
            data: { relationship: 'parentChild' },
          }),
        });
      });

      // Group siblings for bracket connections
      const sortedParentIds = [...member.parentIds].sort((a, b) => a.localeCompare(b));
      const parentKey = sortedParentIds.join('-');
      if (!siblingsMap.has(parentKey)) {
        siblingsMap.set(parentKey, []);
      }
      siblingsMap.get(parentKey)?.push(member);
    }
  });

  // Create sibling connections in bracket style
  siblingsMap.forEach((siblings) => {
    if (siblings.length > 1) {
      for (let i = 0; i < siblings.length - 1; i++) {
        const left = siblings[i];
        const right = siblings[i + 1];
        specs.push({
          key: `sibling-${left.id}-${right.id}`,
          sources: [left, right],
          build: () => ({
            id: `sibling-${left.id}-${right.id}`,
            source: left.id,
            target: right.id,
            type: 'sibling',
            data: { relationship: 'sibling' },
          }),
        });
      }
    }
  });

  return specs;
};

type GridPatternType = 'dots' | 'lines' | 'cross';

/**
 * Helper grid murni (S-09 AC5): di-hoist keluar komponen supaya identitas
 * fungsi stabil antar render.
 */
const convertToBackgroundVariant = (pattern: GridPatternType): BackgroundVariant => {
  return pattern as BackgroundVariant;
};

// Grid colors per theme. In dark mode the light-mode grays were far too
// bright against the dark canvas; the dark variants are the same grays
// with luminance reduced ~50% so the grid stays visible but quiet.
const GRID_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: { dots: '#d1d5db', cross: '#e5e7eb', lines: '#e5e7eb' },
  dark: { dots: '#686b6e', cross: '#727375', lines: '#727375' },
};
const MAJOR_GRID_COLOR: Record<'light' | 'dark', string> = {
  light: '#d1d5db',
  dark: '#686b6e',
};

const getGridBackgroundColor = (variant: BackgroundVariant, isDark: boolean): string => {
  const colors = GRID_COLORS[isDark ? 'dark' : 'light'];
  return colors[variant] ?? colors.lines;
};

const getGridGap = (variant: BackgroundVariant): number => {
  return variant === 'lines' ? 25 : 30;
};

const getGridSize = (variant: BackgroundVariant): number => {
  switch (variant) {
    case 'dots':
      return 1;
    case 'cross':
      return 0.5;
    default:
      return 0.5;
  }
};

const ReactFlowFamilyTreeInner: React.FC<ReactFlowFamilyTreeProps> = ({
  members,
  onMemberUpdate,
  onMemberAdd,
  onMemberDelete,
  onAddMember,
  revealMemberId,
  onMemberRevealed,
}) => {
  const { fitView, getNodes, getEdges } = useReactFlow<FamilyMemberFlowNode, Edge>();
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyMemberFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [tiers, setTiers] = useState<TierLayout[]>([]);
  const [gridType, setGridType] = useState<GridPatternType>('lines');
  const [showGrid, setShowGrid] = useState(true);
  const [generationLimitState, setGenerationLimitState] = useState<GenerationLimitState>(
    DEFAULT_GENERATION_LIMIT_STATE
  );
  const { t } = useTranslation(['canvas', 'common']);
  const isDark = useDarkMode();
  const { editMode } = useFamilyStore();
  const linkExistingMembers = useFamilyStore((s) => s.linkExistingMembers);

  // Top-right action row: Add Member only in edit mode, Statistics in a
  // popup (the old side panel is gone), Tree Settings in a gear dropdown
  // holding the layout/grid controls, then Export and Import (right-aligned
  // so their menus stay on-screen).
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Right-click context menu: one instance rendered by the tree, anchored
  // at the cursor. Nodes only report the request (no per-node menus).
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Deletion confirmations are in-app dialogs, not window.confirm.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Add spouse/child/parent: pick an existing member to link or create a
  // new one (the original flow).
  const [chooserIntent, setChooserIntent] = useState<{
    kind: 'spouse' | 'child' | 'parent';
    targetMemberId: string;
  } | null>(null);

  // Programmatic triggers for the import file picker and the export
  // dropdown (the context menu's Import/Export items drive them).
  const importTriggerRef = useRef<(() => void) | null>(null);
  const exportTriggerRef = useRef<(() => void) | null>(null);

  // Transient error toast for failed relationship links (drag or chooser).
  const [linkError, setLinkError] = useState<string | null>(null);

  // S-09 AC2: batas generasi (pure function, default-on)
  const generationLimit = useMemo(
    () => applyGenerationLimit(members, generationLimitState),
    [members, generationLimitState]
  );
  const visibleMembers = generationLimit.visibleMembers;
  // S-09 AC7: rentang generasi total untuk label batas (satuan generasi,
  // bukan jumlah individu).
  const totalGenerations = useMemo(
    () => countGenerationSpan(members),
    [members]
  );

  // S-09 AC2: kontrol cabang; ekspansi penuh lewat konfirmasi i18n.
  const handleExpandBranch = useCallback((memberId: string) => {
    setGenerationLimitState((state) => expandBranch(state, memberId));
  }, []);
  const handleCollapseGenerations = useCallback(() => {
    setGenerationLimitState((state) => collapseToDefaultLimit(state));
  }, []);
  const handleExpandAllGenerations = useCallback(() => {
    if (window.confirm(t('generations.expandAllWarning', { count: members.length }))) {
      setGenerationLimitState((state) => expandAllGenerations(state));
    }
  }, [t, members.length]);

  // S-09 AC5: handler interaksi hoist + delegasi ref. Node yang dipakai
  // ulang oleh cache hidrasi memanggil handler lewat actionsRef, jadi
  // tidak ada closure basi saat prop onMemberAdd/onMemberDelete berganti.
  const membersRef = useRef(new Map<string, FamilyMember>());
  membersRef.current = new Map(members.map((member) => [member.id, member]));

  // Right-click opens the single tree-level menu, clamped to the viewport
  // so it is never cut off when the cursor is near an edge.
  const openContextMenu = useCallback((memberId: string, x: number, y: number) => {
    const menuWidth = 208; // w-52
    const menuHeight = 336; // ~7 items + 2 separators, generous margin
    setContextMenu({
      nodeId: memberId,
      x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });
  }, []);

  const actionsRef = useRef<MemberNodeHandlers>({
    onEdit: setEditingMember,
    onAddChild: () => undefined,
    onAddSpouse: () => undefined,
    onAddParent: () => undefined,
    onContextMenuRequest: () => undefined,
  });
  actionsRef.current = {
    onEdit: setEditingMember,
    // Add child/spouse/parent now offer "link an existing member" first and
    // fall back to the original create-new flow (RelationshipChooserModal).
    onAddChild: (memberId) => setChooserIntent({ kind: 'child', targetMemberId: memberId }),
    onAddSpouse: (memberId) => setChooserIntent({ kind: 'spouse', targetMemberId: memberId }),
    onAddParent: (memberId) => setChooserIntent({ kind: 'parent', targetMemberId: memberId }),
    onContextMenuRequest: openContextMenu,
  };

  // Factory node stabil: hanya bergantung handler expand yang useCallback.
  const buildMemberNode = useCallback(
    (member: FamilyMember, hiddenDescendantCount: number | undefined) => {
      const base = createMemberNode(member, {
        onEdit: (m) => actionsRef.current.onEdit(m),
        onAddChild: (id) => actionsRef.current.onAddChild(id),
        onAddSpouse: (id) => actionsRef.current.onAddSpouse(id),
        onAddParent: (id) => actionsRef.current.onAddParent(id),
        onContextMenuRequest: (id, x, y) => actionsRef.current.onContextMenuRequest(id, x, y),
      });
      return {
        ...base,
        data: {
          ...base.data,
          onExpandBranch: handleExpandBranch,
          hiddenDescendantCount,
        },
      };
    },
    [handleExpandBranch]
  );

  // S-09 AC4: konstruksi nodes/edges memo per lingkup generasi dengan
  // cache referensi; expand satu cabang hanya membangun node baru pada
  // cabang itu, node lama dipakai ulang dengan referensi identik.
  const nodesCacheRef = useRef<Map<string, StableHydrationEntry<FamilyMember | number, FamilyMemberFlowNode>>>(
    new Map()
  );
  const edgesCacheRef = useRef<Map<string, StableHydrationEntry<FamilyMember, Edge>>>(
    new Map()
  );

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodeSpecs: HydrationSpec<FamilyMember | number, FamilyMemberFlowNode>[] = [];
    const byGeneration = groupMembersByGeneration(visibleMembers);
    for (const generationMembers of byGeneration.values()) {
      for (const member of generationMembers) {
        const hiddenCount = generationLimit.hiddenDescendantCounts.get(member.id);
        nodeSpecs.push({
          key: member.id,
          sources: [member, hiddenCount ?? 0],
          build: () => buildMemberNode(member, hiddenCount),
        });
      }
    }
    const hydratedNodes = hydrateStableByKey(nodesCacheRef.current, nodeSpecs);
    nodesCacheRef.current = hydratedNodes.cache;

    const edgeSpecs = createFamilyEdgeSpecs(visibleMembers);
    const hydratedEdges = hydrateStableByKey(edgesCacheRef.current, edgeSpecs);
    edgesCacheRef.current = hydratedEdges.cache;

    return {
      initialNodes: hydratedNodes.values,
      initialEdges: hydratedEdges.values,
    };
  }, [visibleMembers, generationLimit, buildMemberNode]);

  // Apply tier layout when members change
  useEffect(() => {
    // Semua algoritma layout (tier TB / dagre LR) berada di engine.
    const result = layoutEngine.layout(initialNodes, initialEdges, {
      direction: layoutDirection,
    });

    setNodes(result.nodes);
    setEdges(layoutDirection === 'TB' ? initialEdges : result.edges);
    setTiers(result.tiers);

    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [initialNodes, initialEdges, layoutDirection, setNodes, setEdges, fitView]);

  // S-14 U3: anggota baru wajib terlihat pasca simpan. Bila id berada di
  // luar jendela generasi, buka cabang leluhurnya; begitu nodenya sudah
  // ada di canvas, pusatkan viewport ke node itu (delay 220ms agar
  // mengalahkan fitView generik pasca-layout).
  useEffect(() => {
    if (!revealMemberId) return;
    if (!membersRef.current.has(revealMemberId)) return;
    if (!visibleMembers.some((m) => m.id === revealMemberId)) {
      const member = membersRef.current.get(revealMemberId);
      const parentId =
        member?.parentIds && member.parentIds.length > 0 ? member.parentIds[0] : undefined;
      setGenerationLimitState((state) =>
        parentId ? expandBranch(state, parentId) : expandAllGenerations(state)
      );
      return;
    }
    const node = nodes.find((n) => n.id === revealMemberId);
    if (node) {
      const targetId = revealMemberId;
      const timer = setTimeout(() => {
        fitView({ nodes: [{ id: targetId }], padding: 0.35, duration: 400, maxZoom: 1.25 });
        onMemberRevealed?.();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [revealMemberId, visibleMembers, nodes, fitView, onMemberRevealed]);

  // Context menu close rules: left-click (pointer-down) outside the menu,
  // right-click anywhere (a right-click on another card is captured by that
  // node's own handler first, which re-opens the menu there), and Escape.
  useEffect(() => {
    if (!contextMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const menu = contextMenuRef.current;
      if (menu && event.target instanceof globalThis.Node && menu.contains(event.target)) return;
      setContextMenu(null);
    };
    const onContextMenu = (event: MouseEvent) => {
      const menu = contextMenuRef.current;
      if (menu && event.target instanceof globalThis.Node && menu.contains(event.target)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  // The in-app delete dialog closes on Escape.
  useEffect(() => {
    if (!pendingDeleteId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDeleteId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingDeleteId]);

  // Failed-link toast clears itself.
  useEffect(() => {
    if (!linkError) return;
    const timer = setTimeout(() => setLinkError(null), 4000);
    return () => clearTimeout(timer);
  }, [linkError]);

  // Custom node change handler to constrain movement
  const handleNodesChange = useCallback((changes: NodeChange<FamilyMemberFlowNode>[]) => {
    if (layoutDirection === 'TB' && tiers.length > 0) {
      const constrainedChanges = changes.map(change => {
        if (change.type === 'position' && 'position' in change && change.position) {
          const constrainedPosition = constrainNodeMovement(
            change.id,
            change.position,
            tiers
          );
          return {
            ...change,
            position: constrainedPosition
          };
        }
        return change;
      });
      onNodesChange(constrainedChanges);
    } else {
      onNodesChange(changes);
    }
  }, [onNodesChange, layoutDirection, tiers]);

  // A dragged connection is a real, persisted relationship — not just a
  // visual edge that disappears on the next re-layout. Side (left/right)
  // handles or a same-generation drop link the pair as spouses; a vertical
  // drop links them parent -> child by generation order. The store aligns
  // the related member's generation and re-fetches the tree.
  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params;
      if (!source || !target || source === target) return;

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return;

      const sourceMember = sourceNode.data.member;
      const targetMember = targetNode.data.member;
      const viaSideHandle =
        params.sourceHandle === 'left' ||
        params.sourceHandle === 'right' ||
        params.targetHandle === 'left' ||
        params.targetHandle === 'right';

      let memberId: string;
      let relatedId: string;
      let direction: 'spouse' | 'parent';

      if (viaSideHandle || sourceMember.generation === targetMember.generation) {
        // Horizontal link between two same-tier people: spouse.
        memberId = source;
        relatedId = target;
        direction = 'spouse';
      } else if (sourceMember.generation > targetMember.generation) {
        // Vertical link, source is the lower generation: source is the child.
        memberId = source; // child
        relatedId = target; // parent
        direction = 'parent';
      } else {
        // Vertical link, target is the lower generation: target is the child.
        memberId = target; // child
        relatedId = source; // parent
        direction = 'parent';
      }

      setLinkError(null);
      linkExistingMembers(memberId, relatedId, direction).catch((err) => {
        setLinkError(
          err instanceof Error ? err.message : t('common:relationshipChooser.error')
        );
      });
    },
    [nodes, linkExistingMembers, t]
  );

  // Chooser: link an existing member to the relationship. `direction` is
  // relative to the target member (the one the relationship is added for).
  const handleLinkExisting = useCallback(
    async (relatedMemberId: string): Promise<boolean> => {
      if (!chooserIntent) return false;
      const { kind, targetMemberId } = chooserIntent;
      try {
        if (kind === 'spouse') {
          await linkExistingMembers(targetMemberId, relatedMemberId, 'spouse');
        } else if (kind === 'child') {
          await linkExistingMembers(targetMemberId, relatedMemberId, 'child');
        } else {
          await linkExistingMembers(targetMemberId, relatedMemberId, 'parent');
        }
        setLinkError(null);
        setChooserIntent(null);
        return true;
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : t('common:relationshipChooser.error'));
        return false;
      }
    },
    [chooserIntent, linkExistingMembers, t]
  );

  // Chooser: "create a new member instead" hands the relationship context
  // back to the host, which opens the original add-member flow.
  const handleCreateNew = useCallback(() => {
    if (!chooserIntent) return;
    const target = membersRef.current.get(chooserIntent.targetMemberId);
    setChooserIntent(null);
    if (!onMemberAdd) return;
    if (chooserIntent.kind === 'child') {
      onMemberAdd({
        parentIds: [chooserIntent.targetMemberId],
        generation: (target?.generation ?? 0) + 1,
      });
    } else if (chooserIntent.kind === 'spouse') {
      onMemberAdd({
        spouseId: chooserIntent.targetMemberId,
        generation: target?.generation ?? 0,
      });
    } else {
      // New parent: the 'parentId' marker maps to the father relationship
      // context in ReactFlowTreeView (parent relationship type, gen - 1).
      onMemberAdd({
        parentId: chooserIntent.targetMemberId,
        generation: Math.max(1, (target?.generation ?? 1) - 1),
      });
    }
  }, [chooserIntent, onMemberAdd]);

  const handleLayoutChange = useCallback((direction: 'TB' | 'LR') => {
    setLayoutDirection(direction);
  }, []);

  const handleAutoLayout = useCallback(() => {
    const result = layoutEngine.layout(getNodes(), getEdges(), {
      direction: layoutDirection,
    });

    setNodes(result.nodes);
    setEdges(layoutDirection === 'TB' ? getEdges() : result.edges);
    setTiers(result.tiers);

    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [getNodes, getEdges, layoutDirection, setNodes, setEdges, fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 800 });
  }, [fitView]);

  // Members referenced by open dialogs/menus; undefined hides the UI when
  // the member is deleted or the tree is swapped underneath.
  const contextMember = contextMenu
    ? members.find((m) => m.id === contextMenu.nodeId)
    : undefined;
  const pendingDeleteMember = pendingDeleteId
    ? members.find((m) => m.id === pendingDeleteId)
    : undefined;
  const chooserTargetMember = chooserIntent
    ? members.find((m) => m.id === chooserIntent.targetMemberId)
    : undefined;

  return (
    <div className="w-full h-full relative">
      <ReactFlow<FamilyMemberFlowNode>
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition={undefined} // Remove React Flow attribution
        className="bg-gray-50 dark:bg-gray-800"
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        snapToGrid={getSnapGrid(layoutDirection).snapToGrid}
        snapGrid={getSnapGrid(layoutDirection).snapGrid}
        onlyRenderVisibleElements={shouldOnlyRenderVisibleElements(nodes.length)}
        proOptions={{
          hideAttribution: true // Hide React Flow attribution if using Pro
        }}
      >
        {/* Enhanced Background with softer grid pattern */}
        {showGrid && (
          <Background 
            variant={convertToBackgroundVariant(gridType)}
            gap={getGridGap(convertToBackgroundVariant(gridType))}
            size={getGridSize(convertToBackgroundVariant(gridType))}
            color={getGridBackgroundColor(convertToBackgroundVariant(gridType), isDark)}
            style={{
              // Transparent: the ReactFlow div itself carries the themed
              // background (bg-gray-50 / dark:bg-gray-800), so the canvas
              // follows the light/dark theme.
              backgroundColor: 'transparent',
              opacity: 0.4,
            }}
          />
        )}
        
        {/* Major grid lines - much softer with adjusted spacing */}
        {showGrid && gridType === 'lines' && (
          <Background 
            variant={convertToBackgroundVariant('lines')}
            gap={125}
            size={1}
            color={MAJOR_GRID_COLOR[isDark ? 'dark' : 'light']}
            offset={0}
            style={{
              opacity: 0.15,
            }}
          />
        )}

        {/* Controls for zoom, fit view, etc. */}
        <Controls 
          position="bottom-right"
          showInteractive={false}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg"
        />

        {/* Minimap for navigation */}
        <MiniMap
          position="bottom-left"
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg"
          nodeColor={(node) => {
            const member = node.data?.member as FamilyMember;
            if (!member) return '#e5e7eb';
            return member.gender === 'male' ? '#3b82f6' : '#ec4899';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable
          zoomable
        />

        {/*
          Top control bar (right-aligned): Add Member (edit mode only),
          Statistics (popup), Tree Settings (gear dropdown with the layout
          and grid controls), then Export and Import. The row extends to
          the left from the right edge, so the export/import dropdowns
          (anchored right-0) always stay fully on-screen.
        */}
        <Panel position="top-right" className="flex items-center gap-2">
          {editMode && (
            <button
              type="button"
              onClick={() => onAddMember?.()}
              className="flex items-center space-x-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              data-testid="tree-add-member"
            >
              <Plus className="w-4 h-4" />
              <span>{t('common:treeView.addMember')}</span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStats((open) => !open)}
              className="flex items-center space-x-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={showStats}
              aria-haspopup="dialog"
              data-testid="tree-stats-button"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t('common:treeView.statistics')}</span>
            </button>
            {showStats && <StatsPopup onClosed={() => setShowStats(false)} />}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettings((open) => !open)}
              className="flex items-center space-x-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={showSettings}
              aria-haspopup="true"
              title={t('common:treeView.treeSettings')}
              data-testid="tree-settings-button"
            >
              <Settings className="w-4 h-4" />
              <span>{t('common:treeView.treeSettings')}</span>
            </button>
            {showSettings && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-transparent border-none outline-hidden cursor-default"
                  onClick={() => setShowSettings(false)}
                  aria-label={t('common:treeView.closeTreeSettings')}
                  tabIndex={-1}
                />
                <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg">
                  <FamilyTreeControls
                    embedded
                    onLayoutChange={handleLayoutChange}
                    onAutoLayout={handleAutoLayout}
                    onFitView={handleFitView}
                    currentLayout={layoutDirection}
                    gridType={convertToBackgroundVariant(gridType)}
                    showGrid={showGrid}
                    onGridTypeChange={(type: BackgroundVariant) => {
                      setGridType(type as GridPatternType);
                    }}
                    onGridToggle={setShowGrid}
                  />
                </div>
              </>
            )}
          </div>

          <ExportControls openTriggerRef={exportTriggerRef} />
          <ImportControls openTriggerRef={importTriggerRef} />
        </Panel>

        {/* Tier indicators for vertical layout */}
        {layoutDirection === 'TB' && tiers.length > 0 && (
          <Panel position="top-center" className="pointer-events-none">
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-white/80 px-2 py-1 rounded">
              {t('generations.tierIndicator', { count: tiers.length })}
            </div>
          </Panel>
        )}

        {/* S-09 AC2: kontrol batas generasi */}
        {(generationLimitState.fullExpand ||
          generationLimitState.expandedBranches.size > 0 ||
          generationLimit.hiddenDescendantCounts.size > 0) && (
          <Panel position="top-center" className="mt-10">
            <div className="flex items-center gap-2 text-xs bg-white/90 border border-gray-200 dark:border-gray-800 px-2 py-1 rounded">
              <span className="text-gray-600 dark:text-gray-400">
                {generationLimitState.fullExpand
                  ? t('generations.expandAll')
                  : t('generations.limitNotice', {
                      shown: generationLimitState.maxGenerations,
                      total: totalGenerations,
                    })}
              </span>
              {!generationLimitState.fullExpand && (
                <button
                  type="button"
                  className="px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleExpandAllGenerations}
                >
                  {t('generations.expandAll')}
                </button>
              )}
              {(generationLimitState.fullExpand ||
                generationLimitState.expandedBranches.size > 0) && (
                <button
                  type="button"
                  className="px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={handleCollapseGenerations}
                >
                  {t('generations.collapse')}
                </button>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Edit Member Modal */}
      {editingMember && (
        <MemberEditModal
          member={editingMember}
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          onSave={(updatedMember) => {
            if (onMemberUpdate) {
              onMemberUpdate(updatedMember);
            }
            setEditingMember(null);
          }}
        />
      )}

      {/* Right-click context menu: one instance per tree, fixed at the
          (clamped) cursor position. Members may vanish between open and
          render, so guard on the lookup. */}
      {contextMenu && contextMember && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={t('contextMenu.title', { name: contextMember.name })}
          className="fixed z-50 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="node-context-menu"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              setEditingMember(contextMember);
            }}
          >
            <Pencil className="w-4 h-4" />
            <span>{t('node.editProfile')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              setChooserIntent({ kind: 'child', targetMemberId: contextMember.id });
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('node.addChild')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              setChooserIntent({ kind: 'spouse', targetMemberId: contextMember.id });
            }}
          >
            <Heart className="w-4 h-4" />
            <span>{t('node.addSpouse')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              setChooserIntent({ kind: 'parent', targetMemberId: contextMember.id });
            }}
          >
            <UserRoundPlus className="w-4 h-4" />
            <span>{t('node.addParent')}</span>
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-800" />
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              onAddMember?.();
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{t('contextMenu.addMember')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              importTriggerRef.current?.();
            }}
          >
            <Upload className="w-4 h-4" />
            <span>{t('contextMenu.import')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              exportTriggerRef.current?.();
            }}
          >
            <Download className="w-4 h-4" />
            <span>{t('contextMenu.export')}</span>
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-800" />
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
            onClick={() => {
              setContextMenu(null);
              setPendingDeleteId(contextMember.id);
            }}
            data-testid="context-menu-delete"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('node.delete')}</span>
          </button>
        </div>
      )}

      {/* Deletion confirmation: in-app alert dialog, not window.confirm. */}
      {pendingDeleteMember && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-member-title"
          aria-describedby="delete-member-desc"
          data-testid="delete-member-dialog"
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h2
                    id="delete-member-title"
                    className="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    {t('node.deleteTitle')}
                  </h2>
                  <p
                    id="delete-member-desc"
                    className="mt-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    {t('node.confirmDelete')}{' '}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pendingDeleteMember.name}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPendingDeleteId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="delete-member-cancel"
                >
                  {t('node.deleteCancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = pendingDeleteMember.id;
                    setPendingDeleteId(null);
                    onMemberDelete?.(id);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  data-testid="delete-member-confirm"
                >
                  {t('node.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add spouse/child/parent: link an existing member or create new. */}
      {chooserIntent && chooserTargetMember && (
        <RelationshipChooserModal
          kind={chooserIntent.kind}
          targetMember={chooserTargetMember}
          members={members}
          onClose={() => setChooserIntent(null)}
          onCreateNew={handleCreateNew}
          onLinkExisting={handleLinkExisting}
        />
      )}

      {/* Transient error for failed relationship links. */}
      {linkError && (
        <div
          role="alert"
          data-testid="link-error"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg"
        >
          {linkError}
        </div>
      )}
    </div>
  );
};

export const ReactFlowFamilyTree: React.FC<ReactFlowFamilyTreeProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ReactFlowFamilyTreeInner {...props} />
    </ReactFlowProvider>
  );
};