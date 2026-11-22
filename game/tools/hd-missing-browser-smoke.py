#!/usr/bin/env python3
"""Chromium check of the committed 16-enemy source-derived review surface."""
import functools,json,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
GAME=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,_fmt,*args):pass
    def do_GET(self):
        if self.path=="/favicon.ico":
            self.send_response(204);self.end_headers();return
        super().do_GET()
def main():
    server=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(GAME)))
    t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
    errs=[]
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
            page=browser.new_page(viewport={"width":1400,"height":980})
            page.set_default_timeout(20000)
            page.on("pageerror",lambda e:errs.append(str(e)))
            page.on("console",lambda e:errs.append(e.text) if e.type=="error" else None)
            url="http://127.0.0.1:%d/hd-source-derived-review.html"%server.server_address[1]
            res=page.goto(url,wait_until="domcontentloaded")
            assert res and res.status==200
            page.wait_for_function("() => document.querySelector('#actor').options.length===16")
            page.locator("#actor").select_option("veil-courier")
            page.locator("#clip").select_option("signature")
            page.wait_for_function("() => document.querySelector('#stage').dataset.imageReady==='true'")
            assert page.locator("#stage").get_attribute("data-frame")=="0"
            pixels=page.locator("#stage").evaluate("""c=>{
                const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                let count=0;for(let i=3;i<a.length;i+=4)if(a[i]>0)count++;
                return count;
            }""")
            assert pixels>1000,pixels
            page.locator("#step").click()
            assert page.locator("#stage").get_attribute("data-frame")=="1"
            page.locator("#play").click()
            page.wait_for_timeout(250)
            assert page.locator("#play").get_attribute("aria-pressed")=="true"
            page.locator("#play").click()
            assert page.locator("#play").get_attribute("aria-pressed")=="false"
            for id in ("ash-wisp","forge-thrall","storm-nue","lantern-vine-maw"):
                page.locator("#actor").select_option(id)
                page.wait_for_function("() => document.querySelector('#stage').dataset.imageReady==='true'")
            out=GAME.parent/"artifacts"/"hd-missing-enemy-browser.png"
            out.parent.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(out),full_page=True)
            assert not errs,errs
            browser.close()
            print(json.dumps({"browser":True,"identities":16,"cellVisible":True,"errors":errs,"screenshot":str(out)}))
    finally:
        server.shutdown();server.server_close();t.join(timeout=5)
if __name__=="__main__":
    main()
