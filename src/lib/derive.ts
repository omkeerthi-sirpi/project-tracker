import type { ChangeType, ID, NotificationChange, NotificationItem, ProjectData, Screen, ScreenVersion } from '../types';

/** Release ordering context: every "as of release X" question is answered through this. */
export interface Ctx {
  idx: Map<ID, number>;
  r: number;
}

export function makeCtx(d: ProjectData, releaseId: ID): Ctx {
  const idx = new Map(d.releases.map((r, i) => [r.id, i] as const));
  return { idx, r: idx.get(releaseId) ?? d.releases.length - 1 };
}

export const at = (c: Ctx, id?: ID) => (id ? (c.idx.get(id) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY);

export const sortVersions = (c: Ctx, vs: ScreenVersion[]) =>
  [...vs].sort((a, b) => at(c, a.releaseId) - at(c, b.releaseId));

export interface ScreenAt {
  visible: boolean;
  /** Version whose screenshot represents the screen at this release. */
  current?: ScreenVersion;
  /** All versions up to and including this release. */
  history: ScreenVersion[];
  /** Version introduced exactly in this release, if any. */
  change?: ScreenVersion;
  removed: boolean;
}

export function screenAt(c: Ctx, s: Screen): ScreenAt {
  const history = sortVersions(c, s.versions).filter((v) => at(c, v.releaseId) <= c.r);
  if (!history.length) return { visible: false, history, removed: false };
  const last = history[history.length - 1];
  const change = at(c, last.releaseId) === c.r ? last : undefined;
  if (last.changeType === 'removed') {
    // Show removed screens only in the release that removed them.
    return { visible: !!change, current: history[history.length - 2] ?? last, history, change, removed: true };
  }
  return { visible: true, current: last, history, change, removed: false };
}

export interface SpanAt {
  visible: boolean;
  added: boolean;
  removed: boolean;
}

export function spanAt(c: Ctx, addedIn: ID, removedIn?: ID): SpanAt {
  const a = at(c, addedIn);
  const rm = removedIn ? at(c, removedIn) : Number.POSITIVE_INFINITY;
  if (a > c.r || rm < c.r) return { visible: false, added: false, removed: false };
  return { visible: true, added: a === c.r, removed: rm === c.r };
}

export function notifAt(c: Ctx, n: NotificationItem): SpanAt & { change?: NotificationChange } {
  return { ...spanAt(c, n.addedIn, n.removedIn), change: n.changes.find((ch) => at(c, ch.releaseId) === c.r) };
}

export interface ChangeEntry {
  key: string;
  kind: 'workflow' | 'screen' | 'notification';
  action: ChangeType;
  personaId: ID;
  workflowId: ID;
  screenId?: ID;
  itemId: ID;
  title: string;
  summary: string;
  details?: string;
  crId?: string;
  author?: string;
  nodeId: string;
  version?: ScreenVersion;
  prevVersion?: ScreenVersion;
}

export function changesForRelease(d: ProjectData, releaseId: ID): ChangeEntry[] {
  const c = makeCtx(d, releaseId);
  const wf = new Map(d.workflows.map((w) => [w.id, w]));
  const sc = new Map(d.screens.map((s) => [s.id, s]));
  const out: ChangeEntry[] = [];

  for (const w of d.workflows) {
    const st = spanAt(c, w.addedIn, w.removedIn);
    if (!st.added && !st.removed) continue;
    out.push({
      key: `w-${w.id}`,
      kind: 'workflow',
      action: st.removed ? 'removed' : 'added',
      personaId: w.personaId,
      workflowId: w.id,
      itemId: w.id,
      title: w.name,
      summary: st.removed ? 'Workflow removed' : 'New workflow introduced',
      nodeId: `w:${w.id}`,
    });
  }

  for (const s of d.screens) {
    const w = wf.get(s.workflowId);
    if (!w) continue;
    const st = screenAt(c, s);
    if (!st.change) continue;
    out.push({
      key: `s-${st.change.id}`,
      kind: 'screen',
      action: st.change.changeType,
      personaId: w.personaId,
      workflowId: w.id,
      screenId: s.id,
      itemId: s.id,
      title: s.name,
      summary: st.change.summary,
      details: st.change.details,
      crId: st.change.crId,
      author: st.change.author,
      nodeId: `s:${s.id}`,
      version: st.change,
      prevVersion: st.history[st.history.length - 2],
    });
  }

  for (const n of d.notifications) {
    const s = sc.get(n.screenId);
    const w = s && wf.get(s.workflowId);
    if (!s || !w) continue;
    const st = notifAt(c, n);
    if (!st.visible || !(st.added || st.removed || st.change)) continue;
    out.push({
      key: `n-${n.id}`,
      kind: 'notification',
      action: st.added ? 'added' : st.removed ? 'removed' : 'modified',
      personaId: w.personaId,
      workflowId: w.id,
      screenId: s.id,
      itemId: n.id,
      title: n.title,
      summary: st.change?.summary ?? (st.added ? 'New notification' : 'Notification removed'),
      crId: st.change?.crId,
      nodeId: `n:${n.id}`,
    });
  }
  return out;
}

export function changelogMarkdown(d: ProjectData, releaseId: ID): string {
  const rel = d.releases.find((r) => r.id === releaseId);
  const entries = changesForRelease(d, releaseId);
  const lines = [`# ${d.name} — ${rel?.name ?? ''} (${rel?.date ?? ''})`, ''];
  if (rel?.notes) lines.push(rel.notes, '');
  for (const p of d.personas) {
    const pe = entries.filter((e) => e.personaId === p.id);
    if (!pe.length) continue;
    lines.push(`## ${p.name}`);
    for (const e of pe) {
      const wf = d.workflows.find((w) => w.id === e.workflowId)?.name;
      const scr = e.kind === 'notification' ? d.screens.find((s) => s.id === e.screenId)?.name : undefined;
      const where = [wf, scr].filter(Boolean).join(' › ');
      lines.push(
        `- **[${e.action.toUpperCase()}] ${e.kind}: ${e.title}**${e.crId ? ` (${e.crId})` : ''} — ${e.summary}${where ? ` _(${where})_` : ''}`,
      );
    }
    lines.push('');
  }
  if (!entries.length) lines.push('_No changes recorded._');
  return lines.join('\n');
}
