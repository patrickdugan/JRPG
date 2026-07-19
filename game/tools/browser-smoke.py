#!/usr/bin/env python3
"""Isolated Chromium QA for cross-page saves and repeat Auto-Grind."""

from __future__ import annotations

import argparse
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
            require(page.locator("#memberName").inner_text() == "Ren Ishikawa", "Camp party failed.")
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

            seed = page.evaluate(
                """async id => {
                  const a = await import('./advancement.mjs');
                  const raw = localStorage.getItem(a.DEFAULT_ADVANCEMENT_SAVE_KEY);
                  const loaded = raw ? a.loadAdvancementState(raw) : { ok: false };
                  let state = loaded.ok ? loaded.value : a.createAdvancementState();
                  if (a.getEncounterWinCount(state, id) === 0) state = a.recordEncounterWin(state, id);
                  state = a.setSpeedMultiplier(state, 1);
                  localStorage.setItem(a.DEFAULT_ADVANCEMENT_SAVE_KEY, a.serializeAdvancementState(state));
                  return { wins: a.getEncounterWinCount(state, id), speed: state.speedMultiplier };
                }""",
                encounter_id,
            )
            require(seed == {"wins": 1, "speed": 1}, "Repeat seed was not one prior win.")
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
            page.locator("#autoGrind").click()
            page.wait_for_timeout(150)
            require(page.locator("#autoGrind").get_attribute("aria-pressed") == "true", "Auto-Grind did not start.")
            page.wait_for_function(
                "() => !document.querySelector('#continueCampaign').hidden",
                timeout=60_000,
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
            require(final == {"wins": 2, "speed": 4}, "Repeat reward or speed authority drifted.")

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
            require(exported_report.get("schemaVersion") == 1, "Evidence export schema drifted.")
            require(exported_report.get("story", {}).get("creditsComplete") is True, "Evidence export omitted credits completion.")
            require(exported_report.get("combat", {}).get("complete") is True, "Evidence export omitted first-clear completion.")
            require(exported_report.get("requiredRoute", {}).get("complete") is True, "Evidence export omitted the 215/215 route.")
            require(exported_report.get("proof", {}).get("durationProven") is False, "Zero-time browser seed fabricated duration proof.")
            require(exported_report.get("proof", {}).get("releaseTargetProven") is False, "Zero-time browser seed fabricated release proof.")
            require(exported_report.get("proof", {}).get("chapterTimingComplete") is True, "Browser play left unattributed chapter time.")
            require(exported_report.get("playtime", {}).get("unattributedMs") == 0, "Evidence export contains unattributed playtime.")
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
        repeat_seed=seed,
        repeat_terminal="VICTORY",
        repeat_final=final,
        keyboard_terminal_link=True,
        credits_seed=credits_seed,
        credits_final=credits_final,
        evidence_export=evidence_export,
        route_action=route_action,
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
