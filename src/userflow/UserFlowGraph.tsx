import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Background, BackgroundVariant, MiniMap, ReactFlow, useEdgesState, useNodesState, useReactFlow, type Edge, type NodeChange,
} from '@xyflow/react';
import { useFlow } from './store';
import { focusSet, search, visibleTree, KIND_LABEL, CHILD_LABEL, STATUS_LABEL, type FlowIndex } from './model';
import { layout, NODE_SIZE, type Positions } from './layout';
import { nodeTypes, type FlowNode, type FlowNodeData } from './nodes';
import { fmtDate } from '../lib/util';

const ANIM_MS = 380;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Search hits that drive highlighting; capped so a vague query cannot open the whole graph. */
export function useSearchHits() {
  const index = useFlow((s) => s.index);
  const query = useFlow((s) => s.query);
  const persona = useFlow((s) => s.filters.persona);
  return useMemo(() => search(index, query, persona), [index, query, persona]);
}
export const HIGHLIGHT_CAP = 60;

export function UserFlowGraph() {
  const index = useFlow((s) => s.index);
  const expanded = useFlow((s) => s.expanded);
  const filters = useFlow((s) => s.filters);
  const selected = useFlow((s) => s.selected);
  const fitToken = useFlow((s) => s.fitToken);
  const centerOn = useFlow((s) => s.centerOn);
  const { select, toggle } = useFlow.getState();
  const rf = useReactFlow();

  const hits = useSearchHits().slice(0, HIGHLIGHT_CAP);
  const hitsKey = hits.join('|');
  const vis = useMemo(() => visibleTree(index, filters, expanded, hits), [index, filters, expanded, hitsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => layout(index, vis), [index, vis]);
  const focus = useMemo(() => focusSet(index, selected, hits), [index, selected, hitsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  // Latest per-node visual state, read by the layout animation without restarting it.
  const hitSet = useMemo(() => new Set(hits), [hitsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dataFor = (id: string): FlowNodeData => ({
    item: index.items.get(id)!,
    open: vis.open.has(id),
    dim: !!focus && !focus.has(id),
    hl: !!focus && focus.has(id),
    match: hitSet.has(id) && !selected,
    context: vis.context.has(id),
  });
  const dataRef = useRef(dataFor);
  dataRef.current = dataFor;

  // ---- positions: animate from where things were (new nodes grow out of their parent) ----
  const shown = useRef<Positions>(new Map());
  const settledAt = useRef(0);
  useEffect(() => {
    const first = shown.current.size === 0;
    const from: Positions = new Map();
    for (const id of vis.ids) {
      let p = shown.current.get(id);
      for (let a = index.items.get(id)?.parentId; !p && a; a = index.items.get(a)?.parentId) p = shown.current.get(a);
      from.set(id, p ?? target.get(id)!);
    }
    const frame = (t: number) => {
      const k = ease(t);
      const next: Positions = new Map();
      setNodes(
        vis.ids.map((id) => {
          const a = from.get(id)!;
          const b = target.get(id)!;
          const position = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
          next.set(id, position);
          const kind = index.items.get(id)!.kind;
          const [width, height] = NODE_SIZE[kind];
          return { id, type: kind, position, width, height, data: dataRef.current(id), selected: id === useFlow.getState().selected };
        }),
      );
      shown.current = next;
    };
    settledAt.current = performance.now() + ANIM_MS;
    if (first) {
      frame(1);
      requestAnimationFrame(() => rf.fitView({ padding: 0.08, maxZoom: 1 }));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS);
      frame(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vis, target, index, setNodes, rf]);

  // ---- highlight / dim / open state without moving anything ----
  useEffect(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, data: dataRef.current(n.id), selected: n.id === selected })));
  }, [focus, hitSet, selected, vis, setNodes]);

  useEffect(() => {
    setEdges(
      vis.edges.map(([a, b]) => {
        const on = !!focus && focus.has(a) && focus.has(b);
        const color = index.items.get(b)!.color;
        return {
          id: `${a}->${b}`,
          source: a,
          target: b,
          type: 'default',
          className: focus ? (on ? 'hl' : 'dim') : '',
          style: on ? ({ stroke: color, '--c': color } as CSSProperties) : undefined,
          animated: on && index.items.get(b)!.kind === 'notification',
          focusable: false,
        };
      }),
    );
  }, [vis, focus, index, setEdges]);

  // ---- camera ----
  const afterSettle = (fn: () => void) => {
    const t = setTimeout(fn, Math.max(0, settledAt.current - performance.now()) + 40);
    return () => clearTimeout(t);
  };
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    return afterSettle(() => rf.fitView({ padding: 0.08, maxZoom: 1, duration: 500 }));
  }, [fitToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!centerOn) return;
    return afterSettle(() => {
      const p = shown.current.get(centerOn);
      const it = index.items.get(centerOn);
      if (p && it) {
        const [w, h] = NODE_SIZE[it.kind];
        rf.setCenter(p.x + w / 2, p.y + h / 2, { zoom: Math.max(rf.getZoom(), 0.95), duration: 600 });
      }
      useFlow.setState({ centerOn: null });
    });
  }, [centerOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the selected node and its children on screen: the details panel narrows the canvas and
  // expanding adds nodes to the right, both of which can push the interesting part out of view.
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A jump from search or another tab centres on the node itself; do not fight that camera move.
    if (!selected || useFlow.getState().centerOn) return;
    return afterSettle(() => {
      const ids = [selected, ...vis.edges.filter(([a]) => a === selected).map(([, b]) => b)];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ids) {
        const p = shown.current.get(id);
        const it = index.items.get(id);
        if (!p || !it) continue;
        const [w, h] = NODE_SIZE[it.kind];
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + w); y1 = Math.max(y1, p.y + h);
      }
      const box = wrap.current?.getBoundingClientRect();
      if (!box || x0 === Infinity) return;
      const { x, y, zoom } = rf.getViewport();
      const M = 40;
      const inView = x0 * zoom + x >= M && y0 * zoom + y >= M && x1 * zoom + x <= box.width - M && y1 * zoom + y <= box.height - M;
      if (inView) return;
      const fits = (x1 - x0) * zoom <= box.width - 2 * M && (y1 - y0) * zoom <= box.height - 2 * M;
      if (fits) rf.setCenter((x0 + x1) / 2, (y0 + y1) / 2, { zoom, duration: 450 });
      else rf.fitBounds({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, { padding: 0.1, duration: 450 });
    });
  }, [selected, vis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tooltip waits for a short hover so it does not flicker while the pointer moves across the graph.
  const tipTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTip = () => {
    clearTimeout(tipTimer.current);
    setTip(null);
  };
  const queueTip = (id: string, x: number, y: number) => {
    clearTimeout(tipTimer.current);
    if (tip?.id === id) return setTip({ id, x, y });
    tipTimer.current = setTimeout(() => setTip({ id, x, y }), 450);
  };

  const handleNodesChange = (changes: NodeChange<FlowNode>[]) => {
    onNodesChange(changes);
    // Keep dragged positions so the next animation starts from where the user left the node.
    for (const c of changes) if (c.type === 'position' && c.position) shown.current.set(c.id, c.position);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && select(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [select]);

  return (
    <div className="uf-canvas" ref={wrap}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(e, n) => {
          hideTip();
          const open = vis.open.has(n.id);
          const onChevron = (e.target as HTMLElement).closest('.uf-toggle');
          // First click selects (and opens); clicking the selected node — or its chevron — toggles.
          if (onChevron || selected === n.id) toggle(n.id, open);
          else if (!open && n.data.item.children.length) toggle(n.id, false);
          select(n.id);
        }}
        onPaneClick={() => select(null)}
        onNodeMouseEnter={(e, n) => queueTip(n.id, e.clientX, e.clientY)}
        onNodeMouseMove={(e, n) => queueTip(n.id, e.clientX, e.clientY)}
        onNodeMouseLeave={hideTip}
        onMoveStart={hideTip}
        nodesConnectable={false}
        elementsSelectable
        colorMode="dark"
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#2a2f55" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) => {
            const it = (n as FlowNode).data.item;
            return it.status === 'unchanged' ? '#3a4170' : STATUS_COLOR[it.status];
          }}
          nodeStrokeWidth={0}
          nodeBorderRadius={4}
          style={{ width: 168, height: 104 }}
          maskColor="rgba(8, 10, 22, 0.75)"
        />
      </ReactFlow>
      <Legend total={vis.ids.length} />
      {tip && <Tooltip index={index} id={tip.id} x={tip.x} y={tip.y} />}
    </div>
  );
}

