#!/usr/bin/env python3
"""Real browser pixel delivery test for six Kurozane HD phase key bindings."""
from __future__ import annotations
import functools
import json
import shutil
import tempfile
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

GAME = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

def create_fixture(root: Path):
    for name in ("hd-painted-animation.mjs", "hd-painted-motion.mjs", "hd-kurozane-phase.mjs"):
        shutil.copyfile(GAME / name, root / name)
    folder = root / "assets" / "art" / "hd-painted-v1"
    (folder / "sheets").mkdir(parents=True)
    canvas = Image.new("RGBA", (384 * 6, 384), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    tones = ("#5f4e58", "#956060", "#5f6675", "#bb554d", "#75414e", "#df4b50")
    for index, tone in enumerate(tones):
        x = index * 384
        draw.ellipse((x+166, 44, x+220, 100), fill="#c2a18a")
        draw.polygon(((x+155,95),(x+230,95),(x+250,345),(x+120,345)), fill=tone)
        draw.line(((x+90,210),(x+305,140)),fill="#e9d6b9",width=8)
    canvas.save(folder / "sheets" / "kurozane.png")
    import hashlib
    source_sha = hashlib.sha256((folder / "sheets" / "kurozane.png").read_bytes()).hexdigest()
    manifest = {"schema":"bbc-hd-painted/1","frameCount":6,
                "actors":{"kurozane":{
                    "file":"sheets/kurozane.png","width":2304,"height":384,
                    "foot":[192,368],"drawHeight":176,"facing":"right",
                    "group":"boss-study","bossFormsOnly":True,
                    "poses":["court-idle","court-action","oni-idle","oni-action","demon-idle","demon-action"],
                    "sha256":source_sha
                }}}
    (folder/"manifest.json").write_text(json.dumps(manifest),encoding="utf-8")

HTML = r"""<!doctype html><html><body><canvas id="c" width="850" height="470"></canvas>
<script type="module">
import {createHdPaintedArtRuntime} from './hd-painted-animation.mjs';
import {selectHdKurozaneForm} from './hd-kurozane-phase.mjs';
const ctx=document.querySelector('#c').getContext('2d');
const fetchJson=url=>fetch(url).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()});
const rt=createHdPaintedArtRuntime({enabled:true,allowBossStudies:true,motionEnabled:false,fetchJson,createImage:()=>new Image()});
const actor={id:'kurozane-instance',faction:'enemy',hp:180,active:true,
 facing:-1,position:{x:420,y:410},grounded:true,staggerRemainingMs:0,
 hitStunRemainingMs:0,activeAttack:null,activeManeuver:null,movementIntent:{x:0}};
const found=[];
const old=ctx.drawImage.bind(ctx);
ctx.drawImage=(...args)=>{found.push(args[1]);old(...args);};
await rt.request('kurozane');
for(const name of ['court','bell','dawn']){
 const director={bossTemplateId:'kurozane',bossActorId:'kurozane-instance',
   phases:[{id:name}],phaseIndex:0};
 for(const phase of [null,'active']){
  actor.activeAttack=phase?{phase}:null;
  const form=selectHdKurozaneForm(actor,director);
  if(!rt.draw(ctx,actor,'kurozane',{bossForm:form}))throw Error('Kurozane unavailable: '+name+'/'+phase);
 }
}
const rejected=rt.draw(ctx,actor,'kurozane',{bossForm:null});
window.testResult={ready:rt.status('kurozane'),frames:found,rejected};
</script></body></html>"""

def main():
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp)
        create_fixture(root)
        (root/"index.html").write_text(HTML,encoding="utf-8")
        server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(root)))
        t=threading.Thread(target=server.serve_forever,daemon=True)
        t.start()
        errors=[]
        try:
            with sync_playwright() as playwright:
                try:
                    browser=playwright.chromium.launch(headless=True)
                except Exception as err:
                    if "Executable doesn't exist" not in str(err):
                        raise
                    for candidate in (
                        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
                        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
                        Path.home()/r"AppData\Local\Google\Chrome\Application\chrome.exe",
                        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
                    ):
                        if candidate.is_file():
                            browser=playwright.chromium.launch(headless=True,executable_path=str(candidate))
                            break
                    else:
                        raise
                page=browser.new_page(viewport={"width":950,"height":570})
                page.set_default_timeout(15000)
                page.on("pageerror",lambda e:errors.append(str(e)))
                resp=page.goto("http://127.0.0.1:%d/index.html"%server.server_address[1],wait_until="domcontentloaded")
                assert resp and resp.status == 200
                page.wait_for_function("() => !!window.testResult")
                data=page.evaluate("window.testResult")
                assert data["ready"]=="ready",data
                assert data["frames"]==[0,384,768,1152,1536,1920],data
                assert data["rejected"] is False,data
                assert not errors,errors
                out=GAME.parent/"artifacts"/"hd-kurozane-phase-browser.png"
                out.parent.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=str(out),full_page=True)
                browser.close()
                print(json.dumps({"ok":True,"sixDraws":data["frames"],"browserErrors":errors,"screenshot":str(out)}))
        finally:
            server.shutdown()
            server.server_close()
            t.join(timeout=5)

if __name__=="__main__":main()
