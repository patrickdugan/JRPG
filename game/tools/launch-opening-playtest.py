#!/usr/bin/env python3
"""Launch a clean opening-slice build for an uninvolved human tester."""

from __future__ import annotations

import functools
import subprocess
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode


GAME_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = GAME_DIR.parent
PLAYER_INSTRUCTION = "Play until the game tells you the opening is complete."


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


def candidate_commit() -> str:
    try:
        revision = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_DIR,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        status = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=REPO_DIR,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        commit = revision.stdout.strip() or "unknown"
        return f"{commit}-dirty" if status.stdout.strip() else commit
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def main() -> int:
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    commit = candidate_commit()
    query = urlencode({
        "new": "1",
        "openingTest": "1",
        "candidate": commit,
    })
    url = f"http://127.0.0.1:{server.server_address[1]}/campaign.html?{query}"
    try:
        opened = webbrowser.open(url, new=1)
        print()
        print("Bells of the Black Chrysanthemum - blind opening playtest")
        print(f"Candidate commit: {commit}")
        print(f"Game URL: {url}")
        print()
        print("Tell the tester only:")
        print(f'  "{PLAYER_INSTRUCTION}"')
        print()
        print("Do not explain controls, story, navigation, or objectives.")
        print("Record questions and stalls instead. Keep this console with the observer.")
        print("At the ending, let the tester complete the in-game feedback before discussing it.")
        print("Keep the downloaded bells-opening-playtest JSON receipt.")
        if not opened:
            print("The browser did not open automatically. Open the Game URL manually.")
        input("Press Enter only after the tester has finished to stop the local server...")
        return 0
    except KeyboardInterrupt:
        return 130
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
