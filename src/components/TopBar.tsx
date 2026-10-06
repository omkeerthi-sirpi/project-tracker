import { useState } from 'react';
import { Network, GitBranch, History, LayoutGrid, Plus } from 'lucide-react';
import { useStore } from '../store';
import { changesForRelease } from '../lib/derive';
import { ReleaseForm } from './Forms';

export function TopBar() {
  const { data, releaseId, view, patch, select } = useStore();
  const [modal, setModal] = useState(false);

  return (
    <header className="topbar">
      <button className="brand" onClick={() => select({ kind: 'root', id: 'root' })}>
        <span className="brand-icon"><GitBranch size={18} /></span>
        <span>
          <strong>CMP Flow Tracker</strong>
          <small>Personas · workflows · screens · notifications</small>
        </span>
      </button>

      <div className="seg">
        <button className={view === 'board' ? 'on' : ''} onClick={() => patch({ view: 'board' })}><LayoutGrid size={14} /> Persona board</button>
        <button className={view === 'userflow' ? 'on' : ''} onClick={() => patch({ view: 'userflow', selection: null })}><Network size={14} /> User flow</button>
        <button className={view === 'changelog' ? 'on' : ''} onClick={() => patch({ view: 'changelog', selection: null })}><History size={14} /> Changelog</button>
      </div>

      <div className="releases" role="tablist" aria-label="Release">
        {data.releases.map((r, i) => {
          const n = changesForRelease(data, r.id).length;
          return (
            <div key={r.id} className="rel-step">
              {i > 0 && <span className="rel-line" />}
              <button className={`rel-pill ${r.id === releaseId ? 'on' : ''}`} onClick={() => patch({ releaseId: r.id })} title={`${r.date}${r.notes ? ' — ' + r.notes : ''}`}>
                <span className="rel-dot" />
                {r.name}
                {n > 0 && <span className="rel-n">{n}</span>}
              </button>
            </div>
          );
        })}
        <button className="rel-add" title="New release / client version" onClick={() => setModal(true)}><Plus size={14} /></button>
      </div>

      {modal && <ReleaseForm onClose={() => setModal(false)} />}
    </header>
  );
}
