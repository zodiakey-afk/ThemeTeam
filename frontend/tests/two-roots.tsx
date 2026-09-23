import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { createWorkspaceController } from '../src/workspace';
import '../src/styles.css';

const roots = new Map<string, ReturnType<typeof createRoot>>();
for (const id of ['root-a', 'root-b']) {
  const root = createRoot(document.getElementById(id)!);
  roots.set(id, root);
  root.render(<App controller={createWorkspaceController()} />);
}
Object.assign(window, {
  __ROOT_FIXTURE__: {
    unmount(id: string) {
      roots.get(id)?.unmount();
      roots.delete(id);
    },
  },
});
