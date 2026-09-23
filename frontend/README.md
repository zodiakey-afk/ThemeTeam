# W03 Development Preview

React/TypeScript workspace tools backed by the existing loopback Python API. This is the W03 foundation, not the M1 office canvas. The reference image is an unapproved concept draft; there is no live model execution.

## Run

Node >=22.12 is required. From `frontend/`, install the locked dependencies with `npm ci --ignore-scripts`.

Start the existing backend from the repository root:

```powershell
python -B run.py --port 8001 --no-open
```

In another terminal, from `frontend/`:

```powershell
$env:THEMETEAM_API_PORT = '8001'
npm.cmd run dev -- --port 5173
```

Open http://127.0.0.1:5173. Both services bind loopback. Use matching configured ports; do not expose the development proxy to the LAN. Keep the old Python UI as the default entry.

The preview reads the current workspace. Create/status commands modify backend memory; Save persists those changes to the workspace file. Reload discards unsaved changes after confirmation. Selection and inspector history are browser-local. Do not run multiple backend writers against the same file.

If a dispatched write has an unknown outcome, that browser session freezes writes. A GET refresh cannot prove a prior request has finished and does not unlock writes. Independently confirm backend quiescence/restart before opening a fresh session; never automatically replay the uncertain command.

## Verify

```powershell
npm.cmd run verify
npm.cmd audit
```

Verification runs typecheck, 24 contract tests, build and Playwright workflows with a temporary Python Store. It records logs, hashes, license metadata and a heuristic credential scan in `docs/evidence/w03-*`. Python/Playwright default to this machine's bundled runtime; set `PYTHON` and `CODEX_NODE_MODULES` for another installation. Playwright uses the installed Edge channel.

Vite's alternate `preview` entry is static-only: API forwarding is explicitly disabled. Use `npm run dev` for the interactive development tools.

The build check uses npm offline mode with existing dependencies, not an offline fresh install. W03 independent code review is complete; QA/release confirmation and M1 visual/performance acceptance remain separate requirements.

Stopping these two development processes restores the original entry-only setup; there is no migration or automatic workspace reset. The current dependency license inventory includes MPL-2.0 build tools; preserve license/source obligations if distributing the toolchain itself.
