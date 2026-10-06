import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { FolderKanban, GitBranch, Inbox, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { createProject, deleteProject, loadProjectData, openProject, updateProject, useStore } from '../store';
import type { ProjectData, ProjectMeta, Release } from '../types';
import { changesForRelease, makeCtx, screenAt, spanAt } from '../lib/derive';
import { PERSONA_COLORS, fmtDate, plural } from '../lib/util';
import { Field, Modal } from './Modal';

interface Summary {
  personas: { name: string; color: string }[];
  workflows: number;
  screens: number;
  notifications: number;
  latest?: Release;
  latestChanges: number;
  openCRs: number;
}

/** Counts as of the project's latest release, so removed items are not counted. */
function summarize(d: ProjectData): Summary {
  const latest = d.releases.at(-1);
  const c = makeCtx(d, latest?.id ?? '');
  return {
    personas: d.personas.map((p) => ({ name: p.name, color: p.color })),
    workflows: d.workflows.filter((w) => spanAt(c, w.addedIn, w.removedIn).visible).length,
    screens: d.screens.filter((s) => { const st = screenAt(c, s); return st.visible && !st.removed; }).length,
    notifications: d.notifications.filter((n) => { const st = spanAt(c, n.addedIn, n.removedIn); return st.visible && !st.removed; }).length,
    latest,
    latestChanges: latest ? changesForRelease(d, latest.id).length : 0,
    openCRs: (d.changeRequests ?? []).filter((x) => x.status === 'open').length,
  };
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? plural(days, 'day') + ' ago' : fmtDate(iso);
}

/** "Patient Portal" → PP, "CMP" → CM. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words.map((w) => w[0]).join('') : name.trim()).slice(0, 2).toUpperCase();
}

export function Dashboard() {
  const projects = useStore((s) => s.projects);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ project?: ProjectMeta } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, Summary> = {};
      for (const p of projects) {
        const d = await loadProjectData(p.id);
        if (d) out[p.id] = summarize(d);
      }
      if (alive) setSummaries(out);
    })();
    return () => {
      alive = false;
    };
  }, [projects]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...projects]
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.description?.toLowerCase().includes(t))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [projects, q]);

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="brand">
          <span className="brand-icon"><GitBranch size={18} /></span>
          <span>
            <strong>Flow Tracker</strong>
            <small>Personas · workflows · screens · notifications</small>
          </span>
        </div>
        <div className="dash-search">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" />
        </div>
        <button className="btn primary" onClick={() => setForm({})}><Plus size={14} /> New project</button>
      </header>

      <main className="dash-main">
        <div className="dash-head">
          <h1>Projects</h1>
          <p className="muted">{plural(projects.length, 'project')} · open one to see its personas, workflows, screens and change requests</p>
        </div>

        <div className="dash-grid">
          {shown.map((p) => {
            const s = summaries[p.id];
            return (
              <article
                key={p.id}
                className="pj-card"
                style={{ '--c': p.color } as CSSProperties}
                onClick={() => openProject(p.id)}
                onKeyDown={(e) => e.key === 'Enter' && openProject(p.id)}
                tabIndex={0}
                role="link"
              >
                <div className="pj-top">
                  <span className="pj-avatar">{initials(p.name)}</span>
                  <div className="pj-title">
                    <h3>{p.name}</h3>
                    {p.description && <p>{p.description}</p>}
                  </div>
                  <div className="pj-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title="Edit project" onClick={() => setForm({ project: p })}><Pencil size={13} /></button>
                    <button
                      className="icon-btn danger"
                      title="Delete project"
                      onClick={() => window.confirm(`Delete "${p.name}" and everything in it? This cannot be undone.`) && deleteProject(p.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="pj-stats">
                  {([['Personas', s?.personas.length], ['Workflows', s?.workflows], ['Screens', s?.screens], ['Notifications', s?.notifications]] as const).map(([label, n]) => (
                    <div key={label}><b>{n ?? '–'}</b><span>{label}</span></div>
                  ))}
                </div>

                {s && s.personas.length > 0 && (
                  <div className="pj-personas">
                    {s.personas.slice(0, 8).map((x) => <span key={x.name} title={x.name} style={{ background: x.color }}>{initials(x.name)}</span>)}
                    {s.personas.length > 8 && <span className="more">+{s.personas.length - 8}</span>}
                  </div>
                )}

                <div className="pj-foot">
                  {s?.latest ? (
                    <span className="pj-rel">
                      <span className="rel-dot" /> {s.latest.name}
                      {s.latestChanges > 0 && <em>{plural(s.latestChanges, 'change')}</em>}
                    </span>
                  ) : <span className="muted">No releases</span>}
                  {!!s?.openCRs && <span className="pj-crs"><Inbox size={12} /> {s.openCRs} open</span>}
                  <span className="grow" />
                  <span className="muted small">Updated {ago(p.updatedAt)}</span>
                </div>
              </article>
            );
          })}

          {!q && (
            <button className="pj-card pj-new" onClick={() => setForm({})}>
              <FolderKanban size={22} />
              <strong>New project</strong>
              <span className="muted small">Start tracking another product's flows</span>
            </button>
          )}
        </div>
        {q && !shown.length && <div className="empty">No project matches “{q}”.</div>}
      </main>

      {form && <ProjectForm project={form.project} onClose={() => setForm(null)} />}
    </div>
  );
}

function ProjectForm({ project, onClose }: { project?: ProjectMeta; onClose: () => void }) {
  const count = useStore((s) => s.projects.length);
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? PERSONA_COLORS[count % PERSONA_COLORS.length]);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const meta = { name: name.trim(), description: description.trim() || undefined, color };
    if (project) await updateProject(project.id, meta);
    else await createProject(meta);
    onClose();
  };
  return (
    <Modal
      title={project ? 'Edit project' : 'New project'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="modal-form" className="btn primary" disabled={!name.trim() || busy}>{project ? 'Save' : 'Create & open'}</button>
        </>
      }
    >
      <form id="modal-form" onSubmit={submit} className="form">
        <Field label="Project name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Patient Portal" />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the product is, who the client is" />
        </Field>
        <Field label="Colour">
          <div className="swatches">
            {PERSONA_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </Field>
        {!project && <p className="muted small">The project starts with release v1.0. Add personas, workflows and screens on its Persona board.</p>}
      </form>
    </Modal>
  );
}
