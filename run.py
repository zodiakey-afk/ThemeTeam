from __future__ import annotations

import argparse
import threading
import webbrowser
from pathlib import Path

from themeteam.web.server import create_server


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ThemeTeam local web app")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--no-open", action="store_true")
    parser.add_argument("--m2", action="store_true", help="Run the M2 FastAPI/SQLite service")
    parser.add_argument("--db", type=Path, default=None, help="M2 SQLite database path")
    args = parser.parse_args()

    if args.m2:
        import uvicorn

        from themeteam.web.api_v1 import create_m2_app, create_m2_service

        root = Path(__file__).resolve().parent
        db_path = args.db or (root / "themeteam" / "core" / "workspace_state.sqlite")
        json_path = root / "themeteam" / "core" / "workspace_state.json"
        service = create_m2_service(json_path, db_path)
        app = create_m2_app(service)
        try:
            uvicorn.run(app, host=args.host, port=args.port, log_level="info")
        finally:
            service.close()
        return

    server = create_server(args.host, args.port)
    url = f"http://{args.host}:{args.port}/"
    if not args.no_open:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    print(f"ThemeTeam running at {url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
