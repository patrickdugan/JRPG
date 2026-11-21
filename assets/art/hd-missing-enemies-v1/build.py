#!/usr/bin/env python3
"""Build and verify 16 missing regular enemies from committed source animation cells.

This is an ORIGINAL-SOURCE-DERIVED ANIMATION BRIDGE. It resamples existing
AI-stylized image poses and applies deterministic, modest transformations.
It does not claim hand-painted masters or independently drawn 24-frame cels.

The engine may opt into this lower-priority HD lane at ?art=hd. The accepted
painted HD pack takes precedence, and the pixel runtime remains fallback.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
ASSET_ROOT = REPO / "game/assets/art/hd-painted-v1/overlay-missing-v1"
ROSTER = REPO / "assets/art/roster-keystone/roster.json"
VERSION = "bbc-hd-painted/1"
MOTION_VERSION = "bbc-hd-motion/2"
CLIPS = ("idle","locomotion","windup","active","recovery","guard","hurt","defeat","signature","stagger")
FRAMES = 24
POSES = ("idle","move","windup","active","hurt","defeat")
GROUPS = (
    ("A-initial", ("ash-wisp","registry-hound","lantern-leech","forge-thrall")),
    ("B-humans-beasts", ("veil-courier","provincial-banner-guard","storm-nue","dream-baku")),
    ("C-beasts", ("twin-tail-nekomata","sickle-weasel","drum-tanuki","marsh-kappa-beast")),
    ("D-beasts-plants", ("ushi-oni-behemoth","black-chrysanthemum-nest-woman","spider-lily-ambusher","lantern-vine-maw")),
)
SKIP_ALPHA=8
KEY_POSITIONS = ((0,0),(0,3),(1,1),(1,3),(3,0),(3,5))
SAMPLES = {
    "idle": ((0,0),(0,0),(0,0),(0,1),(0,0),(0,0)),
    "locomotion": tuple((0,j) for j in range(6)),
    "windup": ((1,0),(1,0),(1,1),(1,1),(1,2),(1,2)),
    "active": ((1,2),(1,3),(1,3),(1,4),(1,5),(1,5)),
    "recovery": ((1,4),(1,5),(1,5),(0,0),(0,0),(0,0)),
    "guard": ((2,0),(2,0),(2,1),(2,0),(2,0),(2,1)),
    "hurt": ((3,0),(3,0),(3,1),(3,1),(3,2),(3,2)),
    "defeat": ((3,2),(3,3),(3,4),(3,5),(3,5),(3,5)),
    "signature": tuple((2,j) for j in range(6)),
    "stagger": ((3,0),(3,0),(3,1),(3,1),(3,2),(3,2)),
}
PROFILES = {
    "flyer":124,"crawler":122,"lean-humanoid":133,"broad-humanoid":144,
    "human":135,"armored-human":144,"quadruped":119,"broad-beast":158,
    "arachnid":151,"serpent-plant":146,"rooted-plant":145,
}

def sha_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def json_write(path:Path, data:dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf8")

def source_specs():
    output={}
    for version in ("v2","v3"):
        root=REPO/"assets/art"/("enemy-animation-suite-"+version)
        p=root/("enemy-animation-suite-"+version+".source.json")
        spec=json.loads(p.read_text(encoding="utf8"))
        for entry in spec["enemies"]:
            output[entry["id"]]=(root,entry,version)
    return output

def ensure_source_coverage(actors,source):
    wanted=[a for batch,ids in GROUPS for a in ids]
    assert len(wanted)==16 and len(set(wanted))==16
    expected={a["id"] for a in actors if a["kind"]=="regular-enemy" and a["paintedKeyArt"]=="pending"}
    assert set(wanted)==expected,(sorted(expected),sorted(wanted))
    assert all(w in source for w in wanted)
    return wanted

def load_source(root,entry):
    src=root/entry["sourceAlpha"]
    assert src.is_file(), src
    image=Image.open(src).convert("RGBA")
    # Source Alpha files are the original, pre-pixelification source boards.
    # If a board accidentally has an opaque alpha channel use its committed
    # magenta-chroma partner and remove only pixels matching the sampled key.
    if image.getchannel("A").getextrema()==(255,255):
        alt=root/entry["sourceChroma"]
        assert alt.is_file()
        image=Image.open(alt).convert("RGBA")
        rgb=image.convert("RGB")
        w,h=rgb.size
        samples=[rgb.getpixel(p) for p in ((0,0),(w-1,0),(0,h-1),(w-1,h-1))]
        key=tuple(sorted(vals)[2] for vals in zip(*samples))
        px=list(image.getdata())
        cut=90*90
        # Explicit chroma transparency; keep gradients near the subject.
        image.putdata([(r,g,b,0 if ((r-key[0])**2+(g-key[1])**2+(b-key[2])**2)<cut else a) for r,g,b,a in px])
    assert image.getchannel("A").getbbox(),str(src)
    return image,src

def source_cells(image):
    w,h=image.size
    cells={}
    for row in range(4):
        for col in range(6):
            x0,x1=round(col*w/6),round((col+1)*w/6)
            y0,y1=round(row*h/4),round((row+1)*h/4)
            # Avoid source-grid hairlines while retaining weapon edges.
            dx=max(1,round((x1-x0)*.012))
            dy=max(1,round((y1-y0)*.014))
            tile=image.crop((x0+dx,y0+dy,x1-dx,y1-dy))
            alpha=tile.getchannel("A")
            alpha=alpha.point(lambda v:0 if v<SKIP_ALPHA else v)
            tile.putalpha(alpha)
            box=alpha.getbbox()
            if not box:raise AssertionError("Empty source cell "+str((row,col)))
            cells[(row,col)]=tile.crop(box)
    return cells

def place(tile, size, maxW, maxH,foot):
    tw,th=tile.size
    factor=min(maxW/tw,maxH/th)
    nw,nh=max(1,round(tw*factor)),max(1,round(th*factor))
    scaled=tile.resize((nw,nh),Image.Resampling.LANCZOS)
    # Original stylized reference boards face screen-left. Flip into the
    # game's documented screen-right HD presentation convention.
    scaled=scaled.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    canvas=Image.new("RGBA",(size,size))
    x=(size-nw)//2
    y=foot-nh
    canvas.alpha_composite(scaled,(x,y))
    return canvas

def motion_cell(cell,offset_x,offset_y,shear,foot=186):
    # Single-pose movement avoids cross-pose optical-flow ghosting.
    # Maximum warp <= ~2 output pixels and one degree of lean.
    v=cell.transform((192,192),Image.Transform.AFFINE,
        (1.0,shear/192,-offset_x,0.0,1.0,-offset_y),resample=Image.Resampling.BICUBIC)
    return v

def png_data(image):
    f=io.BytesIO()
    image.save(f,format="PNG",optimize=True)
    return f.getvalue()

def webp_data(image):
    f=io.BytesIO()
    image.save(f,format="WEBP",quality=83,method=4,lossless=False,exact=True)
    return f.getvalue()

def name_for(id):
    return id.replace("-"," ").title()

def make_one(id,sources,outroot):
    root,entry,version=sources[id]
    image,sourcePath=load_source(root,entry)
    cells=source_cells(image)
    pngkeys=[place(cells[pos],384,354,355,374) for pos in KEY_POSITIONS]
    sheet=Image.new("RGBA",(384*6,384))
    for i,key in enumerate(pngkeys):sheet.alpha_composite(key,(i*384,0))
    source_png=png_data(sheet)
    sourceSha=sha_bytes(source_png)
    sheetRel="sheets/"+id+".png"
    target=outroot/sheetRel
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(source_png)
    draw_height=PROFILES.get(entry["profile"],130)
    artRec={
        "file":sheetRel,"width":2304,"height":384,"foot":[192,374],
        "drawHeight":draw_height,"group":"enemy","facing":"right",
        "poses":list(POSES),"sha256":sourceSha,
        "sourceProvenance":"AI-stylized source animation board; derived PNG key poses",
        "sourceFile":str(sourcePath.relative_to(REPO)),
    }
    motion={}
    for name in CLIPS:
        atlas=Image.new("RGBA",(12*192,2*192))
        hashes=[]
        for idx in range(FRAMES):
            # Six distinct source-cel key poses per cycle. Each frame has a
            # small deterministic wobble, never a blend with a second face.
            row,col=SAMPLES[name][(idx//4)%6]
            base=place(cells[(row,col)],192,179,174,186)
            k=idx%4
            dx=[0,1,0,-1][k]
            dy=[0,0,-1,1][k]+(1 if name=="locomotion" and col%2 else 0)
            lean=((-1,1,0,1)[k] if name in ("active","signature","windup") else 0)
            frame=motion_cell(base,dx,dy,lean)
            hash_rgba=sha_bytes(frame.tobytes())
            hashes.append(hash_rgba)
            atlas.alpha_composite(frame,((idx%12)*192,(idx//12)*192))
        assert len(set(hashes))==24,(id,name,"non-unique frames")
        bytes_=webp_data(atlas)
        path="motion/"+id+"/"+name+".webp"
        t=outroot/path
        t.parent.mkdir(parents=True,exist_ok=True)
        t.write_bytes(bytes_)
        # Verify the hashes of the actual decoded WebP frames. Lossy WebP
        # encoding changes pixels even when the source frames are identical.
        decoded=Image.open(io.BytesIO(bytes_)).convert("RGBA")
        decoded_hashes=[sha_bytes(decoded.crop(((i%12)*192,(i//12)*192,(i%12+1)*192,(i//12+1)*192)).tobytes()) for i in range(24)]
        assert len(set(decoded_hashes))==24,(id,name,"WebP duplicate frames")
        motion[name]={
            "path":path,"frames":24,"columns":12,"rows":2,"width":2304,"height":384,
            "cell":[192,192],"foot":[96,186],"sourcePose":
                (0 if name=="idle" else 1 if name=="locomotion" else 2 if name=="windup"
                else 3 if name in ("active","signature") else 4 if name in ("hurt","stagger")
                else 5 if name=="defeat" else 0),
            "uniqueFrames":24,"frameMs":40,"sha256":sha_bytes(bytes_),"frameRGBAsha256":decoded_hashes,
        }
    motionRec={
        "group":"enemy","drawHeight":draw_height,"foot":[192,374],
        "facing":"right","sourceSheetSha256":sourceSha,"sourceFile":sheetRel,
        "clipSet":motion,
    }
    return artRec,motionRec, pngkeys

def make_contact(rows, destination):
    # Render a real contact sheet of six key poses per missing enemy.
    cardw,cardh=930,240
    image=Image.new("RGB",(cardw*2,cardh*8),(19,28,38))
    draw=ImageDraw.Draw(image)
    for index,(id,keys) in enumerate(rows):
        x=(index%2)*cardw
        y=(index//2)*cardh
        draw.rectangle((x+1,y+1,x+cardw-3,y+cardh-3),outline=(103,94,76))
        draw.text((x+10,y+8),name_for(id),fill=(244,210,152))
        for i,key in enumerate(keys):
            mini=key.resize((142,142),Image.Resampling.LANCZOS)
            cell=Image.new("RGBA",(142,142),(52,57,64,255))
            cell.alpha_composite(mini)
            image.paste(cell.convert("RGB"),(x+10+i*150,y+38))
            draw.text((x+12+i*150,y+189),POSES[i],fill=(212,211,204))
    destination.parent.mkdir(parents=True,exist_ok=True)
    image.save(destination,quality=86,optimize=True)

def run(check=False):
    k=json.loads(ROSTER.read_text(encoding="utf8"))
    source=source_specs()
    ids=ensure_source_coverage(k["identities"],source)
    art, motion, previews={}, {}, []
    for id in ids:
        a,m,keys=make_one(id,source,ASSET_ROOT)
        art[id]=a;motion[id]=m;previews.append((id,keys))
    manifest={
        "schema":VERSION,"version":1,"frameCount":6,"actors":art,
        "status":"review-candidate-source-derived","scope":"16 missing regular enemies; source-derived from existing high-resolution boards",
    }
    motion_manifest={
        "schema":MOTION_VERSION,"version":2,"sourceSchema":VERSION,"frameCount":24,
        "frameTotal":len(ids)*len(CLIPS)*24,"motionClipCount":len(ids)*len(CLIPS),
        "status":"source-derived-review-candidate","actors":motion
    }
    json_write(ASSET_ROOT/"manifest.json",manifest)
    json_write(ASSET_ROOT/"motion-manifest.json",motion_manifest)
    make_contact(previews,REPO/"artifacts/hd-missing-enemy-contact.jpg")
    print(json.dumps({"identities":len(ids),"keyPoses":len(ids)*6,"motionClips":len(ids)*10,
                      "derivedFrames":len(ids)*10*24,"manifestActors":len(motion)},indent=2))

if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--check",action="store_true")
    args=cli.parse_args()
    run(args.check)
