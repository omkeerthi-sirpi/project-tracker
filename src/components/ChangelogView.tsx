import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, Bell, Check, Copy, Crosshair, Monitor, Workflow } from 'lucide-react';
import { useStore } from '../store';
import { changelogMarkdown, changesForRelease, type ChangeEntry } from '../lib/derive';
import { fmtDate, plural } from '../lib/util';
import { ScreenImage } from './ScreenImage';
import { CompareSlider } from './CompareSlider';
import { Modal } from './Modal';
import { openInFlow } from '../userflow/store';

const KIND_ICON = { workflow: Workflow, screen: Monitor, notification: Bell };

export function ChangelogView() {
  const data = useStore((s) => s.data);
  const releaseId = useStore((s) => s.releaseId);
  const { patch } = useStore.getState();
  const [copied, setCopied] = useState(false);
  const [compare, setCompare] = useState<ChangeEntry | null>(null);

  const rel = data.releases.find((r) => r.id === releaseId);
  const entries = useMemo(() => changesForRelease(data, releaseId), [data, releaseId]);
  const counts = { added: 0, modified: 0, removed: 0 };
  entries.forEach((e) => counts[e.action]++);
  const color = (pid: string) => data.personas.find((p) => p.id === pid)?.color ?? '#7c6cff';

  return (
    <div className="changelog">
      <aside className="cl-side">
        <h4>Releases</h4>
        {[...data.releases].reverse().map((r) => {
          const n = changesForRelease(data, r.id).length;
          return (
            <button key={r.id} className={`cl-rel ${r.id === releaseId ? 'on' : ''}`} onClick={() => patch({ releaseId: r.id })}>
              <span className="cl-rel-dot" />
              <span className="cl-rel-text">
                <strong>{r.name}</strong>
                <small>{fmtDate(r.date)}</small>
              </span>
              <span className="pill">{n}</span>
            </button>
          );
        })}
      </aside>

      <main className="cl-main">
        <div className="cl-head">
          <div>
            <h1>{rel?.name} <span className="muted">· {fmtDate(rel?.date)}</span></h1>
            {rel?.notes && <p className="muted">{rel.notes}</p>}
            <div className="chips">
              <span className="badge b-added">{counts.added} added</span>
              <span className="badge b-modified">{counts.modified} modified</span>
              <span className="badge b-removed">{counts.removed} removed</span>
            </div>
          </div>
          <button
            className="btn"
            onClick={async () => {
              await navigator.clipboard.writeText(changelogMarkdown(data, releaseId));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy as Markdown'}
          </button>
        </div>

        {!entries.length && <div className="empty">No changes recorded for this release yet. Open a screen in the graph and add a <b>New version</b>.</div>}

        {data.personas.map((p) => {
          const pe = entries.filter((e) => e.personaId === p.id);
          if (!pe.length) return null;
          return (
            <section key={p.id} className="cl-persona" style={{ '--c': p.color } as CSSProperties}>
              <h3><span className="dot" style={{ background: p.color }} /> {p.name} <span className="muted small">{plural(pe.length, 'change')}</span></h3>
              <div className="cl-grid">
                {pe.map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  const wf = data.workflows.find((w) => w.id === e.workflowId)?.name;
                  const scr = e.kind === 'notification' ? data.screens.find((s) => s.id === e.screenId)?.name : undefined;
                  return (
                    <article key={e.key} className={`cl-card c-${e.action}`}>
                      <div className="cl-card-head">
                        <Icon size={14} />
                        <span className="cl-kind">{e.kind}</span>
                        <span className={`badge b-${e.action}`}>{e.action}</span>
                        {e.crId && <span className="cr">{e.crId}</span>}
                        <span className="grow" />
                        <button className="icon-btn" title="Show in user flow" onClick={() => openInFlow(e.itemId)}>
                          <Crosshair size={13} />
                        </button>
                      </div>
                      <h4>{e.title}</h4>
                      <p className="cl-where">{[wf, scr].filter(Boolean).join(' › ')}</p>
                      <p>{e.summary}</p>
                      {e.details && <p className="muted small">{e.details}</p>}
                      {e.kind === 'screen' && (
                        <div className="cl-shots" onClick={() => e.prevVersion?.imageId && e.version?.imageId && setCompare(e)}>
                          {e.prevVersion ? (
                            <ScreenImage imageId={e.prevVersion.imageId} color={color(e.personaId)} name="before" />
                          ) : (
                            <div className="thumb-new">New screen</div>
                          )}
                          <ArrowRight size={16} className="muted" />
                          {e.action === 'removed' ? (
                            <div className="thumb-removed">Removed</div>
                          ) : (
                            <ScreenImage imageId={e.version?.imageId} color={color(e.personaId)} name="after" />
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {compare && (
        <Modal title={`${compare.title} — before / after`} onClose={() => setCompare(null)} wide>
          <CompareSlider
            a={compare.prevVersion?.imageId}
            b={compare.version?.imageId}
            labelA="Before"
            labelB={`After (${rel?.name})`}
            color={color(compare.personaId)}
          />
        </Modal>
      )}
    </div>
  );
}
