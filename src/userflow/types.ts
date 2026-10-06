// Data contract for the User Flow tab. adapter.ts builds it from the project data for the selected release;
// a backend could return the same shape.

export type ChangeStatus = 'new' | 'modified' | 'unchanged' | 'deprecated';
export type NotificationType = 'success' | 'warning' | 'error' | 'info';
export type FlowKind = 'persona' | 'workflow' | 'screen' | 'notification';

/** Fields every node carries for change tracking. */
interface Tracked {
  id: string;
  status: ChangeStatus;
  description?: string;
  /** What changed in this item (shown for new / modified / deprecated items). */
  changes?: string[];
  lastModified: string;
  modifiedBy?: string;
}

export interface Notification extends Tracked {
  message: string;
  type: NotificationType;
}

/** One entry in a screen's version history. */
export interface ScreenVersionInfo {
  id: string;
  label: string;
  release: string;
  changeType: 'added' | 'modified' | 'removed';
  summary: string;
  crId?: string;
}

export interface Screen extends Tracked {
  name: string;
  /** Screenshot of the screen as of the selected release. */
  imageId?: string;
  versions?: ScreenVersionInfo[];
  notifications: Notification[];
}

export interface Workflow extends Tracked {
  name: string;
  screens: Screen[];
}

export interface Persona extends Tracked {
  name: string;
  /** Accent used for the persona's subtree; kept subtle. */
  color: string;
  workflows: Workflow[];
}

export interface FlowData {
  product: string;
  release: string;
  personas: Persona[];
}
