import { useState } from 'react';
import { Columns2, SplitSquareHorizontal } from 'lucide-react';
import { useImageUrl } from '../lib/images';
import { ScreenImage } from './ScreenImage';

export function CompareSlider({ a, b, labelA, labelB, color }: {
  a?: string;
  b?: string;
  labelA: string;
  labelB: string;
  color: string;
}) {
  const [pos, setPos] = useState(50);
  const [mode, setMode] = useState<'swipe' | 'side'>('swipe');
  const ua = useImageUrl(a);
  const ub = useImageUrl(b);

  return (
    <div className="compare">
      <div className="seg small">
        <button className={mode === 'swipe' ? 'on' : ''} onClick={() => setMode('swipe')}>
          <SplitSquareHorizontal size={13} /> Swipe
        </button>
        <button className={mode === 'side' ? 'on' : ''} onClick={() => setMode('side')}>
          <Columns2 size={13} /> Side by side
        </button>
      </div>
      {mode === 'side' ? (
        <div className="cmp-side">
          <figure>
            <ScreenImage imageId={a} color={color} name={labelA} />
            <figcaption>{labelA}</figcaption>
          </figure>
          <figure>
            <ScreenImage imageId={b} color={color} name={labelB} />
            <figcaption>{labelB}</figcaption>
          </figure>
        </div>
      ) : ua && ub ? (
        <div className="cmp-swipe">
          <img src={ub} alt={labelB} draggable={false} />
          <img src={ua} alt={labelA} draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} className="top" />
          <div className="cmp-line" style={{ left: `${pos}%` }} />
          <span className="cmp-tag l">{labelA}</span>
          <span className="cmp-tag r">{labelB}</span>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Compare position" />
        </div>
      ) : (
        <p className="muted small">Both versions need a screenshot to swipe-compare.</p>
      )}
    </div>
  );
}
