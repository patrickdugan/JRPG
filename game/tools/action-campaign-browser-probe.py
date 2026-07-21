#!/usr/bin/env python3
"""Installed-Chrome probe for the isolated campaign action controller."""

from __future__ import annotations

import argparse
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


GAME_DIR = Path(__file__).resolve().parents[1]
CHROMIUM_CANDIDATES = (
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe",
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def find_chromium(explicit: str | None) -> Path:
    candidates = (Path(explicit),) if explicit else CHROMIUM_CANDIDATES
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("No installed Chrome or Edge executable was found.")


def run_probe(chromium: Path) -> dict[str, object]:
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    console_errors: list[str] = []
    page_errors: list[str] = []
    delivery_errors: list[dict[str, object]] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=str(chromium),
                args=["--disable-extensions", "--no-first-run", "--disable-background-networking"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1200})
            page = context.new_page()
            page.set_default_timeout(15_000)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on(
                "response",
                lambda response: delivery_errors.append({"url": response.url, "status": response.status})
                if response.status >= 400
                else None,
            )
            response = page.goto(
                f"{base}/action-campaign-battle.html?encounter=c1-cinder-hounds"
                "&return=campaign.html%3Fprobe%3D1",
                wait_until="domcontentloaded",
            )
            require(response is not None and response.status == 200, "Action campaign page did not return HTTP 200.")
            page.wait_for_function(
                """() => {
                  const canvas = document.querySelector('#actionCampaignCanvas');
                  return canvas?.dataset.partyArtState === 'ready'
                    && canvas?.dataset.enemyArtState === 'ready'
                    && canvas?.dataset.stageArtState === 'ready'
                    && globalThis.__ACTION_CAMPAIGN_BATTLE__?.getSnapshot().kernel.nowMs > 0;
                }"""
            )
            before = page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const controlled = snapshot.kernel.actors.find(actor => actor.id === snapshot.kernel.controlledActorId);
                  return {
                    encounterId: snapshot.encounterId,
                    stageId: document.querySelector('#actionCampaignCanvas').dataset.stageId,
                    objectiveSupported: snapshot.objective.supported,
                    objectiveStatus: snapshot.objective.status,
                    controlledActorId: snapshot.kernel.controlledActorId,
                    controlledX: controlled.position.x,
                    continueHidden: document.querySelector('#continueCampaign').hidden,
                    returnTarget: document.querySelector('#continueCampaign').getAttribute('href'),
                    storageKeys: Object.keys(localStorage),
                  };
                }"""
            )
            require(before["encounterId"] == "c1-cinder-hounds", f"Wrong encounter: {before}")
            require(before["stageId"] == "c1-flooded-cedars", f"Wrong authored stage: {before}")
            require(before["objectiveSupported"] is True and before["objectiveStatus"] == "pending", f"Objective runtime missing: {before}")
            require(before["controlledActorId"] == "ren", f"Party control missing: {before}")
            require(before["continueHidden"] is True, f"Continue exposed before settlement: {before}")
            require(before["returnTarget"] == "campaign.html?probe=1", f"Return handoff drifted: {before}")
            require(before["storageKeys"] == [], f"Page load touched the isolated persistent profile: {before}")

            page.locator("#actionCampaignCanvas").focus()
            page.keyboard.down("d")
            page.wait_for_timeout(240)
            page.keyboard.up("d")
            page.wait_for_timeout(80)
            page.keyboard.press("j")
            page.wait_for_function(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const actor = snapshot.kernel.actors.find(entry => entry.id === snapshot.kernel.controlledActorId);
                  return actor && actor.activeAttack === null && actor.offensiveCooldownRemainingMs > 0;
                }"""
            )
            cooldown_before = page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const actor = snapshot.kernel.actors.find(entry => entry.id === snapshot.kernel.controlledActorId);
                  return { x: actor.position.x, remainingMs: actor.offensiveCooldownRemainingMs };
                }"""
            )
            page.keyboard.down("d")
            page.wait_for_timeout(80)
            page.keyboard.up("d")
            after = page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const controlled = snapshot.kernel.actors.find(actor => actor.id === snapshot.kernel.controlledActorId);
                  return {
                    controlledX: controlled.position.x,
                    paused: document.querySelector('#actionCampaignCanvas').dataset.paused,
                    objectiveText: document.querySelector('#objectiveText').textContent,
                    partyRows: document.querySelectorAll('#partyReadout li').length,
                    enemyRows: document.querySelectorAll('#enemyReadout li').length,
                    cooldownRows: document.querySelectorAll('#attackTimers .attack-timer').length,
                    offenseCooldownMs: controlled.offensiveCooldownRemainingMs,
                    storageKeys: Object.keys(localStorage),
                  };
                }"""
            )
            require(after["controlledX"] > before["controlledX"], f"Free movement did not advance: {before} / {after}")
            require(after["controlledX"] > cooldown_before["x"], f"Movement stayed locked during live cooldown: {cooldown_before} / {after}")
            require(0 <= after["offenseCooldownMs"] < cooldown_before["remainingMs"], f"Cooldown timer did not count down independently: {cooldown_before} / {after}")
            require(after["paused"] == "false", f"Visible page reported paused: {after}")
            require(bool(after["objectiveText"]), f"Text objective authority is empty: {after}")
            require(after["partyRows"] == 2 and after["enemyRows"] == 2, f"Text roster authority drifted: {after}")
            require(after["cooldownRows"] == 2, f"Cooldown authority drifted: {after}")
            require(after["storageKeys"] == [], f"Movement touched the isolated persistent profile: {after}")
            require(not console_errors, f"Console errors: {console_errors}")
            require(not page_errors, f"Page errors: {page_errors}")
            require(not delivery_errors, f"Delivery errors: {delivery_errors}")
            context.close()
            browser.close()
            return {
                "ok": True,
                "chromium": str(chromium),
                "encounterId": before["encounterId"],
                "stageId": before["stageId"],
                "movementDelta": round(after["controlledX"] - before["controlledX"], 3),
                "cooldownMovementDelta": round(after["controlledX"] - cooldown_before["x"], 3),
                "cooldownTimerDeltaMs": cooldown_before["remainingMs"] - after["offenseCooldownMs"],
                "objectiveSupported": before["objectiveSupported"],
                "continueLocked": before["continueHidden"],
                "isolatedStorageKeys": after["storageKeys"],
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "deliveryErrors": delivery_errors,
            }
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chromium")
    args = parser.parse_args()
    result = run_probe(find_chromium(args.chromium))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
