import { useEffect, useState } from 'react';
import { createStore, del, get, set } from 'idb-keyval';
import { uid } from './util';

// Screenshots are stored as Blobs in IndexedDB (localStorage is far too small for images).
const imgStore = createStore('cmp-flow-images', 'images');
const urlCache = new Map<string, string>();

export async function saveImage(blob: Blob, id = uid('img')): Promise<string> {
  await set(id, blob, imgStore);
  return id;
}

export const getImage = (id: string) => get<Blob>(id, imgStore);
export const deleteImage = (id: string) => del(id, imgStore);

export function useImageUrl(id?: string): string | undefined {
  const [url, setUrl] = useState(() => (id ? urlCache.get(id) : undefined));
  useEffect(() => {
    if (!id) return setUrl(undefined);
    const cached = urlCache.get(id);
    if (cached) return setUrl(cached);
    let alive = true;
    getImage(id).then((blob) => {
      if (!blob || !alive) return;
      const u = URL.createObjectURL(blob);
      urlCache.set(id, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(b);
  });

export const dataUrlToBlob = (u: string) => fetch(u).then((r) => r.blob());
