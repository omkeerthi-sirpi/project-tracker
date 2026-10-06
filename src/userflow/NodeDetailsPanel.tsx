import { ChevronRight, Pencil, X } from 'lucide-react';
import { useFlow } from './store';
import { ancestors, descendants, CHILD_LABEL, KIND_LABEL, NOTIF_TYPES, STATUSES, STATUS_LABEL } from './model';
import { KIND_ICON, NOTIF_ICON } from './UserFlowToolbar';
import { STATUS_COLOR } from './UserFlowGraph';
import { fmtDate } from '../lib/util';
import type { CSSProperties } from 'react';
import { useStore } from '../store';
import { ScreenImage } from '../components/ScreenImage';

export function NodeDetailsPanel() {
  const index = useFlow((s) => s.index);
  const selected = useFlow((s) => s.selected);
  const { select, reveal } = useFlow.getState();
  const it = selected ? index.items.get(selected) : undefined;
  if (!it) return null;

  const Icon = KIND_ICON[it.kind];
  const path = ancestors(index, it.id).map((id) => index.items.get(id)!);
  const below = descendants(index, it.id).map((id) => index.items.get(id)!);
  const byStatus = STATUSES.map((s) => [s, below.filter((x) => x.status === s).length] as const);
  const notifs = below.filter((x) => x.kind === 'notification');
  const byType = NOTIF_TYPES.map((t) => [t, notifs.filter((n) => n.notifType === t).length] as const);
  const children = it.children.map((id) => index.items.get(id)!);
  const childWord = CHILD_LABEL[it.kind];

  return (
    <aside className="uf-panel" style={{ '--c': it.color } as CSSProperties}>
      <header className="uf-panel-head">
        <span className="uf-panel-kind"><Icon size={14} /> {KIND_LABEL[it.kind]} details</span>
        <button className="uf-icon-btn" onClick={() => select(null)} aria-label="Close details"><X size={16} /></button>
      </header>

      <div className="uf-panel-body" key={it.id}>
        {path.length > 0 && (
          <nav className="uf-crumbs">
            {path.map((p) => (
              <span key={p.id}>
                <button onClick={() => reveal(p.id)}>{p.name}</button>
                <ChevronRight size={11} />
              </span>
            ))}
          </nav>
        )}
        <h2 className="uf-panel-title">{it.name}</h2>

        <div className="uf-panel-badges">
          <span className={`uf-status lg s-${it.status}`}>{STATUS_LABEL[it.status]}</span>
          {it.notifType && (() => {
            const T = NOTIF_ICON[it.notifType];
            return <span className={`uf-type t-${it.notifType}`}><T size={12} /> {it.notifType}</span>;
          })()}
        </div>

        {it.description && <p className="uf-panel-desc">{it.description}</p>}

        {it.kind === 'screen' && (
          <div className="uf-shot">
            <ScreenImage
              imageId={it.imageId}
              color={it.color}
              name={it.name}
              onClick={it.imageId ? () => useStore.getState().patch({ lightbox: { imageId: it.imageId, title: it.name, color: it.color } }) : undefined}
            />
          </div>
        )}

        <button
          className="uf-edit"
          onClick={() => useStore.getState().patch({ view: 'board', boardPersonaId: it.personaId, selection: { kind: it.kind, id: it.id } })}
        >
          <Pencil size={13} /> Edit on Persona board
        </button>

        {it.changes && it.changes.length > 0 && (
          <section className="uf-sec">
            <h4>Changes</h4>
            <ul className="uf-changes-list">
              {it.changes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </section>
        )}

        <section className="uf-sec uf-meta">
          {it.kind !== 'notification' && (
            <>
              <div><span>{childWord[0].toUpperCase() + childWord.slice(1)}s</span><b>{it.children.length}</b></div>
              {it.kind !== 'screen' && <div><span>Notifications</span><b>{it.notifCount}</b></div>}
            </>
          )}
          <div><span>Last modified</span><b>{fmtDate(it.lastModified)}</b></div>
          {it.modifiedBy && <div><span>Modified by</span><b>{it.modifiedBy}</b></div>}
        </section>

        {it.versions && it.versions.length > 0 && (
          <section className="uf-sec">
            <h4>Version history</h4>
            <ol className="uf-versions">
              {[...it.versions].reverse().map((v) => (
                <li key={v.id} className={`c-${v.changeType}`}>
                  <span className="uf-ver">{v.label}</span>
                  <span className="uf-ver-text">
                    <b>{v.summary}</b>
                    <small>{v.release}{v.crId ? ` · ${v.crId}` : ''}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {below.length > 0 && (
          <section className="uf-sec">
            <h4>Change summary <small>{below.length} items below</small></h4>
            <div className="uf-bar">
              {byStatus.map(([s, n]) => n > 0 && <span key={s} style={{ flex: n, background: STATUS_COLOR[s] }} title={`${STATUS_LABEL[s]}: ${n}`} />)}
            </div>
            <div className="uf-bar-legend">
              {byStatus.map(([s, n]) => (
                <span key={s}><i style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]} <b>{n}</b></span>
              ))}
            </div>
          </section>
        )}

        {notifs.length > 0 && (
          <section className="uf-sec">
            <h4>Notification types</h4>
            <div className="uf-types">
              {byType.map(([t, n]) => {
                const T = NOTIF_ICON[t];
                return <span key={t} className={`uf-type t-${t} ${n ? '' : 'zero'}`}><T size={12} /> {n} {t}</span>;
              })}
            </div>
          </section>
        )}

        {children.length > 0 && (
          <section className="uf-sec">
            <h4>{childWord[0].toUpperCase() + childWord.slice(1)}s</h4>
            <ul className="uf-children">
              {children.map((c) => {
                const CI = c.notifType ? NOTIF_ICON[c.notifType] : KIND_ICON[c.kind];
                return (
                  <li key={c.id}>
                    <button onClick={() => reveal(c.id)}>
                      <span className={c.notifType ? `t-${c.notifType}` : 'uf-child-icon'}><CI size={13} /></span>
                      <span className="uf-child-name">{c.name}</span>
                      {c.status !== 'unchanged' && <span className={`uf-dot s-${c.status}`} title={STATUS_LABEL[c.status]} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
