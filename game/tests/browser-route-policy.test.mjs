import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [battleSource, routeSource] = await Promise.all([
  readFile(new URL('../battle.js', import.meta.url), 'utf8'),
  readFile(new URL('../tools/browser-route-playthrough.py', import.meta.url), 'utf8'),
]);

test('battle publishes one non-mutating competent command suggestion for rendered-control QA', () => {
  const publish = battleSource.slice(
    battleSource.indexOf('function publishRenderedBattleState(snapshot)'),
    battleSource.indexOf('\nfunction renderTempo', battleSource.indexOf('function publishRenderedBattleState(snapshot)')),
  );
  assert.match(publish, /const suggestion = chooseRepeatBattleCommand\(engine\)/);
  assert.match(publish, /canvas\.dataset\.suggestedCommand = suggestion\.type/);
  assert.match(publish, /canvas\.dataset\.suggestedDx = String\(suggestion\.dx\)/);
  assert.match(publish, /canvas\.dataset\.suggestedSkillId = suggestion\.skillId/);
  assert.match(publish, /canvas\.dataset\.suggestedTargetId = suggestion\.targetId/);
  assert.doesNotMatch(publish, /engine\.(?:move|useSkill|guard|performObjectiveAction)\(/);
});

test('route runner executes suggestions only through visible controls and keyboard movement', () => {
  const execute = routeSource.slice(
    routeSource.indexOf('    def execute_battle_suggestion'),
    routeSource.indexOf('    def move_battle_actor_toward', routeSource.indexOf('    def execute_battle_suggestion')),
  );
  assert.match(execute, /self\.page\.keyboard\.press\(key\)/);
  assert.match(execute, /self\.page\.locator\("#skillSelect"\)\.select_option\(skill_id\)/);
  assert.match(execute, /self\.page\.locator\("#targetSelect"\)\.select_option\(target_id\)/);
  assert.match(execute, /self\.page\.locator\('\[data-command="skill"\]'\)\.click\(\)/);
  assert.match(execute, /confirm\.click\(\)/);
  assert.doesNotMatch(execute, /evaluate|local_storage|session_storage/);
  assert.ok(
    execute.indexOf(`self.page.locator('[data-command="skill"]').click()`) < execute.indexOf('self.page.locator("#skillSelect").select_option(skill_id)'),
    'the Skill command must enable its native selectors before the runner uses them',
  );
  assert.match(routeSource, /if self\.page\.locator\('\[data-command="move"\]'\)\.is_disabled\(\):/);
});

test('exact field navigation balances target distance with bounded revisit pressure', () => {
  const navigate = routeSource.slice(
    routeSource.indexOf('    def navigate_to_exact_target'),
    routeSource.indexOf('    def finish_published_route_markers', routeSource.indexOf('    def navigate_to_exact_target')),
  );
  assert.match(navigate, /\+ 3 \* visits\.get/);
  assert.match(navigate, /blocked_edges\.add\(\(here, vector\)\)/);
  assert.match(navigate, /self\.move\(vector\)/);
  assert.match(routeSource, /def on_battle_page\(self\) -> bool:/);
  assert.match(routeSource, /self\.page\.locator\("#battleStateBadge"\)\.count\(\) > 0/);
  assert.match(routeSource, /self\.page\.wait_for_timeout\(50\)/);
});

test('a route exit blocked by newly due work hands control back to the rendered route ledger', () => {
  const finishField = routeSource.slice(
    routeSource.indexOf('    def finish_published_field_objectives'),
    routeSource.indexOf('    def finish_dialogue_and_choices', routeSource.indexOf('    def finish_published_field_objectives')),
  );
  assert.match(finishField, /interaction\.click\(\)/);
  assert.match(finishField, /self\.page\.locator\("#routeDueList \[data-route-activity-id\]"\)\.count\(\)/);
  assert.match(finishField, /self\.drain_due_route_work\(scene_key\)/);
  assert.match(finishField, /if self\.field_objective_target\(\) != published:\s+continue/);
});

test('multi-map route work cannot be abandoned merely because its activity ID stays stable', () => {
  const drain = routeSource.slice(
    routeSource.indexOf('    def drain_due_route_work'),
    routeSource.indexOf('    def return_to_story_route_if_available', routeSource.indexOf('    def drain_due_route_work')),
  );
  assert.match(drain, /for _ in range\(30\):/);
  assert.match(drain, /self\.start_due_entries\(\)/);
  assert.match(drain, /self\.finish_published_route_markers\(scene_key\)/);
  assert.doesNotMatch(drain, /after_due == before_due and after_marker == before_marker/);
  assert.match(drain, /raise RouteBlocked\("route-work-loop"/);
});

test('story-complete recovery keeps the active clean receipt through the credits boundary', () => {
  assert.match(routeSource, /proof_badge = page\.locator\("#runProofStatus"\)/);
  assert.match(routeSource, /proof_badge\.get_attribute\("data-proof"\) != "active"/);
  assert.doesNotMatch(routeSource, /proof\.startswith\("Clean run "\)/);
  assert.match(
    routeSource,
    /before_next_scene = page\.locator\("#nextScene"\)\.inner_text\(\)[\s\S]*after_next_scene = page\.locator\("#nextScene"\)\.inner_text\(\)[\s\S]*if before == after:\s+if before_next_scene != after_next_scene and after_next_scene\.startswith\("View credits"\):\s+continue/,
  );
  assert.match(routeSource, /driver\.on_credits_page\(\):\s+driver\.seal_credits\(\)/);
  assert.match(routeSource, /self\.page\.locator\("#sealCredits"\)/);
  assert.match(routeSource, /route_proof\.startswith\("215\/215 "\)/);
  assert.match(routeSource, /status\.startswith\("Credits complete · receipt sealed"\)/);
  assert.match(routeSource, /self\.page\.locator\("#exportEvidence"\)/);
  assert.match(routeSource, /evidence\["playtestEvidenceExport"\] = driver\.export_credits_evidence/);
});

test('native field-choice prompts retain their published player-visible default', () => {
  const handler = routeSource.slice(
    routeSource.indexOf('def accept_player_dialog'),
    routeSource.indexOf('\n\n@dataclass', routeSource.indexOf('def accept_player_dialog')),
  );
  assert.match(handler, /dialog\.type == "prompt"/);
  assert.match(handler, /dialog\.accept\(dialog\.default_value\)/);
  assert.match(routeSource, /page\.on\("dialog", accept_player_dialog\)/);
  assert.doesNotMatch(handler, /evaluate|localStorage|sessionStorage/);
});

test('post-victory recovery uses Campaign, Camp, rest, and Remedy controls', () => {
  assert.match(routeSource, /self\.recover_after_battle\(\)/);
  assert.match(routeSource, /self\.page\.locator\('a\[href="camp\.html"\]'\)\.first\.click\(\)/);
  assert.match(routeSource, /self\.page\.locator\("#restParty"\)/);
  assert.match(routeSource, /self\.page\.locator\("#inventoryList \[data-use-item\]"\)/);
  assert.match(routeSource, /self\.return_from_camp\(\)/);
  assert.match(routeSource, /locator\('a\[href="campaign\.html"\]'\)\.first\.click\(no_wait_after=True\)/);
  assert.match(routeSource, /def play_battle_and_resume_scene\(self, scene_key: str\)/);
  assert.match(routeSource, /if self\.scene_key\(\) == scene_key:\s+self\.finish_story_scene\(\)/);
  assert.match(routeSource, /if self\.use_ready_exit\(initial\):\s+if self\.on_battle_page\(\):\s+self\.play_battle_and_resume_scene\(initial\)/);
  assert.match(routeSource, /driver\.finish_story_scene\(\)\s+if driver\.on_battle_page\(\):\s+driver\.play_battle_and_resume_scene\(before\)/);
});

test('bounded sessions can continue only through labeled rendered recovery controls', () => {
  assert.match(routeSource, /page\.locator\("#recoveryFile"\)\.set_input_files\(str\(recovery_in\)\)/);
  assert.match(routeSource, /page\.locator\("#exportRecovery"\)\.click\(\)/);
  assert.match(routeSource, /download\.save_as\(str\(recovery_out\)\)/);
  assert.match(routeSource, /"recoveryOnly": True/);
  assert.match(routeSource, /"proofClaimed": False/);
  assert.match(routeSource, /"code": "recovery-frontier"/);
  assert.match(routeSource, /deadline=started \+ args\.max_seconds - \(\s+args\.frontier_reserve_seconds if args\.recovery_out else 0\s+\)/);
  assert.match(routeSource, /if args\.recovery_out and time\.monotonic\(\) >= budget\.deadline:/);
  assert.match(routeSource, /args\.frontier_reserve_seconds >= args\.max_seconds/);
  assert.doesNotMatch(routeSource, /localStorage|sessionStorage|add_init_script|page\.evaluate/);
});
