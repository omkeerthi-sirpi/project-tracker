import type { ChangeType, ID, ProjectData, Screen } from '../types';
import { saveImage } from './images';
import { mockScreenSvg, svgBlob } from './mockScreen';
import { uid } from './util';

interface Spec {
  name: string;
  color: string;
  description: string;
  workflows: { name: string; screens: { name: string; notifs: string[] }[] }[];
}

// Baseline (v1.0) taken from the persona → workflow → screen → notification diagram.
const SPEC: Spec[] = [
  {
    name: 'Platform Admin',
    color: '#8b5cf6',
    description: 'Owns the platform: organizations, configuration and roles.',
    workflows: [
      { name: 'Manage Organizations', screens: [
        { name: 'Dashboard', notifs: ['New organization created', 'Maintenance scheduled'] },
        { name: 'Organization Settings', notifs: ['System setting updated', 'Configuration changed'] },
      ] },
      { name: 'System Configuration', screens: [{ name: 'System Logs', notifs: ['Login attempt detected', 'Error in system', 'Backup completed'] }] },
      { name: 'Analytics & Reports', screens: [{ name: 'Analytics Reports', notifs: ['Analytics report ready', 'New document uploaded'] }] },
      { name: 'Role Management', screens: [{ name: 'Role Management', notifs: ['User role assigned'] }] },
    ],
  },
  {
    name: 'Org Admin',
    color: '#3b82f6',
    description: 'Manages a single organization, its cohorts and users.',
    workflows: [
      { name: 'Organization Management', screens: [
        { name: 'Organization Profile', notifs: ['Organization updated', 'Profile updated'] },
        { name: 'Settings', notifs: ['System notification', 'Data sync completed'] },
      ] },
      { name: 'Cohort Management', screens: [{ name: 'Cohort Details', notifs: ['Cohort created', 'Approval pending'] }] },
      { name: 'User Management', screens: [{ name: 'User List', notifs: ['User added', 'Role changed', 'Access request received'] }] },
      { name: 'Document Management', screens: [{ name: 'Document Upload', notifs: ['Document uploaded'] }] },
    ],
  },
  {
    name: 'Cohort PI',
    color: '#22c55e',
    description: 'Principal investigator overseeing cohorts and participants.',
    workflows: [
      { name: 'View Cohorts', screens: [
        { name: 'Cohort Dashboard', notifs: ['Cohort milestone reached', 'System alert'] },
        { name: 'Data Viewer', notifs: ['Data collection completed', 'Analysis completed'] },
      ] },
      { name: 'Manage Participants', screens: [{ name: 'Participants List', notifs: ['New participant added', 'Participant updated'] }] },
      { name: 'Track Appointments', screens: [{ name: 'Appointments', notifs: ['Appointment scheduled', 'Reminder notification'] }] },
      { name: 'Reports & Analytics', screens: [{ name: 'Reports', notifs: ['Report generated', 'Document uploaded'] }] },
    ],
  },
  {
    name: 'Cohort Admin',
    color: '#f97316',
    description: 'Runs day-to-day cohort operations.',
    workflows: [
      { name: 'Manage Facilitators', screens: [{ name: 'Facilitator List', notifs: ['Facilitator added', 'Access request'] }] },
      { name: 'Manage Participants', screens: [{ name: 'Participant List', notifs: ['Participant updated', 'Appointment confirmed', 'Reminder sent'] }] },
      { name: 'Document Management', screens: [{ name: 'Document Upload', notifs: ['Document uploaded', 'Data validation failed'] }] },
      { name: 'Progress Tracking', screens: [
        { name: 'Progress Report', notifs: ['Progress milestone reached', 'Report generated'] },
        { name: 'Cohort Milestones', notifs: ['System notification'] },
      ] },
    ],
  },
  {
    name: 'Cohort IT Admin',
    color: '#ec4899',
    description: 'Handles ODK, integrations and technical setup for a cohort.',
    workflows: [
      { name: 'Configure ODK', screens: [{ name: 'ODK Settings', notifs: ['ODK configuration saved', 'Configuration updated'] }] },
      { name: 'Integration Setup', screens: [{ name: 'Integration Logs', notifs: ['Integration status updated', 'Error in integration'] }] },
      { name: 'System Logs', screens: [{ name: 'System Logs', notifs: ['System log alert', 'Performance issue', 'Backup completed', 'Maintenance scheduled'] }] },
      { name: 'API Management', screens: [
        { name: 'API Docs', notifs: ['API call successful'] },
        { name: 'Configuration', notifs: [] },
      ] },
    ],
  },
];

