#!/usr/bin/env python3
"""Serve and verify every browser-shipped file over an ephemeral localhost port."""

from __future__ import annotations

import functools
import json
import threading
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


GAME_DIR = Path(__file__).resolve().parents[1]
SHIPPED_SUFFIXES = frozenset({".html", ".css", ".js", ".mjs", ".png", ".svg"})
EXCLUDED_PARTS = frozenset({"node_modules", "tests", "tools"})


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


def release_files() -> list[Path]:
    return sorted(
        path
        for path in GAME_DIR.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SHIPPED_SUFFIXES
        and not EXCLUDED_PARTS.intersection(path.relative_to(GAME_DIR).parts)
    )


def verify_delivery() -> dict[str, object]:
    files = release_files()
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    failures: list[dict[str, object]] = []
    delivered_bytes = 0
    by_suffix: dict[str, int] = {}
    try:
        for path in files:
            relative = path.relative_to(GAME_DIR).as_posix()
            try:
                with urllib.request.urlopen(f"{base}/{relative}", timeout=15) as response:
                    body = response.read()
                    expected = path.read_bytes()
                    if response.status != 200 or body != expected:
                        failures.append({
                            "path": relative,
                            "status": response.status,
                            "expectedBytes": len(expected),
                            "receivedBytes": len(body),
                        })
                        continue
                    delivered_bytes += len(body)
                    by_suffix[path.suffix.lower()] = by_suffix.get(path.suffix.lower(), 0) + 1
            except Exception as error:  # noqa: BLE001 - audit must report any delivery failure
                failures.append({"path": relative, "error": str(error)})
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
    return {
        "root": str(GAME_DIR),
        "fileCount": len(files),
        "deliveredBytes": delivered_bytes,
        "bySuffix": dict(sorted(by_suffix.items())),
        "failures": failures,
        "ok": not failures and len(files) > 0,
    }


def main() -> int:
    result = verify_delivery()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
