import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  AlertTriangle, Bell, Check, CheckCircle2, ChevronDown, ChevronsDownUp, ChevronsUpDown, Info, Layers, Maximize, Minus, Monitor, Plus,
  RotateCcw, Search, Tag, User, Users, Workflow, X, XCircle,
} from 'lucide-react';
import { useFlow } from './store';
import { useSearchHits, HIGHLIGHT_CAP, STATUS_COLOR } from './UserFlowGraph';
import { ancestors, KINDS, KIND_LABEL, NOTIF_TYPES, STATUSES, STATUS_LABEL, notifFilterOn, statusFilterOn } from './model';
import type { FlowKind, NotificationType } from './types';

export const KIND_ICON: Record<FlowKind, typeof User> = { persona: User, workflow: Workflow, screen: Monitor, notification: Bell };
export const NOTIF_ICON: Record<NotificationType, typeof Info> = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };

// ---------- search ----------

export function SearchBar() {
  const index = useFlow((s) => s.index);
  const query = useFlow((s) => s.query);
  const { setQuery, reveal } = useFlow.getState();
  const hits = useSearchHits();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const shown = hits.slice(0, 10);
  const choose = (id: string) => {
    // reveal() opens the chosen path explicitly, so the query can go and take the other matches' branches with it.
    reveal(id);
    setQuery('');
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="uf-search">
      <Search size={15} className="uf-search-icon" />
      <input
        ref={input}
        value={query}
        placeholder="Search user flow…"
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, shown.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          if (e.key === 'Enter' && shown[cursor]) choose(shown[cursor]);
          if (e.key === 'Escape') { setQuery(''); input.current?.blur(); }
        }}
      />
      {query ? (
        <button className="uf-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>
      ) : (
        <kbd>/</kbd>
      )}
      {open && query.trim().length >= 2 && (
        <div className="uf-results">
          <div className="uf-results-head">
            {hits.length ? `${hits.length} match${hits.length === 1 ? '' : 'es'}` : 'No matches'}
            {hits.length > HIGHLIGHT_CAP && <span> · first {HIGHLIGHT_CAP} highlighted</span>}
          </div>
          {shown.map((id, i) => {
            const it = index.items.get(id)!;
            const Icon = KIND_ICON[it.kind];
            const path = ancestors(index, id).map((a) => index.items.get(a)!.name).join(' › ');
            return (
              <button key={id} className={i === cursor ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setCursor(i)} onClick={() => choose(id)}>
                <span className={`uf-res-icon k-${it.kind}`}><Icon size={13} /></span>
                <span className="uf-res-text">
                  <span className="uf-res-name">{highlight(it.name, query)}</span>
                  <span className="uf-res-path">{path || KIND_LABEL[it.kind]}</span>
                </span>
                {it.status !== 'unchanged' && <span className={`uf-status s-${it.status}`}>{it.status}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function highlight(text: string, q: string): ReactNode {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0) return text;
  const n = q.trim().length;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + n)}</mark>{text.slice(i + n)}</>;
}

// ---------- filters ----------

function Dropdown({ icon, label, value, active, children }: { icon: ReactNode; label: string; value: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="uf-dd" ref={ref}>
      <button className={`uf-dd-btn ${active ? 'active' : ''} ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {icon}
        <span className="uf-dd-label">{label}</span>
        <span className="uf-dd-value">{value}</span>
        <ChevronDown size={13} />
      </button>
      {open && <div className="uf-dd-menu">{children}</div>}
    </div>
  );
}

function Option({ on, onClick, children, count, radio }: { on: boolean; onClick: () => void; children: ReactNode; count?: number; radio?: boolean }) {
  return (
    <button className={`uf-opt ${on ? 'on' : ''} ${radio ? 'radio' : ''}`} onClick={onClick}>
      <span className="uf-check">{on && <Check size={11} strokeWidth={3} />}</span>
      <span className="uf-opt-label">{children}</span>
      {count !== undefined && <span className="uf-opt-count">{count}</span>}
    </button>
  );
}

const summary = <T extends string>(set: Set<T>, all: readonly T[], label: (v: T) => string) =>
  set.size === all.length ? 'All' : set.size === 1 ? label([...set][0]) : `${set.size} of ${all.length}`;

export function Filters() {
  const index = useFlow((s) => s.index);
  const f = useFlow((s) => s.filters);
  const { setPersona, toggleIn, resetFilters } = useFlow.getState();

  const items = [...index.items.values()].filter((it) => !f.persona || it.personaId === f.persona);
  const count = <K extends 'kind' | 'status' | 'notifType'>(k: K, v: string) => items.filter((it) => it[k] === v).length;
  const personas = index.roots.map((id) => index.items.get(id)!);
  const anyActive = !!f.persona || f.kinds.size !== KINDS.length || statusFilterOn(f) || notifFilterOn(f);

  return (
    <div className="uf-filters">
      <Dropdown icon={<Users size={14} />} label="Persona" value={f.persona ? index.items.get(f.persona)!.name : 'All'} active={!!f.persona}>
        <Option radio on={!f.persona} onClick={() => setPersona('')}>All personas</Option>
        {personas.map((p) => (
          <Option radio key={p.id} on={f.persona === p.id} onClick={() => setPersona(p.id)} count={p.changedBelow}>
            <i className="uf-swatch" style={{ background: p.color }} /> {p.name}
          </Option>
        ))}
        <div className="uf-dd-foot">Number = changed items</div>
      </Dropdown>

      <Dropdown icon={<Layers size={14} />} label="Type" value={summary(f.kinds, KINDS, (k) => KIND_LABEL[k])} active={f.kinds.size !== KINDS.length}>
        {KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <Option key={k} on={f.kinds.has(k)} onClick={() => toggleIn('kinds', k)} count={count('kind', k)}>
              <Icon size={13} /> {KIND_LABEL[k]}
            </Option>
          );
        })}
        <div className="uf-dd-foot">Hidden levels are skipped; their children connect upward.</div>
      </Dropdown>

      <Dropdown icon={<Tag size={14} />} label="Status" value={summary(f.statuses, STATUSES, (s) => STATUS_LABEL[s])} active={statusFilterOn(f)}>
        {STATUSES.map((s) => (
          <Option key={s} on={f.statuses.has(s)} onClick={() => toggleIn('statuses', s)} count={count('status', s)}>
            <i className="uf-swatch round" style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]}
          </Option>
        ))}
      </Dropdown>

      <Dropdown icon={<Bell size={14} />} label="Notification" value={summary(f.notifTypes, NOTIF_TYPES, (t) => t[0].toUpperCase() + t.slice(1))} active={notifFilterOn(f)}>
        {NOTIF_TYPES.map((t) => {
          const Icon = NOTIF_ICON[t];
          return (
            <Option key={t} on={f.notifTypes.has(t)} onClick={() => toggleIn('notifTypes', t)} count={count('notifType', t)}>
              <span className={`t-${t}`}><Icon size={13} /></span> {t === 'info' ? 'Information' : t[0].toUpperCase() + t.slice(1)}
            </Option>
          );
        })}
      </Dropdown>

      {anyActive && (
        <button className="uf-reset" onClick={resetFilters}><RotateCcw size={13} /> Reset filters</button>
      )}
    </div>
  );
}

// ---------- view controls ----------

export function ViewControls() {
  const rf = useReactFlow();
  const { zoom } = useViewport();
  const { expandAll, collapseAll, fit } = useFlow.getState();
  return (
    <div className="uf-view">
      <div className="uf-btn-group">
        <button onClick={expandAll} title="Expand all — shows every notification"><ChevronsUpDown size={14} /> Expand all</button>
        <button onClick={collapseAll} title="Collapse to personas"><ChevronsDownUp size={14} /> Collapse all</button>
      </div>
      <div className="uf-btn-group">
        <button className="icon" onClick={() => rf.zoomOut({ duration: 200 })} title="Zoom out"><Minus size={14} /></button>
        <button className="uf-zoom" onClick={() => rf.zoomTo(1, { duration: 300 })} title="Reset zoom to 100%">{Math.round(zoom * 100)}%</button>
        <button className="icon" onClick={() => rf.zoomIn({ duration: 200 })} title="Zoom in"><Plus size={14} /></button>
        <button className="icon" onClick={fit} title="Fit graph to screen"><Maximize size={14} /></button>
      </div>
    </div>
  );
}
