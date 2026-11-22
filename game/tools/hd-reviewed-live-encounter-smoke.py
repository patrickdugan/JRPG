#!/usr/bin/env python3
"""Live Action Campaign integration smoke for two approved HD windups.

Runs the *unmodified* game/action-campaign-battle.html and its authored
chapter-8/9 encounters. Playwright instruments canvas.drawImage only in the
test browser, records actual WebP source draws, and uses the browser's virtual
clock to exercise natural enemy AI. No production game source, assets or save
storage is mutated.
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
OUT = ROOT / "artifacts" / "hd-reviewed-live-encounter"
CASES = (
    ("yearless-bell", "c9-yearless-bell", "Yearless Bell"),
    ("lady-enma", "c8-lady-enma", "Lady Enma"),
)
PROBE = r"""(() => {
  if (window.__liveHdEvidence) return;
  const evidence = {reviewed:0, canonical:0, reviewedUrls:{},
    canonicalUrls:{}, selectedFrames:[], observedSources:{}, phaseEvents:[], drawCalls:0};
  window.__liveHdEvidence = evidence;
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args) {
    if (this.canvas?.id==='actionCampaignCanvas') {
      const candidate=args[0];
      const source=typeof candidate?.currentSrc==='string' && candidate.currentSrc
        ? candidate.currentSrc : candidate?.src;
      if (typeof source==='string' && source.includes('/hd-painted-v1/')) {
        const reviewed=source.includes('/reviewed-motion/');
        const originalClip=source.includes('/motion/');
        if (reviewed || originalClip) {
          const target=reviewed?'reviewed':'canonical';
          evidence[target]++;
          const urls=reviewed?evidence.reviewedUrls:evidence.canonicalUrls;
          const name=source.slice(source.indexOf('/hd-painted-v1/'));
          urls[name]=(urls[name]||0)+1;
          const x=Number(args[1]), y=Number(args[2]);
          if (evidence.selectedFrames.length<60)
            evidence.selectedFrames.push({target,name,x,y});
          if ((name.includes('yearless-bell/')||name.includes('lady-enma/'))
              && (name.includes('/windup.webp')||name.includes('/active.webp'))
              && evidence.phaseEvents.length<1000)
            evidence.phaseEvents.push({target,name,x,y,t:performance.now()});
        }
      }
      evidence.drawCalls++;
    }
    return original.apply(this,args);
  };
})();"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(page):
    return page.evaluate("""() => {
      const accessor=window.__ACTION_CAMPAIGN_BATTLE__;
      const s=accessor?.getSnapshot?.();
      const c=document.querySelector('#actionCampaignCanvas');
      if (!s) return {ready:false,status:document.querySelector('#battleAnnouncement')?.textContent};
      return {
        ready:true,encounterId:s.encounterId,outcome:s.outcome,
        objectiveSupported:s.objective?.supported,
        actors:s.kernel.actors.map(a=>({id:a.id,name:a.name,faction:a.faction,
          hp:a.hp,activeAttack:a.activeAttack?{phase:a.activeAttack.phase,
            attackId:a.activeAttack.attackId,elapsedMs:a.activeAttack.elapsedMs}:null,
          x:a.position?.x,y:a.position?.y})),
        source:c.dataset.hdMotionActualSource,lane:c.dataset.hdMotionLane,
        canvasMode:c.dataset.hdArtMode,hdDrawCount:Number(c.dataset.hdArtDrawCount),
        motionClip:c.dataset.hdMotionClip,
        storageUnchanged:accessor.canonicalStorageUnchanged(),
        instrumentation:window.__liveHdEvidence,
      };
    }""")


