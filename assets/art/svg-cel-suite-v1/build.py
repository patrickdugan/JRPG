#!/usr/bin/env python3
"""Deterministically build the 62-identity, 686-cell Gothic SVG studio suite."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from html import escape

import geometry

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT.parents[2] / "game" / "assets" / "art" / "svg-cel-suite-v1"
CAST = json.loads((ROOT / "cast.json").read_text(encoding="utf-8"))
W, H = geometry.WIDTH, geometry.HEIGHT


def header(a: dict, variant: str, width: int) -> str:
    description = ("Code-authored editable SVG motion cels for " + a["name"] +
        ". Reference only: " + a["reference"] +
        ". Every shape is new vector geometry; no embedded raster.")
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" data-actor="%s" data-variant="%s" '
        'data-cell-size="%d,%d" data-anchor="72,149" data-native-facing="right" '
        'data-root-motion="simulation" data-art-source="code-authored-vector">\n'
        '<title>%s / Gothic SVG %s motion</title>\n<desc>%s</desc>\n'
        % (width, H, width, H, escape(a["id"]), variant, W, H,
           escape(a["name"]), variant, escape(description)))


def frame_body(a: dict, frame: str, variant: str) -> str:
    if variant == "field":
        direction, state = frame.split("-", 1)
        base = "run-contact" if state == "walk" else "guard" if state == "gesture" else "idle-a"
        return geometry.draw(a, base, direction)
    return geometry.draw(a, frame, "east")


def strip(a: dict, variant: str) -> str:
    frames = (CAST["npcFieldFrame"]["frames"] if a["group"]=="npc" else geometry.FIELD_POSES) if variant == "field" else geometry.ACTION_POSES
    parts = [header(a, variant, len(frames) * W)]
    for i, pose in enumerate(frames):
        body = frame_body(a, pose, variant)
        parts.append(
            '<g id="cell-%02d-%s" data-pose="%s" data-frame-index="%d" '
            'data-anchor-x="72" data-anchor-y="149" '
            'transform="translate(%d 0)">\n<title>%s / %s</title>\n%s\n</g>\n'
            % (i, pose, pose, i, i * W, escape(a["name"]),pose,body)
        )
    parts.append("</svg>\n")
    return "".join(parts)


def standalone(a: dict, pose: str, variant: str = "action") -> str:
    return header(a, variant, W) + (
        '<g id="cell-%s" data-pose="%s" data-anchor-x="72" '
        'data-anchor-y="149">%s</g>\n</svg>\n' %
        (pose, pose, frame_body(a, pose, variant))
    )


def checksum(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def build(include_cells: bool = False) -> dict[str, str]:
    result: dict[str, str] = {}
    assets = []
    for a in CAST["cast"]:
        variants = ("action", "field") if a["group"] == "party" else ("field",) if a["group"]=="npc" else ("action",)
        for variant in variants:
            frames = (CAST["npcFieldFrame"]["frames"] if a["group"]=="npc" else geometry.FIELD_POSES) if variant == "field" else geometry.ACTION_POSES
            output = "sheets/%s-%s.svg" % (a["id"], variant)
            content = strip(a, variant)
            result[output] = content
            assets.append(dict(
                id=a["id"], name=a["name"], group=a["group"], rig=a["rig"],
                reference=a["reference"], variant=variant, output=output,
                sha256=checksum(content), bytes=len(content.encode("utf-8")),
                poses=list(frames), width=W, height=H, foot=list(geometry.FOOT),
                provenance="code-authored-svg-from-concept-contract",
            ))
            if include_cells:
                for pose in frames:
                    output = "cells/%s/%s/%s.svg" % (a["id"],variant,pose)
                    result[output] = standalone(a, pose, variant)
    receipt = dict(
        schemaVersion=1, assetId=CAST["assetId"], castPath="cast.json",
        generatorPath="build.py", identityCount=len(CAST["cast"]),
        actionSheetCount=len([x for x in CAST["cast"] if x["group"]!="npc"]), fieldSheetCount=23, npcRoleCount=16,
        sheetCount=len(assets), generatedCellCount=sum(len(x["poses"]) for x in assets),
        frameSize=[W,H], simulationRootMotion=True,
        imageEmbeds=0, exports=assets,
    )
    result["manifest.json"] = json.dumps(receipt,ensure_ascii=False,indent=2)+"\n"
    return result


def validate_sources() -> None:
    cast=CAST["cast"]
    assert len(cast)==62, "Expected 62 distinct identities"
    assert len({x["id"] for x in cast})==len(cast), "Duplicate identity"
    expected = {"party":7,"enemy-v2":12,"enemy-v3-human":4,
                "enemy-v3-beast":8,"enemy-v3-plant":4,"boss-state":4,"boss":7,"npc":16}
    for group,count in expected.items():
        assert len([x for x in cast if x["group"]==group])==count, group
    assert len(geometry.ACTION_POSES)==13
    assert len(geometry.FIELD_POSES)==8
    for a in cast:
        assert a["rig"] and a["reference"].startswith("assets/art/")
        assert a["base"].startswith("#") and a["accent"].startswith("#")


def validate_generated(outputs: dict[str,str]) -> dict:
    svg_count,cell_count=0,0
    for path,text in outputs.items():
        if not path.endswith(".svg"):continue
        root=ET.fromstring(text)
        assert root.tag.endswith("svg")
        assert root.attrib["data-root-motion"]=="simulation"
        assert "data:image" not in text.lower()
        assert "<image" not in text.lower()
        assert "<foreignObject" not in text
        assert "<script" not in text.lower()
        assert "http://" not in text.replace('xmlns="http://www.w3.org/2000/svg"','')
        assert "https://" not in text
        assert len(text)>3500,path
        svg_count+=1
        cell_count+=len([x for x in root if x.attrib.get("data-pose") is not None])
    assert svg_count==69
    assert cell_count==46*13+7*8+16*2
    return {"svgSheets":svg_count,"allPoseCells":cell_count}


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true")
    parser.add_argument("--emit-cells",action="store_true",help="Export 686 standalone SVG frames to cells/")
    parser.add_argument("--validate",action="store_true",help="Validate generated content without writing")
    args=parser.parse_args()
    if args.check and args.emit_cells:
        parser.error("Emit cells in a separate run from checking the published strips.")
    validate_sources()
    outputs=build(include_cells=args.emit_cells)
    result=validate_generated({k:v for k,v in outputs.items() if k.startswith("sheets/")})
    errors=[]
    if not args.validate:
        for filename,text in outputs.items():
            targets=[ROOT / filename]
            if filename.startswith("sheets/") or filename=="manifest.json":
                targets.append(RUNTIME / filename)
            for path in targets:
                label=str(path.relative_to(ROOT.parents[2]))
                if args.check:
                    if not path.is_file():errors.append(label+" missing")
                    elif path.read_text(encoding="utf-8")!=text:errors.append(label+" differs")
                else:
                    path.parent.mkdir(parents=True,exist_ok=True)
                    path.write_text(text,encoding="utf-8")
    if errors:raise SystemExit("Non-reproducible SVG assets:\n"+"\n".join(errors))
    print(json.dumps({"ok":True,"checked":args.check,"outputCount":len(outputs),
        "identities":len(CAST["cast"]),"generatedCellCount":46*13+7*8+16*2,**result},indent=2))


if __name__=="__main__":
    main()
