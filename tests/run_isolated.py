"""Run fresh or repeated suites while rejecting default workspace file access."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import sys
import threading
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DEFAULT = ROOT / "themeteam" / "core" / "workspace_state.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=1)
    parser.add_argument("--pattern", default="test*.py")
    args = parser.parse_args()
    if args.rounds < 1:
        parser.error("rounds must be positive")
    before = hashlib.sha256(DEFAULT.read_bytes()).hexdigest() if DEFAULT.exists() else None
    protected = os.path.normcase(str(DEFAULT.resolve()))
    checking = True
    denied = []

    def audit(event, values):
        if checking and event == "open" and isinstance(values[0], (str, bytes, os.PathLike)):
            candidate = os.path.normcase(os.path.abspath(os.fsdecode(values[0])))
            if candidate == protected:
                denied.append(candidate)
                raise AssertionError("Test tried to open default user workspace")

    sys.addaudithook(audit)
    results = []
    initial_threads = set(threading.enumerate())
    try:
        for _ in range(args.rounds):
            suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), pattern=args.pattern)
            result = unittest.TextTestRunner(verbosity=2).run(suite)
            results.append({"tests": result.testsRun, "failures": len(result.failures),
                            "errors": len(result.errors), "skipped": len(result.skipped)})
    finally:
        checking = False
    after = hashlib.sha256(DEFAULT.read_bytes()).hexdigest() if DEFAULT.exists() else None
    leaked = [t.name for t in set(threading.enumerate()) - initial_threads]
    report = {"python": platform.python_version(), "platform": platform.platform(),
              "rounds": results, "before": before, "after": after,
              "denied_accesses": len(denied), "leaked_threads": leaked}
    print(json.dumps(report, indent=2))
    return int(before != after or bool(denied) or bool(leaked) or not any(r["tests"] for r in results) or
               any(r["failures"] or r["errors"] for r in results))


if __name__ == "__main__":
    raise SystemExit(main())
