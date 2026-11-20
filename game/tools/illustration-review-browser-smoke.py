#!/usr/bin/env python3
"""Hosted Chromium acceptance for recovered July original illustration archive."""
from __future__ import annotations

import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

GAME_DIR = Path(__file__).resolve().parents[1]
SCREENSHOT = GAME_DIR.parent / "artifacts" / "july-illustration-review.png"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        pass


def smoke() -> dict:
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(GAME_DIR))
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    errors: list[str] = []
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1420, "height": 1040}, accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(20000)
            page.on("pageerror", lambda error: errors.append("page: " + str(error)))
            page.on("console", lambda msg: errors.append("console: " + msg.text) if msg.type == "error" else None)
            page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
            resp = page.goto(base + "/illustration-review.html?asset=nikola", wait_until="domcontentloaded")
            assert resp and resp.status == 200
            count = page.locator("#assetList button").count()
            assert count == 4, count

            for ident in ["nikola", "mateus", "kurozane", "world"]:
                page.locator(f'#assetList button[data-asset-id="{ident}"]').click()
                page.wait_for_function("""() => ['sourceImage','laterImage'].every(id => {
                    const image = document.getElementById(id);
                    return image.complete && image.naturalWidth > 60 && image.naturalHeight > 40;
                })""")
                assert page.locator("#assetSha").inner_text().strip()
                assert "/assets/art/july-illustrations-v1/" in page.locator("#sourceImage").get_attribute("src")

            page.locator('#assetList button[data-asset-id="nikola"]').click()
            page.locator("#verdict").select_option("use-as-reference")
            page.locator("#note").fill("Keep the July Western Gothic silhouette and original costume shapes.")
            page.reload(wait_until="domcontentloaded")
            assert page.locator("#verdict").input_value() == "use-as-reference"
            assert "original costume" in page.locator("#note").input_value()

            with page.expect_download() as result:
                page.locator("#exportReview").click()
            download = result.value
            assert download.suggested_filename == "bells-july-illustration-review.json"
            artifact_dir = SCREENSHOT.parent
            artifact_dir.mkdir(parents=True, exist_ok=True)
            exported = artifact_dir / "july-illustration-review.json"
            download.save_as(exported)
            report = json.loads(exported.read_text(encoding="utf-8"))
            assert report["schemaVersion"] == 1 and len(report["entries"]) == 4
            assert report["entries"][0]["verdict"] == "use-as-reference"

            page.locator('#assetList button[data-asset-id="mateus"]').click()
            page.locator("#verdict").select_option("needs-revision")
            page.locator("#note").fill("Local test note")
            page.locator("#importReview").set_input_files({
                "name": "review.json",
                "mimeType": "application/json",
                "buffer": json.dumps(report).encode("utf-8"),
            })
            assert "Imported 4" in page.locator("#reviewStatus").inner_text()
            assert page.locator("#verdict").input_value() == "unreviewed"

            stale = json.loads(json.dumps(report))
            stale["entries"][0]["sourceSha"] = "0" * 40
            page.locator("#importReview").set_input_files({
                "name": "stale.json",
                "mimeType": "application/json",
                "buffer": json.dumps(stale).encode("utf-8"),
            })
            assert "Import rejected" in page.locator("#reviewStatus").inner_text()
            page.locator('#assetList button[data-asset-id="nikola"]').click()
            assert page.locator("#verdict").input_value() == "use-as-reference"
            SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SCREENSHOT), full_page=True)
            assert not errors, errors
            context.close()
            browser.close()
            return {"ok": True, "images": 8, "sourcePairs": count, "storageRoundtrip": True,
                    "jsonRoundtrip": True, "staleImportRejected": True, "errors": []}
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    print(json.dumps(smoke(), indent=2))
