import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  root: frontend,
  configFile: path.join(frontend, 'vite.config.ts'),
  build: {
    outDir: 'dist-two-roots',
    rolldownOptions: { input: path.join(frontend, 'tests/two-roots.html') },
  },
});
