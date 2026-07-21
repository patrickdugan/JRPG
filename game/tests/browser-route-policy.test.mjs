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
  assert.doesNotMatch(publish, /engine\.(?:move|useSkill|useItem|guard|dodge|performObjectiveAction)\(/);
  assert.doesNotMatch(publish, /itemConsumption\s*=/, 'render-time policy inspection cannot consume an item');
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

test('completionist fieldwork can hand newly due work back to the rendered route ledger', () => {
  const finishField = routeSource.slice(
    routeSource.indexOf('    def finish_published_field_objectives'),
    routeSource.indexOf('    def finish_dialogue_and_choices', routeSource.indexOf('    def finish_published_field_objectives')),
  );
  assert.match(finishField, /interaction\.click\(\)/);
  assert.match(finishField, /self\.completionist and self\.page\.locator\("#routeDueList \[data-route-activity-id\]"\)\.count\(\)/);
  assert.match(finishField, /self\.drain_due_route_work\(scene_key\)/);
  assert.match(finishField, /if self\.field_objective_target\(\) != published:\s+continue/);
});

test('published field objectives yield to newly ready story gates and fail fast on a stable blocked target', () => {
  const finishField = routeSource.slice(
    routeSource.indexOf('    def finish_published_field_objectives'),
    routeSource.indexOf('    def finish_dialogue_and_choices', routeSource.indexOf('    def finish_published_field_objectives')),
  );
  const firstPublishedRead = finishField.indexOf('published = self.field_objective_target()');
  assert.ok(firstPublishedRead > 0);
  assert.ok(
    finishField.indexOf('if self.advance_story_if_ready():') < firstPublishedRead,
    'the newly enabled Next scene control must win before another published-target interaction',
  );
  assert.ok(
    finishField.indexOf('if self.launch_pending_battle_if_ready():') < firstPublishedRead,
    'a pending authored battle must win before unrelated published fieldwork',
  );
  assert.match(
    finishField,
    /interaction\.click\(\)[\s\S]*if self\.advance_story_if_ready\(\):[\s\S]*after_published = self\.field_objective_target\(\)[\s\S]*if after_published == published:/,
  );
  assert.match(finishField, /"field-objective-requirement-missing"/);
  assert.match(finishField, /"field-objective-no-progress"/);
  assert.match(finishField, /if not requirement_missing and not no_progress:[\s\S]*?continue/);
  assert.match(finishField, /feedback=feedback/);
});

test('Storyworld, story, and pending-battle convergence helpers use rendered controls and exclude grind replays', () => {
  const helpers = routeSource.slice(
    routeSource.indexOf('    def finish_visible_storyworld'),
    routeSource.indexOf('    def finish_published_field_objectives', routeSource.indexOf('    def advance_story_if_ready')),
  );
  assert.match(helpers, /self\.page\.locator\("#storyworldPanel"\)/);
  assert.match(helpers, /self\.finish_visible_storyworld\(\)/);
  assert.match(helpers, /self\.page\.locator\("#nextScene"\)/);
  assert.match(helpers, /next_scene\.click\(\)/);
  assert.match(helpers, /self\.page\.locator\("#launchBattle"\)/);
  assert.match(helpers, /startswith\("Enter encounter:"\)/);
  assert.match(helpers, /launch\.click\(\)/);
  assert.doesNotMatch(helpers, /evaluate|local_storage|session_storage/);
});

test('visible Storyworld encounters choose a stable rendered option and never mutate runtime state directly', () => {
  const storyworld = routeSource.slice(
    routeSource.indexOf('    def finish_visible_storyworld'),
    routeSource.indexOf('    def advance_story_if_ready', routeSource.indexOf('    def finish_visible_storyworld')),
  );
  assert.match(storyworld, /panel\.count\(\) == 0 or not panel\.is_visible\(\)/);
  assert.match(storyworld, /self\.page\.locator\("#storyworldContinue"\)/);
  assert.match(storyworld, /continuation\.is_visible\(\) and not continuation\.is_disabled\(\)/);
  assert.match(storyworld, /self\.page\.locator\("\[data-storyworld-option-id\]:visible"\)/);
  assert.match(storyworld, /visible_options\.append\(\(option_id, index\)\)/);
  assert.match(storyworld, /_, selected_index = min\(visible_options\)/);
  assert.match(storyworld, /options\.nth\(selected_index\)\.click\(\)/);
  assert.doesNotMatch(storyworld, /evaluate|localStorage|sessionStorage|storage_adapter|chooseStoryworldOption/);
});

test('narrative mode leaves the 215-entry ledger optional while explicit completionist mode drains it', () => {
  const finishScene = routeSource.slice(
    routeSource.indexOf('    def finish_story_scene'),
    routeSource.indexOf('\n\ndef find_chromium', routeSource.indexOf('    def finish_story_scene')),
  );
  assert.match(finishScene, /if self\.completionist:\s+self\.drain_due_route_work\(initial\)/);
  assert.doesNotMatch(finishScene, /self\.finish_dialogue_and_choices\(\)\s+self\.drain_due_route_work\(initial\)/);
  assert.match(routeSource, /parser\.add_argument\(\s+"--completionist"/);
  assert.match(routeSource, /PlayerDriver\(page, budget, completionist=args\.completionist\)/);
  assert.match(routeSource, /"routeMode": "completionist-215" if args\.completionist else "narrative-82-scenes"/);
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

test('credits sealing honors the selected rendered gate without inventing elapsed playtime', () => {
  assert.match(routeSource, /proof_badge = page\.locator\("#runProofStatus"\)/);
  assert.match(routeSource, /proof_badge\.get_attribute\("data-proof"\) != "active"/);
  assert.doesNotMatch(routeSource, /proof\.startswith\("Clean run "\)/);
  assert.match(
    routeSource,
    /before_next_scene = page\.locator\("#nextScene"\)\.inner_text\(\)[\s\S]*after_next_scene = page\.locator\("#nextScene"\)\.inner_text\(\)[\s\S]*if before == after:\s+if before_next_scene != after_next_scene and after_next_scene\.startswith\("View credits"\):\s+continue/,
  );
  assert.match(routeSource, /driver\.on_credits_page\(\):\s+driver\.seal_credits\(\)/);
  assert.match(routeSource, /self\.page\.locator\("#sealCredits"\)/);
  assert.match(routeSource, /if self\.completionist and \(/);
  assert.match(routeSource, /re\.search\(r"\\b215\/215\\b", route_proof\)/);
  assert.match(routeSource, /if seal\.is_disabled\(\):\s+raise RouteBlocked\(\s+"credits-seal-gate"/);
  assert.match(routeSource, /will not synthesize playtime or bypass it/);
  assert.match(routeSource, /normalized_status\.startswith\("credits complete"\)/);
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
  assert.match(routeSource, /def return_to_campaign_for_recovery\(self\) -> bool:/);
  assert.match(routeSource, /locator\('a\[href="campaign\.html"\]:visible'\)\.first/);
  assert.match(routeSource, /driver\.return_to_campaign_for_recovery\(\)/);
  assert.match(routeSource, /"throughRenderedCampaignLink": returned/);
  assert.match(routeSource, /"bounded" if error\.code == "time-budget" and args\.recovery_out else "blocked"/);
  assert.match(routeSource, /args\.frontier_reserve_seconds >= args\.max_seconds/);
  assert.doesNotMatch(routeSource, /localStorage|sessionStorage|add_init_script|page\.evaluate/);
});
