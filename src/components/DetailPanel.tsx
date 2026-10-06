import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Bell, ChevronRight, GitCommitHorizontal, Network, Pencil, Plus, RotateCcw, Trash2, User, Workflow as WorkflowIcon, X, Monitor, Ban, Maximize2,
} from 'lucide-react';
import { useStore } from '../store';
import type { ChangeType, ID, NotificationItem, ProjectData, Screen } from '../types';
import { at, changesForRelease, makeCtx, notifAt, screenAt, sortVersions, spanAt } from '../lib/derive';
import { fmtDate, plural } from '../lib/util';
import { ScreenImage } from './ScreenImage';
import { CompareSlider } from './CompareSlider';
import {
  NotificationChangeForm, NotificationForm, PersonaForm, ReleaseForm, ScreenForm, VersionForm, WorkflowForm,
} from './Forms';

type SetModal = (m: ReactNode) => void;

export function DetailPanel() {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const [modal, setModal] = useState<ReactNode>(null);
  if (!selection) return null;

  let body: ReactNode = null;
  switch (selection.kind) {
    case 'root': body = <RootPanel setModal={setModal} />; break;
    case 'persona': body = <PersonaPanel id={selection.id} setModal={setModal} />; break;
    case 'workflow': body = <WorkflowPanel id={selection.id} setModal={setModal} />; break;
    case 'screen': body = <ScreenPanel id={selection.id} setModal={setModal} />; break;
    case 'version': body = <VersionRedirect id={selection.id} />; break;
    case 'notification': body = <NotificationPanel id={selection.id} setModal={setModal} />; break;
  }
  return (
    <aside className="panel">
      <button className="icon-btn panel-close" onClick={() => select(null)} aria-label="Close panel">
        <X size={16} />
      </button>
      <div key={`${selection.kind}:${selection.id}`} className="panel-body">{body}</div>
      {modal}
    </aside>
  );
}

// ---------- helpers ----------

function useLookup() {
  const data = useStore((s) => s.data);
  const releaseId = useStore((s) => s.releaseId);
  return useMemo(() => {
    const c = makeCtx(data, releaseId);
    const rel = (id?: ID) => data.releases.find((r) => r.id === id);
    const wf = (id?: ID) => data.workflows.find((w) => w.id === id);
    const persona = (id?: ID) => data.personas.find((p) => p.id === id);
    const screen = (id?: ID) => data.screens.find((s) => s.id === id);
    const personaOfWf = (id?: ID) => persona(wf(id)?.personaId);
    return { data, releaseId, c, rel, wf, persona, screen, personaOfWf };
  }, [data, releaseId]);
}

const ChangeBadge = ({ type }: { type?: ChangeType }) => (type ? <span className={`badge b-${type}`}>{type}</span> : null);

function Crumbs({ items }: { items: { label: string; kind: 'root' | 'persona' | 'workflow' | 'screen'; id: ID }[] }) {
  const select = useStore((s) => s.select);
  return (
    <nav className="crumbs">
      {items.map((it, i) => (
        <span key={it.id}>
          {i > 0 && <ChevronRight size={12} />}
          <button onClick={() => select({ kind: it.kind, id: it.id })}>{it.label}</button>
        </span>
      ))}
    </nav>
  );
}

