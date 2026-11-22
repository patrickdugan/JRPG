#!/usr/bin/env python3
"""Real Chromium smoke for the seven-boss review studio and paired evidence exports.

Uses the checked-in source PNGs and WebP atlases. Never mutates the source art,
roster approvals, or the game save namespace. Python Playwright is optional for
local runs and installed by the dedicated CI workflow.
"""
from __future__ import annotations

import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "hd-boss-review"
IDS = (
    "captain-kaji", "widow-of-fog", "furnace-abbot", "ujiro",
    "bell-warden-chiyo", "lady-enma", "yearless-bell",
)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *args):
        return


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    roster_path = ROOT / "assets/art/roster-keystone/roster.json"
    roster_before = sha256(roster_path)
    errors = []
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT))
    )
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = "http://127.0.0.1:" + str(server.server_address[1])
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1480, "height": 1150}, accept_downloads=True)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            response = page.goto(base + "/game/hd-boss-review.html?boss=captain-kaji", wait_until="domcontentloaded")
            assert response and response.status == 200

            for boss in IDS:
                page.locator('button[data-boss="' + boss + '"]').click()
                page.wait_for_function(
                    """id => {
                      const c = document.querySelector('#motionCanvas');
                      const image = document.querySelector('#sourceImage');
                      return c?.dataset.imageReady === 'true'
                        && c.dataset.boss === id && c.dataset.clip === 'idle'
                        && image?.naturalWidth === 1536 && image?.naturalHeight === 1024
                        && document.querySelectorAll('#poseGrid button').length === 6;
                    }""",
                    arg=boss,
                    timeout=40000,
                )
                assert page.locator("#sourceMeta").inner_text().endswith("pending"), boss
                assert page.locator("#clip option").count() == 10, boss

            # Exercise true frame navigation, review state, playback, and evidence.
            page.locator('button[data-boss="captain-kaji"]').click()
            page.wait_for_function(
                "() => document.querySelector('#motionCanvas')?.dataset.imageReady==='true'"
                " && document.querySelector('#motionCanvas').dataset.boss==='captain-kaji'",
                timeout=40000,
            )
            page.locator("#clip").select_option("windup")
            page.wait_for_function(
                "() => document.querySelector('#motionCanvas')?.dataset.imageReady==='true'"
                " && document.querySelector('#motionCanvas').dataset.clip==='windup'"
            )
            page.locator("#speed").select_option("0.5")
            page.locator("#backdrop").select_option("light")
            page.locator("#stepBack").click()
            assert page.locator("#motionCanvas").get_attribute("data-frame") == "23"
            page.locator("#stepNext").click()
            assert page.locator("#motionCanvas").get_attribute("data-frame") == "0"
            page.locator("#stepBack").click()
            page.locator("#bossDecision").select_option("needs-fixes")
            page.locator("#bossNote").fill("Review the sword-side silhouette edge and transparency.")
            page.locator("#clipDecision").select_option("ready-for-signoff")
            page.locator("#clipNote").fill("Check attack tell readability near frame 24.")

            # Record one independently reproducible screenshot PNG + receipt.
            page.screenshot(path=str(OUT / "review-studio-full-page.png"), full_page=True)
            with page.expect_download() as download_info:
                page.locator("#capture").click()
            png_download = download_info.value
            png_path = OUT / png_download.suggested_filename
            assert png_path.suffix == ".png"
            png_download.save_as(str(png_path))
            with page.expect_download() as json_info:
                page.locator("#receipt").click()
            json_download = json_info.value
            json_path = OUT / json_download.suggested_filename
            assert json_path.suffix == ".json"
            json_download.save_as(str(json_path))
            receipt = json.loads(json_path.read_text(encoding="utf-8"))
            assert receipt["schema"] == "jrpg-hd-boss-visual-review/1"
            assert receipt["bossId"] == "captain-kaji"
            assert receipt["clipId"] == "windup"
            assert receipt["frameIndex"] == 23
            assert receipt["backdrop"] == "light"
            assert receipt["playbackSpeed"] == 0.5
            assert receipt["canonicalVisualApproval"] == "pending"
            assert receipt["review"]["decision"] == "needs-fixes"
            assert receipt["review"]["clipDecision"] == "ready-for-signoff"
            assert receipt["screenshotSha256"] == sha256(png_path)
            assert receipt["originalPainting"]["sha256"]
            assert receipt["sixKeyAtlas"]["sha256"]
            assert receipt["animationAtlas"]["sha256"]

            with page.expect_download() as notes_info:
                page.locator("#exportDraft").click()
            notes_path = OUT / notes_info.value.suggested_filename
            notes_info.value.save_as(str(notes_path))
            notes = json.loads(notes_path.read_text(encoding="utf-8"))
            assert len(notes["rosterStatus"]) == 7
            assert all(x["canonicalVisualApproval"] == "pending" for x in notes["rosterStatus"].values())

            page.reload(wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.querySelector('#motionCanvas')?.dataset.imageReady==='true'",
                timeout=40000,
            )
            assert page.locator("#bossNote").input_value().startswith("Review the sword-side")
            page.emulate_media(reduced_motion="reduce")
            page.locator("#play").click()
            assert page.locator("#play").get_attribute("aria-pressed") == "false"
            assert not errors, errors

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
    assert sha256(roster_path) == roster_before, "Smoke unexpectedly changed the Roster Keystone"
    report = {
        "ok": True,
        "realSourceBossesLoaded": len(IDS),
        "runtimeClipsPerBoss": 10,
        "pngReceiptHashMatched": True,
        "reviewNotesPersistedInIsolatedBrowser": True,
        "canonicalVisualApproval": "pending",
        "rosterSha256Unchanged": roster_before,
        "pageErrors": errors,
    }
    (OUT / "smoke-summary.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    probe()
