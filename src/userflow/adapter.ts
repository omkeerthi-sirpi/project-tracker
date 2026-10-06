import type { ChangeType, NotifType, ProjectData } from '../types';
import { at, makeCtx, notifAt, screenAt, spanAt } from '../lib/derive';
import type { ChangeStatus, FlowData, Notification, Persona, Screen, Workflow } from './types';

const STATUS: Record<ChangeType, ChangeStatus> = { added: 'new', modified: 'modified', removed: 'deprecated' };

/** Notifications without an explicit type get one from their wording. */
export function guessNotifType(title: string): NotifType {
  const t = title.toLowerCase();
  if (/(fail|error|invalid|denied|expired|rejected|exceed|unsupported)/.test(t)) return 'error';
  if (/(warn|pending|approaching|issue|alert|remind|conflict|missing|lost|overdue|request)/.test(t)) return 'warning';
  if (/(success|complete|created|added|uploaded|saved|signed|reached|generated|confirmed|assigned|updated|ready|approved|scheduled|sent)/.test(t)) return 'success';
  return 'info';
}

const latest = (dates: string[]) => dates.filter(Boolean).sort().at(-1) ?? '';
const withCr = (summary: string, crId?: string) => (crId ? `${summary} (${crId})` : summary);

/**
 * Builds the User Flow tree from the project data "as of" one release: only items that exist in that release
 * are included, and each item's status says what happened to it in that release.
 */
export function fromProject(d: ProjectData, releaseId: string): FlowData {
  const c = makeCtx(d, releaseId);
  const rel = new Map(d.releases.map((r) => [r.id, r]));
  const relName = (id?: string) => (id && rel.get(id)?.name) || '';
  const relDate = (id?: string) => (id && rel.get(id)?.date) || '';
  const thisRelease = relName(releaseId);

  const personas: Persona[] = d.personas.map((p) => {
    const workflows: Workflow[] = d.workflows
      .filter((w) => w.personaId === p.id)
      .flatMap((w) => {
        const ws = spanAt(c, w.addedIn, w.removedIn);
        if (!ws.visible) return [];

        const screens: Screen[] = d.screens
          .filter((s) => s.workflowId === w.id)
          .flatMap((s) => {
            const st = screenAt(c, s);
            if (!st.visible) return [];

            const notifications: Notification[] = d.notifications
              .filter((n) => n.screenId === s.id)
              .flatMap((n) => {
                const ns = notifAt(c, n);
                if (!ns.visible) return [];
                const status: ChangeStatus = ns.added ? 'new' : ns.removed ? 'deprecated' : ns.change ? 'modified' : 'unchanged';
                const lastChange = n.changes.filter((ch) => at(c, ch.releaseId) <= c.r).sort((a, b) => at(c, a.releaseId) - at(c, b.releaseId)).at(-1);
                return [{
                  id: n.id,
                  message: n.title,
                  type: n.type ?? guessNotifType(n.title),
                  status,
                  description: n.trigger ? `Sent when: ${n.trigger} · ${n.channel}` : `Sent ${n.channel === 'in-app' ? 'in the app' : `by ${n.channel}`}.`,
                  changes: ns.change ? [withCr(ns.change.summary, ns.change.crId)]
                    : ns.added ? [`Added in ${thisRelease}`]
                    : ns.removed ? [`Removed in ${thisRelease}`]
                    : undefined,
                  lastModified: relDate(lastChange?.releaseId ?? n.addedIn),
                }];
              });

            const last = st.history.at(-1)!;
            return [{
              id: s.id,
              name: s.name,
              status: st.change ? STATUS[st.change.changeType] : 'unchanged',
              description: s.description,
              changes: st.change ? [withCr(st.change.summary, st.change.crId), ...(st.change.details ? [st.change.details] : [])] : undefined,
              lastModified: last.createdAt,
              modifiedBy: last.author,
              imageId: st.current?.imageId,
              versions: st.history.map((v, i) => ({
                id: v.id, label: `v${i + 1}`, release: relName(v.releaseId), changeType: v.changeType, summary: v.summary, crId: v.crId,
              })),
              notifications,
            }];
          });

        return [{
          id: w.id,
          name: w.name,
          status: ws.added ? 'new' : ws.removed ? 'deprecated' : 'unchanged',
          description: w.description,
          changes: ws.added ? [`New workflow in ${thisRelease}`] : ws.removed ? [`Removed in ${thisRelease}`] : undefined,
          lastModified: latest([relDate(w.addedIn), ...screens.map((s) => s.lastModified)]),
          screens,
        }];
      });

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      description: p.description,
      status: 'unchanged',
      lastModified: latest(workflows.map((w) => w.lastModified)),
      workflows,
    };
  });

  return { product: d.name, release: thisRelease, personas };
}
