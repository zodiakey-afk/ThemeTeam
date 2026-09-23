import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createWorkspaceController } from './workspace';
import './styles.css';

const controller = createWorkspaceController();
createRoot(document.getElementById('root')!).render(<App controller={controller} />);
