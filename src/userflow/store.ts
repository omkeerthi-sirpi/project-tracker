import { create } from 'zustand';
import type { ChangeStatus, FlowKind, NotificationType } from './types';
import { buildIndex, KINDS, NOTIF_TYPES, STATUSES, type Filters, type FlowIndex } from './model';
import { fromProject } from './adapter';
import { useStore } from '../store';

interface FlowState {
  index: FlowIndex;
  expanded: Record<string, boolean>;
  selected: string | null;
  query: string;
  filters: Filters;
  /** Bumped to ask the canvas to fit the view after the layout settles. */
  fitToken: number;
  /** Node to centre on after the layout settles. */
  centerOn: string | null;

  select(id: string | null): void;
  /** `open` is what the canvas currently shows (it may be open because of a filter or search). */
  toggle(id: string, open: boolean): void;
  reveal(id: string): void;
  expandAll(): void;
  collapseAll(): void;
  setQuery(q: string): void;
  setPersona(id: string): void;
  toggleIn<K extends 'kinds' | 'statuses' | 'notifTypes'>(key: K, v: K extends 'kinds' ? FlowKind : K extends 'statuses' ? ChangeStatus : NotificationType): void;
  setOnly<K extends 'statuses' | 'notifTypes'>(key: K, v: K extends 'statuses' ? ChangeStatus : NotificationType): void;
  resetFilters(): void;
  fit(): void;
}

const allFilters = (): Filters => ({ persona: '', kinds: new Set(KINDS), statuses: new Set(STATUSES), notifTypes: new Set(NOTIF_TYPES) });

/** Drop explicit "collapsed" choices so a new filter can open the paths to its matches. */
const withoutCollapsed = (ex: Record<string, boolean>) => Object.fromEntries(Object.entries(ex).filter(([, v]) => v));

/** The tree always reflects the project data as of the release picked in the top bar. */
function currentIndex() {
  const { data, releaseId } = useStore.getState();
  return buildIndex(fromProject(data, releaseId));
}

export const useFlow = create<FlowState>()((set, get) => ({
  index: currentIndex(),
  expanded: {},
  selected: null,
  query: '',
  filters: allFilters(),
  fitToken: 0,
  centerOn: null,

  select: (selected) => set({ selected }),
  toggle: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: !open } })),
  reveal: (id) => {
    const { index, expanded, filters } = get();
    const it = index.items.get(id);
    if (!it) return;
    const ex = { ...expanded };
    for (let cur = it.parentId; cur; cur = index.items.get(cur)?.parentId) ex[cur] = true;
    const persona = filters.persona && filters.persona !== it.personaId ? '' : filters.persona;
    set({ expanded: ex, selected: id, centerOn: id, filters: { ...filters, persona } });
  },
  expandAll: () =>
    set((s) => {
      const ex: Record<string, boolean> = {};
      for (const it of s.index.items.values()) if (it.children.length) ex[it.id] = true;
      return { expanded: ex, fitToken: s.fitToken + 1 };
    }),
  collapseAll: () =>
    set((s) => {
      const ex: Record<string, boolean> = {};
      for (const it of s.index.items.values()) if (it.children.length) ex[it.id] = false;
      return { expanded: ex, selected: null, fitToken: s.fitToken + 1 };
    }),
  setQuery: (query) => set((s) => ({ query, expanded: withoutCollapsed(s.expanded) })),
  setPersona: (persona) => set((s) => ({ filters: { ...s.filters, persona }, selected: null, fitToken: s.fitToken + 1 })),
  toggleIn: (key, v) =>
    set((s) => {
      const next = new Set(s.filters[key] as Set<string>);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      if (!next.size) return {}; // never filter everything away
      return { filters: { ...s.filters, [key]: next }, expanded: withoutCollapsed(s.expanded), fitToken: s.fitToken + 1 };
    }),
  setOnly: (key, v) =>
    set((s) => {
      const cur = s.filters[key] as Set<string>;
      const all = key === 'statuses' ? STATUSES : NOTIF_TYPES;
      // Clicking the only selected value again goes back to "all".
      const next = cur.size === 1 && cur.has(v) ? new Set<string>(all) : new Set<string>([v]);
      return { filters: { ...s.filters, [key]: next }, expanded: withoutCollapsed(s.expanded), fitToken: s.fitToken + 1 };
    }),
  resetFilters: () => set((s) => ({ filters: allFilters(), expanded: {}, fitToken: s.fitToken + 1 })),
  fit: () => set((s) => ({ fitToken: s.fitToken + 1 })),
}));

useStore.subscribe((s, prev) => {
  if (s.data !== prev.data || s.releaseId !== prev.releaseId) useFlow.setState({ index: currentIndex() });
});

/** Switch to the User flow tab and jump to an item (persona, workflow, screen or notification id). */
export function openInFlow(id: string) {
  useStore.getState().patch({ view: 'userflow', selection: null });
  useFlow.getState().reveal(id);
}
