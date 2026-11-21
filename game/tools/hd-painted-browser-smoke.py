#!/usr/bin/env python3
"""Chromium smoke for the Action Campaign opt-in painted sprite renderer."""
from __future__ import annotations
import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

GAME=Path(__file__).resolve().parents[1]
ART=GAME/'assets'/'art'/'hd-painted-v1'
OUT=GAME.parent/'artifacts'

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,_fmt,*_args): pass

def make_fixture():
    (ART/'sheets').mkdir(parents=True,exist_ok=True)
    actors={}
    for key,color,group in [('ren',(70,128,155),'party'),
                            ('aya',(115,168,137),'party'),
                            ('cinder-hound',(193,98,68),'enemy')]:
        img=Image.new('RGBA',(2304,384),(0,0,0,0))
        draw=ImageDraw.Draw(img)
        for i in range(6):
            x=i*384
            draw.rounded_rectangle((x+137,40,x+245,364),radius=16,
                fill=(*color,245),outline=(253,230,173,255),width=5)
            draw.ellipse((x+155,16,x+224,92),fill=(*color,255),outline=(242,225,184),width=4)
            draw.line((x+218,135,x+285,55+i*8),fill=(234,185,109),width=13)
        data=ART/'sheets'/(key+'.png')
        img.save(data)
        actors[key]={
            'file':'sheets/'+key+'.png','width':2304,'height':384,
            'foot':[192,368],'drawHeight':126,'facing':'right','group':group,
            'poses':['idle','move','windup','active','guard','hurt'] if group=='party'
              else ['idle','move','windup','active','hurt','defeat'],
            'sha256':hashlib.sha256(data.read_bytes()).hexdigest()
        }
    (ART/'cards').mkdir(parents=True,exist_ok=True)
    card=Image.new('RGB',(768,1152),(32,35,43))
    ImageDraw.Draw(card).text((90,90),'CINDER HOUND ENCOUNTER ART TEST',fill=(245,205,135))
    card_path=ART/'cards'/'cinder-hound.png'
    card.save(card_path)
    cards={'cinder-hound':{'file':'cards/cinder-hound.png','width':768,'height':1152,
                          'sha256':hashlib.sha256(card_path.read_bytes()).hexdigest()}}
    manifest=ART/'manifest.json'
    manifest.write_text(json.dumps({'schema':'bbc-hd-painted/1','frameCount':6,
                                   'actors':actors,'cards':cards}))
    return manifest

def probe():
    manifest=make_fixture()
    server=ThreadingHTTPServer(('127.0.0.1',0),
        functools.partial(Quiet,directory=str(GAME)))
    worker=threading.Thread(target=server.serve_forever,daemon=True)
    worker.start()
    base='http://127.0.0.1:'+str(server.server_address[1])
    errors=[]
    result={}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            ctx=browser.new_context(viewport={'width':1400,'height':1100})
            page=ctx.new_page()
            page.set_default_timeout(25000)
            page.on('pageerror',lambda error:errors.append(str(error)))
            url=base+'/action-campaign-battle.html?encounter=c1-cinder-hounds&lead=ren&support=aya'
            response=page.goto(url+'&art=hd',wait_until='domcontentloaded')
            assert response and response.status==200
            page.wait_for_function("""() => {
                const el=document.querySelector('#actionCampaignCanvas');
                return el?.dataset.hdArtMode === 'hd' &&
                  Number(el.dataset.hdArtDrawCount) > 0;
            }""",timeout=30000)
            painted=page.locator('#actionCampaignCanvas').evaluate(
                "(el)=>({mode:el.dataset.hdArtMode,count:el.dataset.hdArtDrawCount,template:el.dataset.hdArtTemplate})")
            assert painted['mode']=='hd' and int(painted['count'])>0,painted
            page.locator("#hdEnemyArtLink:not([hidden])").wait_for(timeout=15000)
            assert page.locator("#hdEnemyArtLink").get_attribute("href").endswith("cards/cinder-hound.png")
            card_check=page.request.get(base+"/assets/art/hd-painted-v1/cards/cinder-hound.png")
            assert card_check.status==200, card_check.status
            OUT.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(OUT/'painted-action-campaign.png'),full_page=True)
            classic=ctx.new_page()
            classic.on('pageerror',lambda error:errors.append(str(error)))
            response=classic.goto(url,wait_until='domcontentloaded')
            assert response and response.status==200
            classic.wait_for_function("""() => {
               const el=document.querySelector('#actionCampaignCanvas');
               return el?.dataset.hdArtMode === 'classic' &&
                   el?.dataset.hdArtDrawCount === '0';
            }""")
            classic.screenshot(path=str(OUT/'classic-action-campaign.png'),full_page=True)
            assert not errors,errors
            ctx.close()
            # Remove the generated fixture to prove the live fallback on 404.
            manifest.unlink()
            fallback=browser.new_context(viewport={'width':1400,'height':1100})
            missing=fallback.new_page()
            missing.on('pageerror',lambda error:errors.append(str(error)))
            missing.goto(url+'&art=hd',wait_until='domcontentloaded')
            missing.wait_for_function("""() => {
                const el=document.querySelector('#actionCampaignCanvas');
                return el?.dataset.hdArtState === 'unavailable' &&
                   el?.dataset.hdArtDrawCount === '0';
            }""",timeout=30000)
            assert not errors,errors
            fallback.close();browser.close()
            result={'ok':True,'source':'synthetic-test-only','painted':painted,
                    'classicFallback':True,'missingAssetFallback':True,'pageErrors':errors}
    finally:
        server.shutdown();server.server_close();worker.join(timeout=5)
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    probe()
