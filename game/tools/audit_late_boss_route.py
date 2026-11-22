#!/usr/bin/env python3
"""Audit the genuine rendered-control Chapter 3-9 route receipt.

Consumes browser-route-playthrough.py JSON. Every boss is counted only when
the existing browser driver has recorded a VICTORY through visible controls.
A simulated lab, tactical rollback, or incomplete route cannot pass this gate.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

EXPECTED_LATE_BOSSES = (
    ("c3-captain-kaji", "captainkaji"),
    ("c4-widow-of-fog", "widowoffog"),
    ("c5-furnace-abbot", "furnaceabbot"),
    ("c6-ujiro", "ujiro"),
    ("c7-bell-warden-chiyo", "bellwardenchiyo"),
    ("c8-lady-enma", "ladyenma"),
    ("c9-yearless-bell", "yearlessbell"),
    ("c9-kurozane", "kurozane"),
)


def normalized(text: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def audit_route(receipt: dict) -> dict:
    if not isinstance(receipt, dict):
        raise TypeError("A browser-route-playthrough JSON object is required")
    battles = receipt.get("actionBattles", [])
    if not isinstance(battles, list):
        raise TypeError("actionBattles must be an array of rendered-control victories")
    named = [
        {
            "encounter": str(b.get("encounter", "")),
            "durationSeconds": b.get("durationSeconds"),
            "simulatedSeconds": b.get("simulatedSeconds"),
            "restarts": b.get("restarts"),
            "objective": b.get("objective"),
        }
        for b in battles if isinstance(b, dict)
    ]
    matches = {}
    for encounter_id, fragment in EXPECTED_LATE_BOSSES:
        matches[encounter_id] = [
            b for b in named if fragment in normalized(b["encounter"])
        ]
    missing = [key for key, hits in matches.items() if not hits]
    route_status = receipt.get("status")
    canonical = receipt.get("battleMode") == "canonical-action"
    credits = route_status in ("complete", "journey-complete")
    passed = canonical and credits and not missing
    return {
        "schema": "jrpg-late-boss-rendered-route-audit/1",
        "source": "browser-route-playthrough.py control-only receipt",
        "routeMode": receipt.get("routeMode"),
        "battleMode": receipt.get("battleMode"),
        "routeStatus": route_status,
        "creditsOutcome": receipt.get("creditsOutcome"),
        "blocker": receipt.get("blocker"),
        "expectedLateBosses": len(EXPECTED_LATE_BOSSES),
        "lateBossVictoryCount": len(EXPECTED_LATE_BOSSES) - len(missing),
        "missingLateBossVictories": missing,
        "lateBossVictories": matches,
        "totalActionBattleVictories": len(named),
        "allLateBossesWonThroughRenderedControls": not missing and canonical,
        "routeReachedCredits": credits,
        "humanArtApproval": "pending",
        "humanComprehension": "not tested",
        "fiveHourDurationProof": "not established by automated route result",
        "passed": passed,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    try:
        report = audit_route(json.loads(args.input.read_text()))
    except (ValueError, OSError, TypeError) as error:
        print(json.dumps({"error": str(error), "input": str(args.input)}))
        return 2
    result = json.dumps(report, indent=2) + "\n"
    print(result)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result)
    return 1 if args.require_complete and not report["passed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
