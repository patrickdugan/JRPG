from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "roster-animation-runtime.source.json"
MANIFEST_PATH = ROOT / "manifest.json"


def sha256_path(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    coverage = json.loads((ROOT / "roster-animation-coverage-v1.json").read_text(encoding="utf-8"))
    errors: list[str] = []

    party = source["party"]
    triggers = source["enemyTriggers"]
    if len(party["characters"]) != 7:
        errors.append(f"expected 7 party characters, found {len(party['characters'])}")
    if len(triggers["entries"]) != 32:
        errors.append(f"expected 32 enemy/boss trigger rows, found {len(triggers['entries'])}")
    if len({entry["id"] for entry in party["characters"] + triggers["entries"]}) != 39:
        errors.append("roster IDs are not unique across all 39 entries")

    output_by_path = {record["path"]: record for record in manifest["outputs"]}
    expected_png = {
        "party-combat-animation-atlas-v1.png": ((1920, 448), {0, 255}),
        "party-combat-animation-contact-sheet-v1.png": ((896, 1050), {255}),
        "enemy-encounter-trigger-atlas-v1.png": ((576, 1536), {0, 255}),
        "enemy-encounter-trigger-contact-sheet-v1.png": ((960, 736), {255}),
    }
    for filename, (size, alpha_values) in expected_png.items():
        path = ROOT / filename
        image = Image.open(path).convert("RGBA")
        if image.size != size:
            errors.append(f"{filename} has size {image.size}, expected {size}")
        if set(image.getchannel("A").getdata()) != alpha_values:
            errors.append(f"{filename} alpha policy drifted")
        if sha256_path(path) != output_by_path[filename]["sha256"]:
            errors.append(f"{filename} hash does not match manifest")

    party_frames = manifest["party"]["frames"]
    enemy_frames = manifest["enemyTriggers"]["frames"]
    if len(party_frames) != 7 * 40:
        errors.append(f"expected 280 party frame records, found {len(party_frames)}")
    if len(enemy_frames) != 32 * 12:
        errors.append(f"expected 384 enemy trigger records, found {len(enemy_frames)}")

    for character in party["characters"]:
        records = [record for record in party_frames if record["characterId"] == character["id"]]
        if len(records) != 40:
            errors.append(f"{character['id']} has {len(records)} party frames")
        events = [record["event"] for record in records if record["event"]]
        if events.count("damage") != 1 or events.count("skill-a") != 1 or events.count("skill-b") != 1:
            errors.append(f"{character['id']} attack events are not exactly once per damaging clip")
        for record in records:
            bounds = record["visibleBounds"]
            if bounds and (bounds[0] < 1 or bounds[2] > 47):
                errors.append(f"{record['id']} violates the one-pixel horizontal gutter")
            if record["visibleColors"] > 16:
                errors.append(f"{record['id']} exceeds the 16-color party frame ceiling")

    for enemy in triggers["entries"]:
        records = [record for record in enemy_frames if record["enemyId"] == enemy["id"]]
        if len(records) != 12:
            errors.append(f"{enemy['id']} has {len(records)} trigger frames")
        events = [record["event"] for record in records if record["event"]]
        if events != ["encounter-alert", "encounter-contact"]:
            errors.append(f"{enemy['id']} trigger events are not alert then contact exactly once")
        if any(record["visibleColors"] > 19 for record in records):
            errors.append(f"{enemy['id']} exceeds the 19-color trigger-frame ceiling")

    if manifest["party"]["rowOrder"] != [entry["id"] for entry in party["characters"]]:
        errors.append("party row order drifted from source")
    if manifest["enemyTriggers"]["rowOrder"] != [entry["id"] for entry in triggers["entries"]]:
        errors.append("enemy trigger row order drifted from source")
    if not coverage["coverageComplete"]:
        errors.append("coverage receipt does not report complete")
    if coverage["party"]["animated"] != 7 or coverage["enemyEncounterTriggers"]["animated"] != 32:
        errors.append("coverage counts drifted")

    expected_gifs = [
        *(f"previews/{character['id']}-all-combat-clips-v1.gif" for character in party["characters"]),
        "enemy-encounter-trigger-motion-preview-v1.gif",
    ]
    for filename in expected_gifs:
        path = ROOT / filename
        image = Image.open(path)
        expected_frames = 48 if filename.startswith("previews/") else 12
        if getattr(image, "n_frames", 1) != expected_frames:
            errors.append(f"{filename} has {getattr(image, 'n_frames', 1)} GIF frames, expected {expected_frames}")
        if sha256_path(path) != output_by_path[filename]["sha256"]:
            errors.append(f"{filename} hash does not match manifest")

    for record in manifest["sources"]:
        if sha256_path(ROOT / record["path"]) != record["sha256"]:
            errors.append(f"source snapshot hash drifted: {record['path']}")

    if errors:
        raise SystemExit("Roster animation runtime verification failed:\n" + "\n".join(errors))
    print(
        "Roster animation verification passed: 7/7 party characters with 8 clips and 40 frames each, "
        "32/32 enemy/boss states with 6 encounter-trigger clips and 12 frames each, exact damage/alert/"
        "contact events, binary-alpha runtime atlases, deterministic source snapshots, and complete coverage."
    )


if __name__ == "__main__":
    main()
