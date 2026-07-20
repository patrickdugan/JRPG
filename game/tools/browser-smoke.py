#!/usr/bin/env python3
"""Isolated Chromium QA for cross-page saves and repeat Auto-Grind."""

from __future__ import annotations

import argparse
import base64
import functools
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError as error:  # pragma: no cover
    raise SystemExit(
        "Install the optional QA dependency with: python -m pip install playwright"
    ) from error


GAME_DIR = Path(__file__).resolve().parents[1]
WRONG_SIZE_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
CHROMIUM_CANDIDATES = (
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe",
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def find_chromium(explicit: str | None) -> Path:
    for candidate in ((Path(explicit),) if explicit else CHROMIUM_CANDIDATES):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("No installed Chrome or Edge executable was found.")


def run_smoke(chromium: Path) -> dict[str, object]:
    handler = functools.partial(QuietHandler, directory=str(GAME_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    console_errors: list[dict[str, object]] = []
    page_errors: list[str] = []
    delivery_errors: list[dict[str, object]] = []
    evidence: dict[str, object] = {"chromium": str(chromium)}

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=str(chromium),
                args=["--disable-extensions", "--no-first-run", "--disable-background-networking"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1200})
            page = context.new_page()
            page.set_default_timeout(15_000)
            page.set_default_navigation_timeout(45_000)
            page.on(
                "console",
                lambda message: console_errors.append(
                    {"text": message.text, "url": message.location.get("url", "")}
                )
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on(
                "response",
                lambda response: delivery_errors.append(
                    {"status": response.status, "url": response.url}
                )
                if response.status >= 400
                else None,
            )
            page.on("dialog", lambda dialog: dialog.accept())

            response = page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            page.locator("#resetCampaign").wait_for()
            require(response is not None and response.status == 200, "Campaign did not return HTTP 200.")
            page.wait_for_function(
                """() => document.querySelector('#mapCanvas')?.dataset.partyArtState === 'ready'
                  && document.querySelector('#mapCanvas')?.dataset.npcArtState === 'ready'
                  && document.querySelector('#mapCanvas')?.dataset.terrainArtState === 'ready'
                  && document.querySelector('#sceneFocusPortrait')?.dataset.artState === 'ready'"""
            )
            campaign_party_art = page.evaluate(
                """() => ({
                  field: document.querySelector('#mapCanvas').dataset.partyArtState,
                  npc: document.querySelector('#mapCanvas').dataset.npcArtState,
                  terrain: document.querySelector('#mapCanvas').dataset.terrainArtState,
                  portrait: document.querySelector('#sceneFocusPortrait').dataset.artState,
                  leader: document.querySelector('#mapCanvas').dataset.fieldLeaderId,
                  leaderOptions: [...document.querySelector('#fieldLeader').options].map(option => option.value),
                  followerCount: document.querySelector('#mapCanvas').dataset.fieldFollowerCount,
                })"""
            )
            require(
                campaign_party_art["terrain"] == "ready"
                and campaign_party_art["leader"] == "ren"
                and campaign_party_art["leaderOptions"] == ["ren"]
                and campaign_party_art["followerCount"] == "0",
                f"Fresh field terrain/leader contract drifted: {campaign_party_art}.",
            )
            require(
                page.locator("#runProofStatus").inner_text().startswith("Unverified save"),
                "Fresh context did not begin unverified.",
            )
            page.locator("#resetCampaign").click()
            page.wait_for_timeout(350)
            clean_proof = page.locator("#runProofStatus").inner_text()
            require(clean_proof.startswith("Clean run "), "New Game did not create a run receipt.")
            run_prefix = clean_proof.split(" · ", 1)[0]
            require(
                page.locator("#launchBattle").get_attribute("aria-disabled") == "true",
                "The noncombat opening scene exposed a battle.",
            )

            page.get_by_role("link", name="Camp & Loadout").click()
            page.wait_for_url("**/camp.html")
            page.locator("#memberName").wait_for()
            page.wait_for_function(
                """() => document.querySelector('#portraitToken')?.dataset.artState === 'ready'
                  && document.querySelector('#inventoryList')?.dataset.itemArtState === 'ready'
                  && document.querySelector('#shopList')?.dataset.itemArtState === 'ready'"""
            )
            camp_party_art = page.locator("#portraitToken").evaluate(
                """token => ({
                  portrait: token.dataset.artState,
                  inventoryItems: document.querySelector('#inventoryList').dataset.itemArtState,
                  shopItems: document.querySelector('#shopList').dataset.itemArtState,
                  usesAtlas: token.classList.contains('has-atlas'),
                  memberId: token.dataset.memberId,
                  expression: token.dataset.expression,
                  row: token.dataset.frameRow,
                  column: token.dataset.frameColumn,
                  x: token.dataset.frameX,
                  y: token.dataset.frameY,
                  width: token.dataset.frameWidth,
                  height: token.dataset.frameHeight,
                })"""
            )
            require(
                camp_party_art == {
                    "portrait": "ready", "inventoryItems": "ready", "shopItems": "ready",
                    "usesAtlas": True, "memberId": "ren", "expression": "neutral",
                    "row": "0", "column": "0", "x": "0", "y": "0", "width": "64", "height": "64",
                },
                f"Camp Ren portrait frame contract drifted: {camp_party_art}.",
            )
            require(page.locator("#memberName").inner_text() == "Ren Ishikawa", "Camp party failed.")
            require(
                page.locator('[data-member-id="aya"]').is_visible(),
                "New Game did not unlock the authored Prologue party member Aya.",
            )
            page.locator('[data-member-id="aya"]').click()
            page.wait_for_function(
                "() => document.querySelector('#portraitToken')?.dataset.memberId === 'aya'"
            )
            aya_portrait_art = page.locator("#portraitToken").evaluate(
                "token => ({ memberId: token.dataset.memberId, expression: token.dataset.expression, row: token.dataset.frameRow, column: token.dataset.frameColumn, x: token.dataset.frameX, y: token.dataset.frameY })"
            )
            require(
                aya_portrait_art == {"memberId": "aya", "expression": "neutral", "row": "1", "column": "0", "x": "0", "y": "64"},
                f"Camp Aya portrait frame contract drifted: {aya_portrait_art}.",
            )
            require(page.locator("#campConversationSummary").inner_text() == "0 / 90 complete", "Camp talk frontier drifted.")
            require(page.locator("#partyCouncilSummary").inner_text() == "0 / 30 complete", "Council frontier drifted.")
            require(page.locator("#archiveRecordSummary").inner_text() == "0 / 60 read", "Archive frontier drifted.")
            page.locator('a[href="campaign.html"]').click(no_wait_after=True)
            page.wait_for_url("**/campaign.html")
            page.locator("#runProofStatus").wait_for()
            require(
                page.locator("#runProofStatus").inner_text().startswith(run_prefix),
                "Run receipt did not survive the Camp round trip.",
            )

            formation_context = browser.new_context(viewport={"width": 1280, "height": 900})
            formation_page = formation_context.new_page()
            formation_page.set_default_timeout(20_000)
            formation_page.set_default_navigation_timeout(45_000)
            formation_page.on(
                "console",
                lambda message: console_errors.append(
                    {"text": message.text, "url": message.location.get("url", "")}
                )
                if message.type == "error"
                else None,
            )
            formation_page.on("pageerror", lambda error: page_errors.append(str(error)))
            formation_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            formation_seed = formation_page.evaluate(
                """async () => {
                  const canonical = await import('./canonical-run.mjs');
                  const progression = await import('./progression.mjs');
                  const advancement = await import('./advancement.mjs');
                  const loadout = await import('./loadout.mjs');
                  const field = await import('./field-runtime.mjs');
                  const levels = await import('./content/levels.mjs');
                  const run = canonical.runCanonicalCompletion();
                  const campaign = progression.moveToBeat(run.states.campaign, 'chapter-5', 'c5-02-ash-fields');
                  const fieldState = field.createFieldState({ levelId: 'kgr-ash-fields', beatId: 'c5-02-ash-fields' });
                  const saves = [
                    progression.createLocalStorageAdapter().save(campaign),
                    advancement.createAdvancementStorageAdapter().save(run.states.advancement),
                    loadout.createLoadoutStorageAdapter().save(run.states.loadout),
                    field.createFieldStorageAdapter().save(fieldState),
                  ];
                  if (saves.some(result => !result.ok)) throw new Error('Formation QA seed did not save.');
                  const directions = [
                    ['w', 0, -1], ['a', -1, 0], ['s', 0, 1], ['d', 1, 0],
                    ['q', -1, -1], ['e', 1, -1], ['z', -1, 1], ['c', 1, 1],
                  ];
                  const legal = directions.find(([_key, dx, dy]) => field.moveFieldBy(fieldState, dx, dy).moved);
                  if (!legal) throw new Error('Formation QA seed has no legal first move.');
                  return {
                    key: legal[0],
                    formation: levels.getLevel('kgr-ash-fields').spawn.formation,
                  };
                }"""
            )
            formation_page.reload(wait_until="domcontentloaded")
            formation_page.wait_for_function(
                """() => document.querySelector('#mapCanvas')?.dataset.partyArtState === 'ready'
                  && document.querySelector('#mapCanvas')?.dataset.fieldFormationKey === 'ren|aya|lise|mateus|genta|kiku'
                  && document.querySelector('#mapCanvas')?.dataset.fieldFollowerCount === '0'"""
            )
            formation_page.keyboard.press(formation_seed["key"])
            formation_page.wait_for_function(
                "() => document.querySelector('#mapCanvas')?.dataset.fieldFollowerCount === '1'"
            )
            formation_followers = formation_page.locator("#mapCanvas").evaluate(
                "canvas => ({ count: Number(canvas.dataset.fieldFollowerCount), ids: canvas.dataset.fieldFollowerIds, formation: canvas.dataset.fieldFormationKey })"
            )
            require(
                formation_seed["formation"] == ["ren", "aya", "lise", "mateus", "genta", "kiku"]
                and formation_followers == {
                    "count": 1,
                    "ids": "aya",
                    "formation": "ren|aya|lise|mateus|genta|kiku",
                },
                f"Formation follower contract drifted: seed={formation_seed}, rendered={formation_followers}.",
            )
            formation_context.close()

            encounter_id = "prologue-ashen-bailiff"
            page.goto(
                f"{base}/battle.html?encounter={encounter_id}&return=campaign.html",
                wait_until="domcontentloaded",
            )
            page.locator("#encounterTitle").wait_for()
            first_clear_locks = [
                page.locator(f'[data-speed="{speed}"]').is_disabled() for speed in (1, 2, 4)
            ]
            require(all(first_clear_locks), "First clear exposed repeat-speed controls.")
            require(page.locator("#autoGrind").is_disabled(), "First clear exposed Auto-Grind.")

            dodge_button = page.locator('[data-command="dodge"]')
            require(dodge_button.get_attribute("aria-keyshortcuts") == "F", "Campaign Dodge lost its F shortcut.")
            page.wait_for_function(
                "() => !document.querySelector('[data-command=\"dodge\"]').disabled",
                timeout=10_000,
            )
            ren_hp_before_dodge = page.locator('[data-actor-id="ren"] .combatant-name span').inner_text()
            dodge_armed_seen = False
            for _attempt in range(6):
                page.wait_for_function(
                    "() => !document.querySelector('[data-command=\"dodge\"]').disabled",
                    timeout=10_000,
                )
                page.keyboard.press("f")
                require(dodge_button.get_attribute("aria-pressed") == "true", "F did not select Campaign Dodge.")
                page.keyboard.press("Enter")
                page.wait_for_timeout(60)
                dodge_armed_seen = dodge_armed_seen or "DODGE" in page.locator(
                    '[data-actor-id="ren"] .combatant-meta'
                ).inner_text()
                if "Dodge is consumed with HP unchanged" in page.locator("#resultLog").inner_text():
                    break
                page.wait_for_function(
                    """() => document.querySelector('#resultLog').textContent.includes('Dodge is consumed with HP unchanged')
                      || !document.querySelector('[data-command="dodge"]').disabled""",
                    timeout=10_000,
                )
                if "Dodge is consumed with HP unchanged" in page.locator("#resultLog").inner_text():
                    break
            dodge_log = page.locator("#resultLog").inner_text()
            ren_hp_after_dodge = page.locator('[data-actor-id="ren"] .combatant-name span').inner_text()
            ren_meta_after_dodge = page.locator('[data-actor-id="ren"] .combatant-meta').inner_text()
            require(dodge_armed_seen, "Campaign Dodge never exposed its persistent stance cue.")
            require(
                "Dodge is consumed with HP unchanged" in dodge_log
                and ren_hp_after_dodge == ren_hp_before_dodge
                and "NEUTRAL" in ren_meta_after_dodge,
                f"Campaign Dodge did not resolve as an exact HP-neutral consumed miss: {ren_hp_before_dodge}, {ren_hp_after_dodge}, {ren_meta_after_dodge}.",
            )
            dodge_result = {
                "hpBefore": ren_hp_before_dodge,
                "hpAfter": ren_hp_after_dodge,
                "armedSeen": dodge_armed_seen,
                "consumed": "Dodge is consumed with HP unchanged" in dodge_log,
                "stanceAfter": "neutral" if "NEUTRAL" in ren_meta_after_dodge else ren_meta_after_dodge,
            }

            seed = page.evaluate(
                """async id => {
                  const a = await import('./advancement.mjs');
                  const raw = localStorage.getItem(a.DEFAULT_ADVANCEMENT_SAVE_KEY);
                  const loaded = raw ? a.loadAdvancementState(raw) : { ok: false };
                  let state = loaded.ok ? loaded.value : a.createAdvancementState();
                  if (a.getEncounterWinCount(state, id) === 0) state = a.recordEncounterWin(state, id);
                  const training = a.grantRewardBundle(state, {
                    xpPerMember: a.MAX_MEMBER_XP,
                    currency: 0,
                    items: [],
                    keyItems: [],
                  });
                  if (!training.ok) throw new Error(training.errors.join(' '));
                  state = training.state;
                  state = a.setSpeedMultiplier(state, 1);
                  localStorage.setItem(a.DEFAULT_ADVANCEMENT_SAVE_KEY, a.serializeAdvancementState(state));
                  return {
                    wins: a.getEncounterWinCount(state, id),
                    speed: state.speedMultiplier,
                    level: a.getPartyMember(state, 'ren').level,
                  };
                }""",
                encounter_id,
            )
            require(seed == {"wins": 1, "speed": 1, "level": 50}, "Repeat queue QA seed drifted.")
            page.reload(wait_until="domcontentloaded")
            page.locator("#autoGrind").wait_for()
            require(
                not any(page.locator(f'[data-speed="{speed}"]').is_disabled() for speed in (1, 2, 4)),
                "Repeat speed remained locked.",
            )
            require(not page.locator("#autoGrind").is_disabled(), "Repeat Auto-Grind stayed locked.")

            page.locator('[data-speed="4"]').click()
            page.wait_for_timeout(150)
            page.reload(wait_until="domcontentloaded")
            page.locator("#autoGrind").wait_for()
            require(
                page.locator('[data-speed="4"]').get_attribute("aria-pressed") == "true",
                "4x speed did not persist through reload.",
            )
            page.locator("#autoGrindWins").select_option("5")
            require(page.locator("#autoGrindWins").input_value() == "5", "Five-win grind queue was not selectable.")
            page.locator("#autoGrind").click()
            page.wait_for_timeout(150)
            require(page.locator("#autoGrind").get_attribute("aria-pressed") == "true", "Auto-Grind did not start.")
            page.wait_for_function(
                "() => document.querySelector('#autoGrind').getAttribute('aria-pressed') === 'false'"
                " && !document.querySelector('#continueCampaign').hidden",
                timeout=120_000,
            )
            require(page.locator("#battleStateBadge").inner_text() == "VICTORY", "Auto-Grind did not win.")
            final = page.evaluate(
                """async id => {
                  const a = await import('./advancement.mjs');
                  const loaded = a.loadAdvancementState(localStorage.getItem(a.DEFAULT_ADVANCEMENT_SAVE_KEY));
                  return { wins: a.getEncounterWinCount(loaded.value, id), speed: loaded.value.speedMultiplier };
                }""",
                encounter_id,
            )
            require(final == {"wins": 6, "speed": 4}, "Five-win repeat queue or speed authority drifted.")

            item_context = browser.new_context(viewport={"width": 1280, "height": 900})
            item_page = item_context.new_page()
            item_page.set_default_timeout(20_000)
            item_page.set_default_navigation_timeout(45_000)
            item_page.on(
                "console",
                lambda message: console_errors.append(
                    {"text": message.text, "url": message.location.get("url", "")}
                )
                if message.type == "error"
                else None,
            )
            item_page.on("pageerror", lambda error: page_errors.append(str(error)))
            item_page.on(
                "response",
                lambda response: delivery_errors.append({"status": response.status, "url": response.url})
                if response.status >= 400
                else None,
            )
            item_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            item_seed = item_page.evaluate(
                """async id => {
                  const advancement = await import('./advancement.mjs');
                  const loadout = await import('./loadout.mjs');
                  let advancementState = advancement.createAdvancementState();
                  advancementState = advancement.preparePartyForEncounter(advancementState, id);
                  advancementState = advancement.recordEncounterWin(advancementState, id);
                  const training = advancement.grantRewardBundle(advancementState, {
                    xpPerMember: advancement.MAX_MEMBER_XP,
                    currency: 0,
                    items: [],
                    keyItems: [],
                  });
                  if (!training.ok) throw new Error(training.errors.join(' '));
                  advancementState = advancement.setSpeedMultiplier(training.state, 4);
                  if (!advancement.createAdvancementStorageAdapter().save(advancementState).ok) {
                    throw new Error('Item QA advancement seed did not save.');
                  }
                  let loadoutState = loadout.createLoadoutState();
                  const wounded = loadout.setMemberVitals(loadoutState, 'ren', { hp: 20 });
                  if (!wounded.ok) throw new Error(wounded.reason);
                  loadoutState = wounded.state;
                  if (!loadout.createLoadoutStorageAdapter().save(loadoutState).ok) {
                    throw new Error('Item QA loadout seed did not save.');
                  }
                  return {
                    wins: advancement.getEncounterWinCount(advancementState, id),
                    speed: advancementState.speedMultiplier,
                    level: advancement.getPartyMember(advancementState, 'ren').level,
                    stock: loadoutState.inventory['river-salve'],
                    hp: loadoutState.vitals.ren.hp,
                  };
                }""",
                encounter_id,
            )
            require(
                item_seed == {"wins": 1, "speed": 4, "level": 50, "stock": 3, "hp": 20},
                f"Campaign Item QA seed drifted: {item_seed}.",
            )
            item_page.goto(
                f"{base}/battle.html?encounter={encounter_id}&return=campaign.html",
                wait_until="domcontentloaded",
            )
            item_page.wait_for_function(
                """() => document.querySelector('#battleCanvas')?.dataset.itemArtState === 'ready'
                  && document.querySelector('#itemIconPreview')?.dataset.itemArtState === 'ready'
                  && !document.querySelector('[data-command="item"]').disabled""",
            )
            item_initial = item_page.evaluate(
                """async () => {
                  const loadout = await import('./loadout.mjs');
                  const loaded = loadout.createLoadoutStorageAdapter().load();
                  return {
                    hp: document.querySelector('[data-actor-id="ren"] .combatant-name span').textContent,
                    itemLabel: document.querySelector('#itemSelect option[value="river-salve"]').textContent,
                    canvasArt: document.querySelector('#battleCanvas').dataset.itemArtState,
                    previewArt: document.querySelector('#itemIconPreview').dataset.itemArtState,
                    revision: loaded.value.revision,
                  };
                }"""
            )
            require("3 held" in item_initial["itemLabel"], f"Battle did not expose three River Salves: {item_initial}.")
            item_page.keyboard.press("i")
            require(
                item_page.locator('[data-command="item"]').get_attribute("aria-pressed") == "true",
                "I did not select the Campaign Item command.",
            )
            item_page.locator("#targetSelect").select_option("ren")
            item_page.locator("#confirmCommand").click()
            item_page.wait_for_function(
                """() => document.querySelector('#resultLog').textContent.includes('recovers 80 HP from River Salve')
                  && document.querySelector('#itemSelect option[value="river-salve"]').textContent.includes('2 held')""",
            )
            item_provisional = {
                "hp": item_page.locator('[data-actor-id="ren"] .combatant-name span').inner_text(),
                "itemLabel": item_page.locator('#itemSelect option[value="river-salve"]').inner_text(),
                "log": item_page.locator("#resultLog").inner_text(),
            }
            require(
                item_provisional["hp"] != item_initial["hp"],
                f"River Salve did not change the exact rendered HP: {item_initial} / {item_provisional}.",
            )

            item_page.reload(wait_until="domcontentloaded")
            item_page.wait_for_function(
                """() => document.querySelector('#battleCanvas')?.dataset.itemArtState === 'ready'
                  && !document.querySelector('[data-command="item"]').disabled""",
            )
            item_refund = item_page.evaluate(
                """async () => {
                  const loadout = await import('./loadout.mjs');
                  const loaded = loadout.createLoadoutStorageAdapter().load();
                  return {
                    hp: document.querySelector('[data-actor-id="ren"] .combatant-name span').textContent,
                    itemLabel: document.querySelector('#itemSelect option[value="river-salve"]').textContent,
                    revision: loaded.value.revision,
                  };
                }"""
            )
            require(
                "3 held" in item_refund["itemLabel"] and item_refund["hp"] == item_initial["hp"],
                f"Reload did not refund provisional River Salve stock and HP: {item_refund}.",
            )
            item_page.keyboard.press("i")
            item_page.locator("#targetSelect").select_option("ren")
            item_page.locator("#confirmCommand").click()
            item_page.wait_for_function(
                "() => document.querySelector('#itemSelect option[value=\"river-salve\"]').textContent.includes('2 held')",
            )
            item_page.wait_for_timeout(900)
            item_page.locator("#autoGrindWins").select_option("1")
            item_page.locator("#autoGrind").click()
            item_page.wait_for_function(
                """() => document.querySelector('#autoGrind').getAttribute('aria-pressed') === 'false'
                  && !document.querySelector('#continueCampaign').hidden""",
                timeout=120_000,
            )
            require(item_page.locator("#battleStateBadge").inner_text() == "VICTORY", "Item QA Auto-Grind did not win.")
            item_durable = item_page.evaluate(
                """async () => {
                  const loadout = await import('./loadout.mjs');
                  const loaded = loadout.createLoadoutStorageAdapter().load();
                  if (!loaded.ok) throw new Error('Item QA durable loadout could not be read.');
                  return {
                    stock: loaded.value.inventory['river-salve'] ?? 0,
                    revision: loaded.value.revision,
                    hp: loaded.value.vitals.ren.hp,
                  };
                }"""
            )
            require(
                item_durable["stock"] == 2
                and item_durable["revision"] == item_refund["revision"] + 1,
                f"Victory did not settle exactly one River Salve in one revision: {item_refund} / {item_durable}.",
            )
            item_page.reload(wait_until="domcontentloaded")
            item_page.wait_for_function(
                "() => document.querySelector('#itemSelect option[value=\"river-salve\"]').textContent.includes('2 held')",
            )
            item_result = {
                "hpBefore": item_initial["hp"],
                "hpAfterUse": item_provisional["hp"],
                "provisionalStock": 2,
                "reloadRefundStock": 3,
                "durableStock": item_durable["stock"],
                "durableRevisionDelta": item_durable["revision"] - item_refund["revision"],
                "canvasArt": item_initial["canvasArt"],
                "previewArt": item_initial["previewArt"],
            }
            item_context.close()

            stage_context = browser.new_context(viewport={"width": 1440, "height": 1000})
            stage_page = stage_context.new_page()
            stage_page.set_default_timeout(20_000)
            stage_page.set_default_navigation_timeout(45_000)
            stage_page.on(
                "console",
                lambda message: console_errors.append(
                    {"text": message.text, "url": message.location.get("url", "")}
                )
                if message.type == "error"
                else None,
            )
            stage_page.on("pageerror", lambda error: page_errors.append(str(error)))
            stage_response = stage_page.goto(
                f"{base}/battle.html?encounter=fp1-mateus",
                wait_until="domcontentloaded",
            )
            require(stage_response is not None and stage_response.status == 200, "Takamine stage failed delivery.")
            stage_page.wait_for_function(
                """() => {
                  const state = document.querySelector('#battleCanvas')?.dataset;
                  return state?.stageArtState === 'ready'
                    && state?.partyArtState === 'ready'
                    && state?.enemyArtState === 'ready'
                    && state?.bossArtState === 'ready'
                    && state?.vfxArtState === 'ready'
                    && state?.statusVfxArtState === 'ready';
                }""",
            )
            stage_art = stage_page.evaluate(
                """async () => {
                  const canvas = document.querySelector('#battleCanvas');
                  const registry = await import('./battle-stage-art.mjs');
                  const art = registry.getBattleStageArt('tkm-bell-chamber');
                  return {
                    state: canvas.dataset.stageArtState,
                    id: canvas.dataset.stageArtId,
                    width: art.sourceWidth,
                    height: art.sourceHeight,
                    sourceCell: art.sourceCell,
                    url: art.url,
                    partyState: canvas.dataset.partyArtState,
                    enemyState: canvas.dataset.enemyArtState,
                    bossState: canvas.dataset.bossArtState,
                    vfxState: canvas.dataset.vfxArtState,
                    statusVfxState: canvas.dataset.statusVfxArtState,
                  };
                }"""
            )
            require(
                stage_art == {
                    "state": "ready",
                    "id": "takamine-bell-chamber-board-v1",
                    "width": 384,
                    "height": 224,
                    "sourceCell": 32,
                    "url": "./assets/art/takamine-bell-chamber/takamine-bell-chamber-board.png",
                    "partyState": "ready",
                    "enemyState": "ready",
                    "bossState": "ready",
                    "vfxState": "ready",
                    "statusVfxState": "ready",
                },
                f"Takamine runtime art contract drifted: {stage_art}.",
            )
            regional_stage_art = []
            for regional_encounter_id, regional_level_id in (
                ("prologue-ashen-bailiff", "hsh-census-square"),
                ("c1-cinder-hounds", "c1-flooded-cedars"),
                ("c1-tithe-hound", "c1-tax-storehouse"),
                ("fp1-cedar-path", "fp1-wet-cedar-stage"),
                ("fp1-flooded-archive", "fp1-flooded-archive-stage"),
                ("c3-dock-patrol", "sdg-rain-docks"),
                ("c3-captain-kaji", "sdg-salt-warehouse"),
                ("c4-fog-nets", "ngi-tide-caves"),
                ("c4-widow-of-fog", "ngi-storm-reef"),
                ("c5-ashen-release", "kgr-ash-fields"),
                ("c5-furnace-abbot", "kgr-archive-furnace"),
                ("c6-masked-clerks", "kzu-archive-roof"),
                ("c6-ujiro", "kzu-public-tribunal"),
                ("c7-name-slip-release", "hsh-prison-ferry"),
                ("c7-bell-warden-chiyo", "hsh-bell-aqueduct"),
                ("c8-lady-enma", "c8-black-gate"),
                ("c9-archive-nodes", "krh-outer-archive"),
                ("c9-yearless-bell", "krh-observatory"),
            ):
                regional_response = stage_page.goto(
                    f"{base}/battle.html?encounter={regional_encounter_id}",
                    wait_until="domcontentloaded",
                )
                require(
                    regional_response is not None and regional_response.status == 200,
                    f"Regional stage {regional_level_id} failed delivery.",
                )
                stage_page.wait_for_function(
                    """() => {
                      const state = document.querySelector('#battleCanvas')?.dataset;
                      return state?.stageArtState === 'ready'
                        && state?.partyArtState === 'ready'
                        && state?.enemyArtState === 'ready'
                        && state?.bossArtState === 'ready'
                        && state?.vfxArtState === 'ready';
                    }""",
                )
                regional_art = stage_page.locator("#battleCanvas").evaluate(
                    "canvas => ({ state: canvas.dataset.stageArtState, id: canvas.dataset.stageArtId })"
                )
                require(
                    regional_art == {"state": "ready", "id": f"{regional_level_id}-board-v01"},
                    f"Regional stage contract drifted for {regional_level_id}: {regional_art}.",
                )
                regional_stage_art.append({"levelId": regional_level_id, **regional_art})
            require(len(regional_stage_art) == 18, "Browser smoke did not decode all 18 regional boards.")
            kurozane_response = stage_page.goto(
                f"{base}/battle.html?encounter=c9-kurozane", wait_until="domcontentloaded"
            )
            require(kurozane_response is not None and kurozane_response.status == 200, "Kurozane boss art failed delivery.")
            stage_page.wait_for_function(
                "() => document.querySelector('#battleCanvas')?.dataset.bossArtState === 'ready'"
            )
            stage_context.close()

            boss_fallback_context = browser.new_context(viewport={"width": 1440, "height": 1000})
            boss_fallback_context.route(
                "**/assets/art/boss-combat-suite/boss-combat-atlas.png",
                lambda route: route.fulfill(status=200, content_type="image/png", body=b"invalid-png-for-boss-fallback-qa"),
            )
            boss_fallback_page = boss_fallback_context.new_page()
            boss_fallback_page.set_default_timeout(20_000)
            boss_fallback_page.set_default_navigation_timeout(45_000)
            boss_fallback_page.on("pageerror", lambda error: page_errors.append(str(error)))
            boss_fallback_response = boss_fallback_page.goto(
                f"{base}/battle.html?encounter=fp1-mateus", wait_until="domcontentloaded"
            )
            require(boss_fallback_response is not None and boss_fallback_response.status == 200, "Boss-only fallback page failed delivery.")
            boss_fallback_page.wait_for_function(
                """() => {
                  const state = document.querySelector('#battleCanvas')?.dataset;
                  return state?.stageArtState === 'ready'
                    && state?.partyArtState === 'ready'
                    && state?.enemyArtState === 'ready'
                    && state?.bossArtState === 'error'
                    && state?.vfxArtState === 'ready';
                }"""
            )
            boss_fallback_colors = boss_fallback_page.locator("#battleCanvas").evaluate(
                """canvas => {
                  const pixels = canvas.getContext('2d').getImageData(448, 78, 128, 128).data;
                  const colors = new Set();
                  for (let index = 0; index < pixels.length; index += 4) {
                    colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
                  }
                  return colors.size;
                }"""
            )
            require(boss_fallback_colors >= 3, "Boss-only image failure left the boss region blank.")
            boss_fallback_context.close()

            fallback_context = browser.new_context(viewport={"width": 1440, "height": 1000})
            fallback_context.route(
                "**/assets/art/takamine-bell-chamber/takamine-bell-chamber-board.png",
                lambda route: route.fulfill(status=200, content_type="image/png", body=b"invalid-png-for-fallback-qa"),
            )
            for failed_art_url in (
                "**/assets/art/party-combat-suite/party-combat-actions.png",
                "**/assets/art/enemy-combat-suite/enemy-combat-atlas.png",
                "**/assets/art/boss-combat-suite/boss-combat-atlas.png",
                "**/assets/art/battle-vfx-suite/battle-vfx-suite-atlas.png",
            ):
                fallback_context.route(
                    failed_art_url,
                    lambda route: route.fulfill(status=200, content_type="image/png", body=b"invalid-png-for-fallback-qa"),
                )
            fallback_page = fallback_context.new_page()
            fallback_page.set_default_timeout(20_000)
            fallback_page.set_default_navigation_timeout(45_000)
            fallback_page.on("pageerror", lambda error: page_errors.append(str(error)))
            fallback_response = fallback_page.goto(
                f"{base}/battle.html?encounter=fp1-mateus",
                wait_until="domcontentloaded",
            )
            require(fallback_response is not None and fallback_response.status == 200, "Takamine fallback page failed delivery.")
            fallback_page.wait_for_function(
                """() => {
                  const state = document.querySelector('#battleCanvas')?.dataset;
                  return state?.stageArtState === 'error'
                    && state?.partyArtState === 'error'
                    && state?.enemyArtState === 'error'
                    && state?.bossArtState === 'error'
                    && state?.vfxArtState === 'error';
                }""",
            )
            fallback_colors = fallback_page.locator("#battleCanvas").evaluate(
                """canvas => {
                  const pixels = canvas.getContext('2d').getImageData(96, 46, 768, 448).data;
                  const colors = new Set();
                  for (let y = 16; y < 448; y += 32) {
                    for (let x = 16; x < 768; x += 32) {
                      const offset = (y * 768 + x) * 4;
                      colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`);
                    }
                  }
                  return colors.size;
                }"""
            )
            require(fallback_colors >= 3, f"Takamine image failure left a blank board: {fallback_colors} colors.")
            fallback_context.close()

            wrong_size_context = browser.new_context(viewport={"width": 1024, "height": 768})
            for wrong_size_url in (
                "**/assets/art/takamine-bell-chamber/takamine-bell-chamber-board.png",
                "**/assets/art/party-combat-suite/party-combat-actions.png",
                "**/assets/art/enemy-combat-suite/enemy-combat-atlas.png",
                "**/assets/art/boss-combat-suite/boss-combat-atlas.png",
                "**/assets/art/battle-vfx-suite/battle-vfx-suite-atlas.png",
                "**/assets/art/party-portrait-suite/party-portrait-expressions.png",
            ):
                wrong_size_context.route(
                    wrong_size_url,
                    lambda route: route.fulfill(status=200, content_type="image/png", body=WRONG_SIZE_PNG),
                )
            wrong_size_page = wrong_size_context.new_page()
            wrong_size_page.set_default_timeout(20_000)
            wrong_size_page.set_default_navigation_timeout(45_000)
            wrong_size_page.on("pageerror", lambda error: page_errors.append(str(error)))
            wrong_size_response = wrong_size_page.goto(
                f"{base}/battle.html?encounter=fp1-mateus", wait_until="domcontentloaded"
            )
            require(wrong_size_response is not None and wrong_size_response.status == 200, "Wrong-size art page failed delivery.")
            wrong_size_page.wait_for_function(
                """() => {
                  const state = document.querySelector('#battleCanvas')?.dataset;
                  return state?.stageArtState === 'error'
                    && state?.partyArtState === 'error'
                    && state?.enemyArtState === 'error'
                    && state?.bossArtState === 'error'
                    && state?.vfxArtState === 'error';
                }"""
            )
            wrong_size_page.goto(f"{base}/camp.html", wait_until="domcontentloaded")
            wrong_size_page.wait_for_function(
                "() => document.querySelector('#portraitToken')?.dataset.artState === 'error'"
            )
            require(
                not wrong_size_page.locator("#portraitToken").evaluate("token => token.classList.contains('has-atlas')"),
                "Wrong-size Camp portrait hid the procedural fallback.",
            )
            wrong_size_context.close()

            portrait_fallback_context = browser.new_context(viewport={"width": 1024, "height": 768})
            portrait_fallback_context.route(
                "**/assets/art/party-portrait-suite/party-portrait-expressions.png",
                lambda route: route.fulfill(status=200, content_type="image/png", body=b"invalid-png-for-portrait-fallback-qa"),
            )
            portrait_fallback_page = portrait_fallback_context.new_page()
            portrait_fallback_page.set_default_timeout(20_000)
            portrait_fallback_page.set_default_navigation_timeout(45_000)
            portrait_fallback_page.on("pageerror", lambda error: page_errors.append(str(error)))
            portrait_fallback_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            portrait_fallback_page.wait_for_function(
                "() => document.querySelector('#sceneFocusPortrait')?.dataset.artState === 'error'"
            )
            portrait_fallback_colors = portrait_fallback_page.locator("#sceneFocusPortrait").evaluate(
                """canvas => {
                  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                  const colors = new Set();
                  for (let index = 0; index < pixels.length; index += 4) {
                    colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
                  }
                  return colors.size;
                }"""
            )
            require(portrait_fallback_colors >= 3, "Campaign portrait failure left a blank fallback.")
            portrait_fallback_page.goto(f"{base}/camp.html", wait_until="domcontentloaded")
            portrait_fallback_page.wait_for_function(
                "() => document.querySelector('#portraitToken')?.dataset.artState === 'error'"
            )
            require(
                not portrait_fallback_page.locator("#portraitToken").evaluate("token => token.classList.contains('has-atlas')"),
                "Camp portrait failure hid the procedural fallback.",
            )
            portrait_fallback_context.close()

            page.locator("body").focus()
            focus_trace: list[str] = []
            for _ in range(10):
                page.keyboard.press("Tab")
                focus_trace.append(
                    page.evaluate("document.activeElement?.id || document.activeElement?.tagName || ''")
                )
            require("continueCampaign" in focus_trace, "Keyboard focus missed the route link.")

            # Leave the battle controller before replacing cross-page states;
            # its pagehide flush must run before, not after, the complete seed.
            page.goto(f"{base}/index.html", wait_until="domcontentloaded")
            page.locator("#gameCanvas").wait_for()

            credits_seed = page.evaluate(
                """async () => {
                  const receipt = await import('./run-receipt.mjs');
                  const { CAMPAIGN } = await import('./content/campaign.mjs');
                  const { ENCOUNTERS } = await import('./content/encounters.mjs');
                  const route = await import('./required-route-run.mjs');
                  const progression = await import('./progression.mjs');
                  const advancement = await import('./advancement.mjs');
                  const quests = await import('./quest-runtime.mjs');
                  const witnesses = await import('./witness-chronicle-runtime.mjs');
                  const conversations = await import('./camp-conversation-runtime.mjs');
                  const councils = await import('./party-council-runtime.mjs');
                  const archives = await import('./archive-record-runtime.mjs');
                  const conversationContract = await import('./camp-conversation-contract.mjs');
                  const councilContract = await import('./party-council-contract.mjs');
                  const archiveContract = await import('./archive-record-contract.mjs');
                  const adapter = receipt.createRunReceiptStorageAdapter();
                  const loaded = adapter.load();
                  if (!loaded.ok || !loaded.found) throw new Error('Clean receipt is missing.');
                  let state = loaded.state;
                  const required = route.runRequiredRouteCompletion({ runId: state.runId });
                  localStorage.setItem(
                    progression.DEFAULT_PROGRESSION_SAVE_KEY,
                    progression.serializeCampaignState(required.states.campaign),
                  );
                  localStorage.setItem(
                    advancement.DEFAULT_ADVANCEMENT_SAVE_KEY,
                    advancement.serializeAdvancementState(required.states.advancement),
                  );
                  localStorage.setItem(
                    quests.DEFAULT_QUEST_SAVE_KEY,
                    quests.serializeQuestState(required.states.quests),
                  );
                  localStorage.setItem(
                    witnesses.DEFAULT_WITNESS_CHRONICLE_SAVE_KEY,
                    witnesses.serializeWitnessChronicleState(required.states.witnessChronicles),
                  );
                  localStorage.setItem(
                    conversationContract.DEFAULT_CAMP_CONVERSATION_SAVE_KEY,
                    conversations.serializeCampConversationState(required.states.campConversations),
                  );
                  localStorage.setItem(
                    councilContract.DEFAULT_PARTY_COUNCIL_SAVE_KEY,
                    councils.serializePartyCouncilState(required.states.partyCouncils),
                  );
                  localStorage.setItem(
                    archiveContract.DEFAULT_ARCHIVE_RECORD_SAVE_KEY,
                    archives.serializeArchiveRecordState(required.states.archiveRecords),
                  );
                  for (const encounter of ENCOUNTERS) {
                    const result = receipt.recordRunFirstClear(state, state.runId, encounter.id);
                    if (!result.ok) throw new Error(result.errors.join(' '));
                    state = result.state;
                  }
                  for (const beat of CAMPAIGN.chapters.flatMap(chapter => chapter.beats)) {
                    const result = receipt.recordRunBeatCompletion(state, state.runId, beat.id);
                    if (!result.ok) throw new Error(result.errors.join(' '));
                    state = result.state;
                  }
                  if (!adapter.save(state).ok) throw new Error('Story-complete receipt did not save.');
                  const proof = receipt.getRunProofReport(state);
                  return {
                    storyComplete: proof.storyComplete,
                    creditsComplete: proof.creditsComplete,
                    routeComplete: required.completionProof.creditsCompletionGateSatisfied,
                    routeActivities: required.summary.completedRequiredActivityCount,
                  };
                }"""
            )
            require(
                credits_seed == {
                    "storyComplete": True,
                    "creditsComplete": False,
                    "routeComplete": True,
                    "routeActivities": 215,
                },
                "Story or intended-route completion seed drifted before credits.",
            )
            page.goto(f"{base}/credits.html", wait_until="domcontentloaded")
            page.locator("#sealCredits").wait_for()
            require(page.locator("#categoryTimingList > li").count() == 5, "Credits activity timing ledger is incomplete.")
            require(page.locator("#chapterTimingList > li").count() == 11, "Credits chapter timing ledger is incomplete.")
            chapter_timing_text = page.locator("#chapterTimingList").inner_text()
            require(" / " in chapter_timing_text, "Credits chapter timing rows omit actual/reference values.")
            require("short by" in chapter_timing_text, "Completed short-run chapters omit their checkpoint gaps.")
            pacing_basis_text = page.locator("#pacingBasis").inner_text()
            require("20:32:08" in pacing_basis_text, "Credits pacing total drifted from the reference checkpoint.")
            require("not observed proof" in pacing_basis_text, "Credits pacing checkpoint is not clearly labeled diagnostic.")
            require(
                page.locator("#timingAttribution").get_attribute("data-state") == "complete",
                "Credits timing ledger contains unattributed active play.",
            )
            require(
                not page.locator("#sealCredits").is_disabled(),
                "Credits seal stayed disabled after story completion: "
                f"{page.locator('#creditsStatus').inner_text()} / {page.locator('#routeProof').inner_text()}",
            )
            require(page.locator('a[href="camp.html"]').is_visible(), "Credits omitted the pre-seal Camp route.")
            require(page.locator('a[href="campaign.html"]').is_visible(), "Credits omitted the Campaign return route.")
            page.locator("#sealCredits").click()
            page.wait_for_function("() => document.querySelector('#sealCredits').disabled")
            credits_final = page.evaluate(
                """async () => {
                  const receipt = await import('./run-receipt.mjs');
                  const loaded = receipt.createRunReceiptStorageAdapter().load();
                  const proof = receipt.getRunProofReport(loaded.state);
                  return { status: proof.status, storyComplete: proof.storyComplete, creditsComplete: proof.creditsComplete };
                }"""
            )
            require(
                credits_final == {"status": "complete", "storyComplete": True, "creditsComplete": True},
                "Explicit credits did not seal the completed story receipt.",
            )
            page.locator("#exportEvidence").wait_for()
            require(not page.locator("#exportEvidence").is_disabled(), "Evidence export stayed disabled for a valid receipt.")
            with page.expect_download() as download_info:
                page.locator("#exportEvidence").click()
            download = download_info.value
            download_path = download.path()
            require(download.failure() is None and download_path is not None, "Evidence JSON download failed.")
            exported_report = json.loads(Path(download_path).read_text(encoding="utf-8"))
            require(exported_report.get("schemaVersion") == 2, "Evidence export schema drifted.")
            require(exported_report.get("story", {}).get("creditsComplete") is True, "Evidence export omitted credits completion.")
            require(exported_report.get("combat", {}).get("complete") is True, "Evidence export omitted first-clear completion.")
            require(exported_report.get("requiredRoute", {}).get("complete") is True, "Evidence export omitted the 215/215 route.")
            require(exported_report.get("proof", {}).get("durationProven") is False, "Zero-time browser seed fabricated duration proof.")
            require(exported_report.get("proof", {}).get("releaseTargetProven") is False, "Zero-time browser seed fabricated release proof.")
            require(exported_report.get("proof", {}).get("chapterTimingComplete") is True, "Browser play left unattributed chapter time.")
            require(exported_report.get("playtime", {}).get("unattributedMs") == 0, "Evidence export contains unattributed playtime.")
            pacing_export = exported_report.get("pacing", {})
            require(pacing_export.get("diagnosticOnly") is True, "Evidence export pacing is not diagnostic-only.")
            require(pacing_export.get("observedPlaytimeProof") is False, "Evidence export pacing fabricated observed proof.")
            require(pacing_export.get("checkpointSignature") == "fnv1a32:dab8e7de", "Evidence checkpoint signature drifted.")
            require(pacing_export.get("aggregateReferenceTargetMs") == 73928467, "Evidence pacing total drifted.")
            require(len(pacing_export.get("chapters", [])) == 11, "Evidence export chapter pacing is incomplete.")
            signature = exported_report.get("signature", "")
            require(signature.startswith("fnv1a32:") and len(signature) == 16, "Evidence export signature is malformed.")
            evidence_export = {
                "filename": download.suggested_filename,
                "signature": signature,
                "routeActivities": exported_report["requiredRoute"]["completedActivityCount"],
                "durationProven": exported_report["proof"]["durationProven"],
                "unattributedMs": exported_report["playtime"]["unattributedMs"],
            }
            context.close()

            recovery_context = browser.new_context(viewport={"width": 1280, "height": 900})
            recovery_page = recovery_context.new_page()
            recovery_page.set_default_timeout(20_000)
            recovery_page.set_default_navigation_timeout(45_000)
            recovery_page.on(
                "console",
                lambda message: console_errors.append({"text": message.text, "url": message.location.get("url", "")})
                if message.type == "error"
                else None,
            )
            recovery_page.on("pageerror", lambda error: page_errors.append(str(error)))
            recovery_page.on("dialog", lambda dialog: dialog.accept())
            recovery_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            recovery_page.locator("#resetCampaign").click()
            recovery_page.locator("#exportRecovery").wait_for()
            original_run_id = recovery_page.evaluate(
                """async () => {
                  const receipt = await import('./run-receipt.mjs');
                  const loaded = receipt.createRunReceiptStorageAdapter().load();
                  if (!loaded.ok || !loaded.found) throw new Error('Recovery smoke has no clean run.');
                  return loaded.state.runId;
                }"""
            )
            with recovery_page.expect_download() as recovery_download_info:
                recovery_page.locator("#exportRecovery").click()
            recovery_download = recovery_download_info.value
            recovery_download_path = recovery_download.path()
            require(
                recovery_download.failure() is None and recovery_download_path is not None,
                "Recovery checkpoint download failed.",
            )
            recovery_checkpoint = json.loads(Path(recovery_download_path).read_text(encoding="utf-8"))
            require(recovery_checkpoint.get("schemaVersion") == 1, "Recovery checkpoint schema drifted.")
            require(recovery_checkpoint.get("recoveryOnly") is True, "Recovery checkpoint lost its recovery-only label.")
            require(len(recovery_checkpoint.get("records", [])) == 13, "Recovery checkpoint omitted an authority.")
            require(
                recovery_checkpoint.get("summary", {}).get("runId") == original_run_id,
                "Recovery checkpoint summary is not bound to the exported run.",
            )
            require(
                "not playtest proof" in recovery_page.locator("#recoveryStatus").inner_text(),
                "Recovery export status does not distinguish recovery from proof.",
            )
            expected_raw_records = {
                record["key"]: record["serialized"] for record in recovery_checkpoint["records"]
            }
            recovery_page.locator("#resetCampaign").click()
            replacement_run_id = recovery_page.evaluate(
                """async () => {
                  const receipt = await import('./run-receipt.mjs');
                  return receipt.createRunReceiptStorageAdapter().load().state.runId;
                }"""
            )
            require(replacement_run_id != original_run_id, "New Game did not replace the recovery smoke run.")
            recovery_keys = json.dumps(list(expected_raw_records), ensure_ascii=True)
            recovery_page.add_init_script(
                f"""Object.defineProperty(window, '__recoveryRawAtDocumentStart', {{
                  configurable: false,
                  value: Object.freeze(Object.fromEntries(
                    {recovery_keys}.map(key => [key, localStorage.getItem(key)]),
                  )),
                }});"""
            )
            with recovery_page.expect_navigation(wait_until="domcontentloaded"):
                recovery_page.locator("#recoveryFile").set_input_files(recovery_download_path)
            recovery_page.locator("#runProofStatus").wait_for()
            restored = recovery_page.evaluate(
                """async ({ expected, originalRunId }) => {
                  const receipt = await import('./run-receipt.mjs');
                  const loaded = receipt.createRunReceiptStorageAdapter().load();
                  const mismatches = Object.entries(expected)
                    .filter(([key, serialized]) => window.__recoveryRawAtDocumentStart?.[key] !== serialized)
                    .map(([key]) => key);
                  return {
                    runId: loaded.state.runId,
                    mismatches,
                    proof: receipt.getRunProofReport(loaded.state),
                    expectedRun: originalRunId,
                  };
                }""",
                {"expected": expected_raw_records, "originalRunId": original_run_id},
            )
            require(restored["runId"] == original_run_id, "Recovery import did not restore the exported run.")
            require(not restored["mismatches"], f"Recovery import changed exact authority strings: {restored['mismatches']}.")
            require(restored["proof"]["durationProven"] is False, "Recovery import fabricated duration proof.")
            recovery_result = {
                "filename": recovery_download.suggested_filename,
                "authorityRecords": len(recovery_checkpoint["records"]),
                "exactStringsRestored": True,
                "runRestored": original_run_id,
                "durationProven": restored["proof"]["durationProven"],
            }
            recovery_context.close()

            route_context = browser.new_context(viewport={"width": 1280, "height": 900})
            route_page = route_context.new_page()
            route_page.set_default_timeout(20_000)
            route_page.set_default_navigation_timeout(45_000)
            route_page.on(
                "console",
                lambda message: console_errors.append({"text": message.text, "url": message.location.get("url", "")})
                if message.type == "error"
                else None,
            )
            route_page.on("pageerror", lambda error: page_errors.append(str(error)))
            route_page.on("dialog", lambda dialog: dialog.accept())
            route_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            route_page.locator("#resetCampaign").click()
            route_page.wait_for_timeout(250)
            first_route_beat = route_page.evaluate(
                """async () => {
                  const progression = await import('./progression.mjs');
                  const adapter = progression.createLocalStorageAdapter();
                  const loaded = adapter.load();
                  const next = progression.completeCurrentBeat(loaded.state);
                  if (!adapter.save(next).ok) throw new Error('Route-guide campaign seed did not save.');
                  return next.completedBeatIds[0];
                }"""
            )
            route_page.reload(wait_until="domcontentloaded")
            route_action_button = route_page.locator("#routeDueList [data-route-activity-id]").first
            route_action_button.wait_for()
            route_activity_id = route_action_button.get_attribute("data-route-activity-id")
            route_activity_type = route_action_button.get_attribute("data-route-activity-type")
            require(route_activity_type == "archive-record", "First route-guide action is no longer the opening archive record.")
            route_action_button.click(no_wait_after=True)
            route_page.wait_for_url("**/camp.html?routeType=archive-record&routeId=**")
            route_page.locator("#archiveRecordStage:not([hidden])").wait_for()
            route_record = route_page.evaluate(
                """async id => {
                  const archive = await import('./archive-record-runtime.mjs');
                  const loaded = archive.createArchiveRecordStorageAdapter().load();
                  const record = loaded.state?.records.find(entry => entry.id === id);
                  return record ? { id: record.id, status: record.status } : null;
                }""",
                route_activity_id,
            )
            require(
                route_record == {"id": route_activity_id, "status": "active"},
                "One-click route guide did not begin the requested archive record.",
            )
            route_page.keyboard.press("n")
            route_page.wait_for_function(
                """async id => {
                  const archive = await import('./archive-record-runtime.mjs');
                  const loaded = archive.createArchiveRecordStorageAdapter().load();
                  return loaded.state?.records.find(entry => entry.id === id)?.paragraphIndex === 1;
                }""",
                arg=route_activity_id,
            )
            route_action = {
                "beatId": first_route_beat,
                "activityId": route_activity_id,
                "activityType": route_activity_type,
                "status": route_record["status"],
                "keyboardParagraphIndex": 1,
            }
            route_context.close()

            catalog_context = browser.new_context(viewport={"width": 1280, "height": 900})
            catalog_page = catalog_context.new_page()
            catalog_page.set_default_timeout(45_000)
            catalog_page.set_default_navigation_timeout(45_000)
            catalog_page.on(
                "console",
                lambda message: console_errors.append({"text": message.text, "url": message.location.get("url", "")})
                if message.type == "error"
                else None,
            )
            catalog_page.on("pageerror", lambda error: page_errors.append(str(error)))
            catalog_page.on("dialog", lambda dialog: dialog.accept())
            catalog_page.goto(f"{base}/campaign.html", wait_until="domcontentloaded")
            catalog_page.locator("#resetCampaign").click()
            catalog_page.wait_for_timeout(200)
            catalog_seed = catalog_page.evaluate(
                """async () => {
                  const canonical = await import('./canonical-run.mjs');
                  const progression = await import('./progression.mjs');
                  const advancement = await import('./advancement.mjs');
                  const loadout = await import('./loadout.mjs');
                  const receipt = await import('./run-receipt.mjs');
                  const run = canonical.runCanonicalCompletion();
                  const saves = [
                    progression.createLocalStorageAdapter().save(run.states.campaign),
                    advancement.createAdvancementStorageAdapter().save(run.states.advancement),
                    loadout.createLoadoutStorageAdapter().save(run.states.loadout),
                  ];
                  if (saves.some(result => !result.ok)) throw new Error('Canonical catalogue prerequisites did not save.');
                  const loadedReceipt = receipt.createRunReceiptStorageAdapter().load();
                  if (!loadedReceipt.ok || !loadedReceipt.found) throw new Error('Catalogue run receipt is missing.');
                  return {
                    canonicalSignature: run.signature,
                    completedBeatCount: run.states.campaign.completedBeatIds.length,
                    unlockedPartyCount: run.states.advancement.party.filter(member => member.unlocked).length,
                    receiptRunId: loadedReceipt.state.runId,
                    receiptBeatCount: loadedReceipt.state.completedBeatIds.length,
                  };
                }"""
            )
            require(catalog_seed["completedBeatCount"] == 60, "Catalogue prerequisite seed omitted story beats.")
            require(catalog_seed["unlockedPartyCount"] == 6, "Catalogue prerequisite seed omitted party members.")
            require(catalog_seed["receiptBeatCount"] == 0, "Catalogue prerequisite seed fabricated receipt story evidence.")
            catalog_page.goto(f"{base}/camp.html", wait_until="domcontentloaded")
            catalog_page.locator("#memberName").wait_for()
            catalog_browser = catalog_page.evaluate(
                """async expectedRunId => {
                  const conversations = await import('./content/camp-conversations.mjs');
                  const councils = await import('./content/party-councils.mjs');
                  const archives = await import('./content/archive-records.mjs');
                  const conversationRuntime = await import('./camp-conversation-runtime.mjs');
                  const councilRuntime = await import('./party-council-runtime.mjs');
                  const archiveRuntime = await import('./archive-record-runtime.mjs');
                  const receiptRuntime = await import('./run-receipt.mjs');

                  const visible = element => element && !element.hidden && getComputedStyle(element).display !== 'none';
                  const selectCamp = campId => {
                    if (!campId) return;
                    const select = document.querySelector('#campSelect');
                    select.value = campId;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                  };
                  const completeEntries = ({ entries, type, buttonAttribute, stageSelector, advanceSelector, choicesSelector }) => {
                    let controlActivations = 0;
                    let choiceActivations = 0;
                    for (const entry of entries) {
                      selectCamp(entry.campId);
                      const button = document.querySelector(`[${buttonAttribute}="${CSS.escape(entry.id)}"]`);
                      if (!button || button.disabled) throw new Error(`${type}:${entry.id} is not available through its list control.`);
                      button.click();
                      controlActivations += 1;
                      const stage = document.querySelector(stageSelector);
                      if (!visible(stage)) throw new Error(`${type}:${entry.id} did not open its player-facing stage.`);
                      let transitions = 0;
                      while (transitions < 100) {
                        const advance = document.querySelector(advanceSelector);
                        const choices = choicesSelector
                          ? [...document.querySelectorAll(`${choicesSelector} button`)].filter(visible)
                          : [];
                        if (choices.length) {
                          choices[0].click();
                          choiceActivations += 1;
                          controlActivations += 1;
                        } else if (visible(advance) && !advance.disabled) {
                          advance.click();
                          controlActivations += 1;
                        } else if (advance?.disabled) {
                          break;
                        } else {
                          throw new Error(`${type}:${entry.id} exposed no usable continuation control.`);
                        }
                        transitions += 1;
                      }
                      if (transitions >= 100 || !document.querySelector(advanceSelector)?.disabled) {
                        throw new Error(`${type}:${entry.id} did not reach its finite terminal state.`);
                      }
                    }
                    return { entryCount: entries.length, controlActivations, choiceActivations };
                  };

                  const companion = completeEntries({
                    entries: conversations.CAMP_CONVERSATIONS.conversations,
                    type: 'camp-conversation',
                    buttonAttribute: 'data-camp-conversation-id',
                    stageSelector: '#campConversationStage',
                    advanceSelector: '#advanceCampConversation',
                    choicesSelector: '#campConversationChoices',
                  });
                  const council = completeEntries({
                    entries: councils.PARTY_COUNCILS.councils,
                    type: 'party-council',
                    buttonAttribute: 'data-party-council-id',
                    stageSelector: '#partyCouncilStage',
                    advanceSelector: '#advancePartyCouncil',
                    choicesSelector: '#partyCouncilChoices',
                  });
                  const archive = completeEntries({
                    entries: archives.ARCHIVE_RECORDS.records,
                    type: 'archive-record',
                    buttonAttribute: 'data-archive-record-id',
                    stageSelector: '#archiveRecordStage',
                    advanceSelector: '#advanceArchiveRecord',
                    choicesSelector: null,
                  });

                  const conversationState = conversationRuntime.createCampConversationStorageAdapter().load().state;
                  const councilState = councilRuntime.createPartyCouncilStorageAdapter().load().state;
                  const archiveState = archiveRuntime.createArchiveRecordStorageAdapter().load().state;
                  const receipt = receiptRuntime.createRunReceiptStorageAdapter().load().state;
                  const conversationMetrics = conversationRuntime.getCampConversationRuntimeMetrics(conversationState);
                  const councilMetrics = councilRuntime.getPartyCouncilRuntimeMetrics(councilState);
                  const archiveMetrics = archiveRuntime.getArchiveRecordRuntimeMetrics(archiveState);
                  return {
                    companion,
                    council,
                    archive,
                    completed: {
                      companion: conversationMetrics.completedConversationCount,
                      council: councilMetrics.completedCouncilCount,
                      archive: archiveMetrics.completedRecordCount,
                    },
                    runBinding: {
                      companion: conversationState.runId,
                      council: councilState.runId,
                      archive: archiveState.runId,
                    },
                    expectedRunId,
                    receiptRunId: receipt.runId,
                    receiptBeatCount: receipt.completedBeatIds.length,
                    durationProven: receiptRuntime.getRunProofReport(receipt).durationProven,
                  };
                }""",
                catalog_seed["receiptRunId"],
            )
            require(catalog_browser["completed"] == {"companion": 90, "council": 30, "archive": 60},
                    "Browser catalogue controls did not complete all 180 finite entries.")
            require(all(run_id == catalog_seed["receiptRunId"] for run_id in catalog_browser["runBinding"].values()),
                    "Browser catalogue ledgers are not bound to the clean-run UUID.")
            require(catalog_browser["receiptRunId"] == catalog_seed["receiptRunId"],
                    "Browser catalogue receipt identity drifted.")
            require(catalog_browser["receiptBeatCount"] == 0,
                    "Browser catalogue prerequisite seed fabricated receipt beat evidence.")
            require(catalog_browser["durationProven"] is False,
                    "Accelerated browser catalogue exercise fabricated duration proof.")
            catalog_context.close()

            responsive_context = browser.new_context(viewport={"width": 390, "height": 844})
            responsive_page = responsive_context.new_page()
            responsive_page.set_default_timeout(20_000)
            responsive_page.set_default_navigation_timeout(45_000)
            responsive_page.on(
                "console",
                lambda message: console_errors.append({"text": message.text, "url": message.location.get("url", "")})
                if message.type == "error"
                else None,
            )
            responsive_page.on("pageerror", lambda error: page_errors.append(str(error)))
            responsive_page.on(
                "response",
                lambda response: delivery_errors.append({"status": response.status, "url": response.url})
                if response.status >= 400
                else None,
            )
            responsive_pages = (
                ("index.html", ".campaign-link"),
                ("campaign.html", "#resetCampaign"),
                (f"battle.html?encounter={encounter_id}", "#encounterTitle"),
                ("camp.html", "#memberName"),
                ("credits.html", "#creditsStatus"),
            )
            responsive_widths: dict[str, dict[str, int]] = {}
            semantic_audits: dict[str, dict[str, list[str]]] = {}
            audio_surfaces: dict[str, dict[str, object]] = {}
            for path, selector in responsive_pages:
                response = responsive_page.goto(f"{base}/{path}", wait_until="domcontentloaded")
                require(response is not None and response.status == 200, f"Responsive {path} failed delivery.")
                responsive_page.locator(selector).wait_for()
                require(responsive_page.locator(selector).is_visible(), f"Responsive {path} hid its primary control.")
                widths = responsive_page.evaluate(
                    """() => ({
                      viewport: window.innerWidth,
                      document: document.documentElement.scrollWidth,
                      body: document.body.scrollWidth,
                    })"""
                )
                require(
                    max(widths["document"], widths["body"]) <= widths["viewport"] + 1,
                    f"Responsive {path} overflows horizontally: {widths}.",
                )
                semantic = responsive_page.evaluate(
                    """() => {
                      const visible = element => {
                        const style = getComputedStyle(element);
                        const rect = element.getBoundingClientRect();
                        return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden'
                          && rect.width > 0 && rect.height > 0;
                      };
                      const accessibleName = element => {
                        const labelledBy = (element.getAttribute('aria-labelledby') || '')
                          .split(/\s+/).filter(Boolean)
                          .map(id => document.getElementById(id)?.textContent?.trim() || '').join(' ').trim();
                        const explicitLabel = element.id
                          ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim() || ''
                          : '';
                        const nativeText = element.matches('button, a[href]') ? element.textContent : '';
                        return (element.getAttribute('aria-label') || labelledBy || explicitLabel
                          || nativeText || element.getAttribute('title') || '').trim();
                      };
                      const seen = new Set();
                      const duplicateIds = [...document.querySelectorAll('[id]')].flatMap(element => {
                        if (seen.has(element.id)) return [element.id];
                        seen.add(element.id);
                        return [];
                      });
                      const unnamedInteractive = [...document.querySelectorAll('button, a[href], select, input:not([type="hidden"]), canvas[tabindex]')]
                        .filter(element => visible(element) && !accessibleName(element))
                        .map(element => `${element.tagName.toLowerCase()}#${element.id || '(no-id)'}`);
                      const imagesMissingAlt = [...document.images]
                        .filter(image => !image.hasAttribute('alt'))
                        .map(image => image.getAttribute('src') || '(inline image)');
                      return { duplicateIds, unnamedInteractive, imagesMissingAlt };
                    }"""
                )
                require(not semantic["duplicateIds"], f"{path} has duplicate IDs: {semantic['duplicateIds']}.")
                require(not semantic["unnamedInteractive"], f"{path} has unnamed visible controls: {semantic['unnamedInteractive']}.")
                require(not semantic["imagesMissingAlt"], f"{path} has images without alt text: {semantic['imagesMissingAlt']}.")

                responsive_page.locator('.skip-link').focus()
                responsive_page.keyboard.press('Enter')
                require(
                    responsive_page.evaluate("() => document.activeElement?.id === 'mainContent'"),
                    f"{path} skip link did not move focus to main content.",
                )

                audio_toggle = responsive_page.locator("#audioToggle")
                audio_volume = responsive_page.get_by_label("Volume", exact=True)
                audio_status = responsive_page.locator("#audioStatus")
                require(audio_toggle.is_visible(), f"{path} hid its sound toggle.")
                require(audio_volume.is_visible(), f"{path} hid its labelled volume range.")
                audio_toggle.click()
                responsive_page.wait_for_function(
                    "() => document.querySelector('#audioToggle')?.getAttribute('aria-pressed') === 'true'",
                )
                playing_status = audio_status.inner_text()
                require(
                    "playing at" in playing_status,
                    f"{path} claimed sound was active without a playing status: {playing_status!r}.",
                )
                audio_volume.fill("0.35")
                responsive_page.wait_for_function(
                    "() => document.querySelector('#audioVolume')?.getAttribute('aria-valuetext') === '35 percent'"
                    " && document.querySelector('#audioStatus')?.textContent?.includes('playing at 35%')",
                )
                gameplay_before = responsive_page.evaluate(
                    """() => JSON.stringify({
                      prototype: window.bellsPrototype ? {
                        x: window.bellsPrototype.engine.player.pos.x,
                        y: window.bellsPrototype.engine.player.pos.y,
                      } : null,
                      scene: document.querySelector('#sceneNumber')?.textContent ?? null,
                      field: document.querySelector('#fieldProgress')?.textContent ?? null,
                      battleX: document.querySelector('#battleCanvas')?.dataset.activeActorX ?? null,
                      battleY: document.querySelector('#battleCanvas')?.dataset.activeActorY ?? null,
                    })"""
                )
                audio_volume.focus()
                responsive_page.keyboard.press("ArrowRight")
                require(float(audio_volume.input_value()) == 0.4, f"{path} captured the focused volume range ArrowRight key.")
                gameplay_after = responsive_page.evaluate(
                    """() => JSON.stringify({
                      prototype: window.bellsPrototype ? {
                        x: window.bellsPrototype.engine.player.pos.x,
                        y: window.bellsPrototype.engine.player.pos.y,
                      } : null,
                      scene: document.querySelector('#sceneNumber')?.textContent ?? null,
                      field: document.querySelector('#fieldProgress')?.textContent ?? null,
                      battleX: document.querySelector('#battleCanvas')?.dataset.activeActorX ?? null,
                      battleY: document.querySelector('#battleCanvas')?.dataset.activeActorY ?? null,
                    })"""
                )
                require(gameplay_after == gameplay_before, f"{path} changed gameplay while the volume range owned ArrowRight.")

                if path == "index.html":
                    move = responsive_page.evaluate(
                        """() => {
                          const engine = window.bellsPrototype.engine;
                          const origin = { ...engine.player.pos };
                          const legal = engine.getLegalMoves('ren')[0];
                          return { origin, dx: legal.destination.x - origin.x, dy: legal.destination.y - origin.y };
                        }"""
                    )
                    responsive_page.locator(f'[data-move="{move["dx"]},{move["dy"]}"]').click()
                    moved = responsive_page.evaluate("() => ({ ...window.bellsPrototype.engine.player.pos })")
                    require(
                        moved == {"x": move["origin"]["x"] + move["dx"], "y": move["origin"]["y"] + move["dy"]},
                        "FP-0 touch movement pad did not move Ren to its legal destination.",
                    )
                    movement_box = responsive_page.locator('[data-move="0,-1"]').bounding_box()
                    require(movement_box is not None and movement_box["width"] >= 44 and movement_box["height"] >= 44,
                            f"FP-0 touch target is smaller than 44px: {movement_box}.")
                    for _step in range(48):
                        plan = responsive_page.evaluate(
                            """() => {
                              const engine = window.bellsPrototype.engine;
                              if (engine.result) return { result: engine.result };
                              if (engine.phase !== 'player_command') return { wait: true };
                              const priority = ['cinder-route', 'dawn-signal', 'courier-cut'];
                              const skill = engine.getActionAvailability()
                                .filter(entry => entry.available)
                                .sort((left, right) => priority.indexOf(left.id) - priority.indexOf(right.id))[0];
                              if (skill) return { action: `skill:${skill.id}` };
                              if (engine.movementPoints <= 0) return { action: 'stance:guard' };
                              const origin = engine.player.pos;
                              const enemy = engine.enemy.pos;
                              const blocked = engine.map.blocked;
                              const enemyKey = `${enemy.x},${enemy.y}`;
                              const directions = [
                                [-1, 0], [1, 0], [0, -1], [0, 1],
                                [-1, -1], [1, -1], [-1, 1], [1, 1],
                              ];
                              const routeDistance = start => {
                                const queue = [{ ...start, distance: 0 }];
                                const seen = new Set([`${start.x},${start.y}`]);
                                while (queue.length) {
                                  const current = queue.shift();
                                  if (Math.max(Math.abs(current.x - enemy.x), Math.abs(current.y - enemy.y)) <= 4) {
                                    return current.distance;
                                  }
                                  for (const [dx, dy] of directions) {
                                    const x = current.x + dx;
                                    const y = current.y + dy;
                                    const key = `${x},${y}`;
                                    if (x < 0 || y < 0 || x >= engine.map.width || y >= engine.map.height
                                      || blocked.has(key) || key === enemyKey || seen.has(key)) continue;
                                    if (dx && dy && (blocked.has(`${current.x + dx},${current.y}`)
                                      || blocked.has(`${current.x},${current.y + dy}`))) continue;
                                    seen.add(key);
                                    queue.push({ x, y, distance: current.distance + 1 });
                                  }
                                }
                                return Number.POSITIVE_INFINITY;
                              };
                              const move = engine.getLegalMoves('ren')
                                .sort((left, right) => routeDistance(left.destination) - routeDistance(right.destination))[0];
                              if (!move) return { action: 'stance:guard' };
                              return {
                                dx: move.destination.x - origin.x,
                                dy: move.destination.y - origin.y,
                              };
                            }"""
                        )
                        if plan.get("result"):
                            break
                        if plan.get("wait"):
                            responsive_page.wait_for_function(
                                "() => window.bellsPrototype.engine.result"
                                " || window.bellsPrototype.engine.phase === 'player_command'",
                                timeout=15_000,
                            )
                            continue
                        if plan.get("action"):
                            responsive_page.locator(f'[data-action="{plan["action"]}"]').click()
                            responsive_page.wait_for_function(
                                "() => window.bellsPrototype.engine.result"
                                " || window.bellsPrototype.engine.phase === 'player_command'",
                                timeout=15_000,
                            )
                        else:
                            responsive_page.locator(f'[data-move="{plan["dx"]},{plan["dy"]}"]').click()
                            responsive_page.wait_for_timeout(75)
                    touch_terminal = responsive_page.evaluate("() => window.bellsPrototype.engine.result")
                    require(touch_terminal == "victory", f"FP-0 touch-only gameplay path ended at {touch_terminal!r}.")
                elif path == "campaign.html":
                    chapter_button = responsive_page.locator("[data-chapter-id]:not(:disabled)").first
                    chapter_id = chapter_button.get_attribute("data-chapter-id")
                    chapter_button.click()
                    require(
                        responsive_page.evaluate("id => document.activeElement?.dataset.chapterId === id", chapter_id),
                        "Campaign chapter focus was lost after its control was rebuilt.",
                    )
                elif path.startswith("battle.html"):
                    enemy_button = responsive_page.locator("#enemyPanel button[data-actor-id]").first
                    enemy_id = enemy_button.get_attribute("data-actor-id")
                    enemy_button.click()
                    require(
                        responsive_page.evaluate("id => document.activeElement?.dataset.actorId === id", enemy_id),
                        "Battle enemy focus was lost after target cards were rebuilt.",
                    )
                elif path == "camp.html":
                    member_button = responsive_page.locator("[data-member-id]:not(:disabled)").first
                    member_id = member_button.get_attribute("data-member-id")
                    member_button.click()
                    require(
                        responsive_page.evaluate("id => document.activeElement?.dataset.memberId === id", member_id),
                        "Camp member focus was lost after party controls were rebuilt.",
                    )
                audio_surfaces[path] = {
                    "aria_pressed": audio_toggle.get_attribute("aria-pressed"),
                    "aria_valuetext": audio_volume.get_attribute("aria-valuetext"),
                    "status": audio_status.inner_text(),
                }
                responsive_widths[path] = widths
                semantic_audits[path] = semantic
            responsive_context.close()

            reduced_context = browser.new_context(viewport={"width": 1024, "height": 768}, reduced_motion="reduce")
            reduced_page = reduced_context.new_page()
            reduced_page.set_default_timeout(20_000)
            reduced_page.set_default_navigation_timeout(60_000)
            reduced_motion_canvases: dict[str, bool] = {}
            for path, canvas_selector in (
                ("index.html", "#gameCanvas"),
                ("campaign.html", "#mapCanvas"),
                (f"battle.html?encounter={encounter_id}", "#battleCanvas"),
                ("battle.html?encounter=fp1-mateus", "#battleCanvas"),
            ):
                response = reduced_page.goto(f"{base}/{path}", wait_until="domcontentloaded")
                require(response is not None and response.status == 200, f"Reduced-motion {path} failed delivery.")
                reduced_page.locator(canvas_selector).wait_for()
                if path == "battle.html?encounter=fp1-mateus":
                    reduced_page.wait_for_function(
                        "() => document.querySelector('#battleCanvas')?.dataset.stageArtState === 'ready'",
                    )
                reduced_page.wait_for_timeout(750)
                before = reduced_page.locator(canvas_selector).evaluate("canvas => canvas.toDataURL()")
                reduced_page.wait_for_timeout(350)
                after = reduced_page.locator(canvas_selector).evaluate("canvas => canvas.toDataURL()")
                require(before == after, f"Reduced-motion canvas kept animating on {path}.")
                reduced_motion_canvases[path] = True
            reduced_context.close()

            restricted_errors: list[str] = []
            restricted = browser.new_context(viewport={"width": 1024, "height": 768})
            restricted.add_init_script(
                """Object.defineProperty(window, 'localStorage', {
                  configurable: true,
                  get() { throw new DOMException('Storage denied by QA context.', 'SecurityError'); },
                });"""
            )
            restricted_page = restricted.new_page()
            restricted_page.set_default_timeout(15_000)
            restricted_page.set_default_navigation_timeout(45_000)
            restricted_page.on("pageerror", lambda error: restricted_errors.append(str(error)))
            restricted_pages = (
                ("campaign.html", "#resetCampaign"),
                ("camp.html", "#memberName"),
                (f"battle.html?encounter={encounter_id}", "#encounterTitle"),
                ("credits.html", "#sealCredits"),
            )
            for path, selector in restricted_pages:
                response = restricted_page.goto(f"{base}/{path}", wait_until="domcontentloaded")
                require(response is not None and response.status == 200, f"Restricted-storage {path} failed delivery.")
                restricted_page.locator(selector).wait_for()
            require(not restricted_errors, f"Denied-storage pages crashed: {restricted_errors}")
            restricted.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    require(not console_errors, f"Console errors: {console_errors}")
    require(not page_errors, f"Page errors: {page_errors}")
    require(not delivery_errors, f"HTTP errors: {delivery_errors}")
    evidence.update(
        clean_run=run_prefix,
        camp_round_trip=True,
        first_clear_speed_locked=True,
        campaign_dodge=dodge_result,
        campaign_item=item_result,
        repeat_seed=seed,
        repeat_terminal="VICTORY",
        repeat_queue_wins=5,
        repeat_final=final,
        takamine_stage_art=stage_art,
        regional_stage_art=regional_stage_art,
        takamine_fallback_colors=fallback_colors,
        boss_fallback_colors=boss_fallback_colors,
        wrong_size_art_fallback=True,
        party_portrait_art={"campaign": campaign_party_art, "camp": camp_party_art, "aya": aya_portrait_art, "fallbackColors": portrait_fallback_colors},
        formation_followers=formation_followers,
        keyboard_terminal_link=True,
        credits_seed=credits_seed,
        credits_final=credits_final,
        evidence_export=evidence_export,
        recovery_checkpoint=recovery_result,
        route_action=route_action,
        catalog_seed=catalog_seed,
        catalog_browser=catalog_browser,
        audio_surfaces=audio_surfaces,
        responsive_widths=responsive_widths,
        semantic_audits=semantic_audits,
        reduced_motion_canvases=reduced_motion_canvases,
        denied_storage_pages=[path for path, _selector in restricted_pages],
        console_errors=[],
        page_errors=[],
        delivery_errors=[],
        ok=True,
    )
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", help="Explicit Chrome/Edge executable path")
    arguments = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(run_smoke(find_chromium(arguments.chromium)), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
