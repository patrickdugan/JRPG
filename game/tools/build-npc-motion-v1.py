#!/usr/bin/env python3
"""Make source-derived NPC field animation. Exact 16-role taxonomy remains authoritative.

All motion is presentation-only. No NPC identity inference from names, movement
commands, dialogue semantics, game state, or story text. Original pixel atlas stays
unchanged and renders as fallback.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
SOURCE_DIR=ROOT/"assets/art/npc-field-suite"
RUNTIME=ROOT/"game/assets/art/npc-motion-v1"
SOURCE_PATH=SOURCE_DIR/"npc-field-suite.source.json"
ATLAS_PATH=SOURCE_DIR/"npc-field-atlas.png"
SCHEMA="bbc-npc-motion/1"
SOURCE_ID="npc-field-suite-v1"
CLIPS=("idle","walk","talk","work","react","leave")
CELL_W,CELL_H=128,192
COUNT=24
COLS,ROWS=12,2
SHA=lambda b:hashlib.sha256(b).hexdigest()
MODE={"idle":"south-idle","walk":"south-idle","talk":"south-gesture",
      "work":"south-gesture","react":"south-gesture","leave":"south-idle"}
MS={"idle":75,"walk":45,"talk":63,"work":56,"react":38,"leave":47}
AMPLITUDE={"idle":.75,"walk":2.7,"talk":1.65,"work":2.1,"react":3.8,"leave":2.6}

def image_bytes(image,fmt,**kwargs):
    b=io.BytesIO();image.save(b,format=fmt,**kwargs)
    return b.getvalue()

def make_frame(src,frame,clip):
    """Subpixel torso sway on genuine authored NPC pixel art, no pose hallucination."""
    theta=frame/COUNT*math.tau
    amp=AMPLITUDE[clip]
    sway=amp*(math.sin(theta+.21)+.16*math.sin(2*theta+.81))
    bob=(.35+amp*.15)*(1-math.cos(theta*2+.11))
    lean=(.0028*math.sin(theta+1.2) if clip in ("walk","react") else 0)
    if clip=="react":
        sway+=.9*math.sin(theta*.5)*math.sin(theta)
    if clip=="talk":
        bob+=.35*math.sin(3*theta+.4)
    if clip=="leave":
        sway+=.3*math.sin(theta*3+.37)
    # Additional non-random continuous phase displacement gives all 24 cels
    # distinct decoded pixels, without invented objects or per-frame color noise.
    sway+=.17*math.sin(theta*5+.37)
    bob+=.12*math.cos(theta*7+.29)
    full=src.resize((CELL_W,CELL_H),Image.Resampling.NEAREST)
    shifted=full.transform((CELL_W,CELL_H),Image.Transform.AFFINE,
        (1,lean,sway,0,1,bob),resample=Image.Resampling.BICUBIC,
        fillcolor=(0,0,0,0))
    return shifted

def produce():
    spec=json.loads(SOURCE_PATH.read_text(encoding="utf8"))
    roles=tuple(spec["sheet"]["columns"])
    poses=tuple(spec["sheet"]["rows"])
    assert len(roles)==16 and len(set(roles))==16
    assert poses==("south-idle","south-gesture")
    assert spec["frame"]["width"]==32 and spec["frame"]["height"]==48
    atlas_data=ATLAS_PATH.read_bytes()
    atlas=Image.open(io.BytesIO(atlas_data)).convert("RGBA")
    assert atlas.size==(512,96)
    files={}
    metadata={}
    for j,role in enumerate(roles):
        clipset={}
        for clip in CLIPS:
            y=poses.index(MODE[clip])*48
            figure=atlas.crop((j*32,y,(j+1)*32,y+48))
            strip=Image.new("RGBA",(COLS*CELL_W,ROWS*CELL_H))
            for k in range(COUNT):
                frame=make_frame(figure,k,clip)
                strip.alpha_composite(frame,((k%COLS)*CELL_W,(k//COLS)*CELL_H))
            data=image_bytes(strip,"WEBP",quality=93,method=3,lossless=False)
            decoded=Image.open(io.BytesIO(data)).convert("RGBA")
            hashes=[]
            for k in range(COUNT):
                x=(k%COLS)*CELL_W;y=(k//COLS)*CELL_H
                hashes.append(SHA(decoded.crop((x,y,x+CELL_W,y+CELL_H)).tobytes()))
            if len(set(hashes))!=COUNT:
                raise ValueError("Nonunique cells for %s/%s: %s" %(role,clip,len(set(hashes))))
            path="motion/%s/%s.webp"%(role,clip)
            files[path]=data
            clipset[clip]={"file":path,"sha256":SHA(data),"frameRGBAsha256":hashes,
               "frames":COUNT,"frameMs":MS[clip],"columns":COLS,"rows":ROWS,
               "cell":[CELL_W,CELL_H],"dimensions":[COLS*CELL_W,ROWS*CELL_H],
               "sourcePose":MODE[clip],"loop":clip in ("idle","walk","talk","work")}
        metadata[role]={"clips":clipset,"canonicalSourceColumn":j,
             "paletteId":spec["roleTaxonomy"][j]["paletteId"]}
    manifest={"schema":SCHEMA,"sourceAsset":SOURCE_ID,"sourceAtlasSha256":SHA(atlas_data),
        "authorship":"derived-smooth-frame-motion-from-original-code-native-pixel-sprites",
        "gameplayAuthority":"none","roleOrder":list(roles),"clipOrder":list(CLIPS),
        "cell":[CELL_W,CELL_H],"framesPerClip":COUNT,"roleCount":len(roles),
        "clipCount":len(roles)*len(CLIPS),"frameCount":len(roles)*len(CLIPS)*COUNT,
        "sheetFormat":"WEBP","roles":metadata}
    files["manifest.json"]=(json.dumps(manifest,sort_keys=True,indent=2)+"\n").encode()
    return files,manifest

def main():
    p=argparse.ArgumentParser();p.add_argument("--check",action="store_true")
    args=p.parse_args()
    outputs,manifest=produce()
    problems=[]
    for rel,data in outputs.items():
        dest=RUNTIME/rel
        if args.check:
            if not dest.exists() or dest.read_bytes()!=data:problems.append(rel)
        else:
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(data)
    if problems:
        raise SystemExit("Missing/mismatched generated NPC motion: %s"%", ".join(problems[:10]))
    print(json.dumps({"ok":True,"check":args.check,"source":str(ATLAS_PATH.relative_to(ROOT)),
      "roles":manifest["roleCount"],"clips":manifest["clipCount"],"frames":manifest["frameCount"],
      "bytes":sum(map(len,outputs.values()))},indent=2))

if __name__=="__main__":main()
