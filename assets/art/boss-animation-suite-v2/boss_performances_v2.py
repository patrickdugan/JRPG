#!/usr/bin/env python3
"""Registry of v2 boss performances (cast modules), rigs, and secondary-motion passes."""

from __future__ import annotations

from boss_cast_creature_v2 import CAST as CREATURES, SECONDARY as CREATURE_SECONDARY
from boss_cast_humanoid_v2 import CAST as HUMANOIDS
from boss_motion_v2 import humanoid_secondary
from boss_rigs_creature_v2 import bell_frame, enma_frame, furnace_frame, quadruped_frame, widow_frame
from boss_rigs_v2 import humanoid_frame

RIGS = {
    "humanoid": humanoid_frame,
    "quadruped": quadruped_frame,
    "widow": widow_frame,
    "enma": enma_frame,
    "furnace": furnace_frame,
    "bell": bell_frame,
}
PERFORMANCES: dict[str, dict] = {**HUMANOIDS, **CREATURES}
SECONDARY = {"humanoid": humanoid_secondary}
for boss_id, apply in CREATURE_SECONDARY.items():
    PERFORMANCES[boss_id]["secondary"] = apply
