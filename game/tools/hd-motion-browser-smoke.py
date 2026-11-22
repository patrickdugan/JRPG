#!/usr/bin/env python3
"""Hosted real-Chromium smoke of HD v2, v1 fallback and decoded WebP dimensions."""
import functools,hashlib,json,shutil,tempfile,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright

GAME=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
def fixture(folder):
 (folder/'sheets').mkdir(parents=True)
 (folder/'motion/ren').mkdir(parents=True)
 im=Image.new('RGBA',(2304,384),(0,0,0,0))
 dr=ImageDraw.Draw(im)
 for i in range(6):
  x=i*384
  dr.ellipse((x+145,55,x+235,145),fill='#ead4c2')
  dr.polygon([(x+160,140),(x+210,130),(x+244,355),(x+130,355)],fill='#355c73')
 im.save(folder/'sheets/ren.png')
 initialsha=sha((folder/'sheets/ren.png').read_bytes())
 entry=dict(file='sheets/ren.png',width=2304,height=384,foot=[192,368],
            drawHeight=124,facing='right',group='party',
            poses=['idle','move','windup','active','guard','hurt'],sha256=initialsha)
 (folder/'manifest.json').write_text(json.dumps({'schema':'bbc-hd-painted/1',
                    'frameCount':6,'actors':{'ren':entry}}))
 clips={}
 names=['idle','locomotion','windup','active','recovery','guard','hurt','defeat','signature','stagger']
 for j,name in enumerate(names):
  atlas=Image.new('RGBA',(2304,384),(0,0,0,0))
  draw=ImageDraw.Draw(atlas)
  for i in range(24):
   x=(i%12)*192;y=(i//12)*192
   draw.ellipse((x+80+i,y+30,x+120+i,y+72),fill='#e8d0b4')
   draw.polygon([(x+75+i,y+70),(x+110+i,y+70),
      (x+124+i,y+182),(x+64+i,y+182)],fill=(68+j*5,93+j*3,112,255))
  path=folder/'motion/ren'/ (name+'.webp')
  atlas.save(path,'WEBP',quality=92,method=1)
  delivered=Image.open(path).convert('RGBA')
  hashes=[sha(delivered.crop(((i%12)*192,(i//12)*192,
           (i%12+1)*192,(i//12+1)*192)).tobytes()) for i in range(24)]
  assert len(set(hashes))==24
  clips[name]=dict(path='motion/ren/'+name+'.webp',sha256=sha(path.read_bytes()),
    sourcePose=0,frames=24,columns=12,rows=2,cell=[192,192],foot=[96,184],
    width=2304,height=384,frameMs=40,uniqueFrames=24,frameRGBAsha256=hashes)
 motion=dict(group='party',facing='right',drawHeight=124,foot=[192,368],
   sourceSheetSha256=initialsha,sourceFile='sheets/ren.png',clipSet=clips)
 (folder/'motion-manifest.json').write_text(json.dumps({'schema':'bbc-hd-motion/2',
    'sourceSchema':'bbc-hd-painted/1','frameCount':24,'motionClipCount':10,
    'frameTotal':240,'actors':{'ren':motion}}))
def run():
 with tempfile.TemporaryDirectory() as temp:
  root=Path(temp)
  for name in ('hd-painted-animation.mjs','hd-painted-motion.mjs','hd-reviewed-motion.mjs'):
   shutil.copyfile(GAME/name,root/name)
  folder=root/'assets/art/hd-painted-v1'
  fixture(folder)
  page_text="""<!doctype html><html><body><canvas width='500' height='350' id='canvas'></canvas>
<script type='module'>
import {createHdPaintedArtRuntime} from './hd-painted-animation.mjs';
const ctx=document.querySelector('#canvas').getContext('2d'), trace=[];
const real=ctx.drawImage.bind(ctx);
ctx.drawImage=(...args)=>{trace.push({width:args[3],sx:args[1]});real(...args);};
const fetchJson=url=>fetch(url).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()});
const source=()=>new Image();
const rt=createHdPaintedArtRuntime({enabled:true,motionEnabled:true,fetchJson,createImage:source});
const actor={id:'ren',hp:100,active:true,grounded:true,facing:1,position:{x:250,y:300},
  movementIntent:{x:0},activeAttack:null,activeManeuver:null,
  hitStunRemainingMs:0,staggerRemainingMs:0};
await rt.request('ren');await rt.motion.request('ren','idle',rt.get('ren').record);
rt.draw(ctx,actor,'ren',{nowMs:120});const idle=trace.at(-1);
actor.activeAttack={phase:'active'};
await rt.motion.request('ren','active',rt.get('ren').record);
rt.draw(ctx,actor,'ren',{nowMs:120,phaseProgress:.6});const hit=trace.at(-1);
const original=createHdPaintedArtRuntime({enabled:true,motionEnabled:false,fetchJson,createImage:source});
await original.request('ren');original.draw(ctx,actor,'ren');const fallback=trace.at(-1);
window.result={idle,hit,fallback,cache:rt.motion.cacheSize,
  source:rt.get('ren').record.sha256,errors:rt.motion.disabledReason};
</script></body></html>"""
  (root/'test.html').write_text(page_text)
  server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  errors=[]
  try:
   with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':900,'height':700})
    page.set_default_timeout(30000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    response=page.goto('http://127.0.0.1:%d/test.html'%server.server_address[1],
                       wait_until='domcontentloaded')
    assert response and response.status==200
    page.wait_for_function('() => window.result !== undefined')
    result=page.evaluate('window.result')
    assert result['idle']['width']==192 and result['hit']['width']==192,result
    assert result['fallback']['width']==384,result
    assert result['cache']==2 and result['errors'] is None,result
    assert not errors,errors
    screenshot=GAME.parent/'artifacts/hd-motion-chromium.png'
    screenshot.parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(screenshot),full_page=True)
    browser.close()
    print(json.dumps({'ok':True,'motionWidth':192,'fallbackWidth':384,
                      'cachedClips':2,'browserErrors':errors}))
  finally:
   server.shutdown();server.server_close();thread.join(timeout=5)
if __name__=='__main__':run()