function PanelHead({ icon, color, title, sub, actions }: { icon: ReactNode; color: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ph" style={{ '--c': color } as CSSProperties}>
      <span className="ph-icon">{icon}</span>
      <div className="ph-text">
        <h2>{title}</h2>
        {sub && <div className="ph-sub">{sub}</div>}
      </div>
      <div className="ph-actions">{actions}</div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="psec">
      <div className="psec-head">
        <h4>{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListRow({ icon, label, meta, badge, onClick, dim }: { icon?: ReactNode; label: string; meta?: ReactNode; badge?: ReactNode; onClick?: () => void; dim?: boolean }) {
  return (
    <button className={`lrow ${dim ? 'dim' : ''}`} onClick={onClick}>
      {icon}
      <span className="lrow-label">{label}</span>
      {badge}
      {meta && <span className="lrow-meta">{meta}</span>}
      <ChevronRight size={14} className="muted" />
    </button>
  );
}

const confirmDel = (what: string) => window.confirm(`Delete ${what}? This removes it from every release and cannot be undone.`);

// ---------- root ----------

function RootPanel({ setModal }: { setModal: SetModal }) {
  const { data, c } = useLookup();
  const { mut, select, patch, releaseId } = useStore();
  const close = () => setModal(null);
  const releaseUsed = (id: ID) =>
    data.workflows.some((w) => w.addedIn === id || w.removedIn === id) ||
    data.screens.some((s) => s.versions.some((v) => v.releaseId === id)) ||
    data.notifications.some((n) => n.addedIn === id || n.removedIn === id || n.changes.some((x) => x.releaseId === id));

  return (
    <>
      <PanelHead icon={<Network size={18} />} color="#7c6cff" title={data.name} sub="Project overview" />
      <div className="stats">
        <Stat n={data.personas.length} l="Personas" />
        <Stat n={data.workflows.filter((w) => spanAt(c, w.addedIn, w.removedIn).visible).length} l="Workflows" />
        <Stat n={data.screens.filter((s) => screenAt(c, s).visible).length} l="Screens" />
        <Stat n={data.notifications.filter((n) => notifAt(c, n).visible).length} l="Notifications" />
      </div>
      <Section title="Personas" action={<button className="btn tiny" onClick={() => setModal(<PersonaForm onClose={close} />)}><Plus size={13} /> Persona</button>}>
        {data.personas.map((p) => (
          <ListRow
            key={p.id}
            icon={<span className="dot" style={{ background: p.color }} />}
            label={p.name}
            meta={plural(data.workflows.filter((w) => w.personaId === p.id).length, 'workflow')}
            onClick={() => select({ kind: 'persona', id: p.id })}
          />
        ))}
      </Section>
      <Section title="Releases" action={<button className="btn tiny" onClick={() => setModal(<ReleaseForm onClose={close} />)}><Plus size={13} /> Release</button>}>
        {[...data.releases].reverse().map((r) => {
          const n = changesForRelease(data, r.id).length;
          return (
            <div key={r.id} className={`rel-row ${r.id === releaseId ? 'on' : ''}`}>
              <button className="rel-main" onClick={() => patch({ releaseId: r.id })}>
                <strong>{r.name}</strong>
                <span className="muted">{fmtDate(r.date)}</span>
                <span className="pill">{plural(n, 'change')}</span>
              </button>
              <button className="icon-btn" title="Edit" onClick={() => setModal(<ReleaseForm release={r} onClose={close} />)}><Pencil size={13} /></button>
              <button
                className="icon-btn"
                title={releaseUsed(r.id) ? 'Release has recorded changes — remove them first' : 'Delete'}
                disabled={releaseUsed(r.id) || data.releases.length === 1}
                onClick={() => window.confirm(`Delete release ${r.name}?`) && mut((d) => { d.releases = d.releases.filter((x) => x.id !== r.id); })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </Section>
      <Section title="Project">
        <label className="field">
          <span className="field-label">Project name</span>
          <input value={data.name} onChange={(e) => mut((d) => { d.name = e.target.value; })} />
        </label>
      </Section>
    </>
  );
}

const Stat = ({ n, l }: { n: number; l: string }) => (
  <div className="stat">
    <strong>{n}</strong>
    <span>{l}</span>
  </div>
);

// ---------- persona ----------

function PersonaPanel({ id, setModal }: { id: ID; setModal: SetModal }) {
  const { data, c, persona, releaseId } = useLookup();
  const { mut, select } = useStore();
  const p = persona(id);
  if (!p) return <Missing />;
  const close = () => setModal(null);
  const wfs = data.workflows.filter((w) => w.personaId === id);
  const changes = changesForRelease(data, releaseId).filter((e) => e.personaId === id);

  return (
    <>
      <Crumbs items={[{ label: 'Project', kind: 'root', id: 'root' }]} />
      <PanelHead
        icon={<User size={18} />}
        color={p.color}
        title={p.name}
        sub={p.description}
        actions={
          <>
            <button className="icon-btn" title="Edit" onClick={() => setModal(<PersonaForm persona={p} onClose={close} />)}><Pencil size={14} /></button>
            <button
              className="icon-btn danger"
              title="Delete"
              onClick={() => {
                if (!confirmDel(`persona "${p.name}" with all its workflows, screens and notifications`)) return;
                mut((d) => {
                  const wIds = new Set(d.workflows.filter((w) => w.personaId === id).map((w) => w.id));
                  const sIds = new Set(d.screens.filter((s) => wIds.has(s.workflowId)).map((s) => s.id));
                  d.personas = d.personas.filter((x) => x.id !== id);
                  d.workflows = d.workflows.filter((w) => !wIds.has(w.id));
                  d.screens = d.screens.filter((s) => !sIds.has(s.id));
                  d.notifications = d.notifications.filter((n) => !sIds.has(n.screenId));
                });
                select(null);
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        }
      />
      {changes.length > 0 && <div className="callout">{plural(changes.length, 'change')} for this persona in the selected release</div>}
      <Section title="Workflows" action={<button className="btn tiny" onClick={() => setModal(<WorkflowForm personaId={id} onClose={close} />)}><Plus size={13} /> Workflow</button>}>
        {wfs.map((w) => {
          const st = spanAt(c, w.addedIn, w.removedIn);
          const screens = data.screens.filter((s) => s.workflowId === w.id && screenAt(c, s).visible).length;
          return (
            <ListRow
              key={w.id}
              icon={<WorkflowIcon size={14} className="muted" />}
              label={w.name}
              meta={plural(screens, 'screen')}
              badge={<ChangeBadge type={st.added ? 'added' : st.removed ? 'removed' : undefined} />}
              dim={!st.visible}
              onClick={() => select({ kind: 'workflow', id: w.id })}
            />
          );
        })}
      </Section>
    </>
  );
}

// ---------- workflow ----------

function WorkflowPanel({ id, setModal }: { id: ID; setModal: SetModal }) {
  const { data, c, wf, persona, releaseId } = useLookup();
  const { mut, select, patch } = useStore();
  const w = wf(id);
  if (!w) return <Missing />;
  const p = persona(w.personaId)!;
  const close = () => setModal(null);
  const st = spanAt(c, w.addedIn, w.removedIn);
  const screens = data.screens.filter((s) => s.workflowId === id).map((s) => ({ s, st: screenAt(c, s) }));

  return (
    <>
      <Crumbs items={[{ label: 'Project', kind: 'root', id: 'root' }, { label: p.name, kind: 'persona', id: p.id }]} />
      <PanelHead
        icon={<WorkflowIcon size={17} />}
        color={p.color}
        title={w.name}
        sub={<>Introduced in {data.releases.find((r) => r.id === w.addedIn)?.name} {w.removedIn && <>· removed in {data.releases.find((r) => r.id === w.removedIn)?.name}</>} <ChangeBadge type={st.added ? 'added' : st.removed ? 'removed' : undefined} /></>}
        actions={
          <>
            <button className="icon-btn" title="Edit" onClick={() => setModal(<WorkflowForm personaId={p.id} workflow={w} onClose={close} />)}><Pencil size={14} /></button>
            {w.removedIn ? (
              <button className="icon-btn" title="Restore workflow" onClick={() => mut((d) => { delete d.workflows.find((x) => x.id === id)!.removedIn; })}><RotateCcw size={14} /></button>
            ) : (
              <button className="icon-btn" title="Mark removed in the selected release" disabled={at(c, w.addedIn) >= c.r} onClick={() => mut((d) => { d.workflows.find((x) => x.id === id)!.removedIn = releaseId; })}><Ban size={14} /></button>
            )}
            <button
              className="icon-btn danger"
              title="Delete"
              onClick={() => {
                if (!confirmDel(`workflow "${w.name}" and its screens`)) return;
                mut((d) => {
                  const sIds = new Set(d.screens.filter((s) => s.workflowId === id).map((s) => s.id));
                  d.workflows = d.workflows.filter((x) => x.id !== id);
                  d.screens = d.screens.filter((s) => !sIds.has(s.id));
                  d.notifications = d.notifications.filter((n) => !sIds.has(n.screenId));
                });
                select({ kind: 'persona', id: p.id });
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        }
      />
      {w.description && <p className="desc">{w.description}</p>}
      <Section title="Screens" action={<button className="btn tiny" onClick={() => setModal(<ScreenForm workflowId={id} onClose={close} />)}><Plus size={13} /> Screen</button>}>
        <div className="screen-grid">
          {screens.map(({ s, st }) => {
            const all = sortVersions(c, s.versions);
            const first = all[0];
            return (
              <button key={s.id} className={`screen-card ${st.visible ? '' : 'dim'}`} onClick={() => {
                if (!st.visible && first && at(c, first.releaseId) > c.r) patch({ releaseId: first.releaseId });
                select({ kind: 'screen', id: s.id });
              }}>
                <ScreenImage imageId={st.current?.imageId ?? first?.imageId} color={p.color} name={s.name} />
                <div className="sc-foot">
                  <span>{s.name}</span>
                  <ChangeBadge type={st.change?.changeType} />
                  {!st.visible && <span className="pill">{st.removed ? 'removed' : `from ${data.releases.find((r) => r.id === first?.releaseId)?.name}`}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {!screens.length && <p className="muted small">No screens yet.</p>}
      </Section>
    </>
  );
}

// ---------- screen ----------

function ScreenPanel({ id, setModal }: { id: ID; setModal: SetModal }) {
  const { data, c, screen, wf, persona, rel } = useLookup();
  const { mut, select, patch } = useStore();
  const s = screen(id);
  const [cmp, setCmp] = useState<[ID, ID] | null>(null);
  if (!s) return <Missing />;
  const w = wf(s.workflowId)!;
  const p = persona(w.personaId)!;
  const close = () => setModal(null);
  const st = screenAt(c, s);
  const all = sortVersions(c, s.versions);
  const notifs = data.notifications.filter((n) => n.screenId === id);
  const imaged = all.filter((v) => v.imageId);
  const lightbox = (imageId: string | undefined, title: string) => patch({ lightbox: { imageId, title, color: p.color } });
  const startCompare = () => {
    const cur = st.current ?? all.at(-1)!;
    const i = imaged.indexOf(cur);
    const prev = imaged[i - 1] ?? imaged[0];
    setCmp([prev.id, (imaged[i] ?? imaged.at(-1)!).id]);
  };
  const vName = (vid: ID) => {
    const v = all.find((x) => x.id === vid)!;
    return `v${all.indexOf(v) + 1} · ${rel(v.releaseId)?.name}`;
  };

  return (
    <>
      <Crumbs items={[{ label: 'Project', kind: 'root', id: 'root' }, { label: p.name, kind: 'persona', id: p.id }, { label: w.name, kind: 'workflow', id: w.id }]} />
      <PanelHead
        icon={<Monitor size={17} />}
        color={p.color}
        title={s.name}
        sub={<>Showing <b>v{st.current ? all.indexOf(st.current) + 1 : '—'}</b> as of {rel(data.releases[c.r]?.id)?.name} <ChangeBadge type={st.change?.changeType} /></>}
        actions={
          <>
            <button className="icon-btn" title="Edit name/description" onClick={() => setModal(<ScreenForm workflowId={w.id} screen={s} onClose={close} />)}><Pencil size={14} /></button>
            <button
              className="icon-btn danger"
              title="Delete screen"
              onClick={() => {
                if (!confirmDel(`screen "${s.name}", all its versions and notifications`)) return;
                mut((d) => {
                  d.screens = d.screens.filter((x) => x.id !== id);
                  d.notifications = d.notifications.filter((n) => n.screenId !== id);
                });
                select({ kind: 'workflow', id: w.id });
              }}
            >
              <Trash2 size={14} />
            </button>
          </>
        }
      />
      {s.description && <p className="desc">{s.description}</p>}

      <div className="hero">
        {st.removed ? (
          <div className="thumb-removed big">Removed in this release</div>
        ) : (
          <ScreenImage imageId={st.current?.imageId} color={p.color} name={s.name} onClick={() => lightbox(st.current?.imageId, s.name)} />
        )}
        {!st.visible && <div className="hero-note">Not part of the selected release</div>}
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={() => setModal(<VersionForm screen={s} onClose={close} />)}><Plus size={14} /> New version</button>
        <button className="btn" disabled={imaged.length < 2} onClick={() => (cmp ? setCmp(null) : startCompare())}>{cmp ? 'Hide compare' : 'Compare versions'}</button>
      </div>

      {cmp && (
        <Section title="Compare">
          <div className="row2 compact">
            {[0, 1].map((k) => (
              <select key={k} value={cmp[k]} onChange={(e) => setCmp(k === 0 ? [e.target.value, cmp[1]] : [cmp[0], e.target.value])}>
                {imaged.map((v) => <option key={v.id} value={v.id}>{vName(v.id)}</option>)}
              </select>
            ))}
          </div>
          <CompareSlider
            a={all.find((v) => v.id === cmp[0])?.imageId}
            b={all.find((v) => v.id === cmp[1])?.imageId}
            labelA={vName(cmp[0])}
            labelB={vName(cmp[1])}
            color={p.color}
          />
        </Section>
      )}

      <Section title={`Version history (${all.length})`}>
        <ol className="timeline" style={{ '--c': p.color } as CSSProperties}>
          {[...all].reverse().map((v) => {
            const n = all.indexOf(v) + 1;
            const future = at(c, v.releaseId) > c.r;
            return (
              <li key={v.id} className={`tl-item ${future ? 'future' : ''} ${v === st.current ? 'current' : ''}`}>
                <span className={`tl-dot d-${v.changeType}`} />
                <div className="tl-body">
                  <div className="tl-head">
                    <strong>v{n}</strong>
                    <button className="link" onClick={() => patch({ releaseId: v.releaseId })}>{rel(v.releaseId)?.name}</button>
                    <ChangeBadge type={v.changeType} />
                    {v.crId && <span className="cr">{v.crId}</span>}
                    {future && <span className="pill">future</span>}
                    <span className="grow" />
                    <button className="icon-btn" title="Edit version" onClick={() => setModal(<VersionForm screen={s} version={v} onClose={close} />)}><Pencil size={12} /></button>
                    <button
                      className="icon-btn danger"
                      title="Delete version"
                      disabled={all.length === 1}
                      onClick={() => window.confirm(`Delete v${n}?`) && mut((d) => {
                        const x = d.screens.find((y) => y.id === id)!;
                        x.versions = x.versions.filter((y) => y.id !== v.id);
                      })}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="tl-summary">{v.summary}</div>
                  {v.details && <div className="tl-details">{v.details}</div>}
                  <div className="tl-meta">{[v.author, fmtDate(v.createdAt)].filter(Boolean).join(' · ')}</div>
                  {v.imageId && (
                    <div className="tl-thumb">
                      <ScreenImage imageId={v.imageId} color={p.color} name={s.name} onClick={() => lightbox(v.imageId, `${s.name} — v${n}`)} />
                      <button className="icon-btn" onClick={() => lightbox(v.imageId, `${s.name} — v${n}`)}><Maximize2 size={12} /></button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title={`Notifications (${notifs.filter((n) => notifAt(c, n).visible).length})`} action={<button className="btn tiny" onClick={() => setModal(<NotificationForm screenId={id} onClose={close} />)}><Plus size={13} /> Notification</button>}>
        <NotifList notifs={notifs} data={data} />
      </Section>
    </>
  );
}

function NotifList({ notifs, data }: { notifs: NotificationItem[]; data: ProjectData }) {
  const { select, releaseId } = useStore();
  const c = makeCtx(data, releaseId);
  if (!notifs.length) return <p className="muted small">No notifications on this screen.</p>;
  return (
    <>
      {notifs.map((n) => {
        const st = notifAt(c, n);
        return (
          <ListRow
            key={n.id}
            icon={<Bell size={13} className="muted" />}
            label={n.title}
            meta={n.channel}
            dim={!st.visible}
            badge={<ChangeBadge type={st.added ? 'added' : st.removed ? 'removed' : st.change ? 'modified' : undefined} />}
            onClick={() => select({ kind: 'notification', id: n.id })}
          />
        );
      })}
    </>
  );
}

/** Version nodes open their screen's panel (history lives there). */
function VersionRedirect({ id }: { id: ID }) {
  const { data } = useLookup();
  const select = useStore((s) => s.select);
  const s: Screen | undefined = data.screens.find((x) => x.versions.some((v) => v.id === id));
  if (s) queueMicrotask(() => select({ kind: 'screen', id: s.id }));
  return <div className="muted small" style={{ padding: 16 }}><GitCommitHorizontal size={14} /> Opening version…</div>;
}

// ---------- notification ----------

function NotificationPanel({ id, setModal }: { id: ID; setModal: SetModal }) {
  const { data, c, screen, wf, persona, rel, releaseId } = useLookup();
  const { mut, select } = useStore();
  const n = data.notifications.find((x) => x.id === id);
  if (!n) return <Missing />;
  const s = screen(n.screenId)!;
  const w = wf(s.workflowId)!;
  const p = persona(w.personaId)!;
  const close = () => setModal(null);
  const st = notifAt(c, n);

  return (
    <>
      <Crumbs items={[{ label: p.name, kind: 'persona', id: p.id }, { label: w.name, kind: 'workflow', id: w.id }, { label: s.name, kind: 'screen', id: s.id }]} />
      <PanelHead
        icon={<Bell size={17} />}
        color={p.color}
        title={n.title}
        sub={<>{n.channel} · since {rel(n.addedIn)?.name}{n.removedIn && <> · removed in {rel(n.removedIn)?.name}</>} <ChangeBadge type={st.added ? 'added' : st.removed ? 'removed' : st.change ? 'modified' : undefined} /></>}
        actions={
          <>
            <button className="icon-btn" title="Edit" onClick={() => setModal(<NotificationForm screenId={s.id} notif={n} onClose={close} />)}><Pencil size={14} /></button>
            <button className="icon-btn danger" title="Delete" onClick={() => {
              if (!confirmDel(`notification "${n.title}"`)) return;
              mut((d) => { d.notifications = d.notifications.filter((x) => x.id !== id); });
              select({ kind: 'screen', id: s.id });
            }}><Trash2 size={14} /></button>
          </>
        }
      />
      {n.trigger && <p className="desc"><b>Trigger:</b> {n.trigger}</p>}
      <div className="btn-row">
        <button className="btn primary" onClick={() => setModal(<NotificationChangeForm notif={n} onClose={close} />)}><Plus size={14} /> Record change</button>
        {n.removedIn ? (
          <button className="btn" onClick={() => mut((d) => { delete d.notifications.find((x) => x.id === id)!.removedIn; })}><RotateCcw size={14} /> Restore</button>
        ) : (
          <button className="btn" disabled={at(c, n.addedIn) >= c.r} title={at(c, n.addedIn) >= c.r ? 'Select a later release to remove it in' : undefined}
            onClick={() => mut((d) => { d.notifications.find((x) => x.id === id)!.removedIn = releaseId; })}>
            <Ban size={14} /> Remove in {rel(releaseId)?.name}
          </button>
        )}
      </div>
      <Section title="History">
        <ol className="timeline" style={{ '--c': p.color } as CSSProperties}>
          {n.removedIn && <TL type="removed" release={rel(n.removedIn)?.name} text="Notification removed" />}
          {[...n.changes].sort((a, b) => at(c, b.releaseId) - at(c, a.releaseId)).map((ch) => (
            <TL key={ch.id} type="modified" release={rel(ch.releaseId)?.name} text={ch.summary} cr={ch.crId}
              onDelete={() => mut((d) => {
                const x = d.notifications.find((y) => y.id === id)!;
                x.changes = x.changes.filter((y) => y.id !== ch.id);
              })} />
          ))}
          <TL type="added" release={rel(n.addedIn)?.name} text="Notification introduced" />
        </ol>
      </Section>
    </>
  );
}

function TL({ type, release, text, cr, onDelete }: { type: ChangeType; release?: string; text: string; cr?: string; onDelete?: () => void }) {
  return (
    <li className="tl-item">
      <span className={`tl-dot d-${type}`} />
      <div className="tl-body">
        <div className="tl-head">
          <strong>{release}</strong>
          <ChangeBadge type={type} />
          {cr && <span className="cr">{cr}</span>}
          <span className="grow" />
          {onDelete && <button className="icon-btn danger" onClick={onDelete}><Trash2 size={12} /></button>}
        </div>
        <div className="tl-summary">{text}</div>
      </div>
    </li>
  );
}

const Missing = () => <p className="muted small" style={{ padding: 16 }}>This item no longer exists.</p>;
