#!/usr/bin/env python3
"""Verify four Git-chunked premium JRPG boss archives before visual candidate import.

Only existing Git blobs and SHA-256-verified original archives may be imported.
This script has no network access and never modifies the game simulation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile

REPO = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = REPO / "assets/art/hd-boss-binary-import-v2/manifest.json"
BOSSES = ("captain-kaji", "widow-of-fog", "furnace-abbot", "ujiro")
SCHEMA = "jrpg-hd-boss-binary-archives/2"


def git_blob_sha(blob: bytes) -> str:
    return hashlib.sha1(f"blob {len(blob)}\0".encode() + blob).hexdigest()


def validate_receipts(meta: dict) -> dict:
    if meta.get("schema") != SCHEMA or sorted(meta.get("packages", {})) != sorted(BOSSES):
        raise ValueError("Wrong archive manifest schema or canonical boss IDs")
    if sorted(meta.get("expectedBosses", [])) != sorted(BOSSES):
        raise ValueError("Canonical boss coverage changed")
    for boss in BOSSES:
        entry = meta["packages"][boss]
        archive = entry["archive"]
        if not isinstance(archive, str) or not archive.endswith(".zip") or pathlib.PurePath(archive).name != archive:
            raise ValueError(f"Unsafe ZIP archive name: {boss}")
        if not isinstance(entry.get("sha256"), str) or len(entry["sha256"]) != 64:
            raise ValueError(f"Missing archive SHA-256: {boss}")
        chunks = entry.get("parts")
        if not isinstance(chunks, list) or len(chunks) not in range(1, 32):
            raise ValueError(f"Missing chunk receipts: {boss}")
        total = 0
        for n, chunk in enumerate(chunks):
            expected = f"assets/art/hd-boss-binary-import-v2/{boss}/part-{n:02d}.bin"
            if chunk.get("path") != expected:
                raise ValueError(f"Unexpected path or order: {boss}/{n}")
            size = chunk.get("bytes")
            if not isinstance(size, int) or not 0 < size <= 1_500_000:
                raise ValueError(f"Chunk exceeds 1.5 MB: {boss}/{n}")
            if not isinstance(chunk.get("gitBlobSHA1"), str) or len(chunk["gitBlobSHA1"]) != 40:
                raise ValueError(f"Missing Git blob SHA-1: {boss}/{n}")
            total += size
        if total != entry.get("bytes") or total > 100_000_000:
            raise ValueError(f"Archive size or sum mismatch: {boss}")
    return {"bosses": len(BOSSES), "chunks": sum(len(m["parts"]) for m in meta["packages"].values()),
            "bytes": sum(m["bytes"] for m in meta["packages"].values())}


def hydrate(*, out_dir: pathlib.Path | None = None, require_complete: bool = False,
            import_check: bool = False) -> dict:
    meta = json.loads(MANIFEST.read_text(encoding="utf-8"))
    counts = validate_receipts(meta)
    if require_complete and not meta.get("readyForImport"):
        raise ValueError("Review archive transfer still in progress")
    complete = []
    missing = []
    for boss in BOSSES:
        entry = meta["packages"][boss]
        chunks = []
        for chunk in entry["parts"]:
            file = REPO / chunk["path"]
            if not file.is_file():
                missing.append(chunk["path"])
                continue
            data = file.read_bytes()
            if len(data) != chunk["bytes"] or git_blob_sha(data) != chunk["gitBlobSHA1"]:
                raise ValueError(f"Corrupt chunk: {chunk['path']}")
            chunks.append(data)
        if len(chunks) != len(entry["parts"]):
            continue
        archive = b"".join(chunks)
        if len(archive) != entry["bytes"] or hashlib.sha256(archive).hexdigest() != entry["sha256"]:
            raise ValueError(f"Original ZIP byte hash mismatch: {boss}")
        with zipfile.ZipFile(__import__("io").BytesIO(archive)) as z:
            bad = z.testzip()
            if bad: raise ValueError(f"Bad ZIP member: {boss}: {bad}")
            manifests = [p for p in z.namelist() if p.endswith("assets/manifest.json")]
            if len(manifests) != 1: raise ValueError(f"Expected one key manifest: {boss}")
            source = json.loads(z.read(manifests[0]))
            if set(source.get("actors", {})) != {boss}: raise ValueError(f"Boss identity mismatch: {boss}")
        if out_dir:
            out_dir.mkdir(parents=True, exist_ok=True)
            target = out_dir / entry["archive"]
            target.write_bytes(archive)
            if import_check:
                subprocess.run([sys.executable, str(REPO / "game/tools/import-hd-boss-pack.py"),
                                str(target), "--repo", str(REPO), "--check"], cwd=REPO, check=True)
        complete.append({"boss": boss, "bytes": len(archive), "parts": len(chunks),
                         "sha256": entry["sha256"]})
    if meta.get("readyForImport") and missing:
        raise ValueError(f"Manifest declared ready with {len(missing)} missing chunks")
    if require_complete and (missing or len(complete) != len(BOSSES)):
        raise ValueError(f"Missing {len(missing)} parts, completed {len(complete)} bosses")
    return {**counts, "readyForImport": meta.get("readyForImport"),
            "verified": complete, "missingParts": missing}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract-dir", type=pathlib.Path)
    ap.add_argument("--require-complete", action="store_true")
    ap.add_argument("--import-check", action="store_true")
    args = ap.parse_args()
    if args.import_check and not args.extract_dir: ap.error("--import-check requires --extract-dir")
    print(json.dumps(hydrate(out_dir=args.extract_dir, require_complete=args.require_complete,
                             import_check=args.import_check), indent=2))


if __name__ == "__main__":
    main()
