export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function download(filename: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PERSONA_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#ef4444'];
