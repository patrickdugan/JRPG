#!/usr/bin/env python3
"""Verify the hosted boss-VFX studio loads all six bosses and both phases."""
from __future__ import annotations
import functools,json,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
GAME=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        if self.path=="/favicon.ico":
            self.send_response(204);self.end_headers();return
        super().do_GET()
def check():
    server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(GAME)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    base=f"http://127.0.0.1:{server.server_address[1]}"
    errors=[]
    try:
        with sync_playwright() as p:
            try:
                browser=p.chromium.launch(headless=True)
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
                        browser=p.chromium.launch(headless=True,executable_path=str(candidate))
                        break
                else:
                    raise
            page=browser.new_page(viewport={"width":1280,"height":980},reduced_motion="reduce")
            page.set_default_timeout(18000)
            page.on("pageerror",lambda e: errors.append("page:"+str(e)))
            page.on("console",lambda msg:errors.append("console:"+msg.text) if msg.type=="error" else None)
            page.on("response",lambda resp:errors.append("HTTP %d:%s"%(resp.status,resp.url)) if resp.status>=400 else None)
            r=page.goto(base+"/hd-boss-vfx-review.html",wait_until="domcontentloaded")
            assert r and r.status==200
            page.wait_for_function("() => document.querySelector('#boss').options.length===6")
            checked=[]
            for boss_id in ["widow-of-fog","furnace-abbot","ujiro","bell-warden-chiyo","lady-enma","yearless-bell"]:
                page.locator("#boss").select_option(boss_id)
                for phase in ["windup","active"]:
                    page.locator("#phase").select_option(phase)
                    page.wait_for_function("""([boss,phase]) => {
                      const c=document.querySelector('#preview');
                      return c.dataset.loaded==='true'&&c.dataset.boss===boss&&c.dataset.phase===phase;
                    }""", arg=[boss_id,phase])
                    page.locator("#frame").evaluate("(e) => { e.value = '9'; e.dispatchEvent(new Event('input', {bubbles: true})); }")
                    page.wait_for_function("() => document.querySelector('#preview').dataset.frame==='9'")
                    checked.append(boss_id+"/"+phase)
            screenshot=GAME.parent/"artifacts"/"hd-boss-vfx-studio.png"
            screenshot.parent.mkdir(exist_ok=True,parents=True)
            page.screenshot(path=str(screenshot),full_page=True)
            assert not errors,errors
            browser.close()
            return {"ok":True,"stagesVerified":checked,"consoleOrHttpErrors":errors}
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)
if __name__=="__main__": print(json.dumps(check(),indent=2))
