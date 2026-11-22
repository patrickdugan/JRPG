"""Regression cases for the Chapter 3-9 route completion auditor."""
import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("audit_late_boss_route.py")
SPEC = importlib.util.spec_from_file_location("late_boss_route_audit", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = module
SPEC.loader.exec_module(module)


def receipt():
    return {
        "status": "journey-complete",
        "creditsOutcome": "journey-finished",
        "routeMode": "narrative-selected-route",
        "battleMode": "canonical-action",
        "actionBattles": [
            {"encounter": name.replace("-", " ").title(), "durationSeconds": 11.0,
             "simulatedSeconds": 50.0, "restarts": 0}
            for _id, name in module.EXPECTED_LATE_BOSSES
        ],
    }


class RouteAuditTests(unittest.TestCase):
    def test_all_eight_rendered_victories_and_journey_credits(self):
        report = module.audit_route(receipt())
        self.assertTrue(report["passed"])
        self.assertEqual(report["lateBossVictoryCount"], 8)
        self.assertTrue(report["routeReachedCredits"])
        self.assertEqual(report["humanArtApproval"], "pending")

    def test_missing_rescue_boss_defeats_gate(self):
        record = receipt()
        record["actionBattles"] = [
            b for b in record["actionBattles"]
            if "Chiyo" not in b["encounter"]
        ]
        report = module.audit_route(record)
        self.assertFalse(report["passed"])
        self.assertEqual(report["missingLateBossVictories"], ["c7-bell-warden-chiyo"])

    def test_legacy_and_incomplete_routes_cannot_claim_canonical_completion(self):
        record = receipt()
        record["battleMode"] = "legacy-tactical"
        self.assertFalse(module.audit_route(record)["passed"])
        record["battleMode"] = "canonical-action"
        record["status"] = "bounded"
        record["blocker"] = {"code": "scene-limit"}
        self.assertFalse(module.audit_route(record)["passed"])

    def test_rejects_invalid_receipt(self):
        with self.assertRaises(TypeError):
            module.audit_route({"actionBattles": {}})
        self.assertEqual(module.normalized("Widow-of-Fog"), "widowoffog")


if __name__ == "__main__":
    unittest.main()
