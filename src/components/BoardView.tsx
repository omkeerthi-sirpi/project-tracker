import { useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { ArrowDown, Bell, CheckCircle2, Crosshair, GripVertical, Inbox, Plus, Trash2, User } from 'lucide-react';
import { useStore } from '../store';
import type { ChangeRequest, ChangeType, ID, NotificationItem, Screen } from '../types';
import { changesForRelease, makeCtx, notifAt, screenAt, spanAt } from '../lib/derive';
import { fmtDate, plural } from '../lib/util';
import { ScreenImage } from './ScreenImage';
import { openInFlow } from '../userflow/store';
import { ChangeRequestForm, NotificationChangeForm, ScreenForm, VersionForm, WorkflowForm } from './Forms';

/** Where an inbox CR can be dropped. */
type Target = { kind: 'screen'; screen: Screen } | { kind: 'notif'; notif: NotificationItem } | { kind: 'new-screen'; workflowId: ID };

const CR_MIME = 'application/x-cmp-cr';
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function BoardView() {
  const data = useStore((s) => s.data);
  const releaseId = useStore((s) => s.releaseId);
  const personaId = useStore((s) => s.boardPersonaId);
  const selection = useStore((s) => s.selection);
  const { patch, select, mut } = useStore.getState();
  const [modal, setModal] = useState<ReactNode>(null);
  /** CR picked up by drag or click; while set, targets light up and a click applies it. */
  const [armed, setArmed] = useState<ChangeRequest | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [showApplied, setShowApplied] = useState(false);
  const close = () => setModal(null);

  const persona = data.personas.find((p) => p.id === personaId) ?? data.personas[0];
  const c = useMemo(() => makeCtx(data, releaseId), [data, releaseId]);

  const columns = useMemo(() => {
    if (!persona) return [];
    return data.workflows
      .filter((w) => w.personaId === persona.id)
      .map((w) => ({ w, st: spanAt(c, w.addedIn, w.removedIn) }))
      .filter((x) => x.st.visible)
      .map(({ w, st }) => ({
        w,
        st,
        screens: data.screens
          .filter((s) => s.workflowId === w.id)
          .map((s) => ({ s, st: screenAt(c, s) }))
          .filter((x) => x.st.visible)
          .map((x) => ({
            ...x,
            notifs: data.notifications
              .filter((n) => n.screenId === x.s.id)
              .map((n) => ({ n, st: notifAt(c, n) }))
              .filter((y) => y.st.visible),
          })),
      }));
  }, [data, c, persona]);

  // Release rail: one dot per change this persona received in each release.
  const timeline = useMemo(
    () => data.releases.map((r) => ({ r, changes: changesForRelease(data, r.id).filter((e) => e.personaId === persona?.id) })),
    [data, persona],
  );

  const openCRs = data.changeRequests.filter((x) => x.status === 'open');
  const applied = data.changeRequests.filter((x) => x.status === 'applied' && x.personaId === persona?.id);
  const inbox = [...openCRs].sort((a, b) => rank(a) - rank(b) || b.receivedAt.localeCompare(a.receivedAt));
  function rank(x: ChangeRequest) {
    return x.personaId === persona?.id ? 0 : x.personaId ? 2 : 1;
  }

  const markApplied = (cr: ChangeRequest) => (nodeId: string, rel: ID) => {
    mut((d) => {
      const x = d.changeRequests.find((y) => y.id === cr.id);
      if (x) Object.assign(x, { status: 'applied', appliedTo: nodeId, appliedIn: rel, personaId: x.personaId ?? persona?.id });
    });
    setArmed(null);
  };

  const apply = (cr: ChangeRequest, t: Target) => {
    const props = { cr, onApplied: markApplied(cr), onClose: close };
    if (t.kind === 'screen') setModal(<VersionForm screen={t.screen} {...props} />);
    if (t.kind === 'notif') setModal(<NotificationChangeForm notif={t.notif} {...props} />);
    if (t.kind === 'new-screen') setModal(<ScreenForm workflowId={t.workflowId} {...props} />);
  };

  /** Props that make an element a CR drop / click target. */
  const target = (key: string, t: Target, onPlainClick: () => void) => ({
    'data-target': armed ? 'on' : undefined,
    'data-over': over === key ? 'on' : undefined,
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(CR_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      const cr = data.changeRequests.find((x) => x.id === e.dataTransfer.getData(CR_MIME));
      if (cr) apply(cr, t);
    },
    onClick: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      if (armed) apply(armed, t);
      else onPlainClick();
    },
  });

  if (!persona) return <div className="board"><div className="empty" style={{ margin: 40 }}>Add a persona to start.</div></div>;

  const stats = {
    screens: columns.reduce((n, col) => n + col.screens.length, 0),
    notifs: columns.reduce((n, col) => n + col.screens.reduce((m, s) => m + s.notifs.length, 0), 0),
    changes: timeline.find((t) => t.r.id === releaseId)?.changes.length ?? 0,
  };

  return (
    <div className="board" onClick={() => setArmed(null)}>
      {/* ---------- left rail: CR inbox + release timeline ---------- */}
      <aside className="bd-rail" onClick={(e) => e.stopPropagation()}>
        <div className="bd-rail-head">
          <h4><Inbox size={13} /> Change requests <span className="pill">{openCRs.length}</span></h4>
          <button className="btn tiny" onClick={() => setModal(<ChangeRequestForm personaId={persona.id} onClose={close} />)}><Plus size={13} /> New</button>
        </div>
        {!inbox.length && <p className="muted small bd-hint">Inbox is empty. New client requests land here.</p>}
        <div className="bd-inbox">
          {inbox.map((cr) => {
            const p = data.personas.find((x) => x.id === cr.personaId);
            const isNew = Date.now() - new Date(cr.receivedAt).getTime() < 3 * 864e5;
            return (
              <div
                key={cr.id}
                className={`cr-card ${armed?.id === cr.id ? 'armed' : ''} ${p && p.id !== persona.id ? 'other' : ''}`}
                style={{ '--c': p?.color ?? 'var(--muted)' } as CSSProperties}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(CR_MIME, cr.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  setArmed(cr);
                }}
                onDragEnd={(e) => {
                  setOver(null);
                  if (e.dataTransfer.dropEffect === 'none') setArmed(null);
                }}
                onClick={() => setArmed(armed?.id === cr.id ? null : cr)}
                title={cr.details}
              >
                <GripVertical size={14} className="cr-grip" />
                <div className="cr-body">
                  <div className="cr-top">
                    <span className="cr">{cr.crId}</span>
                    {isNew && <span className="cr-new">new</span>}
                    <span className="grow" />
                    <button
                      className="icon-btn danger"
                      title="Delete request"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${cr.crId}?`)) mut((d) => { d.changeRequests = d.changeRequests.filter((x) => x.id !== cr.id); });
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="cr-title">{cr.title}</div>
                  <div className="cr-meta">
                    {p ? (
                      <button className="link-plain" onClick={(e) => { e.stopPropagation(); patch({ boardPersonaId: p.id }); }}>
                        <span className="dot" style={{ background: p.color }} /> {p.name}
                      </button>
                    ) : <span>No persona</span>}
                    <span>· {fmtDate(cr.receivedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {armed && (
          <p className="bd-armed">
            Placing <b>{armed.crId}</b>: drop or click a screen, a notification or <b>+ New screen</b>. <button className="link" onClick={() => setArmed(null)}>Cancel</button>
          </p>
        )}

        {applied.length > 0 && (
          <>
            <button className="bd-applied-toggle" onClick={() => setShowApplied(!showApplied)}>
              <CheckCircle2 size={13} /> {plural(applied.length, 'request')} placed for {persona.name} {showApplied ? '▾' : '▸'}
            </button>
            {showApplied && applied.map((cr) => (
              <button key={cr.id} className="bd-applied" onMouseEnter={() => setHoverNode(cr.appliedTo ?? null)} onMouseLeave={() => setHoverNode(null)}
                onClick={() => cr.appliedIn && patch({ releaseId: cr.appliedIn })}>
                <span className="cr">{cr.crId}</span> <span>{cr.title}</span>
                <small>{data.releases.find((r) => r.id === cr.appliedIn)?.name}</small>
              </button>
            ))}
          </>
        )}

        <h4 className="bd-tl-title">Release timeline</h4>
        <div className="bd-tl">
          {[...timeline].reverse().map(({ r, changes }) => (
            <button key={r.id} className={`bd-tl-item ${r.id === releaseId ? 'on' : ''}`} onClick={() => patch({ releaseId: r.id })}>
              <span className="bd-tl-node" />
              <span className="bd-tl-text">
                <strong>{r.name}</strong> <small>{fmtDate(r.date)}</small>
                <span className="bd-tl-dots">
                  {changes.map((e) => (
                    <span
                      key={e.key}
                      className={`bd-tl-dot d-${e.action}`}
                      title={`${e.crId ? e.crId + ' · ' : ''}${e.title}: ${e.summary}`}
                      onMouseEnter={() => r.id === releaseId && setHoverNode(e.nodeId)}
                      onMouseLeave={() => setHoverNode(null)}
                    />
                  ))}
                  {!changes.length && <small className="muted">no changes</small>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ---------- main: persona header + workflow columns ---------- */}
      <main className="bd-main">
        <div className="bd-personas">
          {data.personas.map((p) => {
            const pending = openCRs.filter((x) => x.personaId === p.id).length;
            return (
              <button
                key={p.id}
                className={`bd-avatar ${p.id === persona.id ? 'on' : ''}`}
                style={{ '--c': p.color } as CSSProperties}
                onClick={(e) => { e.stopPropagation(); patch({ boardPersonaId: p.id }); }}
                title={p.name}
              >
                <span className="bd-avatar-circle">{initials(p.name)}{pending > 0 && <span className="bd-avatar-n">{pending}</span>}</span>
                <span className="bd-avatar-name">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="bd-hero" style={{ '--c': persona.color } as CSSProperties}>
          <span className="bd-hero-icon"><User size={22} /></span>
          <div>
            <h2>{persona.name}</h2>
            {persona.description && <p className="muted">{persona.description}</p>}
          </div>
          <div className="bd-stats">
            <span><b>{columns.length}</b> workflows</span>
            <span><b>{stats.screens}</b> screens</span>
            <span><b>{stats.notifs}</b> notifications</span>
            <span className={stats.changes ? 'hot' : ''}><b>{stats.changes}</b> changed in {data.releases.find((r) => r.id === releaseId)?.name}</span>
          </div>
        </div>

        <div className="bd-cols">
          {columns.map(({ w, st, screens }) => (
            <section key={w.id} className="bd-col" style={{ '--c': persona.color } as CSSProperties}>
              <button
                className={`bd-col-head ${st.added ? 'c-added' : st.removed ? 'c-removed' : ''} ${selection?.id === w.id ? 'sel' : ''}`}
                onClick={(e) => { e.stopPropagation(); select({ kind: 'workflow', id: w.id }); }}
              >
                <span className="bd-col-name">{w.name}</span>
                {(st.added || st.removed) && <span className={`badge b-${st.added ? 'added' : 'removed'}`}>{st.added ? 'new' : 'removed'}</span>}
                <small>{plural(screens.length, 'screen')}</small>
              </button>

              {screens.map(({ s, st: sst, notifs }, i) => {
                const nodeId = `s:${s.id}`;
                const vNum = sst.history.length;
                return (
                  <div key={s.id} className="bd-step">
                    {i > 0 && <ArrowDown size={14} className="bd-arrow" />}
                    <article
                      className={`bd-card ${sst.change ? `chg c-${sst.change.changeType}` : ''} ${selection?.id === s.id ? 'sel' : ''} ${hoverNode === nodeId ? 'hl' : ''}`}
                      {...target(nodeId, { kind: 'screen', screen: s }, () => select({ kind: 'screen', id: s.id }))}
                    >
                      {sst.change && <ChangeTag type={sst.change.changeType} />}
                      <div className="bd-thumb">
                        {sst.removed ? <div className="thumb-removed">Removed</div> : <ScreenImage imageId={sst.current?.imageId} color={persona.color} name={s.name} />}
                        <span className="ver-pill" style={{ '--c': persona.color } as CSSProperties}>v{vNum}</span>
                      </div>
                      <div className="bd-card-body">
                        <div className="bd-card-title">{s.name}</div>
                        {sst.change && (
                          <div className="bd-card-chg">{sst.change.crId && <span className="cr">{sst.change.crId}</span>} {sst.change.summary}</div>
                        )}
                      </div>
                      {notifs.length > 0 && (
                        <ul className="bd-notifs">
                          {notifs.map(({ n, st: nst }) => {
                            const chg: ChangeType | undefined = nst.added ? 'added' : nst.removed ? 'removed' : nst.change ? 'modified' : undefined;
                            const nid = `n:${n.id}`;
                            return (
                              <li
                                key={n.id}
                                className={`${chg ? `n-${chg}` : ''} ${hoverNode === nid ? 'hl' : ''} ${selection?.id === n.id ? 'sel' : ''}`}
                                title={[n.trigger, nst.change?.summary].filter(Boolean).join(' — ') || undefined}
                                {...target(nid, { kind: 'notif', notif: n }, () => select({ kind: 'notification', id: n.id }))}
                              >
                                <Bell size={11} /> <span>{n.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  </div>
                );
              })}

              <button
                className="bd-add"
                {...target(`new:${w.id}`, { kind: 'new-screen', workflowId: w.id }, () => setModal(<ScreenForm workflowId={w.id} onClose={close} />))}
              >
                <Plus size={13} /> New screen
              </button>
            </section>
          ))}

          <button className="bd-col bd-col-add" onClick={(e) => { e.stopPropagation(); setModal(<WorkflowForm personaId={persona.id} onClose={close} />); }}>
            <Plus size={16} /> Workflow
          </button>
        </div>

        <div className="bd-legend">
          <span><i className="lg-dot" style={{ background: 'var(--added)' }} /> added</span>
          <span><i className="lg-dot" style={{ background: 'var(--modified)' }} /> modified</span>
          <span><i className="lg-dot" style={{ background: 'var(--removed)' }} /> removed</span>
          <span className="muted">in the selected release · click a card for details & history</span>
          <button className="link" onClick={() => openInFlow(persona.id)}><Crosshair size={12} /> open in user flow</button>
        </div>
      </main>
      {modal}
    </div>
  );
}

const ChangeTag = ({ type }: { type: ChangeType }) => <span className={`chg-badge b-${type}`}>{type}</span>;
