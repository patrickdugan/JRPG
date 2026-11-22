#!/usr/bin/env python3
"""Prepare exactly two approved-for-testing HD windup clips in an isolated opt-in lane.

Regenerate both candidates from SHA-verified original paintings, compare their
WebP bytes and decoded RGBA hashes with the already audited PR #26 receipts,
and install into reviewed-motion/ without overwriting any canonical art.

The release preview requires ?art=hd&motion=reviewed. The boss-wide art
approval remains pending, including unreplaced active/recovery clips.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("game/assets/art/hd-painted-v1/reviewed-motion")
SCHEMA = "jrpg-reviewed-hd-windup/1"
# Byte identities from the independently passed PR #26 GitHub Actions artifact.
EXPECTED = {
    "yearless-bell": {
        "candidate": "914bf7f42c7535f18e91177a29e5f6b6e7415e796739fe98e51c717c992e07e1",
        "source": "3ccd3009bc336bacbfcd820f0d2935233e212eef4475f18fc360ffc9458f1e6b",
        "originalWindup": "07bafe1a11b547ab12de96b7f6bd930743cdc7d357f88461a6624e278b94c48f",
        "originalActive": "0670bdbab23442e18b4792478a39b70d493ac0f8a55169b0219a59d0713602c3",
    },
    "lady-enma": {
        "candidate": "2c2e18d0486c4f10aa9d73f6c8d6ea13b85bde80bf7bc678b5d9786bbffc1a47",
        "source": "7e96c5eb829def0e7ffc6e62668afc8c0879e3818bd7a1aaa5c5e0f75da86ceb",
        "originalWindup": "43a4c93aa7ecf5501a415ad18fb7503ec598c7e4c7cc52212afd212d70896987",
        "originalActive": "a0ba3881265546018e6c7715596063c6ceb7fd589446bf5b9953649258d9e046",
    },
}


def hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def render(root: Path, directory: Path):
    script = root / "game/tools/hd-boss-active-effect-leadin.py"
    subprocess.run(
        [sys.executable, str(script), "--root", str(root),
         "--output-dir", str(directory)],
        cwd=root, check=True, stdout=subprocess.DEVNULL,
    )
    return read_json(directory / "effect-leadin-receipts.json")


def candidate_entries(root: Path, directory: Path) -> tuple[dict, dict[str, bytes]]:
    key_art = read_json(root / "game/assets/art/hd-painted-v1/manifest.json")
    motion = read_json(root / "game/assets/art/hd-painted-v1/motion-manifest.json")
    roster = read_json(root / "assets/art/roster-keystone/roster.json")
    previous = render(root, directory)
    if previous.get("candidateCount") != 2 or set(previous.get("bosses", {})) != set(EXPECTED):
        raise ValueError("Unexpected candidate coverage from PR #26 generator")
    entries, binaries = {}, {}
    for boss, pinned in EXPECTED.items():
        rows = [x for x in roster["identities"]
                if x.get("kind") == "named-boss" and x.get("id") == boss]
        if len(rows) != 1 or rows[0]["visualApproval"] != "pending" or not rows[0]["assetInGit"]:
            raise ValueError("Boss-level review gate changed: " + boss)
        art = key_art["actors"][boss]
        actor = motion["actors"][boss]
        original = actor["clipSet"]["windup"]
        active = actor["clipSet"]["active"]
        if art["sha256"] != pinned["source"] or actor["sourceSheetSha256"] != pinned["source"]:
            raise ValueError("Six-key source art changed: " + boss)
        if original["sha256"] != pinned["originalWindup"] or active["sha256"] != pinned["originalActive"]:
            raise ValueError("Source phase clip changed: " + boss)
        old_png = root / "game/assets/art/hd-painted-v1" / art["file"]
        old_webp = root / "game/assets/art/hd-painted-v1" / original["path"]
        active_webp = root / "game/assets/art/hd-painted-v1" / active["path"]
        for filename, expected in (
            (old_png, pinned["source"]),
            (old_webp, pinned["originalWindup"]),
            (active_webp, pinned["originalActive"]),
        ):
            if hash_bytes(filename.read_bytes()) != expected:
                raise ValueError("Original painted artifact bytes changed: " + str(filename))
        rel = f"reviewed-motion/{boss}/windup.webp"
        generated = directory / f"{boss}-windup-effect-leadin.webp"
        data = generated.read_bytes()
        receipt = previous["bosses"][boss]
        if hash_bytes(data) != pinned["candidate"] or receipt["leadInWebPSha256"] != pinned["candidate"]:
            raise ValueError("Generated candidate differs from PR #26 audited bytes: " + boss)
        if receipt["immutableActiveSha256"] != pinned["originalActive"]:
            raise ValueError("Original release source identity changed: " + boss)
        hashes = receipt["decodedFrameHashes"]
        if len(hashes) != 24 or len(set(hashes)) != 24:
            raise ValueError("Invalid candidate decoded frame receipts: " + boss)
        with Image.open(generated) as img:
            image = img.convert("RGBA")
        if image.size != (2304, 384):
            raise ValueError("Candidate WebP has invalid 12x2 geometry: " + boss)
        for index in range(24):
            x, y = (index % 12) * 192, (index // 12) * 192
            if hash_bytes(image.crop((x, y, x + 192, y + 192)).tobytes()) != hashes[index]:
                raise ValueError(f"Decoded SHA-256 mismatch {boss} frame {index}")
        entries[boss] = {
            "clip": "windup",
            "path": rel,
            "sha256": pinned["candidate"],
            "frameRGBAsha256": hashes,
            "sourceSheetSha256": pinned["source"],
            "originalWindupSha256": pinned["originalWindup"],
            "originalActiveSha256": pinned["originalActive"],
            "sourcePose": original["sourcePose"],
            "frameMs": original["frameMs"],
            "foot": original["foot"],
            "frames": 24,
            "columns": 12,
            "rows": 2,
            "cell": [192, 192],
            "width": 2304,
            "height": 384,
            "optIn": "art=hd&motion=reviewed",
            "acceptance": "user-approved-clip-trial",
            "bossVisualApproval": "pending",
        }
        binaries[rel] = data
    document = {
        "schema": SCHEMA,
        "source": "PR #26 effect anticipation CI, source-reproduced",
        "baseline": "game/assets/art/hd-painted-v1/motion-manifest.json",
        "mode": "explicit opt-in windup-only",
        "bossCount": 2,
        "clipCount": 2,
        "frameCount": 48,
        "defaultRuntime": "canonical source motion",
        "visualApproval": "pending for all seven complete boss packages",
        "entries": entries,
    }
    return document, binaries


def write_checked(path: Path, bytes_to_write: bytes) -> None:
    if path.exists() and hash_bytes(path.read_bytes()) != hash_bytes(bytes_to_write):
        raise ValueError("Existing reviewed-motion payload is divergent: " + str(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(bytes_to_write)


def prepare(root: Path, install: bool) -> dict:
    root = root.resolve()
    with tempfile.TemporaryDirectory(prefix="jrpg-reviewed-windup-") as temp:
        document, binaries = candidate_entries(root, Path(temp))
        if install:
            for relative, contents in binaries.items():
                write_checked(root / "game/assets/art/hd-painted-v1" / relative, contents)
            target = root / OUT / "manifest.json"
            data = (json.dumps(document, indent=2, ensure_ascii=False) + "\n").encode()
            write_checked(target, data)
        print(json.dumps({
            "installation": "installed" if install else "verified-without-writing",
            "schema": SCHEMA,
            "clips": [
                {"boss": boss, "sha256": entry["sha256"], "frames": 24,
                 "frameMs": entry["frameMs"]}
                for boss, entry in document["entries"].items()
            ],
            "originalSourcesUnchanged": True,
            "bossVisualApproval": "pending",
        }, indent=2))
    return document


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--install", action="store_true",
                        help="write only into the isolated reviewed-motion directory")
    args = parser.parse_args()
    prepare(args.root, args.install)
