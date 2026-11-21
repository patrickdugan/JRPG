#!/usr/bin/env python3
"""Verify and import the optional painted image ZIP into a JRPG checkout."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
TARGET=ROOT/'game'/'assets'/'art'/'hd-painted-v1'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def install(source,check=False):
    source=Path(source)
    if (source/'assets'/'manifest.json').is_file():
        source=source/'assets'
    manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('schema')!='bbc-hd-painted/1' or len(manifest.get('actors',{}))!=12:
        raise ValueError('Expected 12 HD character records')
    items=[('manifest.json',source/'manifest.json')]
    for actor,record in manifest['actors'].items():
        if not actor.replace('-','').isalnum():
            raise ValueError('Unsafe actor id: '+actor)
        rel='sheets/'+actor+'.png'
        if record['file']!=rel or record['width']!=2304 or record['height']!=384:
            raise ValueError('Invalid sprite geometry for '+actor)
        art=source/rel
        if not art.is_file() or sha(art)!=record['sha256']:
            raise ValueError('Missing or corrupt sprite for '+actor)
        items.append((rel,art))
    if not check:
        for name,src in items:
            dst=TARGET/name
            dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(src,dst)
            if sha(dst)!=sha(src):
                raise IOError('Imported image checksum changed: '+name)
    print(json.dumps({'ok':True,'checkOnly':check,'atlases':len(items)-1,'target':str(TARGET)},indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('package',type=Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    install(args.package,args.check)
