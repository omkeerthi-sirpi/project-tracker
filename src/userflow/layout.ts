import dagre from '@dagrejs/dagre';
import type { FlowKind } from './types';
import type { FlowIndex, Visible } from './model';

export const NODE_SIZE: Record<FlowKind, [number, number]> = {
  persona: [232, 64],
  workflow: [232, 54],
  screen: [212, 40],
  notification: [260, 30],
};

export type Positions = Map<string, { x: number; y: number }>;
type Cluster = { pos: Positions; w: number; h: number };

const cache = new Map<string, Cluster>();
const byPersonaOf = (ix: FlowIndex, id: string) => ix.items.get(id)!.personaId;

/**
 * Left-to-right tree per persona (dagre), then the persona clusters are packed into columns so the
 * canvas fills a wide screen instead of one very tall strip.
 */
export function layout(ix: FlowIndex, v: Visible): Positions {
  const byPersona = new Map<string, string[]>();
  for (const id of v.ids) {
    const p = ix.items.get(id)!.personaId;
    if (!byPersona.has(p)) byPersona.set(p, []);
    byPersona.get(p)!.push(id);
  }
  const visible = new Set(v.ids);

  const clusters: Cluster[] = [];
  for (const ids of byPersona.values()) {
    // Clicking usually changes one persona; reuse the others' layouts.
    const clusterEdges = v.edges.filter(([a, b]) => visible.has(a) && byPersonaOf(ix, b) === byPersonaOf(ix, ids[0]));
    const key = ids.join(',') + '|' + clusterEdges.map((e) => e.join('>')).join(',');
    const hit = cache.get(key);
    if (hit) {
      clusters.push(hit);
      continue;
    }
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 72, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));
    const set = new Set(ids);
    for (const id of ids) {
      const [w, h] = NODE_SIZE[ix.items.get(id)!.kind];
      g.setNode(id, { width: w, height: h });
    }
    for (const [a, b] of clusterEdges) if (set.has(a) && set.has(b)) g.setEdge(a, b);
    dagre.layout(g);

    const pos: Positions = new Map();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const n = g.node(id);
      const [w, h] = NODE_SIZE[ix.items.get(id)!.kind];
      const x = n.x - w / 2;
      const y = n.y - h / 2;
      pos.set(id, { x, y });
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    }
    for (const p of pos.values()) { p.x -= minX; p.y -= minY; }
    const c = { pos, w: maxX - minX, h: maxY - minY };
    if (cache.size > 200) cache.clear();
    cache.set(key, c);
    clusters.push(c);
  }

  return pack(clusters);
}

/** Masonry-pack clusters into the column count whose overall shape is closest to a 16:10 screen. */
function pack(clusters: Cluster[]): Positions {
  const GAP_X = 120, GAP_Y = 64, TARGET = 1.6;
  let best: { cols: number; score: number } = { cols: 1, score: Infinity };
  for (let cols = 1; cols <= Math.min(5, clusters.length); cols++) {
    const { width, height } = place(clusters, cols, GAP_X, GAP_Y);
    const score = Math.abs(Math.log(width / Math.max(height, 1) / TARGET));
    if (score < best.score) best = { cols, score };
  }
  const { offsets } = place(clusters, best.cols, GAP_X, GAP_Y);
  // Cluster positions are shared with the cache, so write offsets into a fresh map.
  const out: Positions = new Map();
  clusters.forEach((c, i) => {
    for (const [id, p] of c.pos) out.set(id, { x: p.x + offsets[i].x, y: p.y + offsets[i].y });
  });
  return out;
}

function place(clusters: { w: number; h: number }[], cols: number, gx: number, gy: number) {
  const colH = new Array(cols).fill(0);
  const colW = new Array(cols).fill(0);
  const colOf: number[] = [];
  const yOf: number[] = [];
  clusters.forEach((c, i) => {
    const col = colH.indexOf(Math.min(...colH));
    colOf[i] = col;
    yOf[i] = colH[col];
    colH[col] += c.h + gy;
    colW[col] = Math.max(colW[col], c.w);
  });
  const colX = colW.map((_, i) => colW.slice(0, i).reduce((a, w) => a + w + gx, 0));
  return {
    offsets: clusters.map((_, i) => ({ x: colX[colOf[i]], y: yOf[i] })),
    width: colX[cols - 1] + colW[cols - 1],
    height: Math.max(...colH) - gy,
  };
}

