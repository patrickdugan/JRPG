#!/usr/bin/env python3
"""Serve the full game on a stable local address and open the title screen.

Saves live in browser storage, which is keyed to the page origin, so the game
always uses the same port. A second launch while the server is running just
opens the browser on the running game.
"""

from __future__ import annotations

import functools
import sys
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 8642
URL = f"http://{HOST}:{PORT}/index.html"


class QuietHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".ogg": "audio/ogg",
    }

    def log_message(self, _format: str, *_args: object) -> None:
        return


class ExclusiveServer(ThreadingHTTPServer):
    """Refuse to share the port: on Windows SO_REUSEADDR lets two servers bind it."""

    allow_reuse_address = False

    def server_bind(self) -> None:
        import socket

        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def game_already_served() -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/index.html", timeout=2) as response:
            return response.status == 200 and b"Black" in response.read(4096)
    except OSError:
        return False


def main() -> int:
    open_browser = "--no-browser" not in sys.argv[1:]
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    try:
        server = ExclusiveServer((HOST, PORT), handler)
    except OSError:
        if game_already_served():
            if open_browser:
                webbrowser.open(URL, new=1)
            print(f"The game is already running at {URL}.")
            return 0
        print(f"Port {PORT} is in use by another program. Free it and launch again.")
        print("(The game keeps one fixed address so your saves stay with it.)")
        return 1
    print()
    print("Bells of the Black Chrysanthemum")
    print(f"Playing at {URL}")
    print("Your progress saves automatically in this browser at this address.")
    print("Close this window (or press Ctrl+C) to stop the game server.")
    if open_browser and not webbrowser.open(URL, new=1):
        print("Open the address above in your browser.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
