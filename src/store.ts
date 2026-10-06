import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { ID, ProjectData, Selection } from './types';
import { blobToDataUrl, dataUrlToBlob, getImage, saveImage } from './lib/images';
import { createSeed } from './lib/seed';
import { download, today } from './lib/util';

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
  data: ProjectData;
  loaded: boolean;
  init(d: ProjectData): void;
  mut(fn: (d: Draft<ProjectData>) => void): void;
  patch(p: Partial<UI>): void;
  select(s: Selection | null): void;
}

const DATA_KEY = 'cmp-flow-tracker:data';
const empty: ProjectData = { name: '', releases: [], personas: [], workflows: [], screens: [], notifications: [], changeRequests: [] };

export const useStore = create<State>()((set) => ({
  data: empty,
  loaded: false,
  releaseId: '',
  selection: null,
  view: 'board',
  boardPersonaId: '',
  lightbox: null,

  init: (raw) => {
    // Older saves predate the CR inbox.
    const data = { ...raw, changeRequests: raw.changeRequests ?? [] };
    set({ data, loaded: true, releaseId: data.releases.at(-1)?.id ?? '', boardPersonaId: data.personas[0]?.id ?? '', selection: null });
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

// ---------- persistence ----------

export async function loadProject() {
  const saved = await idbGet<ProjectData>(DATA_KEY);
  useStore.getState().init(saved ?? (await createSeed()));
  let t: ReturnType<typeof setTimeout>;
  useStore.subscribe((s, prev) => {
    if (s.data === prev.data) return;
    clearTimeout(t);
    t = setTimeout(() => idbSet(DATA_KEY, s.data), 300);
  });
}

export async function resetDemo() {
  const seed = await createSeed();
  await idbSet(DATA_KEY, seed);
  useStore.getState().init(seed);
}

function imageIds(d: ProjectData) {
  return d.screens.flatMap((s) => s.versions.map((v) => v.imageId).filter((x): x is string => !!x));
}

export async function exportProject() {
  const { data } = useStore.getState();
  const images: Record<string, string> = {};
  for (const id of imageIds(data)) {
    const b = await getImage(id);
    if (b) images[id] = await blobToDataUrl(b);
  }
  download(`cmp-flow-${today()}.json`, JSON.stringify({ format: 'cmp-flow-tracker@1', data, images }, null, 2));
}

export async function importProject(file: File) {
  const parsed = JSON.parse(await file.text());
  if (parsed.format !== 'cmp-flow-tracker@1') throw new Error('Not a CMP Flow Tracker export');
  for (const [id, url] of Object.entries(parsed.images as Record<string, string>)) await saveImage(await dataUrlToBlob(url), id);
  await idbSet(DATA_KEY, parsed.data);
  useStore.getState().init(parsed.data);
}
