#!/usr/bin/env python3
"""Chromium review of all six 16-role NPC animation clip families."""
from __future__ import annotations
import functools
import json
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright

GAME=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def check():
    server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(GAME)))
    worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
    root="http://127.0.0.1:%s"%server.server_address[1]
    errors=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={"width":1280,"height":1000},reduced_motion="reduce")
            page.set_default_timeout(20_000)
            page.on("pageerror",lambda e:errors.append(str(e)))
            page.on("response",lambda resp:errors.append("HTTP %d %s"%(resp.status,resp.url)) if resp.status>=400 else None)
            resp=page.goto(root+"/npc-motion-review.html",wait_until="domcontentloaded")
            assert resp is not None and resp.status==200
            checked=[]
            for clip in ("idle","walk","talk","work","react","leave"):
                page.locator("#clip").select_option(clip)
                page.wait_for_function("""name => {
                   const c=document.querySelector('#roster');
                   return c.dataset.clip===name&&c.dataset.loaded==='16';
                }""",arg=clip)
                page.locator("#play").uncheck()
                page.locator("#frame").evaluate("(el) => { el.value = \"17\"; el.dispatchEvent(new Event(\"input\", { bubbles: true })); }")
                page.wait_for_function("() => document.querySelector('#roster').dataset.frame==='17'")
                checked.append(clip)
            page.locator("#clip").select_option("walk")
            page.wait_for_function("() => document.querySelector('#roster').dataset.clip==='walk'&&document.querySelector('#roster').dataset.loaded==='16'")
            screenshot=GAME.parent/"artifacts"/"npc-motion-review.png"
            screenshot.parent.mkdir(exist_ok=True,parents=True)
            page.screenshot(path=str(screenshot),full_page=True)
            assert not errors,errors
            browser.close()
            return {"ok":True,"roles":16,"clipsChecked":checked,"decodedImages":96,"errors":errors}
    finally:
        server.shutdown();server.server_close();worker.join(timeout=5)

if __name__=="__main__":print(json.dumps(check(),indent=2))
