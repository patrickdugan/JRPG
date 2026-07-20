#!/usr/bin/env python3
"""Bounded, player-control-only browser attempt of the canonical Campaign route.

The driver starts with the rendered New Game button and uses only DOM controls
that a player can reach.  It deliberately does not seed, edit, or delete web
storage and does not invoke game transition functions through JavaScript.
"""

from __future__ import annotations

import argparse
import functools
import json
import re
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright
except ImportError as error:  # pragma: no cover
    raise SystemExit(
        "Install the optional QA dependency with: python -m pip install playwright"
    ) from error


GAME_DIR = Path(__file__).resolve().parents[1]
CHROMIUM_CANDIDATES = (
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe",
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)
POSITION_PATTERN = re.compile(r"space\s+(\d+),(\d+)", re.IGNORECASE)
VITALS_PATTERN = re.compile(r"HP\s+(\d+)/(\d+)")

DIRECTIONS = (
    ("0,-1", "0,1"),
    ("1,0", "-1,0"),
    ("0,1", "0,-1"),
    ("-1,0", "1,0"),
    ("1,-1", "-1,1"),
    ("1,1", "-1,-1"),
    ("-1,1", "1,-1"),
    ("-1,-1", "1,1"),
)

BATTLE_DIRECTIONS = (
    ("q", (-1, -1)), ("w", (0, -1)), ("e", (1, -1)),
    ("a", (-1, 0)), ("d", (1, 0)),
    ("z", (-1, 1)), ("s", (0, 1)), ("c", (1, 1)),
)
BATTLE_KEY_BY_DELTA = {delta: key for key, delta in BATTLE_DIRECTIONS}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


class RouteBlocked(RuntimeError):
    def __init__(self, code: str, message: str, **details: object) -> None:
        super().__init__(message)
        self.code = code
        self.details = details


def accept_player_dialog(dialog: object) -> None:
    """Accept native controls, preserving a prompt's player-visible default choice."""
    if dialog.type == "prompt":
        dialog.accept(dialog.default_value)
    else:
        dialog.accept()


@dataclass
class Budget:
    deadline: float
    max_scenes: int
    max_field_moves_per_scene: int
    max_battle_commands: int

    def check(self, checkpoint: str) -> None:
        if time.monotonic() >= self.deadline:
            raise RouteBlocked("time-budget", "The bounded route-attempt time budget expired.", checkpoint=checkpoint)


