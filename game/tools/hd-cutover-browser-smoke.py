#!/usr/bin/env python3
"""Serve the actual Git artwork and browser-test candidate cutover review.

Uses a disposable synthetic WebP derived from the first canonical original
windup clip. The fixture is never written into the engine asset directory.
"""
from __future__ import annotations

import argparse
import functools
import hashlib
import json
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/hd-cutover-browser"
BOSS = "yearless-bell"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare_fixture(dir: Path, real_candidate_dir: Path | None = None):
    manifest = json.loads((ROOT / "game/assets/art/hd-painted-v1/motion-manifest.json").read_text())
    source = manifest["actors"][BOSS]["clipSet"]
    original = ROOT / "game/assets/art/hd-painted-v1" / source["windup"]["path"]
    assert digest(original.read_bytes()) == source["windup"]["sha256"]
    with Image.open(original) as im:
        atlas = im.convert("RGBA")
    # Make a distinguishable candidate at exactly one cell. This fixture
    # tests upload/evidence wiring and makes no artistic quality claim.
    atlas.putpixel((2124, 202), (210, 160, 90, 255))
    path = dir / "synthetic-yearless-review.webp"
    atlas.save(path, format="WEBP", lossless=True, method=6)
    with Image.open(path) as im:
        decoded = im.convert("RGBA")
    hashes = []
    for i in range(24):
        x, y = (i % 12) * 192, (i // 12) * 192
        hashes.append(digest(decoded.crop((x, y, x + 192, y + 192)).tobytes()))
    assert len(set(hashes)) == 24
    record = {
        "schema": "jrpg-hd-boss-attack-effect-leadin/1",
        "bosses": {
            BOSS: {
                "leadInWebPSha256": digest(path.read_bytes()),
                "decodedFrameHashes": hashes,
                "immutableActiveSha256": source["active"]["sha256"],
            },
        },
    }
    receipt = dir / "synthetic-generator-receipt.json"
    receipt.write_text(json.dumps(record), encoding="utf-8")
    bad = json.loads(receipt.read_text(encoding="utf-8"))
    bad["bosses"][BOSS]["leadInWebPSha256"] = "f" * 64
    wrong = dir / "wrong-sha-receipt.json"
    wrong.write_text(json.dumps(bad), encoding="utf-8")
    if real_candidate_dir is not None:
        real = real_candidate_dir / (BOSS + "-windup-effect-leadin.webp")
        real_receipt = real_candidate_dir / "effect-leadin-receipts.json"
        if not real.is_file() or not real_receipt.is_file():
            raise ValueError("Real source-generated effect candidate is absent")
        proof = json.loads(real_receipt.read_text(encoding="utf-8"))
        official = proof["bosses"][BOSS]
        assert official["leadInWebPSha256"] == digest(real.read_bytes())
        assert official["immutableActiveSha256"] == source["active"]["sha256"]
        assert len(official["decodedFrameHashes"]) == 24
        path, receipt = real, real_receipt
    return path, receipt, wrong, manifest


def run(real_candidate_dir: Path | None = None):
    OUT.mkdir(parents=True, exist_ok=True)
    roster_path = ROOT / "assets/art/roster-keystone/roster.json"
    roster_sha = digest(roster_path.read_bytes())
    errors = []
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT))
    )
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    url = "http://127.0.0.1:" + str(server.server_address[1])
    try:
        with tempfile.TemporaryDirectory() as tmp:
            candidate, receipt, wrong, manifest = prepare_fixture(Path(tmp), real_candidate_dir)
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={"width": 1450, "height": 990}, accept_downloads=True
                )
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                response = page.goto(
                    url + "/game/hd-cutover-lab.html?boss=" + BOSS,
                    wait_until="domcontentloaded",
                )
                assert response and response.status == 200
                try:
                    page.wait_for_function(
                        """() => document.querySelector('#original')?.dataset.phase === 'windup'
                           && Number.isFinite(Number(document.querySelector('#baselineScore')?.textContent))
                           && document.querySelector('#original')?.dataset.frame === '20'""",
                        timeout=15000,
                    )
                except Exception:
                    print("Browser page initialization diagnostic:",
                          {"status": page.locator("#status").inner_text(),
                           "errors": errors,
                           "originalData": page.locator("#original").evaluate("(node) => ({...node.dataset})"),
                           "baseline": page.locator("#baselineScore").inner_text()},
                          flush=True)
                    page.screenshot(path=str(OUT / "failed-startup.png"), full_page=True)
                    raise
                assert page.locator("#originalCounter").inner_text() == "WINDUP 21 / 24"
                assert page.locator("#capture").is_disabled()
                page.locator("#candidate").set_input_files(candidate)
                page.locator("#receiptFile").set_input_files(wrong)
                page.wait_for_function(
                    "() => document.querySelector('#verifiedStatus')?.textContent === 'Rejected'"
                )
                assert page.locator("#capture").is_disabled()
                assert "SHA-256 mismatch" in page.locator("#status").inner_text()
                page.locator("#receiptFile").set_input_files(receipt)
                page.wait_for_function(
                    "() => document.querySelector('#verifiedStatus')?.textContent === 'Verified'",
                    timeout=20000,
                )
                assert page.locator("#capture").is_enabled()
                assert page.locator("#proposed").get_attribute("data-verified") == "true"
                page.locator("#decision").select_option("needs-keys")
                page.locator("#notes").fill(
                    "Synthetic fixture: inspect Yearless Bell attachment at frame 24."
                )
                page.locator("#backdrop").select_option("parchment")
                page.locator("#speed").select_option("0.25")
                for _ in range(4):
                    page.locator("#next").click()
                assert page.locator("#originalCounter").inner_text() == "ACTIVE 01 / 24"
                assert page.locator("#proposed").get_attribute("data-frame") == "24"
                page.locator("#prev").click()
                assert page.locator("#originalCounter").inner_text() == "WINDUP 24 / 24"
                page.screenshot(path=str(OUT / "cutover-review-full-page.png"), full_page=True)

                with page.expect_download() as shot_info:
                    page.locator("#capture").click()
                shot = shot_info.value
                png = OUT / shot.suggested_filename
                shot.save_as(str(png))
                with page.expect_download() as json_info:
                    page.locator("#downloadReceipt").click()
                exported = OUT / json_info.value.suggested_filename
                json_info.value.save_as(str(exported))
                report = json.loads(exported.read_text(encoding="utf-8"))
                assert report["bossId"] == BOSS
                assert report["timelineFrame"] == 23
                assert report["phase"]["phase"] == "windup"
                assert report["phase"]["frameNumber"] == 24
                assert report["candidateWindupSha256"] == digest(candidate.read_bytes())
                assert report["originalActiveSha256"] == manifest["actors"][BOSS]["clipSet"]["active"]["sha256"]
                assert report["screenshotSha256"] == digest(png.read_bytes())
                assert report["canonicalVisualApproval"] == "pending"
                assert report["humanReview"]["decision"] == "needs-keys"

                page.reload(wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => document.querySelector('#original')?.dataset.phase === 'windup'",
                    timeout=30000,
                )
                assert page.locator("#notes").input_value().startswith("Synthetic fixture")
                page.emulate_media(reduced_motion="reduce")
                page.locator("#play").click()
                assert page.locator("#play").get_attribute("aria-pressed") == "false"
                page.locator("#boss").select_option("lady-enma")
                page.wait_for_function(
                    "() => document.querySelector('#original')?.dataset.phase === 'windup'"
                    " && document.querySelector('#status')?.textContent.includes('Original phase boundary')",
                    timeout=30000,
                )
                assert page.locator("#capture").is_disabled()
                assert page.locator("#verifiedStatus").inner_text() == "Pending"
                assert not errors, errors
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
    assert digest(roster_path.read_bytes()) == roster_sha
    result = {
        "ok": True,
        "source": ("real Git source and regenerated effect candidate"
                   if real_candidate_dir is not None
                   else "real original Git images; disposable synthetic upload fixture"),
        "candidateHashMatchedReceipt": True,
        "incorrectReceiptRejected": True,
        "phaseBoundaryStepping": True,
        "pairedPngSha256Matched": True,
        "localNotesRetained": True,
        "reducedMotionRespected": True,
        "rosterUnchanged": True,
        "pageErrors": errors,
    }
    (OUT / "smoke-summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--real-candidate-dir", type=Path, default=None)
    args = parser.parse_args()
    run(args.real_candidate_dir.resolve() if args.real_candidate_dir else None)
