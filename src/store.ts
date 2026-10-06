import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import type { ID, ProjectData, ProjectMeta, Selection } from './types';
import { deleteImage } from './lib/images';
import { createSeed } from './lib/seed';
import { today, uid } from './lib/util';

export type View = 'board' | 'userflow' | 'changelog';

export interface Lightbox {
  imageId?: string;
  title: string;
  color: string;
}

interface UI {
  releaseId: ID;
  selection: Selection | null;
  view: View;
  boardPersonaId: ID;
  lightbox: Lightbox | null;
}

interface State extends UI {
  /** All projects, shown on the dashboard. */
  projects: ProjectMeta[];
  /** False until the project list has been read from storage. */
  ready: boolean;
  /** Open project, or null when the dashboard is showing. */
  projectId: ID | null;
  data: ProjectData;
  /** True once the open project's data is in memory. */
  loaded: boolean;
  init(projectId: ID, d: ProjectData): void;
  mut(fn: (d: Draft<ProjectData>) => void): void;
  patch(p: Partial<UI>): void;
  select(s: Selection | null): void;
}

const empty: ProjectData = { name: '', releases: [], personas: [], workflows: [], screens: [], notifications: [], changeRequests: [] };

export const useStore = create<State>()((set) => ({
  projects: [],
  ready: false,
  projectId: null,
  data: empty,
  loaded: false,
  releaseId: '',
  selection: null,
  view: 'board',
  boardPersonaId: '',
  lightbox: null,

  init: (projectId, raw) => {
    // Older saves predate the CR inbox.
    const data = { ...raw, changeRequests: raw.changeRequests ?? [] };
    set({
      projectId, data, loaded: true, view: 'board', selection: null, lightbox: null,
      releaseId: data.releases.at(-1)?.id ?? '', boardPersonaId: data.personas[0]?.id ?? '',
    });
  },
  mut: (fn) =>
    set((s) => ({
      data: produce(s.data, (d) => {
        fn(d);
        d.releases.sort((a, b) => a.date.localeCompare(b.date));
      }),
    })),
  patch: (p) => set(p),
  select: (selection) => set({ selection }),
}));

// ---------- persistence: a project registry + one data record per project ----------

const REGISTRY_KEY = 'flow-tracker:projects';
const dataKey = (id: ID) => `flow-tracker:project:${id}`;
/** Where the single-project version of the app kept its data; migrated into the "cmp" project once. */
const LEGACY_KEY = 'cmp-flow-tracker:data';

export const loadProjectData = (id: ID) => idbGet<ProjectData>(dataKey(id));

const saveRegistry = (projects: ProjectMeta[]) => {
  useStore.setState({ projects });
  return idbSet(REGISTRY_KEY, projects);
};

const touch = (id: ID) =>
  saveRegistry(useStore.getState().projects.map((p) => (p.id === id ? { ...p, updatedAt: new Date().toISOString() } : p)));

let pending: { id: ID; data: ProjectData; timer: ReturnType<typeof setTimeout> } | null = null;
async function flush() {
  if (!pending) return;
  const { id, data, timer } = pending;
  clearTimeout(timer);
  pending = null;
  await idbSet(dataKey(id), data);
  await touch(id);
}

async function loadRegistry() {
  let projects = await idbGet<ProjectMeta[]>(REGISTRY_KEY);
  if (!projects) {
    // First run of the multi-project version: keep the existing CMP data (or the demo) as the first project.
    const data = (await idbGet<ProjectData>(LEGACY_KEY)) ?? (await createSeed());
    const now = new Date().toISOString();
    projects = [{ id: 'cmp', name: 'CMP', description: data.name || 'Cohort Management Platform', color: '#7c6cff', createdAt: now, updatedAt: now }];
    await idbSet(dataKey('cmp'), data);
    await idbSet(REGISTRY_KEY, projects);
  }
  useStore.setState({ projects, ready: true });
}

/** Hash routes: #/ = dashboard, #/p/<id> = project. */
async function route() {
  await flush();
  const id = location.hash.match(/^#\/p\/([^/]+)/)?.[1];
  const { projects, projectId } = useStore.getState();
  if (!id || !projects.some((p) => p.id === id)) {
    if (id) history.replaceState(null, '', '#/');
    useStore.setState({ projectId: null, loaded: false, data: empty, selection: null });
    return;
  }
  if (id === projectId) return;
  useStore.setState({ loaded: false, projectId: id });
  const data = await loadProjectData(id);
  // Ignore a stale load if the user navigated again meanwhile.
  if (useStore.getState().projectId === id) useStore.getState().init(id, data ?? { ...empty, name: projects.find((p) => p.id === id)!.name });
}

export const openProject = (id: ID) => (location.hash = `#/p/${id}`);
export const goToDashboard = () => (location.hash = '#/');

export async function startApp() {
  await loadRegistry();
  window.addEventListener('hashchange', route);
  await route();
  useStore.subscribe((s, prev) => {
    // Only save edits to the open project, not the data swap that happens when a project opens.
    if (s.data === prev.data || !s.loaded || !prev.loaded || !s.projectId || s.projectId !== prev.projectId) return;
    if (pending && pending.id !== s.projectId) void flush();
    if (pending) clearTimeout(pending.timer);
    pending = { id: s.projectId, data: s.data, timer: setTimeout(flush, 300) };
  });
  window.addEventListener('beforeunload', () => void flush());
}

export async function createProject(meta: Pick<ProjectMeta, 'name' | 'description' | 'color'>) {
  const id = uid('prj');
  const now = new Date().toISOString();
  const data: ProjectData = { ...empty, name: meta.name, releases: [{ id: uid('rel'), name: 'v1.0', date: today(), notes: 'First release' }] };
  await idbSet(dataKey(id), data);
  await saveRegistry([...useStore.getState().projects, { ...meta, id, createdAt: now, updatedAt: now }]);
  openProject(id);
}

export async function updateProject(id: ID, patch: Partial<Pick<ProjectMeta, 'name' | 'description' | 'color'>>) {
  await saveRegistry(useStore.getState().projects.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  // The project overview reads the name from the data record too.
  const data = patch.name ? await loadProjectData(id) : undefined;
  if (data && patch.name) await idbSet(dataKey(id), { ...data, name: patch.name });
}

export async function deleteProject(id: ID) {
  const data = await loadProjectData(id);
  for (const s of data?.screens ?? []) for (const v of s.versions) if (v.imageId) await deleteImage(v.imageId);
  await idbDel(dataKey(id));
  await saveRegistry(useStore.getState().projects.filter((p) => p.id !== id));
}