class PlayerDriver:
    def __init__(self, page: Page, budget: Budget) -> None:
        self.page = page
        self.budget = budget
        self.controls = 0
        self.field_moves = 0
        self.battle_commands = 0
        self.camp_controls = 0
        self.scenes: list[dict[str, object]] = []
        self.last_position: tuple[int, int] | None = None

    def click(self, selector: str, *, timeout: int = 10_000) -> None:
        self.page.locator(selector).click(timeout=timeout)
        self.controls += 1

    def on_battle_page(self) -> bool:
        return (
            urlparse(self.page.url).path.endswith("battle.html")
            or self.page.locator("#battleStateBadge").count() > 0
        )

    def on_credits_page(self) -> bool:
        return urlparse(self.page.url).path.endswith("credits.html")

    def seal_credits(self) -> None:
        self.page.locator("#creditsStatus").wait_for()
        route_proof = self.page.locator("#routeProof").inner_text()
        if not route_proof.startswith("215/215 ") or "credits gate ready" not in route_proof:
            raise RouteBlocked(
                "credits-route-gate",
                "Credits were reached before the rendered intended-route gate was ready.",
                routeProof=route_proof,
            )
        seal = self.page.locator("#sealCredits")
        if not seal.is_disabled():
            seal.click()
            self.controls += 1
        for _ in range(40):
            if self.page.locator("#creditsStatus").get_attribute("data-state") == "sealed":
                break
            self.page.wait_for_timeout(50)
        status = self.page.locator("#creditsStatus").inner_text()
        if not status.startswith("Credits complete · receipt sealed"):
            raise RouteBlocked(
                "credits-seal",
                "The rendered credits control did not seal the clean-run receipt.",
                creditsStatus=status,
            )

    def export_credits_evidence(self, target: Path) -> dict[str, object]:
        export = self.page.locator("#exportEvidence")
        if export.is_disabled():
            raise RouteBlocked("evidence-export", "The rendered playtest-evidence export remained disabled after credits sealed.")
        with self.page.expect_download() as download_info:
            export.click()
        self.controls += 1
        download = download_info.value
        download.save_as(str(target))
        return {
            "path": str(target),
            "suggestedFilename": download.suggested_filename,
            "renderedControl": True,
        }

    def scene_key(self) -> str:
        if self.on_battle_page():
            return "__BATTLE__"
        try:
            return " | ".join(
                self.page.locator(selector).inner_text().strip()
                for selector in ("#chapterTitle", "#sceneNumber", "#sceneTitle")
            )
        except PlaywrightTimeoutError:
            if self.on_battle_page():
                return "__BATTLE__"
            raise

    def checkpoint(self) -> dict[str, object]:
        path = urlparse(self.page.url).path.rsplit("/", 1)[-1]
        if path == "credits.html":
            return {
                "page": path,
                "creditsStatus": self.page.locator("#creditsStatus").inner_text(),
                "creditsProof": self.page.locator("#creditsProof").inner_text(),
                "routeProof": self.page.locator("#routeProof").inner_text(),
                "creditsAction": self.page.locator("#sealCredits").inner_text(),
                "creditsHint": self.page.locator("#creditsActionHint").inner_text(),
            }
        if path == "battle.html" or self.on_battle_page():
            return {
                "page": path,
                "encounter": self.page.locator("#encounterTitle").inner_text(),
                "battleState": self.page.locator("#battleStateBadge").inner_text(),
                "objective": self.page.locator("#objectiveProgress").inner_text(),
                "lastLog": self.page.locator("#resultLog").inner_text()[-800:],
            }
        if path == "camp.html":
            return {
                "page": path,
                "feedback": self.page.locator("#campFeedback").inner_text(),
                "url": self.page.url,
            }
        return {
            "page": path,
            "scene": self.scene_key(),
            "dialogue": self.page.locator("#dialogueProgress").inner_text(),
            "fieldObjective": self.page.locator("#fieldObjective").inner_text(),
            "fieldProgress": self.page.locator("#fieldProgress").inner_text(),
            "fieldFeedback": self.page.locator("#fieldFeedback").inner_text(),
            "interaction": self.page.locator("#interactField").inner_text(),
            "nextScene": self.page.locator("#nextScene").inner_text(),
            "route": self.page.locator("#routeSummary").inner_text(),
            "routeStatus": self.page.locator("#routeStatus").inner_text(),
            "runProof": self.page.locator("#runProofStatus").inner_text(),
        }

    def position(self) -> tuple[int, int]:
        map_canvas = self.page.locator("#mapCanvas")
        field_x = map_canvas.get_attribute("data-field-x")
        field_y = map_canvas.get_attribute("data-field-y")
        if field_x is not None and field_y is not None:
            self.last_position = int(field_x), int(field_y)
            return self.last_position
        text = self.page.locator("#fieldFeedback").inner_text()
        match = POSITION_PATTERN.search(text)
        if not match:
            if self.last_position is not None:
                return self.last_position
            raise RouteBlocked(
                "position-unobservable",
                "The rendered field feedback did not expose the current exact space.",
                feedback=text,
            )
        self.last_position = int(match.group(1)), int(match.group(2))
        return self.last_position

    def story_operation_target(self) -> tuple[str, tuple[int, int]] | None:
        canvas = self.page.locator("#mapCanvas")
        node_id = canvas.get_attribute("data-story-operation-node-id")
        target_x = canvas.get_attribute("data-story-operation-x")
        target_y = canvas.get_attribute("data-story-operation-y")
        if node_id is None or target_x is None or target_y is None:
            return None
        return node_id, (int(target_x), int(target_y))

    def route_marker_target(self) -> tuple[str, str, str, tuple[int, int]] | None:
        canvas = self.page.locator("#mapCanvas")
        marker_type = canvas.get_attribute("data-route-marker-type")
        marker_id = canvas.get_attribute("data-route-marker-id")
        owner_id = canvas.get_attribute("data-route-marker-owner-id")
        target_x = canvas.get_attribute("data-route-marker-x")
        target_y = canvas.get_attribute("data-route-marker-y")
        if None in (marker_type, marker_id, owner_id, target_x, target_y):
            return None
        return marker_type, marker_id, owner_id, (int(target_x), int(target_y))

    def field_objective_target(self) -> tuple[str, str, tuple[int, int], int] | None:
        canvas = self.page.locator("#mapCanvas")
        target_type = canvas.get_attribute("data-field-objective-target-type")
        target_id = canvas.get_attribute("data-field-objective-target-id")
        target_x = canvas.get_attribute("data-field-objective-target-x")
        target_y = canvas.get_attribute("data-field-objective-target-y")
        target_range = canvas.get_attribute("data-field-objective-target-range")
        if None in (target_type, target_id, target_x, target_y, target_range):
            return None
        return target_type, target_id, (int(target_x), int(target_y)), int(target_range)

    def navigate_to_exact_target(
        self,
        target: tuple[int, int],
        scene_key: str,
        *,
        interaction_range: int = 0,
        max_steps: int = 700,
    ) -> None:
        visits: dict[tuple[int, int], int] = {}
        blocked_edges: set[tuple[tuple[int, int], str]] = set()
        vectors = {
            "-1,-1": (-1, -1), "0,-1": (0, -1), "1,-1": (1, -1),
            "-1,0": (-1, 0), "1,0": (1, 0),
            "-1,1": (-1, 1), "0,1": (0, 1), "1,1": (1, 1),
        }
        for _ in range(max_steps):
            self.budget.check("exact story-operation navigation")
            here = self.position()
            if max(abs(here[0] - target[0]), abs(here[1] - target[1])) <= interaction_range:
                return
            visits[here] = visits.get(here, 0) + 1
            candidates = sorted(
                vectors.items(),
                key=lambda item: (
                    max(abs(target[0] - here[0] - item[1][0]), abs(target[1] - here[1] - item[1][1]))
                    + 3 * visits.get((here[0] + item[1][0], here[1] + item[1][1]), 0),
                    visits.get((here[0] + item[1][0], here[1] + item[1][1]), 0),
                    item[0],
                ),
            )
            moved = False
            for vector, _delta in candidates:
                if (here, vector) in blocked_edges:
                    continue
                after = self.move(vector)
                if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                    return
                if after == here:
                    blocked_edges.add((here, vector))
                    continue
                moved = True
                break
            if not moved:
                raise RouteBlocked(
                    "operation-target-unreachable",
                    "Every rendered movement control from the current tile was blocked before reaching the published operation target.",
                    current=here,
                    target=target,
                )
        raise RouteBlocked(
            "operation-target-step-budget",
            "The published story-operation target was not reached within the rendered-movement step budget.",
            current=self.position(),
            target=target,
            stepBudget=max_steps,
        )

    def finish_published_route_markers(self, scene_key: str) -> None:
        prior_signature: tuple[str, str, str, tuple[int, int], str] | None = None
        repeated_signature = 0
        for _ in range(180):
            published = self.route_marker_target()
            if not published:
                return
            marker_type, marker_id, owner_id, target = published
            self.navigate_to_exact_target(
                target,
                scene_key,
                interaction_range=1 if marker_type == "side-story" else 0,
            )
            if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                return
            choices = self.page.locator("#witnessChoiceDeck button")
            if choices.count() and choices.first.is_visible():
                choices.first.click()
                self.controls += 1
            interaction = self.page.locator("#interactField")
            label = interaction.inner_text().strip()
            expected = (
                label.startswith("Hear testimony")
                or label.startswith("Record witness stage")
                or label.startswith("Enter chronicle battle")
                or label.startswith("Advance side story")
            )
            if interaction.is_disabled() or not expected:
                raise RouteBlocked(
                    "route-marker-mismatch",
                    "The published witness or side-story coordinate was reached but its rendered interaction was unavailable.",
                    markerType=marker_type,
                    markerId=marker_id,
                    ownerId=owner_id,
                    target=target,
                    current=self.position(),
                    interaction=label,
                )
            signature = (marker_type, marker_id, owner_id, target, label)
            repeated_signature = repeated_signature + 1 if signature == prior_signature else 0
            prior_signature = signature
            if repeated_signature >= 20:
                raise RouteBlocked(
                    "route-marker-no-progress",
                    "A rendered route-marker interaction repeated without changing its stable state.",
                    markerType=marker_type,
                    markerId=marker_id,
                    interaction=label,
                )
            interaction.click()
            self.controls += 1
            if self.on_battle_page():
                return
        raise RouteBlocked("route-marker-loop", "More than 180 route-marker interactions occurred without leaving the field activity.")

    def finish_published_story_operations(self, scene_key: str) -> None:
        for _ in range(12):
            published = self.story_operation_target()
            if not published:
                return
            node_id, target = published
            self.navigate_to_exact_target(target, scene_key)
            if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                return
            interaction = self.page.locator("#interactField")
            if interaction.is_disabled() or "story operation" not in interaction.inner_text():
                raise RouteBlocked(
                    "operation-target-mismatch",
                    "The published operation coordinate was reached but its rendered interaction was unavailable.",
                    nodeId=node_id,
                    target=target,
                    interaction=interaction.inner_text(),
                )
            interaction.click()
            self.controls += 1
            if self.on_battle_page():
                return
        raise RouteBlocked("operation-node-loop", "More than 12 operation-node transitions occurred in one scene.")

    def advance_story_if_ready(self) -> bool:
        """Use the rendered scene control as soon as the current gate opens."""
        next_scene = self.page.locator("#nextScene")
        if next_scene.is_disabled():
            return False
        next_scene.click()
        self.controls += 1
        return True

    def launch_pending_battle_if_ready(self) -> bool:
        """Launch only a rendered pending encounter, never an enabled grind replay."""
        launch = self.page.locator("#launchBattle")
        if launch.get_attribute("aria-disabled") == "true":
            return False
        if not launch.inner_text().strip().startswith("Enter encounter:"):
            return False
        launch.click()
        self.controls += 1
        self.page.wait_for_url("**/battle.html**")
        return True

    def finish_published_field_objectives(self, scene_key: str) -> bool:
        for _ in range(30):
            # Completing a field interaction can enable story advancement while
            # leaving the previous target rendered briefly. Always honor the
            # newly enabled player control before considering that target again.
            if self.advance_story_if_ready():
                return True
            # A pending authored encounter is part of the scene gate. It is safe
            # to prioritize over unrelated fieldwork; an enabled grind replay is
            # deliberately excluded by launch_pending_battle_if_ready().
            if self.launch_pending_battle_if_ready():
                return True
            published = self.field_objective_target()
            if not published:
                return False
            target_type, target_id, target, interaction_range = published
            self.navigate_to_exact_target(target, scene_key, interaction_range=interaction_range)
            if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                return True
            if self.field_objective_target() != published:
                continue
            interaction = self.page.locator("#interactField")
            label = interaction.inner_text().strip()
            expected = label.startswith("Interact:") if target_type == "interaction" else label.startswith("Use exit")
            if interaction.is_disabled() or not expected:
                raise RouteBlocked(
                    "field-objective-target-mismatch",
                    "The published field objective target was reached but its rendered interaction was unavailable.",
                    targetType=target_type,
                    targetId=target_id,
                    target=target,
                    current=self.position(),
                    interaction=label,
                )
            interaction.click()
            self.controls += 1
            if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                return True
            if self.advance_story_if_ready():
                return True
            if self.launch_pending_battle_if_ready():
                return True
            if self.page.locator("#routeDueList [data-route-activity-id]").count():
                self.drain_due_route_work(scene_key)
                if self.on_battle_page() or self.scene_key() != scene_key:
                    return True
                if self.advance_story_if_ready():
                    return True
                if self.launch_pending_battle_if_ready():
                    return True
            after_published = self.field_objective_target()
            if after_published == published:
                feedback = self.page.locator("#fieldFeedback").inner_text().strip()
                normalized_feedback = feedback.casefold()
                requirement_missing = " requires " in normalized_feedback
                no_progress = (
                    normalized_feedback.startswith("exit locked:")
                    or normalized_feedback.startswith("interaction unavailable:")
                    or "was already completed" in normalized_feedback
                    or "no interaction is within" in normalized_feedback
                )
                if not requirement_missing and not no_progress:
                    # Some exits and encounter-adjacent objectives retain one
                    # stable published target across several legitimate
                    # rendered movement/interaction attempts. The outer bound
                    # remains authoritative unless the UI explicitly reports
                    # that no progress is possible.
                    continue
                blocker_code = (
                    "field-objective-requirement-missing"
                    if requirement_missing
                    else "field-objective-no-progress"
                )
                blocker_message = (
                    "The rendered field objective still requires unavailable story progress."
                    if requirement_missing
                    else "The rendered field objective did not change after one player interaction."
                )
                raise RouteBlocked(
                    blocker_code,
                    blocker_message,
                    targetType=target_type,
                    targetId=target_id,
                    target=target,
                    feedback=feedback,
                    noProgressFeedback=no_progress,
                )
        raise RouteBlocked("field-objective-loop", "More than 30 published field objective transitions occurred in one scene.")

    def finish_dialogue_and_choices(self) -> None:
        dialogue = self.page.locator("#continueDialogue")
        for _ in range(500):
            if dialogue.is_disabled():
                break
            dialogue.click()
            self.controls += 1
        else:
            raise RouteBlocked("dialogue-loop", "Dialogue did not reach its rendered terminal state.")

        choices = self.page.locator("[data-choice-id]")
        for index in range(choices.count()):
            choice = choices.nth(index)
            if not choice.is_disabled() and "is-picked" not in (choice.get_attribute("class") or ""):
                choice.click()
                self.controls += 1

    def move(self, vector: str) -> tuple[int, int]:
        before = self.position()
        self.page.locator(f'[data-field-move="{vector}"]').click()
        self.controls += 1
        self.field_moves += 1
        self.page.wait_for_timeout(50)
        if self.on_battle_page():
            return before
        return self.position()

    def interact_if_productive(self) -> bool:
        button = self.page.locator("#interactField")
        if button.is_disabled():
            return False
        label = button.inner_text().strip()
        productive = (
            "story operation" in label
            or label.startswith("Interact:")
            or label.startswith("Advance side story")
            or label.startswith("Hear testimony")
            or label.startswith("Record witness stage")
            or label.startswith("Enter chronicle battle")
        )
        if not productive:
            return False
        button.click()
        self.controls += 1
        return True

    def explore_field_once(self, scene_key: str) -> tuple[int, int]:
        visited: set[tuple[int, int]] = set()
        start = self.position()
        moved_at_start = self.field_moves

        def walk() -> bool:
            self.budget.check("field exploration")
            if self.field_moves - moved_at_start >= self.budget.max_field_moves_per_scene:
                raise RouteBlocked(
                    "field-move-budget",
                    "The scene exceeded the bounded rendered-movement budget.",
                    scene=scene_key,
                    moves=self.field_moves - moved_at_start,
                )
            here = self.position()
            visited.add(here)
            if self.interact_if_productive():
                return True
            if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                return True
            for vector, reverse in DIRECTIONS:
                before = self.position()
                after = self.move(vector)
                if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                    return True
                if after == before:
                    continue
                if after not in visited and walk():
                    return True
                if self.position() != before:
                    restored = self.move(reverse)
                    if restored != before:
                        # Some authored terrain is directional. End this sweep
                        # at the newly rendered space and begin a fresh graph
                        # walk instead of assuming every edge is reversible.
                        return True
            return False

        walk()
        return start

    def use_ready_exit(self, scene_key: str) -> bool:
        visited: set[tuple[int, int]] = set()

        def walk() -> bool:
            self.budget.check("route exit search")
            here = self.position()
            visited.add(here)
            interaction = self.page.locator("#interactField")
            if not interaction.is_disabled() and interaction.inner_text().startswith("Use exit"):
                interaction.click()
                self.controls += 1
                return True
            for vector, reverse in DIRECTIONS:
                before = self.position()
                after = self.move(vector)
                if urlparse(self.page.url).path.endswith("battle.html") or self.scene_key() != scene_key:
                    return True
                if after == before:
                    continue
                if after not in visited and walk():
                    return True
                if self.position() != before:
                    restored = self.move(reverse)
                    if restored != before:
                        return False
            return False

        return walk()

    def finish_camp_entry(self) -> None:
        focused = self.page.locator(".is-route-focus")
        stage_selectors = ("#campConversationStage", "#partyCouncilStage", "#archiveRecordStage")
        stage_already_open = any(self.page.locator(selector).is_visible() for selector in stage_selectors)
        if focused.count() == 1 and not focused.is_disabled():
            focused.click()
            self.controls += 1
            self.camp_controls += 1
        elif not stage_already_open:
            raise RouteBlocked(
                "camp-entry-unavailable",
                "The Campaign route link exposed neither a usable focus nor an already-open Camp stage.",
                url=self.page.url,
                focusedCount=focused.count(),
            )
        stages = (
            ("#advanceCampConversation", "#campConversationChoices button"),
            ("#advancePartyCouncil", "#partyCouncilChoices button"),
            ("#advanceArchiveRecord", None),
        )
        for advance_selector, choice_selector in stages:
            advance = self.page.locator(advance_selector)
            if not advance.is_visible():
                continue
            for _ in range(160):
                choices = self.page.locator(choice_selector) if choice_selector else None
                usable_choice = choices and choices.count() and choices.first.is_visible()
                if usable_choice:
                    choices.first.click()
                elif not advance.is_disabled():
                    advance.click()
                else:
                    break
                self.controls += 1
                self.camp_controls += 1
            else:
                raise RouteBlocked("camp-entry-loop", "A focused Camp entry did not terminate.", url=self.page.url)
            break
        else:
            raise RouteBlocked("camp-stage-missing", "The focused Camp entry opened no rendered stage.")
        self.rest_party_if_needed()
        self.return_from_camp()

    def rest_party_if_needed(self) -> bool:
        damaged = False
        members = self.page.locator("#campPartyList [data-member-id]")
        for index in range(members.count()):
            member = members.nth(index)
            if member.is_disabled():
                continue
            member.click()
            self.controls += 1
            self.camp_controls += 1
            match = VITALS_PATTERN.search(self.page.locator("#memberVitals").inner_text())
            damaged = damaged or bool(match and int(match.group(1)) < int(match.group(2)))
        if damaged:
            rest = self.page.locator("#restParty")
            if rest.is_disabled():
                raise RouteBlocked("camp-rest-unavailable", "The party was damaged but the rendered rest control was unavailable.")
            rest.click()
            self.controls += 1
            self.camp_controls += 1
            feedback = self.page.locator("#campFeedback").inner_text().lower()
            if "rested at" not in feedback:
                if "already rested" not in feedback or not self.use_remedies_for_damaged_party():
                    raise RouteBlocked(
                        "camp-rest-rejected",
                        "The damaged party could not complete a rendered Camp rest or Remedy use.",
                        feedback=self.page.locator("#campFeedback").inner_text(),
                    )
            return True
        return False

    def use_remedies_for_damaged_party(self) -> bool:
        filter_button = self.page.locator('[data-inventory-filter="consumable"]')
        if not filter_button.is_visible() or filter_button.is_disabled():
            return False
        filter_button.click()
        self.controls += 1
        self.camp_controls += 1
        used = False
        members = self.page.locator("#campPartyList [data-member-id]")
        for index in range(members.count()):
            member = members.nth(index)
            if member.is_disabled():
                continue
            member.click()
            self.controls += 1
            self.camp_controls += 1
            for _ in range(8):
                match = VITALS_PATTERN.search(self.page.locator("#memberVitals").inner_text())
                if not match or int(match.group(1)) >= int(match.group(2)):
                    break
                remedies = self.page.locator("#inventoryList [data-use-item]")
                if remedies.count() == 0:
                    return used
                remedies.first.click()
                self.controls += 1
                self.camp_controls += 1
                used = True
        return used

    def return_from_camp(self) -> None:
        self.page.locator('a[href="campaign.html"]').first.click(no_wait_after=True)
        self.controls += 1
        self.page.wait_for_url("**/campaign.html")
        self.page.locator("#sceneTitle").wait_for()

    def recover_after_battle(self) -> None:
        self.page.locator('a[href="camp.html"]').first.click()
        self.controls += 1
        self.page.wait_for_url("**/camp.html")
        self.page.locator("#campFeedback").wait_for()
        self.rest_party_if_needed()
        self.return_from_camp()

    def start_due_entries(self) -> None:
        for _ in range(30):
            due = self.page.locator("[data-route-activity-id]")
            if due.count() == 0:
                return
            activity_type = due.first.get_attribute("data-route-activity-type")
            due.first.click()
            self.controls += 1
            if urlparse(self.page.url).path.endswith("camp.html"):
                self.page.locator("#campFeedback").wait_for()
                self.finish_camp_entry()
                continue
            # Quest and witness entries use their rendered list control to accept
            # and travel. Their field objectives are completed by the normal map
            # traversal before the story frontier closes.
            if activity_type not in ("finite-sidequest", "repeat-grind-milestone", "witness-chronicle"):
                raise RouteBlocked("unknown-route-entry", "A route entry exposed an unknown player workflow.", activityType=activity_type)
            return
        raise RouteBlocked("route-entry-loop", "The due-entry list did not converge after 30 rendered entries.")

    def drain_due_route_work(self, scene_key: str) -> None:
        """Alternate frontier entry and its published fieldwork until both clear."""
        for _ in range(30):
            self.start_due_entries()
            if self.on_battle_page():
                return
            self.finish_published_route_markers(scene_key)
            if self.on_battle_page():
                return
            due = self.page.locator("#routeDueList [data-route-activity-id]")
            after_due = due.first.get_attribute("data-route-activity-id") if due.count() else None
            after_marker = self.route_marker_target()
            if after_due is None and after_marker is None:
                return
            # A multi-map quest legitimately keeps the same activity ID while
            # completing one objective and publishing its next destination.
            # Re-enter it through the rendered ledger until the activity or
            # marker actually converges; the outer hard bound catches a true
            # no-progress loop without abandoning a valid cross-map route.
        raise RouteBlocked("route-work-loop", "Due route entries and their published fieldwork did not converge.")

    def return_to_story_route_if_available(self) -> None:
        button = self.page.locator("#returnStoryRoute")
        if button.count() and button.is_visible() and not button.is_disabled():
            button.click()
            self.controls += 1
            self.page.locator("#mapCanvas[data-field-state]").wait_for()

    def battle_control_state(self) -> tuple[str, tuple[int, int], str | None, tuple[int, int] | None]:
        canvas = self.page.locator("#battleCanvas")
        actor_id = canvas.get_attribute("data-active-actor-id")
        actor_x = canvas.get_attribute("data-active-actor-x")
        actor_y = canvas.get_attribute("data-active-actor-y")
        action = canvas.get_attribute("data-objective-action")
        target_x = canvas.get_attribute("data-objective-target-x")
        target_y = canvas.get_attribute("data-objective-target-y")
        if actor_id is None or actor_x is None or actor_y is None:
            raise RouteBlocked(
                "battle-position-unobservable",
                "The rendered COMMAND state did not expose the active actor's exact simulation tile.",
            )
        target = None if target_x is None or target_y is None else (int(target_x), int(target_y))
        return actor_id, (int(actor_x), int(actor_y)), action, target

    def battle_combat_target(self) -> tuple[str, tuple[int, int], int] | None:
        canvas = self.page.locator("#battleCanvas")
        target_id = canvas.get_attribute("data-combat-target-id")
        target_x = canvas.get_attribute("data-combat-target-x")
        target_y = canvas.get_attribute("data-combat-target-y")
        skill_range = canvas.get_attribute("data-combat-skill-range")
        if target_id is None or target_x is None or target_y is None or skill_range is None:
            return None
        return target_id, (int(target_x), int(target_y)), int(skill_range)

    def execute_battle_suggestion(self) -> bool:
        canvas = self.page.locator("#battleCanvas")
        command = canvas.get_attribute("data-suggested-command")
        if command is None:
            return False
        if command == "move":
            dx = int(canvas.get_attribute("data-suggested-dx") or "99")
            dy = int(canvas.get_attribute("data-suggested-dy") or "99")
            key = BATTLE_KEY_BY_DELTA.get((dx, dy))
            if key is None:
                raise RouteBlocked("battle-suggestion-invalid", "The rendered battle suggestion exposed an invalid movement vector.", dx=dx, dy=dy)
            _actor_id, before, _action, _target = self.battle_control_state()
            canvas.focus()
            self.page.keyboard.press(key)
            self.controls += 1
            self.battle_commands += 1
            self.page.wait_for_timeout(30)
            if self.page.locator("#battleStateBadge").inner_text().strip() == "COMMAND":
                _next_actor, after, _action, _target = self.battle_control_state()
                if after == before:
                    raise RouteBlocked("battle-suggestion-rejected", "The rendered suggested movement did not change the active actor tile.", key=key, position=before)
            return True
        if command == "skill":
            skill_id = canvas.get_attribute("data-suggested-skill-id")
            target_id = canvas.get_attribute("data-suggested-target-id")
            if not skill_id or not target_id:
                raise RouteBlocked("battle-suggestion-invalid", "The rendered skill suggestion omitted its skill or target.")
            self.page.locator('[data-command="skill"]').click()
            self.page.locator("#skillSelect").select_option(skill_id)
            self.page.locator("#targetSelect").select_option(target_id)
            confirm = self.page.locator("#confirmCommand")
            if confirm.is_disabled():
                raise RouteBlocked("battle-suggestion-rejected", "The rendered suggested skill could not be confirmed.", skillId=skill_id, targetId=target_id)
            confirm.click()
            self.controls += 4
            self.battle_commands += 1
            self.page.wait_for_timeout(80)
            return True
        if command in ("objective", "guard"):
            self.page.locator(f'[data-command="{command}"]').click()
            confirm = self.page.locator("#confirmCommand")
            if confirm.is_disabled():
                raise RouteBlocked("battle-suggestion-rejected", "The rendered suggested command could not be confirmed.", command=command)
            confirm.click()
            self.controls += 2
            self.battle_commands += 1
            self.page.wait_for_timeout(80)
            return True
        raise RouteBlocked("battle-suggestion-invalid", "The rendered battle suggestion used an unknown command.", command=command)

    def move_battle_actor_toward(self, target: tuple[int, int]) -> bool:
        actor_id, here, _action, _published_target = self.battle_control_state()
        candidates = sorted(
            BATTLE_DIRECTIONS,
            key=lambda item: (
                max(abs(target[0] - here[0] - item[1][0]), abs(target[1] - here[1] - item[1][1])),
                item[0],
            ),
        )
        canvas = self.page.locator("#battleCanvas")
        canvas.focus()
        for key, _delta in candidates:
            self.page.keyboard.press(key)
            self.controls += 1
            self.battle_commands += 1
            self.page.wait_for_timeout(30)
            badge = self.page.locator("#battleStateBadge").inner_text().strip()
            if badge != "COMMAND":
                return True
            next_actor_id, after, _action, _target = self.battle_control_state()
            if next_actor_id != actor_id or after != here:
                return True
            last_log = self.page.locator("#resultLog li").last.inner_text() if self.page.locator("#resultLog li").count() else ""
            if "No Pace remains" in last_log or "recovering" in last_log:
                return False
        return False

    def play_battle(self) -> None:
        self.page.locator("#battleStateBadge").wait_for()
        encounter = self.page.locator("#encounterTitle").inner_text()
        commands_at_start = self.battle_commands
        while self.battle_commands - commands_at_start < self.budget.max_battle_commands:
            self.budget.check(f"battle {encounter}")
            badge = self.page.locator("#battleStateBadge").inner_text().strip()
            if badge == "VICTORY" and self.page.locator("#continueCampaign").is_visible():
                self.page.locator("#continueCampaign").click()
                self.controls += 1
                self.page.wait_for_url("**/campaign.html")
                self.page.locator("#sceneTitle").wait_for()
                self.recover_after_battle()
                return
            if badge == "DEFEAT":
                raise RouteBlocked("battle-defeat", "The rendered-control policy was defeated.", encounter=encounter)
            if badge != "COMMAND":
                self.page.wait_for_timeout(80)
                continue
            if self.page.locator('[data-command="move"]').is_disabled():
                self.page.wait_for_timeout(80)
                continue

            if self.execute_battle_suggestion():
                continue

            objective = self.page.locator('[data-command="objective"]')
            if not objective.is_disabled():
                _actor_id, here, _action, target = self.battle_control_state()
                if target is not None and here != target:
                    if self.move_battle_actor_toward(target):
                        continue
                else:
                    objective.click()
                    self.page.locator("#confirmCommand").click()
                    self.controls += 2
                    self.battle_commands += 1
                    self.page.wait_for_timeout(80)
                    continue

            _actor_id, here, _action, _objective_target = self.battle_control_state()
            combat_target = self.battle_combat_target()
            if combat_target is not None:
                target_id, target, skill_range = combat_target
                target_select = self.page.locator("#targetSelect")
                if target_select.input_value() != target_id:
                    target_select.select_option(target_id)
                    self.controls += 1
                if max(abs(here[0] - target[0]), abs(here[1] - target[1])) > skill_range:
                    if self.move_battle_actor_toward(target):
                        continue

            acted = False
            attack = self.page.locator('[data-command="attack"]')
            if not attack.is_disabled():
                prior = self.page.locator("#resultLog li").count()
                attack.click()
                confirm = self.page.locator("#confirmCommand")
                if not confirm.is_disabled():
                    confirm.click()
                    self.controls += 2
                    self.battle_commands += 1
                    self.page.wait_for_timeout(80)
                    acted = self.page.locator("#resultLog li").count() > prior
            if acted:
                continue

            guard = self.page.locator('[data-command="guard"]')
            if not guard.is_disabled():
                guard.click()
                self.page.locator("#confirmCommand").click()
                self.controls += 2
                self.battle_commands += 1
                continue
            self.page.wait_for_timeout(80)
        raise RouteBlocked(
            "battle-command-budget",
            "The rendered-control battle policy did not reach a terminal result.",
            encounter=encounter,
            commandBudget=self.budget.max_battle_commands,
            commandsUsed=self.battle_commands - commands_at_start,
        )

    def play_battle_and_resume_scene(self, scene_key: str) -> None:
        self.play_battle()
        if self.scene_key() == scene_key:
            self.finish_story_scene()

    def finish_story_scene(self) -> None:
        initial = self.scene_key()
        self.finish_dialogue_and_choices()
        self.drain_due_route_work(initial)
        if self.on_battle_page():
            self.play_battle()
            # A registered battle is one node inside the current scene
            # operation. Returning to the same scene is expected; continue
            # through its rendered post-battle acknowledgement.
            initial = self.scene_key()
        self.return_to_story_route_if_available()

        self.finish_published_story_operations(initial)
        if self.on_battle_page():
            self.play_battle_and_resume_scene(initial)
            return
        if self.page.locator("#nextScene").is_enabled():
            self.page.locator("#nextScene").click()
            self.controls += 1
            return
        if self.finish_published_field_objectives(initial):
            if self.on_battle_page():
                self.play_battle_and_resume_scene(initial)
            return

        for _ in range(12):
            self.explore_field_once(initial)
            if self.on_battle_page():
                self.play_battle_and_resume_scene(initial)
                return
            if self.scene_key() != initial:
                return
            self.finish_dialogue_and_choices()
            self.drain_due_route_work(initial)
            if self.on_battle_page():
                self.play_battle_and_resume_scene(initial)
                return
            self.return_to_story_route_if_available()
            if self.page.locator("#nextScene").is_enabled():
                self.page.locator("#nextScene").click()
                self.controls += 1
                return
            if self.finish_published_field_objectives(initial):
                if self.on_battle_page():
                    self.play_battle_and_resume_scene(initial)
                return
            progress = self.page.locator("#fieldProgress").inner_text()
            if "Story operation" not in progress:
                break

        if self.use_ready_exit(initial):
            if self.on_battle_page():
                self.play_battle_and_resume_scene(initial)
            return
        if self.launch_pending_battle_if_ready():
            self.play_battle_and_resume_scene(initial)
            return
        raise RouteBlocked(
            "scene-gate",
            "All bounded rendered-control strategies were exhausted while the scene remained gated.",
            checkpoint=self.checkpoint(),
        )


