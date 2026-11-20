#!/usr/bin/env python3
"""Hosted Chrome smoke for the source-authored vector animation studio."""
from __future__ import annotations
import functools,json,threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,_fmt,*_args):pass

def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    base="http://127.0.0.1:%d"%server.server_address[1]
    errors=[]
    result={}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={"width":1440,"height":1060},reduced_motion="no-preference")
            page.set_default_timeout(20000)
            page.on("pageerror",lambda error:errors.append("page: "+str(error)))
            page.on("console",lambda msg:errors.append("console: "+msg.text) if msg.type=="error" else None)
            page.on("response",lambda response:errors.append("http: %d %s"%(response.status,response.url)) if response.status>=400 else None)
            response=page.goto(base+"/svg-motion-studio.html?actor=nikola-drazanic",wait_until="domcontentloaded")
            assert response and response.status==200
            page.wait_for_function("() => document.querySelectorAll('#castList button').length === 62")
            assert "Nikola" in page.locator("#characterName").inner_text()
            assert page.locator("#poseButtons button").count()==13
            page.locator("#poseButtons button[data-pose='6']").click()
            assert page.locator("#sheetImage").get_attribute("x")==str(-6*144)
            page.locator("#viewMode").select_option("field")
            assert page.locator("#poseButtons button").count()==8
            page.locator("#poseButtons button[data-pose='6']").click()
            assert "west" in page.locator("#poseName").inner_text()
            page.locator("#viewMode").select_option("action")
            page.locator("#playToggle").click()
            page.wait_for_timeout(600)
            assert page.locator("#playToggle").get_attribute("aria-pressed")=="true"
            page.locator("#playToggle").click()
            assert page.locator("#playToggle").get_attribute("aria-pressed")=="false"
            for identity in ("ren","mateus","kurozane-demon-mode","bell-moth","silk-jorogumo",
                             "razor-bamboo-stalker","lady-enma","yearless-bell"):
                page.locator('#castList button[data-actor="%s"]'%identity).click()
                assert page.locator("#sheetImage").get_attribute("href").endswith(identity+"-action.svg")
                asset=page.request.get(base+"/assets/art/svg-cel-suite-v1/sheets/"+identity+"-action.svg")
                assert asset.status==200
                assert '<svg' in asset.text() and 'data-art-source="code-authored-vector"' in asset.text()
            page.locator('#castList button[data-actor="npc-physician"]').click()
            assert page.locator("#viewMode").input_value()=="field"
            assert page.locator("#poseButtons button").count()==2
            npc_asset=page.request.get(base+"/assets/art/svg-cel-suite-v1/sheets/npc-physician-field.svg")
            assert npc_asset.status==200
            page.locator('#castList button[data-actor="nikola-drazanic"]').click()
            page.locator("#viewMode").select_option("action")
            page.locator("#poseButtons button[data-pose='9']").click()
            screenshot=ROOT.parent/"artifacts"/"svg-motion-studio.png"
            screenshot.parent.mkdir(exist_ok=True,parents=True)
            page.screenshot(path=str(screenshot),full_page=True)
            assert not errors,errors
            browser.close()
            result={"ok":True,"castCount":62,"actionCellsPerIdentity":13,"partyFieldCells":8,
                    "played":True,"assetRequestsVerified":8,"errors":errors,"screenshot":str(screenshot)}
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)
    print(json.dumps(result,indent=2))
if __name__=="__main__":main()
