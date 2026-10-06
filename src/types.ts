export type ID = string;
export type ChangeType = 'added' | 'modified' | 'removed';
export type Channel = 'in-app' | 'email' | 'sms' | 'push';
export type NotifType = 'success' | 'warning' | 'error' | 'info';
export type NodeKind = 'root' | 'persona' | 'workflow' | 'screen' | 'version' | 'notification';

/** A client delivery / version of the product (v1.0, v1.1 ...). Kept sorted by date. */
export interface Release {
  id: ID;
  name: string;
  date: string;
  notes?: string;
}

export interface Persona {
  id: ID;
  name: string;
  color: string;
  description?: string;
}

export interface Workflow {
  id: ID;
  personaId: ID;
  name: string;
  description?: string;
  addedIn: ID;
  removedIn?: ID;
}

/** One snapshot of a screen. Every change request on a screen adds a new version node. */
export interface ScreenVersion {
  id: ID;
  releaseId: ID;
  changeType: ChangeType;
  summary: string;
  details?: string;
  crId?: string;
  author?: string;
  imageId?: string;
  createdAt: string;
}

export interface Screen {
  id: ID;
  workflowId: ID;
  name: string;
  description?: string;
  versions: ScreenVersion[];
}

export interface NotificationChange {
  id: ID;
  releaseId: ID;
  summary: string;
  crId?: string;
}

export interface NotificationItem {
  id: ID;
  screenId: ID;
  title: string;
  channel: Channel;
  /** Severity shown to the user; when unset it is guessed from the title. */
  type?: NotifType;
  trigger?: string;
  addedIn: ID;
  removedIn?: ID;
  changes: NotificationChange[];
}

/** An incoming client change request, waiting in the inbox until it is applied to the flow. */
export interface ChangeRequest {
  id: ID;
  crId: string;
  title: string;
  details?: string;
  personaId?: ID;
  requestedBy?: string;
  receivedAt: string;
  status: 'open' | 'applied';
  /** Node the CR was applied to (s:<screen id> or n:<notification id>), set when applied. */
  appliedTo?: string;
  appliedIn?: ID;
}

/** One entry on the projects dashboard. The project's content lives in its own ProjectData record. */
export interface ProjectMeta {
  id: ID;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  name: string;
  releases: Release[];
  personas: Persona[];
  workflows: Workflow[];
  screens: Screen[];
  notifications: NotificationItem[];
  changeRequests: ChangeRequest[];
}

export interface Selection {
  kind: NodeKind;
  id: ID;
}
