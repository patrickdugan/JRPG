#!/usr/bin/env python3
"""Installed-Chrome probe for the isolated campaign action controller."""

from __future__ import annotations

import argparse
import functools
import json
import threading
import time
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
            page.set_default_navigation_timeout(45_000)
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
                "&lead=ren&support=miyo"
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
                    && canvas?.dataset.comboAvailable === 'false'
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
                    controlledMovementProfileId: controlled.movementProfileId,
                    supportActorId: snapshot.duo.supportActorId,
                    controlledX: controlled.position.x,
                    continueHidden: document.querySelector('#continueCampaign').hidden,
                    returnTarget: document.querySelector('#continueCampaign').getAttribute('href'),
                    storageKeys: Object.keys(localStorage),
                    comboAvailable: snapshot.combo.available,
                    comboReasonCodes: snapshot.combo.reasons.map(reason => reason.code),
                    comboName: document.querySelector('#comboTitle').textContent,
                    comboArts: [...document.querySelectorAll('#comboArts li')].map(row => row.textContent),
                    comboProximity: document.querySelector('#comboProximity').textContent,
                  };
                }"""
            )
            require(before["encounterId"] == "c1-cinder-hounds", f"Wrong encounter: {before}")
            require(before["stageId"] == "c1-flooded-cedars", f"Wrong authored stage: {before}")
            require(before["objectiveSupported"] is True and before["objectiveStatus"] == "pending", f"Objective runtime missing: {before}")
            require(before["controlledActorId"] == "ren", f"Party control missing: {before}")
            require(before["controlledMovementProfileId"] == "infiltrator", f"Ren movement profile missing: {before}")
            require(before["supportActorId"] == "miyo", f"Selected Miyo support missing: {before}")
            require(before["continueHidden"] is True, f"Continue exposed before settlement: {before}")
            require(before["returnTarget"] == "campaign.html?probe=1", f"Return handoff drifted: {before}")
            require(before["storageKeys"] == [], f"Page load touched the isolated persistent profile: {before}")
            require(before["comboAvailable"] is False, f"Cinder Hounds incorrectly exposed Hunter-Priest combo: {before}")
            require("participant-missing" in before["comboReasonCodes"], f"Missing participant lock reason: {before}")
            require(before["comboName"] == "Black Sun Concord", f"Combo contract name drifted: {before}")
            require(len(before["comboArts"]) == 2, f"Contributing arts are not text-authoritative: {before}")
            require("Proximity unavailable" in before["comboProximity"], f"Missing proximity readout: {before}")

            page.locator("#actionCampaignCanvas").focus()
            page.keyboard.press("l")
            page.wait_for_function("() => document.querySelector('#eventLog').textContent.includes('unavailable')")

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

            combo_context = browser.new_context(viewport={"width": 1440, "height": 1200})
            combo_page = combo_context.new_page()
            combo_page.set_default_timeout(15_000)
            combo_page.set_default_navigation_timeout(45_000)
            combo_page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            combo_page.on("pageerror", lambda error: page_errors.append(str(error)))
            combo_page.on(
                "response",
                lambda response: delivery_errors.append({"url": response.url, "status": response.status})
                if response.status >= 400
                else None,
            )
            combo_response = combo_page.goto(
                f"{base}/action-campaign-battle.html?encounter=c4-widow-of-fog"
                "&return=campaign.html%3Fcombo-probe%3D1",
                wait_until="domcontentloaded",
            )
            require(combo_response is not None and combo_response.status == 200,
                    "Widow of Fog action page did not return HTTP 200.")
            combo_page.wait_for_function(
                """() => {
                  const canvas = document.querySelector('#actionCampaignCanvas');
                  return canvas?.dataset.partyArtState === 'ready'
                    && canvas?.dataset.enemyArtState === 'ready'
                    && canvas?.dataset.stageArtState === 'ready'
                    && globalThis.__ACTION_CAMPAIGN_BATTLE__?.getSnapshot().kernel.nowMs > 0;
                }"""
            )
            combo_page.locator("#actionCampaignCanvas").focus()
            combo_page.wait_for_function(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  return snapshot.encounterId === 'c4-widow-of-fog'
                    && snapshot.kernel.controlledActorId === 'lise'
                    && snapshot.combo.available === true;
                }"""
            )
            combo_ready = combo_page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  return {
                    encounterId: snapshot.encounterId,
                    controlledActorId: snapshot.kernel.controlledActorId,
                    comboId: snapshot.combo.comboId,
                    comboAvailable: snapshot.combo.available,
                    participants: snapshot.combo.participants.map(({ actorId, attackId }) => ({ actorId, attackId })),
                    separationPx: snapshot.combo.separationPx,
                    storageKeys: Object.keys(localStorage),
                  };
                }"""
            )
            require(combo_ready["comboAvailable"] is True, f"Widow combo was not ready: {combo_ready}")
            require(combo_ready["controlledActorId"] == "lise", f"Default duo did not lead with Nikola: {combo_ready}")
            require(combo_ready["storageKeys"] == [], f"Fresh combo context had persistent storage: {combo_ready}")
            require(
                {participant["actorId"] for participant in combo_ready["participants"]} == {"lise", "mateus"},
                f"Wrong combo participants: {combo_ready}",
            )

            combo_page.evaluate(
                """() => {
                  const events = [];
                  const seen = new Set();
                  const collect = () => {
                    const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                    for (const event of snapshot.recentEvents) {
                      if (event.comboId !== snapshot.combo.comboId) continue;
                      const key = JSON.stringify([
                        event.nowMs, event.type, event.actorId, event.attackId, event.targetActorId,
                      ]);
                      if (!seen.has(key)) {
                        seen.add(key);
                        events.push(event);
                      }
                    }
                    requestAnimationFrame(collect);
                  };
                  globalThis.__ACTION_COMBO_PROBE_EVENTS__ = events;
                  requestAnimationFrame(collect);
                }"""
            )
            combo_page.keyboard.press("l")
            combo_page.wait_for_function(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const active = snapshot.kernel.actors.filter(actor => actor.activeAttack?.comboId === snapshot.combo.comboId);
                  return active.length === 2
                    && active.some(actor => actor.id === 'lise')
                    && active.some(actor => actor.id === 'mateus');
                }"""
            )
            combo_started = combo_page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  return snapshot.kernel.actors
                    .filter(actor => actor.activeAttack?.comboId === snapshot.combo.comboId)
                    .map(actor => ({
                      actorId: actor.id,
                      attackId: actor.activeAttack.attackId,
                      comboId: actor.activeAttack.comboId,
                    }));
                }"""
            )
            require(
                {actor["actorId"] for actor in combo_started} == {"lise", "mateus"},
                f"Combo did not atomically commit exactly Nikola and Mateus: {combo_started}",
            )
            require(
                all(actor["comboId"] == combo_ready["comboId"] for actor in combo_started),
                f"Active attacks lost combo provenance: {combo_started}",
            )
            combo_page.wait_for_function(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const completions = globalThis.__ACTION_COMBO_PROBE_EVENTS__
                    .filter(event => event.type === 'attack-complete' && event.comboId === snapshot.combo.comboId);
                  const completedActors = new Set(completions.map(event => event.actorId));
                  const lise = snapshot.kernel.actors.find(actor => actor.id === 'lise');
                  const mateus = snapshot.kernel.actors.find(actor => actor.id === 'mateus');
                  return completedActors.has('lise')
                    && completedActors.has('mateus')
                    && lise?.activeAttack === null
                    && mateus?.activeAttack === null
                    && lise.attackCooldowns['party:lise:dawn-bolt'] > 0
                    && mateus.attackCooldowns['party:mateus:penitent-night'] > 0
                    && lise.attackCooldowns['party:lise:hunter-thrust'] === 0;
                }"""
            )
            combo_after = combo_page.evaluate(
                """() => {
                  const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                  const lise = snapshot.kernel.actors.find(actor => actor.id === 'lise');
                  const mateus = snapshot.kernel.actors.find(actor => actor.id === 'mateus');
                  return {
                    completedActorIds: [...new Set(globalThis.__ACTION_COMBO_PROBE_EVENTS__
                      .filter(event => event.type === 'attack-complete' && event.comboId === snapshot.combo.comboId)
                      .map(event => event.actorId))].sort(),
                    liseDawnBoltCooldownMs: lise.attackCooldowns['party:lise:dawn-bolt'],
                    mateusPenitentNightCooldownMs: mateus.attackCooldowns['party:mateus:penitent-night'],
                    liseHunterThrustCooldownMs: lise.attackCooldowns['party:lise:hunter-thrust'],
                    activeComboActorIds: snapshot.kernel.actors
                      .filter(actor => actor.activeAttack?.comboId === snapshot.combo.comboId)
                      .map(actor => actor.id),
                    storageKeys: Object.keys(localStorage),
                  };
                }"""
            )
            require(combo_after["completedActorIds"] == ["lise", "mateus"],
                    f"Both linked arts did not complete: {combo_after}")
            require(combo_after["liseDawnBoltCooldownMs"] > 0, f"Dawn Bolt cooldown missing: {combo_after}")
            require(combo_after["mateusPenitentNightCooldownMs"] > 0,
                    f"Penitent Night cooldown missing: {combo_after}")
            require(combo_after["liseHunterThrustCooldownMs"] == 0,
                    f"Combo incorrectly touched Hunter Thrust cooldown: {combo_after}")
            require(combo_after["activeComboActorIds"] == [], f"Combo attacks did not finish: {combo_after}")
            require(combo_after["storageKeys"] == [], f"Combo flow touched persistent storage: {combo_after}")
            require(not console_errors, f"Console errors: {console_errors}")
            require(not page_errors, f"Page errors: {page_errors}")
            require(not delivery_errors, f"Delivery errors: {delivery_errors}")
            combo_context.close()

            canonical_context = browser.new_context(viewport={"width": 1440, "height": 1200})
            canonical_page = canonical_context.new_page()
            canonical_page.set_default_timeout(15_000)
            canonical_page.set_default_navigation_timeout(45_000)
            canonical_page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            canonical_page.on("pageerror", lambda error: page_errors.append(str(error)))
            canonical_page.on(
                "response",
                lambda response: delivery_errors.append({"url": response.url, "status": response.status})
                if response.status >= 400
                else None,
            )
            new_game_response = canonical_page.goto(
                f"{base}/campaign.html?new=1",
                wait_until="domcontentloaded",
            )
            require(new_game_response is not None and new_game_response.status == 200,
                    "Campaign New Game setup did not return HTTP 200.")
            canonical_page.locator("#sceneTitle").wait_for()
            canonical_response = canonical_page.goto(
                f"{base}/action-campaign-battle.html?encounter=c1-cinder-hounds"
                "&mode=campaign&lead=nikola&support=mateus"
                "&return=campaign.html%3Fcanonical-probe%3D1",
                wait_until="domcontentloaded",
            )
            require(canonical_response is not None and canonical_response.status == 200,
                    "Canonical action campaign page did not return HTTP 200.")
            canonical_page.wait_for_function(
                """() => {
                  const canvas = document.querySelector('#actionCampaignCanvas');
                  return canvas?.dataset.canonicalMode === 'true'
                    && globalThis.__ACTION_CAMPAIGN_BATTLE__?.getSnapshot().kernel.nowMs > 0;
                }"""
            )
            canonical_page.locator("#actionCampaignCanvas").focus()
            combat_deadline = time.monotonic() + 35
            restart_count = 0
            while time.monotonic() < combat_deadline:
                state = canonical_page.evaluate(
                    """() => {
                      const snapshot = globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot();
                      const controlled = snapshot.kernel.actors.find(actor => actor.id === snapshot.kernel.controlledActorId);
                      const support = snapshot.kernel.actors.find(
                        actor => actor.faction === 'player' && actor.id !== snapshot.kernel.controlledActorId && actor.hp > 0
                      );
                      const enemies = snapshot.kernel.actors.filter(actor => actor.faction === 'enemy' && actor.hp > 0);
                      const nearest = controlled && enemies.sort(
                        (left, right) => Math.abs(left.position.x - controlled.position.x)
                          - Math.abs(right.position.x - controlled.position.x)
                      )[0];
                      return {
                        outcome: snapshot.outcome,
                        complete: globalThis.__ACTION_CAMPAIGN_BATTLE__.canonicalComplete,
                        controlledX: controlled?.position.x ?? 0,
                        controlledHp: controlled?.hp ?? 0,
                        controlledMaxHp: controlled?.maxHp ?? 1,
                        supportHp: support?.hp ?? 0,
                        supportMaxHp: support?.maxHp ?? 1,
                        enemyX: nearest?.position.x ?? null,
                        enemyWindup: enemies.some(actor => actor.activeAttack?.phase === 'windup'),
                        tagReady: snapshot.kernel.tagCooldownRemainingMs === 0,
                        comboReady: snapshot.combo.available,
                      };
                    }"""
                )
                if state["complete"]:
                    break
                if state["outcome"] == "defeat":
                    require(restart_count < 1, f"Canonical action probe lost twice: {state}")
                    canonical_page.keyboard.press("r")
                    restart_count += 1
                    canonical_page.wait_for_timeout(200)
                    continue
                if state["comboReady"]:
                    canonical_page.keyboard.press("l")
                if state["enemyX"] is not None:
                    distance = state["enemyX"] - state["controlledX"]
                    if (state["controlledHp"] / state["controlledMaxHp"] < 0.42
                            and state["supportHp"] / state["supportMaxHp"] > 0.55
                            and state["tagReady"]):
                        canonical_page.keyboard.press("Tab")
                    if abs(distance) < 180 or state["enemyWindup"]:
                        key = "a" if distance > 0 else "d"
                        canonical_page.keyboard.down(key)
                        canonical_page.keyboard.press("q")
                        canonical_page.wait_for_timeout(110)
                        canonical_page.keyboard.up(key)
                    elif abs(distance) > 270:
                        key = "d" if distance > 0 else "a"
                        canonical_page.keyboard.down(key)
                        canonical_page.wait_for_timeout(90)
                        canonical_page.keyboard.up(key)
                    canonical_page.keyboard.press("k")
                    canonical_page.keyboard.press("j")
                    canonical_page.keyboard.press("v")
                    canonical_page.keyboard.press("c")
                canonical_page.wait_for_timeout(100)
            canonical_page.wait_for_function(
                "() => globalThis.__ACTION_CAMPAIGN_BATTLE__?.canonicalComplete === true",
                timeout=5_000,
            )
            canonical_after = canonical_page.evaluate(
                """() => {
                  const canvas = document.querySelector('#actionCampaignCanvas');
                  const keys = Object.keys(localStorage);
                  return {
                    outcome: globalThis.__ACTION_CAMPAIGN_BATTLE__.getSnapshot().outcome,
                    canonicalComplete: globalThis.__ACTION_CAMPAIGN_BATTLE__.canonicalComplete,
                    settlementState: canvas.dataset.settlementState,
                    continueHidden: document.querySelector('#continueCampaign').hidden,
                    returnTarget: document.querySelector('#continueCampaign').getAttribute('href'),
                    storageKeys: keys,
                    hasAdvancement: keys.some(key => key.includes('.advancement.')),
                    hasLoadout: keys.some(key => key.includes('.loadout.')),
                    hasPlaytime: keys.some(key => key.includes('.playtime.')),
                    hasRunReceipt: keys.some(key => key.includes('.run-receipt.')),
                    storageChanged: !globalThis.__ACTION_CAMPAIGN_BATTLE__.canonicalStorageUnchanged(),
                  };
                }"""
            )
            require(canonical_after["outcome"] == "victory", f"Canonical action did not win: {canonical_after}")
            require(canonical_after["canonicalComplete"] is True, f"Canonical settlement did not complete: {canonical_after}")
            require(canonical_after["settlementState"] == "committed", f"Settlement did not commit: {canonical_after}")
            require(canonical_after["continueHidden"] is False, f"Continue stayed locked after commit: {canonical_after}")
            require(canonical_after["returnTarget"] == "campaign.html?canonical-probe=1",
                    f"Canonical return target drifted: {canonical_after}")
            require(all(canonical_after[key] for key in (
                "hasAdvancement", "hasLoadout", "hasPlaytime", "hasRunReceipt", "storageChanged"
            )), f"Canonical authorities were not all written: {canonical_after}")
            require(not console_errors, f"Console errors: {console_errors}")
            require(not page_errors, f"Page errors: {page_errors}")
            require(not delivery_errors, f"Delivery errors: {delivery_errors}")
            canonical_context.close()
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
                "comboLocked": not before["comboAvailable"],
                "comboReasonCodes": before["comboReasonCodes"],
                "comboEncounterId": combo_ready["encounterId"],
                "comboReady": combo_ready["comboAvailable"],
                "comboParticipants": combo_ready["participants"],
                "comboStartedActors": combo_started,
                "comboCompletedActorIds": combo_after["completedActorIds"],
                "comboCooldownsMs": {
                    "liseDawnBolt": combo_after["liseDawnBoltCooldownMs"],
                    "mateusPenitentNight": combo_after["mateusPenitentNightCooldownMs"],
                    "liseHunterThrust": combo_after["liseHunterThrustCooldownMs"],
                },
                "isolatedStorageKeys": after["storageKeys"],
                "comboStorageKeys": combo_after["storageKeys"],
                "canonicalSettlement": canonical_after,
                "canonicalRestarts": restart_count,
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
