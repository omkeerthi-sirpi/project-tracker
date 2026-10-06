import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store';
import { ScreenImage } from './ScreenImage';

export function Lightbox() {
  const lb = useStore((s) => s.lightbox);
  const patch = useStore((s) => s.patch);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && patch({ lightbox: null });
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [patch]);
  if (!lb) return null;
  return (
    <div className="overlay lightbox" onClick={() => patch({ lightbox: null })}>
      <div className="lb-title">{lb.title}</div>
      <button className="icon-btn lb-close" aria-label="Close">
        <X size={18} />
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <ScreenImage imageId={lb.imageId} color={lb.color} name={lb.title} className="lb-img" />
      </div>
    </div>
  );
}
