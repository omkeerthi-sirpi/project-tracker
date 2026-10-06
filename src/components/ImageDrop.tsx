import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

/** Click, drag & drop, or paste (Ctrl+V) a screenshot. */
export function ImageDrop({ value, onChange, hint }: { value: Blob | null; onChange: (b: Blob | null) => void; hint?: string }) {
  const [url, setUrl] = useState<string>();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return setUrl(undefined);
    const u = URL.createObjectURL(value);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (file) {
        e.preventDefault();
        onChange(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onChange]);

  return (
    <div
      className={`drop ${over ? 'over' : ''} ${url ? 'has' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith('image/')) onChange(f);
      }}
    >
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {url ? (
        <>
          <img src={url} alt="preview" />
          <button
            type="button"
            className="icon-btn drop-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <div className="drop-empty">
          <ImagePlus size={22} />
          <strong>Drop, click or paste a screenshot</strong>
          <span>{hint ?? 'PNG, JPG, SVG — Ctrl+V works anywhere in this dialog'}</span>
        </div>
      )}
    </div>
  );
}
