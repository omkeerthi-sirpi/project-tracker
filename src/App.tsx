import { useStore } from './store';
import { TopBar } from './components/TopBar';
import { ChangelogView } from './components/ChangelogView';
import { BoardView } from './components/BoardView';
import { UserFlowPage } from './userflow/UserFlowPage';
import { DetailPanel } from './components/DetailPanel';
import { Lightbox } from './components/Lightbox';

export function App() {
  const loaded = useStore((s) => s.loaded);
  const view = useStore((s) => s.view);
  if (!loaded) return <div className="loading">Loading project…</div>;
  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        {view === 'userflow' ? <UserFlowPage /> : view === 'board' ? <BoardView /> : <ChangelogView />}
        {view !== 'userflow' && <DetailPanel />}
      </div>
      <Lightbox />
    </div>
  );
}
