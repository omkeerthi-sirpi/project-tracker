import type { CSSProperties } from 'react';
import { ImageOff } from 'lucide-react';
import { useImageUrl } from '../lib/images';

export function ScreenImage({ imageId, color, name, onClick, className = '' }: {
  imageId?: string;
  color: string;
  name: string;
  onClick?: () => void;
  className?: string;
}) {
  const url = useImageUrl(imageId);
  if (url)
    return <img className={`shot ${className} ${onClick ? 'clickable' : ''}`} src={url} alt={name} onClick={onClick} draggable={false} />;
  return (
    <div className={`shot shot-empty ${className}`} style={{ '--c': color } as CSSProperties} onClick={onClick}>
      <ImageOff size={18} />
      <span>No screenshot</span>
    </div>
  );
}
