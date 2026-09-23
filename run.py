from __future__ import annotations

import argparse
import threading
import webbrowser

from themeteam.web.server import create_server


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ThemeTeam local web app")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()

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

