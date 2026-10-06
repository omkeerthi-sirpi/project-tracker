import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import type { ChangeRequest, ChangeType, Channel, ID, NotifType, NotificationItem, Persona, Release, Screen, ScreenVersion, Workflow } from '../types';
import { saveImage } from '../lib/images';
import { makeCtx, at, sortVersions } from '../lib/derive';
import { PERSONA_COLORS, today, uid } from '../lib/util';
import { Field, Modal } from './Modal';
import { ImageDrop } from './ImageDrop';

type Close = { onClose: () => void };
/** Pre-fills a form from an inbox CR; onApplied marks the CR as placed in the flow. */
type FromCR = { cr?: ChangeRequest; onApplied?: (nodeId: string, releaseId: ID) => void };

function Footer({ onClose, label = 'Save', disabled }: Close & { label?: string; disabled?: boolean }) {
  return (
    <>
      <button type="button" className="btn ghost" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form="modal-form" className="btn primary" disabled={disabled}>
        {label}
      </button>
    </>
  );
}

export function ReleaseSelect({ value, onChange, minId }: { value: ID; onChange: (id: ID) => void; minId?: ID }) {
  const data = useStore((s) => s.data);
  const c = makeCtx(data, value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {data.releases.map((r) => (
        <option key={r.id} value={r.id} disabled={!!minId && at(c, r.id) < at(c, minId)}>
          {r.name} — {r.date}
        </option>
      ))}
    </select>
  );
}

