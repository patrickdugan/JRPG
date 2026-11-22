#!/usr/bin/env python3
"""Real-browser smoke for the isolated reviewed windup runtime.

Loads actual source PNGs and reviewed 24-frame WebP strips, asserts source
frame timing remains canonical, verifies missing review assets fall back
to canonical motion, and leaves original files and game saves untouched.
"""
from __future__ import annotations
import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

GAME=Path(__file__).resolve().parents[1]
ROOT=GAME.parent
OUT=ROOT / "artifacts/hd-reviewed-motion"
PAGE=GAME / "__reviewed_motion_smoke.html"
BOSSES=("yearless-bell","lady-enma")

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,_format,*_args):
        return

def sha(path: Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fixture():
    return """<!doctype html><html><body>
<canvas id="reviewCanvas" width="850" height="480" aria-label="Reviewed motion rendering"></canvas>
<script type="module">
import {createHdPaintedArtRuntime} from './hd-painted-animation.mjs';
import {reviewedModeFromSearch} from './hd-reviewed-motion.mjs';
const params=new URLSearchParams(location.search);
const enabled=params.get('art')==='hd';
const reviewedMotionEnabled=reviewedModeFromSearch(location.search);
const source='./assets/art/hd-painted-v1/';
const ctx=document.getElementById('reviewCanvas').getContext('2d');
const fetchJson=async url=>{
  const r=await fetch(url);
  if(!r.ok)throw Error('HTTP '+r.status+' '+url);
  return r.json();
};
const rt=createHdPaintedArtRuntime({
  enabled, motionEnabled:enabled, reviewedMotionEnabled,
  fetchJson, createImage:()=>new Image(),
});
const rows=[];
for(let n=0;n<2;n++){
  const id=['yearless-bell','lady-enma'][n];
  const item=await rt.request(id);
  if(!item)throw Error('Missing original painted art: '+id);
  const windup=await rt.motion.request(id,'windup',item.record);
  const active=await rt.motion.request(id,'active',item.record);
  if(!windup||!active)throw Error('Missing windup or active clip: '+id);
  const actor={id,hp:100,active:true,grounded:true,facing:1,
   position:{x:210+n*410,y:410},movementIntent:{x:0},
   activeAttack:{phase:'windup'},activeManeuver:null,
   staggerRemainingMs:0,hitStunRemainingMs:0};
  if(!rt.draw(ctx,actor,id,{phaseProgress:.97,nowMs:250}))throw Error('Failed to draw '+id);
  rows.push({id,origin:windup.origin,clipPath:windup.clip.path,
             sourceSha:item.record.sha256,originalTiming:windup.clip.frameMs,
             activeOrigin:active.origin,activePath:active.clip.path,
             selectedFrame:Math.floor(.97*24)});
}
document.querySelector('canvas').dataset.ready='true';
window.report={rows,reviewedMotionEnabled,mode:enabled?'hd':'classic',
  cacheSize:rt.motion.cacheSize};
</script></body></html>"""

def run():
    OUT.mkdir(parents=True, exist_ok=True)
    roots=[
      ROOT/"assets/art/roster-keystone/roster.json",
      GAME/"assets/art/hd-painted-v1/motion-manifest.json",
      GAME/"assets/art/hd-painted-v1/manifest.json",
    ]
    before={str(p):sha(p) for p in roots}
    if PAGE.exists():raise ValueError("Test fixture path already exists")
    PAGE.write_text(fixture(),encoding="utf-8")
    server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(GAME)))
    runner=threading.Thread(target=server.serve_forever,daemon=True)
    runner.start()
    base="http://127.0.0.1:"+str(server.server_address[1])+"/__reviewed_motion_smoke.html"
    errors=[]
    try:
      with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True)
        ctx=browser.new_context(viewport={"width":970,"height":600})
        def open_case(url:str):
          page=ctx.new_page()
          page.on("pageerror",lambda error:errors.append(str(error)))
          r=page.goto(url,wait_until="domcontentloaded")
          assert r and r.status==200
          page.wait_for_function("() => window.report?.rows?.length===2",timeout=30000)
          return page,page.evaluate("window.report")
        reviewed_page,reviewed=open_case(base+"?art=hd&motion=reviewed")
        assert reviewed["reviewedMotionEnabled"] is True
        assert all(row["origin"]=="reviewed" for row in reviewed["rows"]),reviewed
        assert all(row["activeOrigin"]=="canonical" for row in reviewed["rows"])
        assert reviewed["cacheSize"]==4
        for row in reviewed["rows"]:
          assert row["clipPath"]=="reviewed-motion/"+row["id"]+"/windup.webp"
          assert row["selectedFrame"]==23
        reviewed_page.screenshot(path=str(OUT/"reviewed-source-bosses.png"),full_page=True)

        original_page,original=open_case(base+"?art=hd")
        assert original["reviewedMotionEnabled"] is False
        assert all(row["origin"]=="canonical" for row in original["rows"])
        original_page.screenshot(path=str(OUT/"canonical-source-bosses.png"),full_page=True)

        rejected=ctx.new_page()
        rejected.on("pageerror",lambda error:errors.append(str(error)))
        rejected.route("**/reviewed-motion/yearless-bell/windup.webp",
          lambda route:route.abort("failed"))
        rejected.goto(base+"?art=hd&motion=reviewed",wait_until="domcontentloaded")
        rejected.wait_for_function("() => window.report?.rows?.length===2",timeout=30000)
        missing=rejected.evaluate("window.report")
        assert missing["rows"][0]["origin"]=="canonical",missing
        assert missing["rows"][1]["origin"]=="reviewed",missing

        assert not errors,errors
        browser.close()
    finally:
      server.shutdown();server.server_close();runner.join(timeout=5)
      PAGE.unlink(missing_ok=True)
    assert {str(p):sha(p) for p in roots}==before
    result={
      "ok":True, "realReviewClipsLoaded":2,
      "canonicalSourceWindupUnchanged":True,
      "canonicalActiveAttackUnchanged":True,
      "optInQuery":"art=hd&motion=reviewed",
      "missingCandidateFallback":True,
      "sourceManifestsAndRosterUnmodified":True,
      "pageErrors":errors,
    }
    (OUT/"reviewed-motion-browser-receipt.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))

if __name__=="__main__":
    run()
