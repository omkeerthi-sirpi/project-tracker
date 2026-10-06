import type { ChangeStatus, FlowData, FlowKind, NotificationType, ScreenVersionInfo } from './types';

/** Flat view of one tree item, used by the graph, search, tooltip and details panel. */
export interface FlowItem {
  id: string;
  kind: FlowKind;
  name: string;
  status: ChangeStatus;
  description?: string;
  changes?: string[];
  lastModified: string;
  modifiedBy?: string;
  personaId: string;
  color: string;
  parentId?: string;
  children: string[];
  notifType?: NotificationType;
  imageId?: string;
  versions?: ScreenVersionInfo[];
  /** Notifications anywhere below (or 1 for a notification itself). */
  notifCount: number;
  /** Changed (non-unchanged) items anywhere below, excluding itself. */
  changedBelow: number;
}

export interface FlowIndex {
  items: Map<string, FlowItem>;
  roots: string[];
}

export const KINDS: FlowKind[] = ['persona', 'workflow', 'screen', 'notification'];
export const STATUSES: ChangeStatus[] = ['new', 'modified', 'unchanged', 'deprecated'];
export const NOTIF_TYPES: NotificationType[] = ['success', 'warning', 'error', 'info'];

export const STATUS_LABEL: Record<ChangeStatus, string> = { new: 'New', modified: 'Modified', unchanged: 'Existing', deprecated: 'Deprecated' };
export const KIND_LABEL: Record<FlowKind, string> = { persona: 'Persona', workflow: 'Workflow', screen: 'Screen', notification: 'Notification' };
export const CHILD_LABEL: Record<FlowKind, string> = { persona: 'workflow', workflow: 'screen', screen: 'notification', notification: '' };

export function buildIndex(d: FlowData): FlowIndex {
  const items = new Map<string, FlowItem>();
  const add = (it: Omit<FlowItem, 'notifCount' | 'changedBelow'>) => items.set(it.id, { ...it, notifCount: 0, changedBelow: 0 });
  for (const p of d.personas) {
    const base = { personaId: p.id, color: p.color };
    add({ ...base, id: p.id, kind: 'persona', name: p.name, status: p.status, description: p.description, changes: p.changes,
      lastModified: p.lastModified, modifiedBy: p.modifiedBy, children: p.workflows.map((w) => w.id) });
    for (const w of p.workflows) {
      add({ ...base, id: w.id, kind: 'workflow', name: w.name, status: w.status, description: w.description, changes: w.changes,
        lastModified: w.lastModified, modifiedBy: w.modifiedBy, parentId: p.id, children: w.screens.map((s) => s.id) });
      for (const s of w.screens) {
        add({ ...base, id: s.id, kind: 'screen', name: s.name, status: s.status, description: s.description, changes: s.changes,
          lastModified: s.lastModified, modifiedBy: s.modifiedBy, parentId: w.id, children: s.notifications.map((n) => n.id),
          imageId: s.imageId, versions: s.versions });
        for (const n of s.notifications)
          add({ ...base, id: n.id, kind: 'notification', name: n.message, status: n.status, description: n.description, changes: n.changes,
            lastModified: n.lastModified, modifiedBy: n.modifiedBy, parentId: s.id, children: [], notifType: n.type });
      }
    }
  }
  // Roll counts up the tree (children always follow their parent in insertion order, so walk backwards).
  for (const it of [...items.values()].reverse()) {
    if (it.kind === 'notification') it.notifCount = 1;
    const parent = it.parentId ? items.get(it.parentId) : undefined;
    if (!parent) continue;
    parent.notifCount += it.notifCount;
    parent.changedBelow += it.changedBelow + (it.status !== 'unchanged' ? 1 : 0);
  }
  return { items, roots: d.personas.map((p) => p.id) };
}

export function ancestors(ix: FlowIndex, id: string): string[] {
  const out: string[] = [];
  let cur = ix.items.get(id)?.parentId;
  while (cur) {
    out.unshift(cur);
    cur = ix.items.get(cur)?.parentId;
  }
  return out;
}

