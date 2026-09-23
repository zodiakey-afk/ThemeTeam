import { defineConfig } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const apiPort = Number(process.env.THEMETEAM_API_PORT || 8000);
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('Invalid API port');
const target = `http://127.0.0.1:${apiPort}`;

function localOriginBoundary(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const count = (key: string) => req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length;
  const host = req.headers.host;
  const allowed = [`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`];
  if (count('host') !== 1 || !host || !allowed.includes(host) || count('origin') > 1 ||
    (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'forbidden', message: 'Invalid local origin' } }));
    return;
  }
  next();
}

export default defineConfig({
  plugins: [{
    name: 'local-origin-boundary',
    configureServer(server) {
      server.middlewares.use(localOriginBoundary);
    },
    configurePreviewServer(server) {
      server.middlewares.use(localOriginBoundary);
      server.middlewares.use('/api', (_req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'not_found', message: 'Static preview has no API' } }));
      });
    },
  }],
  preview: { host: '127.0.0.1', strictPort: true, cors: false, proxy: {} },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true, cors: false,
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: { '/api': {
      target, changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request, original) => {
          if (original.headers.origin) request.setHeader('Origin', target);
        });
      },
    } },
  },
});
