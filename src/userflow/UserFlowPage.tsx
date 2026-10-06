import { ReactFlowProvider } from '@xyflow/react';
import { UserFlowGraph } from './UserFlowGraph';
import { Filters, SearchBar, ViewControls } from './UserFlowToolbar';
import { NodeDetailsPanel } from './NodeDetailsPanel';
import './userflow.css';

/** Rendered inside the app shell (top bar above), as the "User flow" tab. */
export function UserFlowPage() {
  return (
    <ReactFlowProvider>
      <div className="uf">
        <div className="uf-toolbar">
          <SearchBar />
          <Filters />
          <ViewControls />
        </div>
        <div className="uf-body">
          <UserFlowGraph />
          <NodeDetailsPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
