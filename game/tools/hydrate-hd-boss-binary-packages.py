#!/usr/bin/env python3
"""Verify and reconstruct Git-committed, chunked painted boss review ZIPs.

The zip chunks are each <=1.5 MB, intentionally allowing authenticated
GitHub app uploads. Once all three premium review packs are present, the
workflow may import them with the repo's existing conservative boss importer.
"""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, subprocess, sys, zipfile

REPO=pathlib.Path(__file__).resolve().parents[2]
MANIFEST=REPO/'assets/art/hd-boss-binary-import-v1/manifest.json'

def git_blob_sha(data: bytes)->str:
    return hashlib.sha1(b'blob '+str(len(data)).encode('ascii')+b'\0'+data).hexdigest()

def verify_packages(*, output_dir: pathlib.Path|None=None, require_complete: bool=False):
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('schema')!='jrpg-hd-boss-binary-archives/1':
        raise ValueError('Unknown binary archive manifest')
    packages=manifest.get('packages',{})
    if require_complete and (
        not manifest.get('readyForImport') or
        set(packages)!={'lady-enma','bell-warden-chiyo','yearless-bell'}):
        raise ValueError('Three premium boss archives must be committed before import')
    rows=[]
    for boss in sorted(packages):
        record=packages[boss]
        payload=[]
        if not record.get('parts'):raise ValueError('Missing parts: '+boss)
        for part in record['parts']:
            rel=pathlib.PurePosixPath(part['path'])
            if rel.is_absolute() or '..' in rel.parts or not str(rel).startswith('assets/art/hd-boss-binary-import-v1/'):
                raise ValueError('Unsafe chunk path')
            data=(REPO/pathlib.Path(*rel.parts)).read_bytes()
            if len(data)!=part['bytes'] or len(data)>1_500_000 or git_blob_sha(data)!=part['gitBlobSHA1']:
                raise ValueError('Chunk byte count / Git SHA mismatch: '+str(rel))
            payload.append(data)
        archive=b''.join(payload)
        if len(archive)!=record['bytes'] or hashlib.sha256(archive).hexdigest()!=record['sha256']:
            raise ValueError('Assembled ZIP size / SHA mismatch: '+boss)
        if output_dir is not None:
            output_dir.mkdir(parents=True,exist_ok=True)
            target=output_dir/record['archive']
            if target.name != record['archive'] or not target.name.endswith('.zip') or '/' in target.name:
                raise ValueError('Unsafe archive name')
            target.write_bytes(archive)
            with zipfile.ZipFile(target) as z:
                bad=z.testzip()
                if bad:raise ValueError('Corrupt ZIP member: '+bad)
        rows.append({'boss':boss,'bytes':len(archive),'parts':len(payload),
                     'sha256':record['sha256']})
    return {'ok':True,'count':len(rows),'readyForImport':manifest.get('readyForImport'),
            'archives':rows}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--extract-dir',type=pathlib.Path)
    ap.add_argument('--require-complete',action='store_true')
    ap.add_argument('--import-check',action='store_true',
                    help='Run the existing strict PNG/WebP importer --check on reconstructed archives')
    args=ap.parse_args()
    if args.import_check and not args.extract_dir:
        ap.error('--import-check requires --extract-dir')
    result=verify_packages(output_dir=args.extract_dir,require_complete=args.require_complete)
    if args.import_check:
        for pack in result['archives']:
            record=json.loads(MANIFEST.read_text())['packages'][pack['boss']]
            command=[sys.executable,str(REPO/'game/tools/import-hd-boss-pack.py'),
                     str(args.extract_dir/record['archive']),'--repo',str(REPO),'--check']
            subprocess.run(command,cwd=REPO,check=True)
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