def find_chromium(explicit: str | None) -> Path:
    candidates = (Path(explicit),) if explicit else CHROMIUM_CANDIDATES
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("No installed Chrome or Edge executable was found.")


def run_attempt(chromium: Path, args: argparse.Namespace) -> dict[str, object]:
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    console_errors: list[str] = []
    page_errors: list[str] = []
    started = time.monotonic()
    evidence: dict[str, object] = {
        "policy": "rendered-controls-only; no direct storage mutation; no runtime transition calls; optional recovery uses the rendered file control",
        "chromium": str(chromium),
        "requestedSceneLimit": args.max_scenes,
        "requestedSeconds": args.max_seconds,
    }
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=not args.headed,
                executable_path=str(chromium),
                args=["--disable-extensions", "--no-first-run", "--disable-background-networking"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1200})
            page = context.new_page()
            page.set_default_timeout(15_000)
            page.set_default_navigation_timeout(45_000)
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("dialog", accept_player_dialog)
            budget = Budget(
                deadline=started + args.max_seconds - (
                    args.frontier_reserve_seconds if args.recovery_out else 0
                ),
                max_scenes=args.max_scenes,
                max_field_moves_per_scene=args.max_field_moves,
                max_battle_commands=args.max_battle_commands,
            )
            driver = PlayerDriver(page, budget)
            try:
                response = page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
                if response is None or response.status != 200:
                    raise RouteBlocked("delivery", "Campaign did not return HTTP 200.")
                if args.recovery_in:
                    recovery_in = Path(args.recovery_in).resolve()
                    with page.expect_navigation(wait_until="domcontentloaded"):
                        page.locator("#recoveryFile").set_input_files(str(recovery_in))
                    driver.controls += 1
                    evidence["recoveryImport"] = {
                        "path": str(recovery_in),
                        "recoveryOnly": True,
                        "proofClaimed": False,
                    }
                else:
                    page.locator("#resetCampaign").click()
                    driver.controls += 1
                page.locator("#sceneTitle").wait_for()
                proof_badge = page.locator("#runProofStatus")
                proof = proof_badge.inner_text()
                if proof_badge.get_attribute("data-proof") != "active":
                    raise RouteBlocked("clean-run-receipt", "The rendered start path did not expose a clean-run receipt.", runProof=proof)
                evidence["startCheckpoint"] = driver.checkpoint()

                for _ in range(args.max_scenes):
                    if args.recovery_out and time.monotonic() >= budget.deadline:
                        evidence["status"] = "bounded"
                        evidence["blocker"] = {
                            "code": "recovery-frontier",
                            "message": "The session retained its requested recovery-export reserve at a Campaign frontier.",
                            "checkpoint": driver.checkpoint(),
                        }
                        break
                    budget.check("story frontier")
                    before = driver.scene_key()
                    before_next_scene = page.locator("#nextScene").inner_text()
                    driver.finish_story_scene()
                    if driver.on_battle_page():
                        driver.play_battle_and_resume_scene(before)
                    if driver.on_credits_page():
                        driver.seal_credits()
                        if args.evidence_out:
                            evidence["playtestEvidenceExport"] = driver.export_credits_evidence(Path(args.evidence_out).resolve())
                        evidence["status"] = "complete"
                        break
                    after = driver.scene_key()
                    after_next_scene = page.locator("#nextScene").inner_text()
                    driver.scenes.append({"before": before, "after": after, "route": page.locator("#routeSummary").inner_text()})
                    if before == after:
                        if before_next_scene != after_next_scene and after_next_scene.startswith("View credits"):
                            continue
                        raise RouteBlocked("no-scene-progress", "A scene attempt returned without advancing the story.", checkpoint=driver.checkpoint())
                else:
                    evidence["status"] = "bounded"
                    evidence["blocker"] = {
                        "code": "scene-limit",
                        "message": "The requested scene limit was reached before credits.",
                        "checkpoint": driver.checkpoint(),
                    }
            except (RouteBlocked, PlaywrightTimeoutError) as error:
                evidence["status"] = "blocked"
                if isinstance(error, RouteBlocked):
                    evidence["blocker"] = {"code": error.code, "message": str(error), **error.details}
                else:
                    evidence["blocker"] = {
                        "code": "playwright-timeout",
                        "message": str(error),
                        "checkpoint": driver.checkpoint(),
                    }
            if args.recovery_out:
                recovery_out = Path(args.recovery_out).resolve()
                if urlparse(page.url).path.endswith("campaign.html"):
                    with page.expect_download() as download_info:
                        page.locator("#exportRecovery").click()
                    driver.controls += 1
                    download = download_info.value
                    download.save_as(str(recovery_out))
                    evidence["recoveryExport"] = {
                        "path": str(recovery_out),
                        "suggestedFilename": download.suggested_filename,
                        "recoveryOnly": True,
                        "proofClaimed": False,
                    }
                else:
                    evidence["recoveryExport"] = {
                        "path": str(recovery_out),
                        "recoveryOnly": True,
                        "proofClaimed": False,
                        "error": "The bounded session stopped outside Campaign, so no rendered recovery export was available.",
                    }
            evidence.update(
                {
                    "elapsedSeconds": round(time.monotonic() - started, 3),
                    "controlActivations": driver.controls,
                    "fieldMoves": driver.field_moves,
                    "battleCommands": driver.battle_commands,
                    "campControls": driver.camp_controls,
                    "sceneTransitions": driver.scenes,
                    "finalCheckpoint": driver.checkpoint(),
                    "consoleErrors": console_errors,
                    "pageErrors": page_errors,
                }
            )
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    return evidence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", help="Path to Chrome or Edge.")
    parser.add_argument("--headed", action="store_true", help="Show the browser while the bounded attempt runs.")
    parser.add_argument("--max-scenes", type=int, default=60)
    parser.add_argument("--max-seconds", type=int, default=300)
    parser.add_argument("--max-field-moves", type=int, default=4_000)
    parser.add_argument("--max-battle-commands", type=int, default=500)
    parser.add_argument("--recovery-in", help="Restore a recovery-only checkpoint through Campaign's rendered file control instead of starting New Game.")
    parser.add_argument("--recovery-out", help="Export a recovery-only checkpoint through Campaign's rendered download control before closing.")
    parser.add_argument("--evidence-out", help="After sealing Credits, export playtest evidence through its rendered download control.")
    parser.add_argument("--frontier-reserve-seconds", type=int, default=120, help="When exporting recovery, retain this many seconds rather than starting another scene.")
    parser.add_argument("--require-complete", action="store_true", help="Exit nonzero unless the route seals credits.")
    args = parser.parse_args()
    for name in ("max_scenes", "max_seconds", "max_field_moves", "max_battle_commands", "frontier_reserve_seconds"):
        if getattr(args, name) <= 0:
            parser.error(f"--{name.replace('_', '-')} must be positive")
    if args.recovery_in and not Path(args.recovery_in).is_file():
        parser.error("--recovery-in must name an existing checkpoint file")
    if args.recovery_out and not Path(args.recovery_out).expanduser().resolve().parent.is_dir():
        parser.error("--recovery-out parent directory must already exist")
    if args.evidence_out and not Path(args.evidence_out).expanduser().resolve().parent.is_dir():
        parser.error("--evidence-out parent directory must already exist")
    if args.recovery_out and args.frontier_reserve_seconds >= args.max_seconds:
        parser.error("--frontier-reserve-seconds must be less than --max-seconds when exporting recovery")
    return args


def main() -> int:
    args = parse_args()
    evidence = run_attempt(find_chromium(args.chromium), args)
    print(json.dumps(evidence, indent=2, ensure_ascii=True))
    return 1 if args.require_complete and evidence.get("status") != "complete" else 0


if __name__ == "__main__":
    sys.exit(main())
