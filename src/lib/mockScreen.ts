// Generates wireframe "screenshots" so the demo data has something to compare.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function mockScreenSvg(o: { title: string; persona: string; color: string; variant: number; note?: string }) {
  const { color, variant } = o;
  const nav = Array.from({ length: 7 }, (_, i) => {
    const y = 100 + i * 48;
    const active = i === (o.title.length % 5) + 1;
    return `${active ? `<rect x="16" y="${y}" width="200" height="38" rx="8" fill="${color}" fill-opacity="0.25"/>` : ''}
      <rect x="34" y="${y + 13}" width="12" height="12" rx="3" fill="${active ? color : '#5b6290'}"/>
      <rect x="58" y="${y + 15}" width="${70 + ((i * 37) % 70)}" height="8" rx="4" fill="${active ? '#e6e8f5' : '#5b6290'}"/>`;
  }).join('');

  const cards = [0, 1, 2]
    .map((i) => {
      const x = 264 + i * 332;
      return `<rect x="${x}" y="100" width="308" height="108" rx="12" fill="#fff" stroke="#e3e6f0"/>
        <rect x="${x + 22}" y="124" width="110" height="9" rx="4" fill="#b9bdd6"/>
        <text x="${x + 22}" y="180" font-size="34" font-weight="700" fill="#141729">${(i + 2) * 37 + variant * 11}</text>
        <rect x="${x + 220}" y="150" width="64" height="32" rx="8" fill="${color}" fill-opacity="${0.15 + i * 0.1}"/>`;
    })
    .join('');

  let y = 236;
  let banner = '';
  if (variant >= 1) {
    const note = esc((o.note ?? 'Updated').slice(0, 78));
    banner = `<rect x="264" y="${y}" width="988" height="54" rx="10" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/>
      <text x="286" y="${y + 33}" font-size="16" font-weight="600" fill="${color}">✦ v${variant + 1}: ${note}</text>
      ${[0, 1, 2].map((i) => `<rect x="${930 + i * 104}" y="${y + 13}" width="92" height="28" rx="14" fill="#fff" stroke="${color}"/>`).join('')}`;
    y += 72;
  }

  const cols = variant >= 2 ? 5 : 4;
  const colW = 988 / cols;
  const header = Array.from({ length: cols }, (_, c) =>
    `<rect x="${284 + c * colW}" y="${y + 20}" width="${colW * 0.45}" height="9" rx="4" fill="${variant >= 2 && c === cols - 1 ? color : '#8a90b8'}"/>`,
  ).join('');
  const rows = Array.from({ length: 7 }, (_, r) => {
    const ry = y + 50 + r * 52;
    return `<line x1="264" x2="1252" y1="${ry}" y2="${ry}" stroke="#eef0f7"/>
      ${Array.from({ length: cols }, (_, c) => {
        const x = 284 + c * colW;
        if (variant >= 2 && c === cols - 1)
          return `<rect x="${x}" y="${ry + 15}" width="78" height="22" rx="11" fill="${color}" fill-opacity="${r % 3 ? 0.18 : 0.4}"/>`;
        return `<rect x="${x}" y="${ry + 21}" width="${40 + ((r * 31 + c * 17) % (colW * 0.5))}" height="9" rx="4" fill="#c9cde0"/>`;
      }).join('')}`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800" font-family="Inter, Segoe UI, Arial, sans-serif">
  <rect width="1280" height="800" fill="#f4f5fa"/>
  <rect width="232" height="800" fill="#141729"/>
  <rect x="24" y="28" width="34" height="34" rx="9" fill="${color}"/>
  <text x="70" y="52" fill="#fff" font-size="19" font-weight="700">CMP</text>
  ${nav}
  <rect x="232" width="1048" height="72" fill="#fff"/>
  <line x1="232" x2="1280" y1="72" y2="72" stroke="#e3e6f0"/>
  <text x="264" y="45" font-size="22" font-weight="700" fill="#141729">${esc(o.title)}</text>
  <text x="1196" y="42" font-size="14" text-anchor="end" fill="#8a90b8">${esc(o.persona)}</text>
  <circle cx="1230" cy="37" r="17" fill="${color}"/>
  ${cards}
  ${banner}
  <rect x="264" y="${y}" width="988" height="${50 + 7 * 52}" rx="12" fill="#fff" stroke="#e3e6f0"/>
  ${header}
  ${rows}
</svg>`;
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml' });