export const STATUS_COLOR = { new: '#22c55e', modified: '#f59e0b', unchanged: '#8a90b8', deprecated: '#ef4444' } as const;

function Tooltip({ index, id, x, y }: { index: FlowIndex; id: string; x: number; y: number }) {
  const it = index.items.get(id);
  if (!it) return null;
  const left = Math.min(x + 16, window.innerWidth - 300);
  const top = Math.min(y + 16, window.innerHeight - 200);
  return (
    <div className="uf-tip" style={{ left, top }}>
      <div className="uf-tip-head">
        <span className="uf-tip-kind">{KIND_LABEL[it.kind]}</span>
        <span className={`uf-status s-${it.status}`}>{STATUS_LABEL[it.status]}</span>
      </div>
      <div className="uf-tip-name">{it.name}</div>
      {it.description && <p>{it.description}</p>}
      <dl>
        {it.kind !== 'notification' && (
          <>
            <dt>{CHILD_LABEL[it.kind].replace(/^./, (c) => c.toUpperCase())}s</dt>
            <dd>{it.children.length}</dd>
            {it.kind !== 'screen' && (
              <>
                <dt>Notifications</dt>
                <dd>{it.notifCount}</dd>
              </>
            )}
          </>
        )}
        {it.notifType && (
          <>
            <dt>Type</dt>
            <dd className={`t-${it.notifType}`}>{it.notifType}</dd>
          </>
        )}
        <dt>Last modified</dt>
        <dd>{fmtDate(it.lastModified)}</dd>
      </dl>
    </div>
  );
}

function Legend({ total }: { total: number }) {
  const statuses = useFlow((s) => s.filters.statuses);
  const setOnly = useFlow((s) => s.setOnly);
  return (
    <div className="uf-legend">
      {(['new', 'modified', 'unchanged', 'deprecated'] as const).map((s) => (
        <button key={s} className={`uf-legend-st ${statuses.size < 4 && !statuses.has(s) ? 'off' : ''}`} onClick={() => setOnly('statuses', s)} title={`Show only ${STATUS_LABEL[s].toLowerCase()} items (click again for all)`}>
          <i style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]}
        </button>
      ))}
      <span className="uf-legend-sep" />
      <span className="uf-legend-count">{total} nodes</span>
    </div>
  );
}
