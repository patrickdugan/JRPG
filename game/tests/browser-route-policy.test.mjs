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
});

test('post-victory recovery uses Campaign, Camp, rest, and Remedy controls', () => {
  assert.match(routeSource, /self\.recover_after_battle\(\)/);
  assert.match(routeSource, /self\.page\.locator\('a\[href="camp\.html"\]'\)\.first\.click\(\)/);
  assert.match(routeSource, /self\.page\.locator\("#restParty"\)/);
  assert.match(routeSource, /self\.page\.locator\("#inventoryList \[data-use-item\]"\)/);
  assert.match(routeSource, /self\.return_from_camp\(\)/);
  assert.match(routeSource, /def play_battle_and_resume_scene\(self, scene_key: str\)/);
  assert.match(routeSource, /if self\.scene_key\(\) == scene_key:\s+self\.finish_story_scene\(\)/);
});

test('bounded sessions can continue only through labeled rendered recovery controls', () => {
  assert.match(routeSource, /page\.locator\("#recoveryFile"\)\.set_input_files\(str\(recovery_in\)\)/);
  assert.match(routeSource, /page\.locator\("#exportRecovery"\)\.click\(\)/);
  assert.match(routeSource, /download\.save_as\(str\(recovery_out\)\)/);
  assert.match(routeSource, /"recoveryOnly": True/);
  assert.match(routeSource, /"proofClaimed": False/);
  assert.match(routeSource, /"code": "recovery-frontier"/);
  assert.doesNotMatch(routeSource, /localStorage|sessionStorage|add_init_script|page\.evaluate/);
});
