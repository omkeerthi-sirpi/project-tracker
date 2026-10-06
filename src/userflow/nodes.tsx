import { memo, type CSSProperties, type ReactNode } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Bell, Minus, Monitor, User, Workflow as WorkflowIcon } from 'lucide-react';
import type { FlowItem } from './model';
import { CHILD_LABEL } from './model';

export interface FlowNodeData extends Record<string, unknown> {
  item: FlowItem;
  open: boolean;
  dim: boolean;
  hl: boolean;
  match: boolean;
  context: boolean;
}
export type FlowNode = Node<FlowNodeData>;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Shell({ d, selected, children }: { d: FlowNodeData; selected?: boolean; children: ReactNode }) {
  const it = d.item;
  const cls = ['uf-node', `uf-${it.kind}`, `st-${it.status}`, d.dim && 'dim', d.hl && 'hl', d.match && 'match', d.context && 'context', selected && 'sel']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={{ '--c': it.color } as CSSProperties}>
      {it.kind !== 'persona' && <Handle type="target" position={Position.Left} isConnectable={false} />}
      <Handle type="source" position={Position.Right} isConnectable={false} />
      {children}
      {/* Status sits on the top edge so it never steals room from the name. */}
      {it.status !== 'unchanged' && it.kind !== 'notification' && <span className={`uf-tag s-${it.status}`}>{it.status}</span>}
      {it.children.length > 0 && (
        <span className={`uf-toggle ${d.open ? 'open' : ''}`} title={d.open ? 'Collapse' : `Show ${plural(it.children.length, CHILD_LABEL[it.kind])}`}>
          {d.open ? <Minus size={10} strokeWidth={3} /> : it.children.length}
        </span>
      )}
    </div>
  );
}

export const PersonaNode = memo(({ data: d, selected }: NodeProps<FlowNode>) => (
  <Shell d={d} selected={selected}>
    <span className="uf-avatar"><User size={18} /></span>
    <div className="uf-text">
      <div className="uf-name">{d.item.name}</div>
      <div className="uf-sub">
        {plural(d.item.children.length, 'workflow')}
        {d.item.changedBelow > 0 && <> · <b>{plural(d.item.changedBelow, 'change')}</b></>}
      </div>
    </div>
  </Shell>
));

export const WorkflowNode = memo(({ data: d, selected }: NodeProps<FlowNode>) => (
  <Shell d={d} selected={selected}>
    <span className="uf-icon"><WorkflowIcon size={14} /></span>
    <div className="uf-text">
      <div className="uf-name">{d.item.name}</div>
      <div className="uf-sub">
        {plural(d.item.children.length, 'screen')}
        {d.item.changedBelow > 0 && <> · <b>{plural(d.item.changedBelow, 'change')}</b></>}
      </div>
    </div>
  </Shell>
));

export const ScreenNode = memo(({ data: d, selected }: NodeProps<FlowNode>) => (
  <Shell d={d} selected={selected}>
    <span className="uf-icon"><Monitor size={13} /></span>
    <div className="uf-text">
      <div className="uf-name">{d.item.name}</div>
    </div>
  </Shell>
));

export const NotificationNode = memo(({ data: d, selected }: NodeProps<FlowNode>) => (
  <Shell d={d} selected={selected}>
    <span className={`uf-bell t-${d.item.notifType}`}><Bell size={10} /></span>
    <div className="uf-text">
      <div className="uf-name" title={d.item.name}>{d.item.name}</div>
    </div>
    {d.item.status !== 'unchanged' && <span className={`uf-dot s-${d.item.status}`} title={d.item.status} />}
  </Shell>
));

export const nodeTypes = { persona: PersonaNode, workflow: WorkflowNode, screen: ScreenNode, notification: NotificationNode };