export async function createSeed(): Promise<ProjectData> {
  const d: ProjectData = {
    name: 'CMP — Cohort Management Platform',
    releases: [
      { id: 'rel_10', name: 'v1.0', date: '2026-07-01', notes: 'Initial client delivery — baseline for all five personas.' },
      { id: 'rel_11', name: 'v1.1', date: '2026-08-20', notes: 'Client feedback round 1.' },
      { id: 'rel_12', name: 'v1.2', date: '2026-09-30', notes: 'Change request batch 2.' },
    ],
    personas: [],
    workflows: [],
    screens: [],
    notifications: [],
    changeRequests: [],
  };

  const addScreen = (workflowId: ID, name: string, releaseId: ID, notifs: string[], notifRelease = releaseId) => {
    const s: Screen = {
      id: uid('scr'),
      workflowId,
      name,
      versions: [{ id: uid('ver'), releaseId, changeType: 'added', summary: 'Initial version', createdAt: '2026-06-25' }],
    };
    d.screens.push(s);
    for (const title of notifs)
      d.notifications.push({ id: uid('ntf'), screenId: s.id, title, channel: 'in-app', addedIn: notifRelease, changes: [] });
    return s;
  };

  for (const p of SPEC) {
    const personaId = uid('per');
    d.personas.push({ id: personaId, name: p.name, color: p.color, description: p.description });
    for (const w of p.workflows) {
      const workflowId = uid('wf');
      d.workflows.push({ id: workflowId, personaId, name: w.name, addedIn: 'rel_10' });
      for (const s of w.screens) addScreen(workflowId, s.name, 'rel_10', s.notifs);
    }
  }

  const personaId = (name: string) => d.personas.find((p) => p.name === name)!.id;
  const wfOf = (persona: string, wf: string) => d.workflows.find((w) => w.personaId === personaId(persona) && w.name === wf)!;
  const screenOf = (persona: string, name: string) => {
    const wfIds = new Set(d.workflows.filter((w) => w.personaId === personaId(persona)).map((w) => w.id));
    return d.screens.find((s) => wfIds.has(s.workflowId) && s.name === name)!;
  };
  const notifOf = (persona: string, title: string) => {
    const scrIds = new Set(
      d.screens.filter((s) => d.workflows.find((w) => w.id === s.workflowId)?.personaId === personaId(persona)).map((s) => s.id),
    );
    return d.notifications.find((n) => scrIds.has(n.screenId) && n.title === title)!;
  };
  const change = (s: Screen, releaseId: ID, changeType: ChangeType, summary: string, crId: string, details: string, author: string) =>
    s.versions.push({ id: uid('ver'), releaseId, changeType, summary, crId, details, author, createdAt: releaseId === 'rel_11' ? '2026-08-14' : '2026-09-24' });

  // --- v1.1: client feedback round 1
  change(screenOf('Cohort PI', 'Participants List'), 'rel_11', 'modified', 'Added status filter & bulk CSV export', 'CR-104',
    'Client asked to filter participants by enrolment status and export the selection to CSV.', 'Keerthi');
  change(screenOf('Platform Admin', 'Role Management'), 'rel_11', 'modified', 'Permission matrix grouped by module', 'CR-097',
    'Permissions were a flat list; now grouped by module with select-all per group.', 'Keerthi');
  const bulk = addScreen(wfOf('Cohort Admin', 'Document Management').id, 'Bulk Upload', 'rel_11', ['Bulk upload completed']);
  bulk.versions[0].summary = 'New screen for uploading many documents at once';
  bulk.versions[0].crId = 'CR-101';
  d.notifications.push({ id: uid('ntf'), screenId: screenOf('Cohort IT Admin', 'API Docs').id, title: 'Token expired', channel: 'email', trigger: 'API token reaches expiry date', addedIn: 'rel_11', changes: [] });

  // --- v1.2: change request batch 2
  change(screenOf('Cohort PI', 'Participants List'), 'rel_12', 'modified', 'Added consent status column', 'CR-121',
    'Show consent status (signed / pending / withdrawn) as a coloured chip in the list.', 'Keerthi');
  change(screenOf('Org Admin', 'User List'), 'rel_12', 'modified', 'Invite users by email + role column', 'CR-118',
    'Replaced manual user creation with email invitations; role shown inline.', 'Keerthi');
  change(screenOf('Cohort IT Admin', 'Configuration'), 'rel_12', 'removed', 'Merged into ODK Settings', 'CR-120',
    'Configuration screen was duplicating ODK Settings; consolidated.', 'Keerthi');
  const login = notifOf('Platform Admin', 'Login attempt detected');
  login.changes.push({ id: uid('chg'), releaseId: 'rel_12', summary: 'Now also sent by email to the admin', crId: 'CR-115' });
  login.channel = 'email';
  notifOf('Platform Admin', 'Maintenance scheduled').removedIn = 'rel_12';
  const consent = { id: uid('wf'), personaId: personaId('Cohort PI'), name: 'Consent Management', addedIn: 'rel_12' };
  d.workflows.push(consent);
  const consentScreen = addScreen(consent.id, 'Consent Forms', 'rel_12', ['Consent withdrawn', 'Consent form signed']);
  consentScreen.versions[0].crId = 'CR-123';
  consentScreen.versions[0].summary = 'New workflow to track participant consent';

  // Inbox: client requests that arrived after v1.2 and are not yet placed in the flow.
  const inbox: [string, string, string, string][] = [
    ['CR-124', 'Cohort PI', 'Show appointment no-shows on the dashboard', 'Client wants a no-show counter card on the Cohort Dashboard.'],
    ['CR-125', 'Cohort PI', 'SMS reminder 24h before appointment', 'Reminder notification should also go out by SMS.'],
    ['CR-126', 'Org Admin', 'Deactivate users instead of deleting', 'Keep audit history; add an Active / Inactive toggle on the user list.'],
    ['CR-127', 'Cohort Admin', 'Upload progress bar for large files', ''],
  ];
  for (const [crId, persona, title, details] of inbox)
    d.changeRequests.push({ id: uid('cr'), crId, title, details: details || undefined, personaId: personaId(persona), requestedBy: 'Client PM', receivedAt: '2026-10-0' + (2 + d.changeRequests.length), status: 'open' });

  // Wireframe screenshots for every version so compare views have something to show.
  for (const s of d.screens) {
    const wf = d.workflows.find((w) => w.id === s.workflowId)!;
    const persona = d.personas.find((p) => p.id === wf.personaId)!;
    let variant = 0;
    for (const v of s.versions) {
      if (v.changeType === 'removed') continue;
      v.imageId = await saveImage(
        svgBlob(mockScreenSvg({ title: s.name, persona: persona.name, color: persona.color, variant, note: v.summary })),
      );
      variant++;
    }
  }
  return d;
}