export function ReleaseForm({ release, onClose }: Close & { release?: Release }) {
  const { mut, patch, data } = useStore();
  const last = data.releases.at(-1)?.name ?? 'v1.0';
  const nextName = last.replace(/(\d+)(?!.*\d)/, (n) => String(+n + 1));
  const [name, setName] = useState(release?.name ?? nextName);
  const [date, setDate] = useState(release?.date ?? today());
  const [notes, setNotes] = useState(release?.notes ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = release?.id ?? uid('rel');
    mut((d) => {
      const r = d.releases.find((x) => x.id === id);
      if (r) Object.assign(r, { name, date, notes });
      else d.releases.push({ id, name, date, notes });
    });
    if (!release) patch({ releaseId: id });
    onClose();
  };
  return (
    <Modal title={release ? `Edit ${release.name}` : 'New release / client version'} onClose={onClose} footer={<Footer onClose={onClose} disabled={!name.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <div className="row2">
          <Field label="Version name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="v1.3" />
          </Field>
          <Field label="Release date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Notes" hint="What this delivery is about, e.g. client feedback round, CR batch">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!release && <p className="muted small">After creating it, open any screen and click <b>New version</b> to record what changed in this release.</p>}
      </form>
    </Modal>
  );
}

export function PersonaForm({ persona, onClose }: Close & { persona?: Persona }) {
  const { mut, data } = useStore();
  const [name, setName] = useState(persona?.name ?? '');
  const [color, setColor] = useState(persona?.color ?? PERSONA_COLORS[data.personas.length % PERSONA_COLORS.length]);
  const [description, setDescription] = useState(persona?.description ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut((d) => {
      const p = persona && d.personas.find((x) => x.id === persona.id);
      if (p) Object.assign(p, { name, color, description });
      else d.personas.push({ id: uid('per'), name, color, description });
    });
    onClose();
  };
  return (
    <Modal title={persona ? 'Edit persona' : 'New persona'} onClose={onClose} footer={<Footer onClose={onClose} disabled={!name.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cohort Facilitator" />
        </Field>
        <Field label="Colour">
          <div className="swatches">
            {PERSONA_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </Field>
        <Field label="Description">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function WorkflowForm({ personaId, workflow, onClose }: Close & { personaId: ID; workflow?: Workflow }) {
  const { mut, releaseId } = useStore();
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [addedIn, setAddedIn] = useState(workflow?.addedIn ?? releaseId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut((d) => {
      const w = workflow && d.workflows.find((x) => x.id === workflow.id);
      if (w) Object.assign(w, { name, description, addedIn });
      else d.workflows.push({ id: uid('wf'), personaId, name, description, addedIn });
    });
    onClose();
  };
  return (
    <Modal title={workflow ? 'Edit workflow' : 'New workflow'} onClose={onClose} footer={<Footer onClose={onClose} disabled={!name.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manage Participants" />
        </Field>
        <Field label="Introduced in release">
          <ReleaseSelect value={addedIn} onChange={setAddedIn} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

export function ScreenForm({ workflowId, screen, onClose, cr, onApplied }: Close & FromCR & { workflowId: ID; screen?: Screen }) {
  const { mut, releaseId, select } = useStore();
  const [name, setName] = useState(screen?.name ?? '');
  const [description, setDescription] = useState(screen?.description ?? cr?.details ?? '');
  const [rel, setRel] = useState(releaseId);
  const [crId, setCrId] = useState(cr?.crId ?? '');
  const [img, setImg] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (screen) {
      mut((d) => Object.assign(d.screens.find((s) => s.id === screen.id)!, { name, description }));
    } else {
      const imageId = img ? await saveImage(img) : undefined;
      const id = uid('scr');
      mut((d) => {
        d.screens.push({
          id,
          workflowId,
          name,
          description,
          versions: [{ id: uid('ver'), releaseId: rel, changeType: 'added', summary: cr?.title ?? 'Initial version', crId: crId || undefined, imageId, createdAt: today() }],
        });
      });
      onApplied?.(`s:${id}`, rel);
      select({ kind: 'screen', id });
    }
    onClose();
  };
  return (
    <Modal title={screen ? 'Edit screen' : 'New screen'} onClose={onClose} wide={!screen} footer={<Footer onClose={onClose} disabled={!name.trim() || busy} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <div className="row2">
          <Field label="Screen name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Participants List" />
          </Field>
          {!screen && (
            <Field label="Introduced in release">
              <ReleaseSelect value={rel} onChange={setRel} />
            </Field>
          )}
        </div>
        <Field label="Description">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {!screen && (
          <>
            <Field label="Change request / ticket (optional)">
              <input value={crId} onChange={(e) => setCrId(e.target.value)} placeholder="CR-130" />
            </Field>
            <Field label="Screenshot">
              <ImageDrop value={img} onChange={setImg} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}

export function VersionForm({ screen, version, onClose, cr, onApplied }: Close & FromCR & { screen: Screen; version?: ScreenVersion }) {
  const { mut, releaseId, data } = useStore();
  const c = makeCtx(data, releaseId);
  const sorted = sortVersions(c, screen.versions);
  const used = new Set(screen.versions.filter((v) => v.id !== version?.id).map((v) => v.releaseId));
  const firstFree = data.releases.find((r) => !used.has(r.id) && at(c, r.id) >= at(c, sorted[0]?.releaseId))?.id ?? releaseId;
  const [rel, setRel] = useState(version?.releaseId ?? (used.has(releaseId) ? firstFree : releaseId));
  const [changeType, setChangeType] = useState<ChangeType>(version?.changeType ?? 'modified');
  const [summary, setSummary] = useState(version?.summary ?? cr?.title ?? '');
  const [details, setDetails] = useState(version?.details ?? cr?.details ?? '');
  const [crId, setCrId] = useState(version?.crId ?? cr?.crId ?? '');
  const [author, setAuthor] = useState(version?.author ?? localStorageGet('cmp-author'));
  const [img, setImg] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const clash = used.has(rel);
  const isFirst = version && sorted[0]?.id === version.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    localStorageSet('cmp-author', author);
    const imageId = img ? await saveImage(img) : undefined;
    mut((d) => {
      const s = d.screens.find((x) => x.id === screen.id)!;
      const fields = { releaseId: rel, changeType, summary, details, crId: crId || undefined, author: author || undefined };
      const v = version && s.versions.find((x) => x.id === version.id);
      if (v) Object.assign(v, fields, imageId ? { imageId } : {});
      else {
        // No new screenshot → carry the previous one forward so the node still has a picture.
        const prev = sortVersions(makeCtx(d, rel), s.versions).filter((x) => x.imageId).at(-1);
        s.versions.push({ id: uid('ver'), ...fields, imageId: changeType === 'removed' ? undefined : (imageId ?? prev?.imageId), createdAt: today() });
      }
    });
    onApplied?.(`s:${screen.id}`, rel);
    onClose();
  };

  return (
    <Modal
      title={version ? `Edit version — ${screen.name}` : `New version — ${screen.name}`}
      onClose={onClose}
      wide
      footer={<Footer onClose={onClose} label={version ? 'Save' : 'Add version'} disabled={!summary.trim() || clash || busy} />}
    >
      <form id="modal-form" onSubmit={submit} className="form">
        <div className="row3">
          <Field label="Release" hint={clash ? 'This screen already has a version in that release' : undefined}>
            <ReleaseSelect value={rel} onChange={setRel} />
          </Field>
          <Field label="Change type">
            <select value={changeType} onChange={(e) => setChangeType(e.target.value as ChangeType)} disabled={!!isFirst}>
              {isFirst && <option value="added">Added</option>}
              <option value="modified">Modified</option>
              <option value="removed">Removed</option>
            </select>
          </Field>
          <Field label="CR / ticket">
            <input value={crId} onChange={(e) => setCrId(e.target.value)} placeholder="CR-130" />
          </Field>
        </div>
        <Field label="What changed (summary)">
          <input autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Added status filter to the list" />
        </Field>
        <div className="row2">
          <Field label="Details / client request">
            <textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Why, who asked, acceptance notes…" />
          </Field>
          <Field label="Author">
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
          </Field>
        </div>
        {changeType !== 'removed' && (
          <Field label={version ? 'Replace screenshot (optional)' : 'New screenshot'}>
            <ImageDrop value={img} onChange={setImg} hint={version ? undefined : 'Leave empty to reuse the previous screenshot'} />
          </Field>
        )}
      </form>
    </Modal>
  );
}

export function NotificationForm({ screenId, notif, onClose }: Close & { screenId: ID; notif?: NotificationItem }) {
  const { mut, releaseId } = useStore();
  const [title, setTitle] = useState(notif?.title ?? '');
  const [channel, setChannel] = useState<Channel>(notif?.channel ?? 'in-app');
  const [type, setType] = useState<NotifType | ''>(notif?.type ?? '');
  const [trigger, setTrigger] = useState(notif?.trigger ?? '');
  const [addedIn, setAddedIn] = useState(notif?.addedIn ?? releaseId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut((d) => {
      const n = notif && d.notifications.find((x) => x.id === notif.id);
      const fields = { title, channel, type: type || undefined, trigger, addedIn };
      if (n) Object.assign(n, fields);
      else d.notifications.push({ id: uid('ntf'), screenId, ...fields, changes: [] });
    });
    onClose();
  };
  return (
    <Modal title={notif ? 'Edit notification' : 'New notification'} onClose={onClose} footer={<Footer onClose={onClose} disabled={!title.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <Field label="Title">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Appointment scheduled" />
        </Field>
        <div className="row2">
          <Field label="Channel">
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="in-app">In-app</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </select>
          </Field>
          <Field label="Introduced in release">
            <ReleaseSelect value={addedIn} onChange={setAddedIn} />
          </Field>
        </div>
        <Field label="Type" hint="Shown as the bell colour in User flow">
          <select value={type} onChange={(e) => setType(e.target.value as NotifType | '')}>
            <option value="">Auto (from the wording)</option>
            <option value="success">Success</option>
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </Field>
        <Field label="Trigger" hint="When is it sent?">
          <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. 24h before appointment" />
        </Field>
      </form>
    </Modal>
  );
}

export function NotificationChangeForm({ notif, onClose, cr, onApplied }: Close & FromCR & { notif: NotificationItem }) {
  const { mut, releaseId } = useStore();
  const [rel, setRel] = useState(releaseId);
  const [summary, setSummary] = useState(cr?.title ?? '');
  const [crId, setCrId] = useState(cr?.crId ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut((d) => {
      const n = d.notifications.find((x) => x.id === notif.id)!;
      n.changes = n.changes.filter((c) => c.releaseId !== rel);
      n.changes.push({ id: uid('chg'), releaseId: rel, summary, crId: crId || undefined });
    });
    onApplied?.(`n:${notif.id}`, rel);
    onClose();
  };
  return (
    <Modal title={`Record change — ${notif.title}`} onClose={onClose} footer={<Footer onClose={onClose} disabled={!summary.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <div className="row2">
          <Field label="Release">
            <ReleaseSelect value={rel} onChange={setRel} minId={notif.addedIn} />
          </Field>
          <Field label="CR / ticket">
            <input value={crId} onChange={(e) => setCrId(e.target.value)} placeholder="CR-130" />
          </Field>
        </div>
        <Field label="What changed">
          <input autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Wording updated, now also sent via SMS" />
        </Field>
      </form>
    </Modal>
  );
}

/** Next free CR number, looking at every CR id already used anywhere in the project. */
function nextCrId(d: ReturnType<typeof useStore.getState>['data']) {
  const ids = [
    ...d.changeRequests.map((c) => c.crId),
    ...d.screens.flatMap((s) => s.versions.map((v) => v.crId)),
    ...d.notifications.flatMap((n) => n.changes.map((c) => c.crId)),
  ];
  const max = Math.max(0, ...ids.map((id) => Number(id?.match(/(\d+)\s*$/)?.[1] ?? 0)));
  return `CR-${max + 1}`;
}

export function ChangeRequestForm({ personaId, onClose }: Close & { personaId?: ID }) {
  const { mut, data } = useStore();
  const [crId, setCrId] = useState(() => nextCrId(data));
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [persona, setPersona] = useState(personaId ?? '');
  const [requestedBy, setRequestedBy] = useState('');
  const [receivedAt, setReceivedAt] = useState(today());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut((d) => {
      d.changeRequests.push({
        id: uid('cr'), crId, title, details: details || undefined, personaId: persona || undefined,
        requestedBy: requestedBy || undefined, receivedAt, status: 'open',
      });
    });
    onClose();
  };
  return (
    <Modal title="New change request" onClose={onClose} footer={<Footer onClose={onClose} label="Add to inbox" disabled={!title.trim() || !crId.trim()} />}>
      <form id="modal-form" onSubmit={submit} className="form">
        <div className="row2">
          <Field label="CR / ticket">
            <input value={crId} onChange={(e) => setCrId(e.target.value)} />
          </Field>
          <Field label="Received">
            <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} required />
          </Field>
        </div>
        <Field label="What the client asked for">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Add export button to participant list" />
        </Field>
        <div className="row2">
          <Field label="Persona">
            <select value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Not sure yet</option>
              {data.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Requested by">
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Client PM" />
          </Field>
        </div>
        <Field label="Details">
          <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <p className="muted small">It lands in the inbox on the Persona board. Drag it onto a screen, a notification or a column's <b>+ New screen</b> slot to place it in the flow.</p>
      </form>
    </Modal>
  );
}

function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}
function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