export function descendants(ix: FlowIndex, id: string, out: string[] = []): string[] {
  for (const c of ix.items.get(id)?.children ?? []) {
    out.push(c);
    descendants(ix, c, out);
  }
  return out;
}

export interface Filters {
  persona: string; // '' = all
  kinds: Set<FlowKind>;
  statuses: Set<ChangeStatus>;
  notifTypes: Set<NotificationType>;
}

export const statusFilterOn = (f: Filters) => f.statuses.size !== STATUSES.length;
export const notifFilterOn = (f: Filters) => f.notifTypes.size !== NOTIF_TYPES.length;

export function search(ix: FlowIndex, q: string, persona: string): string[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const out: string[] = [];
  for (const it of ix.items.values())
    if ((!persona || it.personaId === persona) && it.name.toLowerCase().includes(t)) out.push(it.id);
  // Exact and prefix matches first, then by hierarchy level.
  const score = (id: string) => {
    const n = ix.items.get(id)!.name.toLowerCase();
    return (n === t ? 0 : n.startsWith(t) ? 1 : 2) * 10 + KINDS.indexOf(ix.items.get(id)!.kind);
  };
  return out.sort((a, b) => score(a) - score(b));
}

export interface Visible {
  /** Item ids to draw, in tree order. */
  ids: string[];
  /** [parent, child] between visible items; a hidden type is skipped over. */
  edges: [string, string][];
  /** Whether the item is currently showing its children. */
  open: Set<string>;
  /** Items shown only as the path to a filter match. */
  context: Set<string>;
}

/**
 * Decides what is on the canvas.
 * - expand/collapse: `expanded` holds explicit user choices.
 * - status / notification-type filters: only matches and their ancestors stay; paths to matches open on their own
 *   unless the user explicitly collapsed them.
 * - search: paths to the matches open so every hit is visible (an explicit collapse still wins).
 * - type filter: a hidden level is "transparent" — its children attach to the nearest visible ancestor.
 */
export function visibleTree(ix: FlowIndex, f: Filters, expanded: Record<string, boolean>, searchHits: string[]): Visible {
  const filtering = statusFilterOn(f) || notifFilterOn(f);
  const keep = new Set<string>();
  const forced = new Set<string>();
  const matches = new Set<string>();
  if (filtering) {
    for (const it of ix.items.values()) {
      if (f.persona && it.personaId !== f.persona) continue;
      if (!f.statuses.has(it.status)) continue;
      if (notifFilterOn(f) && (it.kind !== 'notification' || !f.notifTypes.has(it.notifType!))) continue;
      matches.add(it.id);
      keep.add(it.id);
      for (const a of ancestors(ix, it.id)) {
        keep.add(a);
        forced.add(a);
      }
    }
  }
  const reveal = new Set(searchHits.flatMap((id) => ancestors(ix, id)));

  const out: Visible = { ids: [], edges: [], open: new Set(), context: new Set() };
  const visit = (id: string, parent?: string) => {
    const it = ix.items.get(id)!;
    if (filtering && !keep.has(id)) return;
    const shown = f.kinds.has(it.kind);
    if (shown) {
      out.ids.push(id);
      if (parent) out.edges.push([parent, id]);
      if (filtering && !matches.has(id)) out.context.add(id);
    }
    // Personas start open so the first view shows every persona's workflows.
    const open = !shown || (expanded[id] ?? (it.kind === 'persona' || reveal.has(id) || forced.has(id)));
    if (!open || !it.children.length) return;
    if (shown) out.open.add(id);
    for (const c of it.children) visit(c, shown ? id : parent);
  };
  for (const r of ix.roots) if (!f.persona || r === f.persona) visit(r);
  return out;
}

/** Selected node + its ancestors + all of its visible descendants. */
export function focusSet(ix: FlowIndex, selected: string | null, hits: string[]): Set<string> | null {
  if (selected && ix.items.has(selected)) return new Set([selected, ...ancestors(ix, selected), ...descendants(ix, selected)]);
  if (hits.length) return new Set(hits.flatMap((id) => [id, ...ancestors(ix, id)]));
  return null;
}