def run_session(context, base: str, boss: str, encounter: str, title: str,
                mode: str, max_ms: int, block_candidate=False):
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(PROBE)
    page.clock.install()
    if block_candidate:
        page.route("**/reviewed-motion/" + boss + "/windup.webp",
                   lambda route: route.abort("failed"))
    uri = base + "/action-campaign-battle.html?encounter=" + encounter + \
          "&lead=ren&support=aya&art=hd&motion=" + mode
    response = page.goto(uri, wait_until="domcontentloaded")
    assert response and response.status == 200
    page.wait_for_function("() => window.__ACTION_CAMPAIGN_BATTLE__?.getSnapshot?.()?.encounterId")
    first = snapshot(page)
    assert first["encounterId"] == encounter, first
    assert first["canvasMode"] == "hd", first
    assert first["storageUnchanged"], first
    assert any(title.lower() in a["name"].lower() for a in first["actors"]
               if a["faction"] == "enemy"), first
    assert first["lane"] == ("reviewed" if mode == "reviewed" else "canonical"), first
    evidence = []
    desired = "/reviewed-motion/" + boss + "/windup.webp"
    fallback = "/motion/" + boss + "/windup.webp"
    active_path = "/motion/" + boss + "/active.webp"
    windup_screenshot_taken = False
    elapsed = 0
    # The browser clock keeps the authored simulation and requestAnimationFrame
    # in sync while avoiding a wall-clock wait for natural enemy windups.
    while elapsed < max_ms:
        page.clock.run_for(100)
        elapsed += 100
        state = snapshot(page)
        evidence.append({
            "elapsedMs": elapsed,
            "outcome": state["outcome"],
            "actorPhase": next((a["activeAttack"]["phase"] if a["activeAttack"] else "idle"
                                for a in state["actors"] if title.lower() in a["name"].lower()
                                and a["faction"]=="enemy"), None),
            "actualSource": state["source"],"clip":state["motionClip"],
        })
        urls = state["instrumentation"]["reviewedUrls"]
        canonical = state["instrumentation"]["canonicalUrls"]
        expected_windup = (any(desired in key for key in urls)
                           if mode == "reviewed" and not block_candidate
                           else any(fallback in key for key in canonical))
        expected_active = any(active_path in key for key in canonical)
        if expected_windup and not windup_screenshot_taken:
            OUT.mkdir(parents=True, exist_ok=True)
            stem = ("reviewed" if mode == "reviewed" and not block_candidate
                    else "blocked-review" if block_candidate else "canonical")
            page.screenshot(path=str(OUT / (boss + "-" + stem + "-windup.png")),
                            full_page=True)
            windup_screenshot_taken = True
        if expected_windup and expected_active:
            break
        if state["outcome"]:
            break
    last = snapshot(page)
    OUT.mkdir(parents=True, exist_ok=True)
    suffix = "reviewed" if mode == "reviewed" and not block_candidate else (
        "blocked-review" if block_candidate else "canonical")
    page.screenshot(path=str(OUT / (boss + "-" + suffix + "-live-battle.png")), full_page=True)
    result = {
        "boss":boss,"encounter":encounter,"mode":mode,"blocked":block_candidate,
        "elapsedVirtualMs":elapsed,"initialActorCount":len(first["actors"]),
        "initialStorageUnchanged":first["storageUnchanged"],
        "finalStorageUnchanged":last["storageUnchanged"],
        "canvasMode":last["canvasMode"],"actualSource":last["source"],
        "originalsDrawn":last["instrumentation"]["canonicalUrls"],
        "reviewedDrawn":last["instrumentation"]["reviewedUrls"],
        "paintedDrawCalls":last["instrumentation"]["drawCalls"],
        "sourceDrawSamples":last["instrumentation"]["selectedFrames"][:20],
        "phaseDrawEvents":last["instrumentation"]["phaseEvents"][:400],
        "firstActiveEvent":next((e for e in last["instrumentation"]["phaseEvents"]
                                 if active_path in e["name"]), None),
        "windupScreenshotSaved":windup_screenshot_taken,
        "phaseSamples":evidence,"errors":errors,
        "encounterOutcome":last["outcome"],
    }
    page.close()
    assert not errors, errors
    assert last["storageUnchanged"], result
    assert result["firstActiveEvent"] is not None, (
        "Live authored attack never displayed the canonical active WebP", result)
    if mode == "reviewed" and not block_candidate:
        assert any(desired in key for key in result["reviewedDrawn"]), (
            "Live boss attack failed to draw reviewed windup", result)
    else:
        assert not result["reviewedDrawn"], (
            "Canonical/missing-asset lane drew reviewed artwork", result)
        if block_candidate:
            assert any(fallback in key for key in result["originalsDrawn"]), (
                "Canonical windup fallback not drawn", result)
    return result


def run(max_ms=20000):
    OUT.mkdir(parents=True,exist_ok=True)
    roots=[
        ROOT/"assets/art/roster-keystone/roster.json",
        GAME/"assets/art/hd-painted-v1/manifest.json",
        GAME/"assets/art/hd-painted-v1/motion-manifest.json",
    ]
    initial={str(p):sha(p) for p in roots}
    http=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(GAME)))
    worker=threading.Thread(target=http.serve_forever,daemon=True)
    worker.start()
    base="http://127.0.0.1:"+str(http.server_address[1])
    completed = []
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            ctx=browser.new_context(viewport={"width":1366,"height":1050})
            for boss,encounter,name in CASES:
                # A genuine authored combat encounter is used in each run.
                completed.append(run_session(ctx,base,boss,encounter,name,
                                             mode="reviewed",max_ms=max_ms))
                completed.append(run_session(ctx,base,boss,encounter,name,
                                             mode="1",max_ms=max_ms//2))
                completed.append(run_session(ctx,base,boss,encounter,name,
                                             mode="reviewed",max_ms=max_ms,
                                             block_candidate=True))
            ctx.close()
            browser.close()
    finally:
        http.shutdown()
        http.server_close()
        worker.join(timeout=5)
    assert {str(p):sha(p) for p in roots} == initial
    receipt={
        "schema":"jrpg-hd-reviewed-live-action-encounter/1",
        "authoredBossEncounters":[x[1] for x in CASES],
        "sourceArtAndRosterUnchanged":True,
        "source":"real game/action-campaign-battle.html and live Action Campaign JS",
        "visualApproval":"pending for all seven complete boss packages",
        "sessions":completed,
    }
    (OUT/"live-encounter-evidence.json").write_text(json.dumps(receipt,indent=2)+"\n")
    print(json.dumps({
        "ok":True,
        "encounters":[x[1] for x in CASES],
        "reviewedWebPsActuallyDrawn":2,
        "canonicalAndMissingPreviewFallbacks":4,
        "authoredActiveAttackClipsDrawn":6,
        "sourceArtAndRosterUnchanged":True,
    },indent=2))
    return receipt


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--virtual-ms",type=int,default=20000)
    args=parser.parse_args()
    run(args.virtual_ms)
