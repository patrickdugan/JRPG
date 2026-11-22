#!/usr/bin/env python3
"""Deterministic source-authored HD presentation VFX for six canonical JRPG bosses.

Produces true RGBA PNGs, 12 unique 256x256 frames per strip, 12 strips total.
These are art-directed effects painted with Pillow paths, NOT enemy body art,
and never authority for attack collisions, timing, victory or safe areas.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

BOSSES = {
    "widow-of-fog": {
        "label": "Widow of Fog",
        "signature": "Receding Call",
        "strike": "Name Drag",
        "color": (169, 213, 225),
        "dark": (76, 112, 138),
        "mode": "fog",
    },
    "furnace-abbot": {
        "label": "Furnace Abbot",
        "signature": "Forge Sermon",
        "strike": "Hammer Decree",
        "color": (252, 156, 55),
        "dark": (184, 54, 27),
        "mode": "furnace",
    },
    "ujiro": {
        "label": "Magistrate Ujiro Arata",
        "signature": "Seizure Order",
        "strike": "Gavel Line",
        "color": (243, 92, 69),
        "dark": (121, 33, 54),
        "mode": "writ",
    },
    "bell-warden-chiyo": {
        "label": "Bell Warden Chiyo",
        "signature": "Ringing Count",
        "strike": "Chain Cast",
        "color": (234, 199, 114),
        "dark": (96, 95, 146),
        "mode": "bell",
    },
    "lady-enma": {
        "label": "Lady Enma of Ash",
        "signature": "Paired Ashes",
        "strike": "Cinder Parasol Wing",
        "color": (251, 95, 98),
        "dark": (135, 36, 72),
        "mode": "fan",
    },
    "yearless-bell": {
        "label": "Yearless Bell",
        "signature": "Yearless Ring",
        "strike": "Yearless Ring (near)",
        "color": (190, 140, 255),
        "dark": (87, 64, 152),
        "mode": "time",
    },
}
STAGES = ("windup", "active")
N = 12
SIZE = 256
AA = 2
OUT = Path(__file__).resolve().parents[1] / "assets" / "art" / "hd-boss-vfx-v1"
SCHEMA = "bbc-hd-boss-vfx/1"

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def pt(n: float) -> int:
    return int(round(n * AA))

def xy_box(cx: float, cy: float, rx: float, ry: float) -> tuple[int, int, int, int]:
    return (pt(cx-rx), pt(cy-ry), pt(cx+rx), pt(cy+ry))

def path(draw: ImageDraw.ImageDraw, pts, color, width=2, joint="curve"):
    draw.line([(pt(x), pt(y)) for x,y in pts], fill=color, width=max(1,pt(width)), joint=joint)

def oval(draw, cx,cy,rx,ry,color,width=2):
    draw.ellipse(xy_box(cx,cy,rx,ry), outline=color, width=pt(width))

def core_glow(draw, cx,cy,r, color, alpha):
    for k in range(8,0,-1):
        rr=r*(.4+k*.18)
        draw.ellipse(xy_box(cx,cy,rr,rr), fill=(*color, int(alpha*(1-k/9)**1.7)))

def petal(draw, cx,cy,angle,length,width,color):
    dx,dy=math.cos(angle),math.sin(angle)
    nx,ny=-dy,dx
    pts=[(cx,cy),(cx+dx*length*.5+nx*width,cy+dy*length*.5+ny*width),
         (cx+dx*length,cy+dy*length),
         (cx+dx*length*.55-nx*width,cy+dy*length*.55-ny*width)]
    draw.polygon([(pt(x),pt(y)) for x,y in pts], fill=color)

def draw_effect(boss: str, stage: str, frame: int) -> Image.Image:
    spec=BOSSES[boss]
    phase=frame/(N-1)
    strength=(.25+.75*phase) if stage=="windup" else (1.0-.24*phase)
    base=Image.new("RGBA",(SIZE*AA,SIZE*AA),(0,0,0,0))
    haze=Image.new("RGBA",base.size,(0,0,0,0))
    h=ImageDraw.Draw(haze,"RGBA")
    ink=ImageDraw.Draw(base,"RGBA")
    color,dark=spec["color"],spec["dark"]
    rng=random.Random(boss+":"+stage+":"+str(frame))
    cx,cy=128,118
    m=spec["mode"]
    movement=phase*math.tau

    if m=="fog":
        # Translucent lunar mist, a named-person filament, and an expanding tide ring.
        for i in range(7):
            shift=i*.8+movement*(.3 if stage=="windup" else .65)
            ellipse_y=22+i*9+phase*16
            radius=32+i*13+phase*(6 if stage=="windup" else 20)
            pts=[]
            for j in range(36):
                ang=j/35*math.tau+shift
                ripple=6*math.sin(ang*3+i+phase*8)
                pts.append((cx+(radius+ripple)*math.cos(ang),cy+ellipse_y*.7*math.sin(ang)+i*2-5))
            path(h,pts,(*color,round(14*strength)),7)
            path(ink,pts,(*color,round(105*strength)),1.3)
        for i in range(6):
            xx=cx+math.sin(movement*.7+i*1.8)*(20+i*13)
            yy=cy+(i-3)*17
            tail=[(xx-35+j*4,yy+math.sin(j*.56+movement+i)*6) for j in range(20)]
            path(ink,tail,(*color,round((45+i*5)*strength)),1.9)
        if stage=="active":
            oval(ink,cx,cy,34+phase*67,22+phase*32,(*color,round(125*strength)),2.5)

    elif m=="furnace":
        # Triple vent rows, churning forge fire, strike sparks, and a hammer impact.
        core_glow(h,cx,cy,28+phase*24,dark,int(90*strength))
        for i in range(3):
            angle=(-.8+i*.8)+movement*.12
            xx=cx+(i-1)*27
            pts=[(xx,cy+43),(xx-12+math.sin(angle)*10,cy+8),
                 (xx+8+math.sin(angle*3)*13,cy-40-phase*35),
                 (xx+15,cy-54-phase*20)]
            path(h,pts,(*dark,round(50*strength)),19)
            path(ink,pts,(*color,round((130+i*18)*strength)),3.6)
            path(ink,pts[:2],(255,226,150,round(135*strength)),2)
        # Diamond grate, square ceremonial geometry
        corners=[(cx,cy-48),(cx+48,cy),(cx,cy+48),(cx-48,cy),(cx,cy-48)]
        path(ink,corners,(*color,round(135*strength)),2.5)
        for i in range(20):
            ang=rng.uniform(0,math.tau)
            dist=(phase*.7+.3)*rng.uniform(18,116)
            x,y=cx+dist*math.cos(ang),cy+dist*.67*math.sin(ang)
            rad=rng.uniform(.7,2.4)
            h.ellipse(xy_box(x,y,rad*2,rad*2),fill=(*color,round(60*strength)))
            ink.ellipse(xy_box(x,y,rad,rad),fill=(255,216,138,round(185*strength)))
        if stage=="active":
            radius=55+phase*62
            oval(ink,cx,cy+17,radius,radius*.47,(255,171,95,round(195*strength)),3)

    elif m=="writ":
        # Paper seals and vertical court order strokes, red stamp authority.
        for i in range(6):
            angle=i*math.tau/6+movement*.13
            distance=25+(15+phase*34)*strength
            px=cx+distance*math.cos(angle);py=cy+distance*.7*math.sin(angle)
            ww,hh=13,23
            h.rounded_rectangle(xy_box(px,py,ww+5,hh+5),radius=pt(3),fill=(*dark,round(30*strength)))
            ink.rectangle(xy_box(px,py,ww,hh),fill=(245,220,175,round(230*strength)),outline=(*dark,210),width=pt(1.6))
            for j in range(3):
                path(ink,[(px-8,py-10+j*7),(px+7,py-11+j*7)],
                     (*color,round(210*strength)),1.5)
            if stage=="active":
                petal(ink,px,py,angle+math.pi,14+phase*17,2,(*color,round(110*strength)))
        oval(ink,cx,cy,23+phase*40,19+phase*32,(*color,round(125*strength)),2)

    elif m=="bell":
        # Brass resonance rings and suspended chain geometry.
        for i in range(5):
            radius=23+i*18+phase*(6 if stage=="windup" else 25)
            oval(h,cx,cy,radius,radius*.72,(*color,round(26*strength)),6)
            oval(ink,cx,cy,radius,radius*.72,(*color,round((100+i*7)*strength)),1.6)
        for i in range(2):
            seed=i*math.pi+movement*.25
            pts=[]
            for k in range(14):
                t=k/13
                x=cx+math.cos(seed)*90*(1-t)+math.sin(t*12+movement)*7
                y=cy-math.sin(seed)*60*(1-t)+(t-.5)*22
                pts.append((x,y))
            path(ink,pts,(*color,round(145*strength)),2.4)
        for i in range(4):
            angle=i*math.pi/2+movement*.4
            x,y=cx+72*math.cos(angle),cy+58*math.sin(angle)
            ink.ellipse(xy_box(x,y,3,3),fill=(*color,round(170*strength)))

    elif m=="fan":
        # A sweep of lacquer-red fan ribs and ash fragments.
        opening=.25+phase*.75 if stage=="windup" else 1.1+phase*.35
        for i in range(13):
            theta=(-1.15+i*2.3/12)*opening - .4
            r=63+phase*58
            xx=cx+r*math.cos(theta);yy=cy-r*.58*math.sin(theta)
            path(h,[(cx,cy),(xx,yy)],(*dark,round(33*strength)),9)
            path(ink,[(cx,cy),(xx,yy)],(*color,round(120*strength)),2.4)
        for i in range(29):
            ang=rng.uniform(-2,1.6)-phase*.5
            r=rng.uniform(20,110+phase*30)
            x,y=cx+r*math.cos(ang),cy-r*.6*math.sin(ang)
            petal(ink,x,y,ang+.4,rng.uniform(3,8),rng.uniform(1.5,3.5),
                  (*color,round(rng.uniform(90,200)*strength)))
        if stage=="active":
            path(ink,[(cx-75,cy+46),(cx,cy-35),(cx+96,cy-43)],
                 (255,177,119,round(160*strength)),4)

    elif m=="time":
        # Four bell nodes, violet orbital mechanics, and a temporal ring.
        for i in range(4):
            theta=i*math.pi/2+movement*.18
            d=44+phase*(10 if stage=="windup" else 30)
            x,y=cx+d*math.cos(theta),cy+d*math.sin(theta)
            h.ellipse(xy_box(x,y,11,11),fill=(*dark,round(55*strength)))
            ink.rounded_rectangle(xy_box(x,y,6,6),radius=pt(1),
                                  fill=(*color,round(200*strength)))
            path(ink,[(cx,cy),(x,y)],(*color,round(75*strength)),1.7)
        for i in range(4):
            r=21+i*17+phase*(12 if stage=="windup" else 50)
            oval(ink,cx,cy,r,r,(*color,round((130-i*20)*strength)),1.7)
        for i in range(12):
            theta=i*math.tau/12+movement*.25
            radius=78+phase*21
            x,y=cx+radius*math.cos(theta),cy+radius*math.sin(theta)
            path(ink,[(x-3,y),(x+3,y)],(*color,round(145*strength)),2)

    # A softly blurred light layer, assembled without flattening transparency.
    glow=haze.filter(ImageFilter.GaussianBlur(pt(4)))
    result=Image.alpha_composite(glow,haze)
    result=Image.alpha_composite(result,base)
    return result.resize((SIZE,SIZE),Image.Resampling.LANCZOS)

def render_all() -> dict[str,bytes]:
    outputs: dict[str,bytes]={}
    records={}
    for boss,spec in BOSSES.items():
        staged={}
        for stage in STAGES:
            atlas=Image.new("RGBA",(SIZE*N,SIZE))
            framehash=[]
            for i in range(N):
                frame=draw_effect(boss,stage,i)
                framehash.append(sha(frame.tobytes()))
                atlas.paste(frame,(SIZE*i,0))
            if len(set(framehash))!=N:
                raise AssertionError("Duplicate VFX frames: "+boss+"/"+stage)
            stream=io.BytesIO();atlas.save(stream,format="PNG",optimize=True)
            output=stream.getvalue()
            rel=f"{boss}-{stage}.png"
            outputs[rel]=output
            staged[stage]={"file":rel,"sha256":sha(output),"bytes":len(output),
                          "frames":N,"cell":[SIZE,SIZE],"dimensions":[SIZE*N,SIZE],
                          "decodedFrameSHA256":framehash}
        records[boss]={"label":spec["label"],"strike":spec["strike"],
                       "signature":spec["signature"],"mode":spec["mode"],
                       "stages":staged}
    manifest={"schema":SCHEMA,"provenance":"code-authored graphical VFX on existing boss attacks",
              "gameplayAuthority":"none","frameSize":[SIZE,SIZE],"framesPerStage":N,
              "stageCount":len(BOSSES)*len(STAGES),
              "totalCells":len(BOSSES)*len(STAGES)*N,
              "bosses":records}
    outputs["manifest.json"]=(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n").encode("utf-8")
    return outputs

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--check",action="store_true")
    args=ap.parse_args()
    outputs=render_all()
    failures=[]
    for name,data in outputs.items():
        file=OUT/name
        if args.check:
            if not file.is_file() or file.read_bytes()!=data:
                failures.append(name)
        else:
            file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(data)
    if failures:raise SystemExit("Mismatched generated VFX: "+", ".join(failures))
    print(json.dumps({"ok":True,"checked":args.check,"bosses":len(BOSSES),
                      "atlasses":len(outputs)-1,"totalCells":len(BOSSES)*len(STAGES)*N,
                      "outputBytes":sum(map(len,outputs.values()))},indent=2))

if __name__=="__main__":main()
