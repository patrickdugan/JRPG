#!/usr/bin/env python3
"""Chapter 3-9 authored boss encounter smoke using the real Action Campaign page.

This is a live-browser telegraph/readability and objective-preservation gate.
It does not claim human comprehension, encounter victory, route completion,
artistic approval, or a five-hour campaign-duration proof.
"""
from __future__ import annotations

import argparse
import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "game"
OUT = ROOT / "artifacts" / "late-boss-gameplay"
CASES = (
    ("c3-captain-kaji", "captain-kaji", "kaji", "chain haul"),
    ("c4-widow-of-fog", "widow-of-fog", "widow", "high tide"),
    ("c5-furnace-abbot", "furnace-abbot", "abbot", "forge sermon"),
    ("c6-ujiro", "ujiro", "ujiro", "seizure order"),
    ("c7-bell-warden-chiyo", "bell-warden-chiyo", "chiyo", "fourth bell count"),
    ("c8-lady-enma", "lady-enma", "enma", "paired ashes"),
    ("c9-yearless-bell", "yearless-bell", "yearless", "four bell nodes"),
    ("c9-kurozane", "kurozane", "kurozane", "umbral heals kurozane"),
)
DRAW_PROBE = r"""(() => {
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  const seen = {};
  window.__lateBossPaint = seen;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    if (this.canvas?.id === 'actionCampaignCanvas') {
      const source = args[0]?.currentSrc || args[0]?.src;
      if (typeof source === 'string' && source.includes('/hd-painted-v1/')) {
        const path = source.split('/hd-painted-v1/')[1];
        seen[path] = (seen[path] || 0) + 1;
      }
    }
    return draw.apply(this, args);
  };
})();"""
STATE = r"""() => {
  const runtime = window.__ACTION_CAMPAIGN_BATTLE__;
  const s = runtime?.getSnapshot?.();
  if (!s) return null;
  const enemies = s.kernel.actors.filter(a => a.faction === 'enemy');
  const c = document.querySelector('#actionCampaignCanvas');
  return {
    encounterId: s.encounterId,
    outcome: s.outcome,
    nowMs: s.kernel.nowMs,
    objectiveSupported: s.objective?.supported,
    objectiveStatus: s.objective?.status,
    objectiveRequirements: (s.objective?.requirements || []).map(r => ({
      id:r.id, complete:r.complete
    })),
    objectiveText: document.querySelector('#objectiveText')?.textContent || '',
    coachingTitle: document.querySelector('#battleCoachTitle')?.textContent || '',
    coachingSummary: document.querySelector('#battleCoachSummary')?.textContent || '',
    coachingSteps: [...document.querySelectorAll('#battleCoachSteps li')]
      .map(n => n.textContent),
    enemyActors: enemies.map(a => ({
      id:a.id,name:a.name,hp:a.hp,
      attack:a.activeAttack
        ? {attackId:a.activeAttack.attackId,phase:a.activeAttack.phase}
        : null
    })),
    phaseId: s.bossPhase?.phaseId || null,
    hdArtMode: c?.dataset.hdArtMode || null,
    canonicalStorageUnchanged: runtime.canonicalStorageUnchanged(),
    persistentKeys: Object.keys(localStorage),
    paintedSources: { ...window.__lateBossPaint }
  };
}"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_case(browser, base, case, max_ms, strict_telegraphs):
    encounter, boss_id, name_fragment, expected_read = case
    context = browser.new_context(viewport={"width": 1280, "height": 920})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(DRAW_PROBE)
    page.clock.install()
    entry = {
        "encounterId": encounter,
        "bossId": boss_id,
        "mode": "Action Lab (isolated), art=hd",
        "input": "D held for first 1.5 seconds, then released; no scripted attacks",
        "status": "not-started",
    }
    try:
        response = page.goto(
            base + "/action-campaign-battle.html?encounter=" + encounter
            + "&lead=ren&support=aya&art=hd",
            wait_until="domcontentloaded",
        )
        assert response is not None and response.status == 200, "HTTP page load failed"
        page.wait_for_function(
            "() => window.__ACTION_CAMPAIGN_BATTLE__?.getSnapshot?.()?.encounterId",
            timeout=20000,
        )
        initial = page.evaluate(STATE)
        assert initial is not None and initial["encounterId"] == encounter, initial
        assert initial["objectiveSupported"] is True, initial
        assert initial["canonicalStorageUnchanged"] is True, initial
        assert not initial["persistentKeys"], initial
        assert initial["coachingTitle"] != "Fight, read, recover", initial
        assert len(initial["coachingSteps"]) == 3, initial
        visible_read = " ".join([
            initial["coachingTitle"], initial["coachingSummary"],
            *initial["coachingSteps"],
        ]).lower()
        assert expected_read in visible_read, (expected_read, initial)
        assert any(name_fragment in actor["name"].lower()
                   for actor in initial["enemyActors"]), initial

        first_windup = None
        observed_attack_phases = set()
        observed_attack_ids = set()
        sampled = []
        page.locator("#actionCampaignCanvas").focus()
        page.keyboard.down("d")
        elapsed = 0
        while elapsed < max_ms:
            page.clock.run_for(250)
            elapsed += 250
            if elapsed == 1500:
                page.keyboard.up("d")
            state = page.evaluate(STATE)
            for actor in state["enemyActors"]:
                if name_fragment not in actor["name"].lower() or not actor["attack"]:
                    continue
                attack = actor["attack"]
                observed_attack_phases.add(attack["phase"])
                observed_attack_ids.add(attack["attackId"])
                if first_windup is None and attack["phase"] == "windup":
                    first_windup = {
                        "elapsedVirtualMs": elapsed,
                        "attackId": attack["attackId"],
                        "phase": attack["phase"],
                    }
                    OUT.mkdir(parents=True, exist_ok=True)
                    page.locator("#actionCampaignCanvas").screenshot(
                        path=str(OUT / (encounter + "-windup.png"))
                    )
            if elapsed % 2000 == 0 or state["outcome"] is not None:
                sampled.append({
                    "elapsedVirtualMs": elapsed,
                    "phaseId": state["phaseId"],
                    "objectiveStatus": state["objectiveStatus"],
                    "outcome": state["outcome"],
                })
            if state["outcome"] is not None:
                break
        if elapsed < 1500:
            page.keyboard.up("d")
        last = page.evaluate(STATE)
        OUT.mkdir(parents=True, exist_ok=True)
        page.locator("#actionCampaignCanvas").screenshot(
            path=str(OUT / (encounter + "-final.png"))
        )
        entry.update({
            "status": "observed" if first_windup is not None else "missing-telegraph",
            "elapsedVirtualMs": elapsed,
            "firstNaturalWindup": first_windup,
            "observedAttackPhases": sorted(observed_attack_phases),
            "observedAttackIds": sorted(observed_attack_ids),
            "phaseSamples": sampled,
            "objective": {
                "text": last["objectiveText"],
                "status": last["objectiveStatus"],
                "requirements": last["objectiveRequirements"],
            },
            "coaching": {
                "title": initial["coachingTitle"],
                "summary": initial["coachingSummary"],
                "steps": initial["coachingSteps"],
            },
            "paintedSourceDraws": last["paintedSources"],
            "outcome": last["outcome"],
            "canonicalStorageUnchanged": last["canonicalStorageUnchanged"],
            "persistentStorageKeys": last["persistentKeys"],
            "pageErrors": errors,
        })
        assert not errors, errors
        assert last["canonicalStorageUnchanged"], entry
        assert not last["persistentKeys"], entry
        if strict_telegraphs:
            assert first_windup is not None, (
                "No natural boss windup observed in the bounded virtual-time session",
                entry,
            )
        return entry
    finally:
        page.close()
        context.close()


def run(max_ms=18000, strict_telegraphs=False):
    OUT.mkdir(parents=True, exist_ok=True)
    protected = (
        ROOT / "assets/art/roster-keystone/roster.json",
        GAME / "assets/art/hd-painted-v1/manifest.json",
        GAME / "assets/art/hd-painted-v1/motion-manifest.json",
    )
    before = {str(p): sha(p) for p in protected}
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(GAME))
    )
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = "http://127.0.0.1:" + str(server.server_address[1])
    sessions = []
    failed = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for case in CASES:
                    try:
                        result = run_case(
                            browser, base, case, max_ms, strict_telegraphs
                        )
                        sessions.append(result)
                    except Exception as exc:
                        failed.append({"encounterId": case[0], "error": str(exc)})
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
    source_preserved = {str(p): sha(p) for p in protected} == before
    receipt = {
        "schema": "jrpg-late-boss-gameplay-lab/1",
        "runtime": "game/action-campaign-battle.html; authored chapter 3-9 encounters",
        "evidenceScope": "real-browser encounter initialization, coaching, natural AI telegraph, rendered canvas and storage isolation",
        "fullRouteCompleted": False,
        "playerVictoriesProven": False,
        "humanComprehensionTested": False,
        "visualApproval": "pending",
        "sourceArtAndRosterUnchanged": source_preserved,
        "strictTelegraphs": strict_telegraphs,
        "cases": len(CASES),
        "sessions": sessions,
        "failures": failed,
    }
    (OUT / "evidence.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({
        "cases": len(CASES),
        "completed": len(sessions),
        "naturalWindups": sum(s["firstNaturalWindup"] is not None for s in sessions),
        "failures": failed,
        "sourceArtAndRosterUnchanged": source_preserved,
        "evidencePath": str(OUT / "evidence.json"),
    }, indent=2))
    assert source_preserved, "Source art or roster changed during browser test"
    assert not failed, failed
    assert len(sessions) == len(CASES), "Incomplete boss encounter matrix"
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--virtual-ms", type=int, default=18000)
    parser.add_argument("--strict-telegraphs", action="store_true")
    args = parser.parse_args()
    if args.virtual_ms < 1500 or args.virtual_ms > 60000:
        parser.error("--virtual-ms must be from 1500 to 60000")
    run(args.virtual_ms, args.strict_telegraphs)
