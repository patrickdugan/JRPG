"""Create a compact rendered contact sheet from real SVG pose cells for art QA."""
from __future__ import annotations
import io
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build

def make(destination: Path) -> dict:
    from PIL import Image, ImageDraw, ImageFont
    import cairosvg
    actors=build.CAST["cast"]
    poses=("idle-a","run-contact","windup","active","signature","defeat")
    cellw, cellh=150,184
    sheet=Image.new("RGB",(160+cellw*len(poses),cellh*(len(actors)+1)),(24,34,44))
    drawer=ImageDraw.Draw(sheet)
    drawer.text((16,12),"Bells of the Black Chrysanthemum / ORIGINAL VECTOR RIG STUDIES",fill=(234,214,175))
    for j,pose in enumerate(poses):
        drawer.text((160+j*cellw,33),pose,fill=(230,200,146))
    for i,actor in enumerate(actors):
        y=(i+1)*cellh
        drawer.text((6,y+14),actor["name"].replace(" · "," "),fill=(237,222,200))
        drawer.text((6,y+34),actor["group"],fill=(178,170,158))
        for j,pose in enumerate(poses):
            png=cairosvg.svg2png(bytestring=build.standalone(actor,pose).encode("utf-8"))
            part=Image.open(io.BytesIO(png)).convert("RGBA")
            tile=Image.new("RGBA",part.size,(51,65,75,255))
            tile.alpha_composite(part)
            sheet.paste(tile.convert("RGB"),(160+j*cellw,y))
    destination.parent.mkdir(parents=True,exist_ok=True)
    sheet.save(destination,optimize=True)
    return {"characters":len(actors),"posesPerCharacter":len(poses),"size":sheet.size,"output":str(destination)}

if __name__=="__main__":
    output=Path(__file__).resolve().parents[3]/"artifacts"/"svg-gothic-full-roster.png"
    print(make(output))
