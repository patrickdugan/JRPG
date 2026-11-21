#!/usr/bin/env python3
"""Verify every committed source-derived image, 24 decoded cells and wave byte cap."""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build import ASSET_ROOT, GROUPS, CLIPS

def sha_file(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def verify():
    art=json.loads((ASSET_ROOT/"manifest.json").read_text(encoding="utf8"))
    motion=json.loads((ASSET_ROOT/"motion-manifest.json").read_text(encoding="utf8"))
    allids=[id for _,batch in GROUPS for id in batch]
    assert len(set(allids))==16 and set(art["actors"])==set(allids)==set(motion["actors"])
    assert art["schema"]=="bbc-hd-painted/1" and art["frameCount"]==6
    assert motion["schema"]=="bbc-hd-motion/2"
    assert motion["motionClipCount"]==160 and motion["frameTotal"]==3840
    summary={}
    for label,batch in GROUPS:
        bytes_=0
        for id in batch:
            actor=art["actors"][id]
            base=ASSET_ROOT/actor["file"]
            assert base.is_file() and sha_file(base)==actor["sha256"]
            key=Image.open(base)
            assert key.size==(2304,384) and key.mode=="RGBA"
            assert all(key.crop((384*i,0,384*(i+1),384)).getchannel("A").getbbox() for i in range(6)),id
            record=motion["actors"][id]
            assert record["sourceSheetSha256"]==actor["sha256"]
            assert record["sourceFile"]==actor["file"]
            assert set(record["clipSet"])==set(CLIPS)
            bytes_+=base.stat().st_size
            for name,entry in record["clipSet"].items():
                p=ASSET_ROOT/entry["path"]
                assert p.is_file() and sha_file(p)==entry["sha256"]
                image=Image.open(p).convert("RGBA")
                assert image.size==(2304,384)
                assert entry["frames"]==24 and entry["uniqueFrames"]==24
                hashes=[]
                for i in range(24):
                    cell=image.crop(((i%12)*192,(i//12)*192,(i%12+1)*192,(i//12+1)*192))
                    assert cell.getchannel("A").getbbox(),(id,name,i)
                    hashes.append(hashlib.sha256(cell.tobytes()).hexdigest())
                assert hashes==entry["frameRGBAsha256"],(id,name,"decoded RGBA mismatch")
                assert len(set(hashes))==24,(id,name,"duplicate frames")
                bytes_+=p.stat().st_size
        assert bytes_<90*1024*1024,(label,"batch exceeds 90 MiB",bytes_)
        summary[label]={"actors":len(batch),"clips":len(batch)*10,"frames":len(batch)*240,"bytes":bytes_}
    print(json.dumps({"ok":True,"actors":16,"clips":160,"frames":3840,"groups":summary},indent=2))
    return summary

if __name__=="__main__":
    verify()
