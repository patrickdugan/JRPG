"""SVG cel identity, contract, source geometry and raster smoke tests."""
import hashlib
import io
import json
import subprocess
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import build
import geometry

CAST = json.loads((ROOT/"cast.json").read_text(encoding="utf-8"))
SVG = "{http://www.w3.org/2000/svg}"

class VectorSuiteTests(unittest.TestCase):
    def test_cast_matches_existing_roster_and_boss_contracts(self):
        build.validate_sources()
        self.assertEqual(len(CAST["cast"]),62)
        self.assertEqual(len({x["id"] for x in CAST["cast"]}),62)
        self.assertEqual(set(x["group"] for x in CAST["cast"]),{
            "party","enemy-v2","enemy-v3-human","enemy-v3-beast",
            "enemy-v3-plant","boss-state","boss","npc"})

    def test_69_sheets_cover_686_cells(self):
        outputs=build.build()
        evidence=build.validate_generated({k:v for k,v in outputs.items() if k.startswith("sheets/")})
        self.assertEqual(evidence["svgSheets"],69)
        self.assertEqual(evidence["allPoseCells"],686)
        receipt=json.loads(outputs["manifest.json"])
        self.assertEqual(receipt["generatedCellCount"],686)
        self.assertEqual(len(receipt["exports"]),69)
        self.assertEqual(receipt["imageEmbeds"],0)

    def test_all_frames_have_transparent_editable_body_parts(self):
        for a in CAST["cast"]:
            variant="field" if a["group"]=="npc" else "action"
            text=build.strip(a,variant)
            root=ET.fromstring(text)
            self.assertEqual(root.attrib["data-cell-size"],"144,160")
            self.assertEqual(root.attrib["data-art-source"],"code-authored-vector")
            frames=[x for x in root if x.attrib.get("data-pose")]
            self.assertEqual(len(frames),2 if a["group"]=="npc" else 13)
            for frame in frames:
                parts=list(frame.iter(SVG+"g"))
                self.assertTrue(any(x.attrib.get("data-part") for x in parts),a["id"])
                self.assertGreaterEqual(len(list(frame.iter(SVG+"path"))),2,a["id"])
            self.assertNotIn("<image",text.lower())
            self.assertNotIn("<foreignObject",text)
            self.assertNotIn("data:image",text)

    def test_party_directional_views_are_distinct_and_flip_natively(self):
        for a in CAST["cast"]:
            if a["group"]!="party":continue
            root=ET.fromstring(build.strip(a,"field"))
            frames=[x for x in root if x.attrib.get("data-pose")]
            self.assertEqual([x.attrib["data-pose"] for x in frames],list(geometry.FIELD_POSES))
            west=build.standalone(a,"west-idle","field")
            north=build.standalone(a,"north-idle","field")
            south=build.standalone(a,"south-idle","field")
            self.assertIn('scale(-1 1)',west)
            self.assertNotEqual(north,south)

    def test_named_heroes_bosses_and_odd_creatures_get_specific_rigs(self):
        actors={a["id"]:a for a in CAST["cast"]}
        for name in ("nikola-drazanic","mateus","kurozane-oni-armor","lady-enma",
                     "yearless-bell","silk-jorogumo","spider-lily-ambusher"):
            self.assertIn(name,actors)
            data=build.standalone(actors[name],"signature")
            self.assertIn("signature",data)
            self.assertGreater(len(data),900)
        self.assertIn('data-part="petal"', build.standalone(actors["spider-lily-ambusher"],"active"))
        self.assertIn('data-part="held-equipment"',build.standalone(actors["nikola-drazanic"],"idle-a"))

    def test_binary_blobs_rebuild_deterministically(self):
        receipt=build.build()
        first=hashlib.sha256(receipt["sheets/ren-action.svg"].encode()).hexdigest()
        second=hashlib.sha256(build.build()["sheets/ren-action.svg"].encode()).hexdigest()
        self.assertEqual(first,second)
        self.assertTrue(first==json.loads(receipt["manifest.json"])["exports"][0]["sha256"])

    def test_svg_rendered_poses_have_visible_unique_pixels(self):
        try:
            import cairosvg
            from PIL import Image, ImageChops
        except ImportError:
            self.skipTest("Install cairosvg and pillow for PNG visibility test")
        cast={a["id"]:a for a in CAST["cast"]}
        for name in ("nikola-drazanic","mateus","kurozane-oni-armor","cinder-hound",
                     "silk-jorogumo","spider-lily-ambusher","yearless-bell"):
            actor=cast[name]
            images=[]
            for pose in ("idle-a","windup","active","signature","defeat"):
                svg=build.standalone(actor,pose).encode("utf-8")
                raster=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg))).convert("RGBA")
                self.assertEqual(raster.size,(144,160))
                alpha=raster.getchannel("A")
                bounds=alpha.getbbox()
                self.assertIsNotNone(bounds,(name,pose))
                self.assertGreater(bounds[2]-bounds[0],15,(name,pose))
                self.assertGreater(bounds[3]-bounds[1],20,(name,pose))
                images.append(raster)
            unique=set(im.tobytes() for im in images)
            self.assertGreaterEqual(len(unique),4,name)

if __name__=="__main__":
    unittest.main(verbosity=2)
