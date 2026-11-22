#!/usr/bin/env python3
"""Validate and import a six-key painted boss ZIP into JRPG in <90 MiB Git batches.

 python game/tools/import-hd-boss-pack.py path/to/Boss.zip --check
 python game/tools/import-hd-boss-pack.py path/to/Boss.zip --commit --push

The package's source and motion are review candidates. This importer never
changes the fixed-step combat engine, boss phase director or hitboxes.
"""
from __future__ import annotations
import argparse, hashlib, io, json, os, re, subprocess, tempfile, zipfile
from pathlib import Path
from PIL import Image

SCHEMA='bbc-hd-painted/1'
MOTION='bbc-hd-motion/2'
ID=re.compile(r'[a-z][a-z0-9-]{0,50}\Z')
CLIPS=frozenset(['idle','locomotion','windup','active','recovery','guard','hurt','defeat','signature','stagger'])
MAX_COMMIT_BYTES=90*1024*1024
SHA=lambda data:hashlib.sha256(data).hexdigest()

class CandidateError(ValueError):pass
def readjson(data):return json.loads(data.decode('utf-8'))

def load_package(z):
    names=[n for n in z.namelist() if n.endswith('assets/manifest.json')]
    if len(names)!=1:raise CandidateError('Expected exactly one package assets/manifest.json')
    prefix=names[0][:-len('assets/manifest.json')]
    if any(n.startswith('/') or '..' in Path(n).parts or '\\' in n for n in z.namelist()):
        raise CandidateError('Unsafe ZIP paths')
    def asset(path):
        full=prefix+'assets/'+path
        try:return z.read(full)
        except KeyError:raise CandidateError('Missing package asset '+path) from None
    keys=readjson(asset('manifest.json'))
    motion=readjson(asset('motion-manifest.json'))
    if keys.get('schema')!=SCHEMA or keys.get('frameCount')!=6 or len(keys.get('actors',{}))!=1:
        raise CandidateError('Invalid six-key manifest')
    if motion.get('schema')!=MOTION or motion.get('sourceSchema')!=SCHEMA or motion.get('frameCount')!=24 or len(motion.get('actors',{}))!=1:
        raise CandidateError('Invalid motion manifest')
    ident,record=next(iter(keys['actors'].items()))
    if not ID.fullmatch(ident) or set(motion['actors'])!={ident} or record.get('group')!='enemy':
        raise CandidateError('Invalid or mismatched enemy identity')
    if record['file']!=f'sheets/{ident}.png' or [record.get('width'),record.get('height')]!=[2304,384] or len(record.get('poses',[]))!=6:
        raise CandidateError('Invalid sprite atlas geometry')
    atlas=asset(record['file'])
    if SHA(atlas)!=record['sha256'] or Image.open(io.BytesIO(atlas)).size!=(2304,384):
        raise CandidateError('Painted key atlas corrupted')
    motionactor=motion['actors'][ident]
    if motionactor['group']!='enemy' or motionactor['sourceSheetSha256']!=record['sha256'] or motionactor['sourceFile']!=record['file']:
        raise CandidateError('Motion metadata does not match painted source')
    if set(motionactor['clipSet'])!=CLIPS or motion['motionClipCount']!=10 or motion['frameTotal']!=240:
        raise CandidateError('Expected exactly ten 24-frame motion clips')
    output={record['file']:atlas}
    for name,clip in motionactor['clipSet'].items():
        path=f'motion/{ident}/{name}.webp'
        if clip['path']!=path or clip['frames']!=24 or clip['columns']!=12 or clip['rows']!=2 or clip['width']!=2304 or clip['height']!=384 or clip['cell']!=[192,192]:
            raise CandidateError('Clip geometry failed: '+name)
        data=asset(path)
        if SHA(data)!=clip['sha256']:raise CandidateError('Clip hash mismatch: '+name)
        im=Image.open(io.BytesIO(data)).convert('RGBA')
        if im.size!=(2304,384):raise CandidateError('Decoded dimensions mismatch: '+name)
        cells=[]
        for i in range(24):
            x=(i%12)*192;y=(i//12)*192
            cells.append(SHA(im.crop((x,y,x+192,y+192)).tobytes()))
        if cells!=clip['frameRGBAsha256'] or len(set(cells))!=24:
            raise CandidateError('Frame hash mismatch or duplicate: '+name)
        output[path]=data
    review={}
    receipt='intake.json'
    intake=None
    if prefix+receipt in z.namelist():
        data=z.read(prefix+receipt)
        intake=readjson(data)
        if intake.get('bossId')!=ident or intake.get('sixKeyAtlasSha256')!=record['sha256']:
            raise CandidateError('Review intake mismatches source')
        review[f'assets/art/hd-painted-boss-review-v1/{ident}/intake.json']=data
    raw=(intake or {}).get('sourceFile') or f'sources/{ident}-six-poses-original.png'
    if not (isinstance(raw,str) and raw.startswith('sources/')
            and raw.endswith('.png') and '..' not in Path(raw).parts
            and '/' not in raw[len('sources/'):]):
        raise CandidateError('Unsafe or missing review source path')
    if prefix+raw in z.namelist():
        source_bytes=z.read(prefix+raw)
        if intake and intake.get('sourceSha256') and SHA(source_bytes)!=intake['sourceSha256']:
            raise CandidateError('Review source SHA mismatch')
        # Retain accurate source filename: comparison boards remain labeled
        # as comparisons rather than misidentified full-resolution paintings.
        review[f'assets/art/hd-painted-boss-review-v1/{ident}/{Path(raw).name}']=source_bytes
    elif intake and intake.get('sourceSha256'):
        raise CandidateError('Declared source absent from review package')
    return ident,record,motionactor,output,review

def dump(data):return (json.dumps(data,indent=2,ensure_ascii=False)+'\n').encode('utf-8')

def safe_write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as w:
        w.write(data);w.flush();os.fsync(w.fileno());tmp=Path(w.name)
    os.replace(tmp,path)

def import_package(pack,repo,*,apply=False,commit=False,push=False):
    pack=Path(pack);repo=Path(repo)
    if not pack.is_file():raise CandidateError('Missing ZIP '+str(pack))
    with zipfile.ZipFile(pack) as z:
        ident,rec,mot,output,review=load_package(z)
    root=repo/'game/assets/art/hd-painted-v1'
    keypath=root/'manifest.json';motionpath=root/'motion-manifest.json'
    origkey=readjson(keypath.read_bytes()) if keypath.exists() else {'schema':SCHEMA,'frameCount':6,'actors':{}}
    origmotion=readjson(motionpath.read_bytes()) if motionpath.exists() else {'schema':MOTION,'sourceSchema':SCHEMA,'frameCount':24,'motionClipCount':0,'frameTotal':0,'actors':{}}
    if origkey.get('schema')!=SCHEMA or origmotion.get('schema')!=MOTION:
        raise CandidateError('Target manifests have incompatible schemas')
    if ident in origkey['actors'] and origkey['actors'][ident]!=rec:
        raise CandidateError('Divergent existing six-key manifest for '+ident)
    if ident in origmotion['actors'] and origmotion['actors'][ident]!=mot:
        raise CandidateError('Divergent existing motion manifest for '+ident)
    key=dict(origkey);key['actors']={**origkey['actors'],ident:rec}
    motion=dict(origmotion);motion['actors']={**origmotion['actors'],ident:mot}
    motion['motionClipCount']=sum(len(a['clipSet']) for a in motion['actors'].values())
    motion['frameTotal']=motion['motionClipCount']*24
    files={str(Path('game/assets/art/hd-painted-v1')/r):data for r,data in output.items()}
    files.update(review)
    files['game/assets/art/hd-painted-v1/manifest.json']=dump(key)
    files['game/assets/art/hd-painted-v1/motion-manifest.json']=dump(motion)
    if commit:
        staged=subprocess.check_output(['git','diff','--cached','--name-only'],cwd=repo,text=True).strip()
        if staged:raise CandidateError('Pre-existing staged changes must be committed separately')
        head=subprocess.check_output(['git','branch','--show-current'],cwd=repo,text=True).strip()
        if not head or head in {'main','master'}:
            raise CandidateError('Refusing Git import to default/detached branch')
        ledgerfile=repo/'assets/art/roster-keystone/roster.json'
        if not ledgerfile.is_file():raise CandidateError('Missing Roster Keystone')
        ledger=readjson(ledgerfile.read_bytes())
        records=[row for row in ledger['identities'] if row.get('id')==ident]
        if len(records)!=1 or records[0].get('kind')!='named-boss':
            raise CandidateError('Boss is missing from canonical Roster Keystone')
        row=records[0]
        row['assetInGit']=True
        row['paintedKeyArt']='candidate-in-Git'
        row['sixKeyCelSheet']='candidate-in-Git'
        row['hdMotion24']='candidate-in-Git'
        row['engineIntegrated']='optional-hd-mode'
        row['visualApproval']='pending'
        files['assets/art/roster-keystone/roster.json']=dump(ledger)
        intake=repo/('assets/art/roster-keystone/'+ident+'-hd-intake.json')
        if intake.is_file():
            record=readjson(intake.read_bytes())
            if record.get('bossId')!=ident:raise CandidateError('Canonical intake boss mismatch')
            record['binarySourceInGit']=True
            record['gitImport']={'status':'candidate-imported','visualApproval':'pending'}
            files[str(intake.relative_to(repo))]=dump(record)
    total=sum(map(len,files.values()))
    if total>=MAX_COMMIT_BYTES:raise CandidateError('Too large for one Git commit: '+str(total))
    for rel,data in files.items():
        p=repo/rel
        if p.exists() and SHA(p.read_bytes())!=SHA(data):
            if rel not in ('game/assets/art/hd-painted-v1/manifest.json','game/assets/art/hd-painted-v1/motion-manifest.json') and not (commit and rel.startswith('assets/art/roster-keystone/')):
                raise CandidateError('Existing art conflicts: '+rel)
    summary={'id':ident,'clips':10,'frames':240,'gitBatchBytes':total,'files':len(files),
             'applied':bool(apply),'sourceInZip':bool(review)}
    if not apply:return summary
    for rel,data in files.items():
        if not (repo/rel).is_file() or (repo/rel).read_bytes()!=data:safe_write(repo/rel,data)
    if commit:
        subprocess.run(['git','add','--',*sorted(files)],cwd=repo,check=True)
        diff=subprocess.run(['git','diff','--cached','--quiet'],cwd=repo)
        if diff.returncode not in (0,1):
            raise CandidateError('Could not inspect staged Git diff')
        if diff.returncode==1:
            subprocess.run(['git','commit','-m',f'art: import {ident} six-key HD body and 240 motion cells'],cwd=repo,check=True)
        if push:subprocess.run(['git','push','origin','HEAD'],cwd=repo,check=True)
        summary['branch']=head;summary['committed']=True;summary['pushed']=bool(push)
    return summary

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('zip',type=Path)
    ap.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2])
    ap.add_argument('--check',action='store_true',help='validate and dry-run without writes')
    ap.add_argument('--commit',action='store_true',help='make an individual <90 MiB Git commit')
    ap.add_argument('--push',action='store_true',help='push to the selected branch')
    a=ap.parse_args()
    if a.push and not a.commit:ap.error('--push requires --commit')
    print(json.dumps(import_package(a.zip,a.repo,apply=not a.check,commit=a.commit,push=a.push),indent=2))

if __name__=='__main__':main()
