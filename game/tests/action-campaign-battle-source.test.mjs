import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../action-campaign-battle.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../action-campaign-battle.css', import.meta.url), 'utf8');
const browser = readFileSync(new URL('../action-campaign-battle.js', import.meta.url), 'utf8');
const inputGrammar = readFileSync(new URL('../action-input-grammar.mjs', import.meta.url), 'utf8');
const model = readFileSync(new URL('../action-campaign-battle-model.mjs', import.meta.url), 'utf8');

test('action page preserves an isolated laboratory lane and adds explicit canonical settlement', () => {
  assert.match(html, /action-campaign-battle\.css/u);
  assert.match(html, /action-campaign-battle\.js/u);
  assert.match(browser, /from '\.\/action-campaign-battle-model\.mjs'/u);
  assert.match(model, /from '\.\/action-combat\.mjs'/u);
  assert.match(model, /from '\.\/action-combos\.mjs'/u);
  assert.match(model, /from '\.\/action-objective-runtime\.mjs'/u);
  assert.match(model, /from '\.\/battle-result-contract\.mjs'/u);
  assert.doesNotMatch(model, /from '\.\/battle-settlement\.mjs'|settleActionCampaignBattleVictory/u);
  assert.match(browser, /loadActionLaboratorySeed/u);
  assert.match(browser, /canonicalStorageUnchanged/u);
  assert.match(browser, /const canonicalMode = query\.canonical && !sliceMode/u);
  assert.match(browser, /settleBattleVictory/u);
  assert.match(browser, /createAdvancementStorageAdapter/u);
  assert.match(browser, /createLoadoutStorageAdapter/u);
  assert.match(browser, /createRunReceiptStorageAdapter/u);
  assert.match(browser, /recordRunPlaytime/u);
  assert.match(browser, /flushCanonicalPlaytime/u);
  assert.match(browser, /handoff: query\.handoff/u);
  assert.doesNotMatch(browser, /from '\.\/battle\.js'|from '\.\/engine\.mjs'/u);
});

test('page carries text authority, keyboard and touch controls, and a session-local result gate', () => {
  const canvas = html.match(/<canvas[\s\S]*?<\/canvas>/u)?.[0] ?? '';
  assert.match(canvas, /tabindex="0"/u);
  assert.match(canvas, /aria-describedby="battleInstructions battleReadout"/u);
  assert.match(html, /id="battleReadout"[^>]*aria-label="Text battle state"/u);
  assert.match(html, /id="battleModeLabel"/u);
  assert.match(html, /id="objectiveRequirements"/u);
  assert.match(html, /id="partyReadout"/u);
  assert.match(html, /id="enemyReadout"/u);
  assert.match(html, /id="continueCampaign"[^>]*hidden[^>]*aria-disabled="true"/u);
  assert.match(html, /<kbd>E<\/kbd>[\s\S]*Hold objective action/u);
  assert.match(html, /<kbd>L<\/kbd>[\s\S]*Hunter–Priest combo/u);
  assert.match(html, /<kbd>Q<\/kbd><kbd>Shift<\/kbd>[\s\S]*Dash/u);
  assert.match(html, /<kbd>S<\/kbd>[\s\S]*Low slide/u);
  assert.match(html, /<kbd>U<\/kbd>[\s\S]*Character rising maneuver/u);
  assert.match(html, /<kbd>I<\/kbd>[\s\S]*Character air descent/u);
  assert.match(html, /id="risingGuide"/u);
  assert.match(html, /id="airGuide"/u);
  assert.match(html, /<kbd>←<\/kbd><kbd>→<\/kbd>[\s\S]*double-tap dash/u);
  assert.match(html, /<kbd>Space<\/kbd>[\s\S]*Jump/u);
  assert.match(html, /<kbd>Z<\/kbd>[\s\S]*Weapon[\s\S]*risingGuide[\s\S]*slide \/[\s\S]*airGuide/u);
  assert.match(html, /<kbd>X<\/kbd>[\s\S]*Art/u);
  assert.match(html, /<kbd>Tab<\/kbd>[\s\S]*Swap with AI support/u);
  assert.match(html, /id="partyTitle">Duo fighters/u);
  assert.match(html, /id="partyReadout"[^>]*aria-label="Duo combat party"/u);
  assert.match(html, /data-held-control="left"/u);
  assert.match(html, /id="movementReadout"[^>]*aria-label="Movement readiness"/u);
  assert.match(html, /data-action-control="dash"/u);
  assert.match(html, /data-action-control="slide"/u);
  assert.match(html, /data-action-control="uppercut"/u);
  assert.match(html, /data-action-control="thunder-kick"/u);
  assert.match(html, /data-action-control="switch"/u);
  assert.match(browser, /ACTION_LAB_FIGHTER_ACTOR_IDS/u);
  assert.match(browser, /fighterActorIds: ACTION_LAB_FIGHTER_ACTOR_IDS/u);
  assert.doesNotMatch(browser, /ACTION_LAB_SUPPORT_ACTOR_ID = 'aya'/u);
  assert.match(browser, /AI SUPPORT/u);
  assert.match(browser, /dataset\.duoEnabled/u);
  assert.match(browser, /dataset\.supportActorId/u);
  assert.match(browser, /dataset\.supportState/u);
  assert.match(browser, /CAMPAIGN BATTLE · LIVE CONSEQUENCES/u);
  assert.match(browser, /dataset\.actorId/u);
  assert.match(browser, /dataset\.positionX/u);
  assert.match(browser, /dataset\.requirementId/u);
  assert.match(browser, /dataset\.targetX/u);
  assert.match(browser, /dataset\.entityType/u);
  assert.match(browser, /dataset\.destinationX/u);
  assert.match(browser, /row\.dataset\.attackId = choice\.id/u);
  assert.match(browser, /row\.dataset\.ready = String\(choice\.state\.ready\)/u);
  assert.match(browser, /row\.dataset\.reachPx/u);
  assert.match(browser, /row\.dataset\.subweaponId = choice\.id/u);
  assert.match(browser, /row\.dataset\.input = choice\.input/u);
  assert.match(model, /aiControlledActorIds/u);
  assert.match(html, /data-action-control="combo"[^>]*>Hunter \+ Priest</u);
});

test('combo input is edge-triggered and calls the kernel only on an explicit request', () => {
  assert.match(browser, /key === 'l' && !event\.repeat/u);
  assert.match(browser, /pressed\.combo = true/u);
  assert.match(browser, /comboPressed: pressed\.combo/u);
  assert.match(model, /if \(input\.comboPressed\)[\s\S]*session\.kernel\.requestCombo/u);
  assert.match(model, /HUNTER_PRIEST_COMBO_CONTRACT\.id/u);
  assert.match(model, /combo\.attackRequests\.map/u);
});

test('movement input preserves key edges, jump hold duration, and browser-observable state', () => {
  assert.match(browser, /key === 'q' \|\| key === 'shift'[\s\S]*queueManeuver\('dash'\)/u);
  assert.match(browser, /key === 's'[\s\S]*queueManeuver\('slide'\)/u);
  assert.match(browser, /key === 'u'[\s\S]*queueManeuver\('uppercut'\)/u);
  assert.match(browser, /key === 'i'[\s\S]*queueManeuver\('thunder-kick'\)/u);
  assert.match(browser, /resolveCompactActionKeyDown/u);
  assert.match(browser, /resolveCompactActionKeyUp/u);
  assert.match(inputGrammar, /COMPACT_DASH_TAP_WINDOW_MS = 220/u);
  assert.match(inputGrammar, /normalizedKey === 'arrowleft' \|\| normalizedKey === 'arrowright'/u);
  assert.match(inputGrammar, /held\.up[\s\S]*id: 'uppercut'/u);
  assert.match(inputGrammar, /held\.down[\s\S]*grounded \? 'slide' : 'thunder-kick'/u);
  assert.match(inputGrammar, /normalizedKey === 'z'[\s\S]*type: 'attack', index: 0/u);
  assert.match(inputGrammar, /normalizedKey === 'x'[\s\S]*type: 'attack', index: 1/u);
  assert.match(browser, /jumpHeld: held\.jump/u);
  assert.match(browser, /advanceActionCampaignBattle\(session, 0,[\s\S]*maneuverPressed: maneuverId/u);
  assert.doesNotMatch(browser, /maneuverPressed: pressed\.maneuver/u);
  assert.match(browser, /dataset\.movementState/u);
  assert.match(browser, /dataset\.movementVelocityX/u);
  assert.match(browser, /dataset\.movementPositionX/u);
  assert.match(browser, /dataset\.lastManeuverInputLatencyMs/u);
  assert.match(model, /session\.kernel\.requestManeuver/u);
  assert.match(model, /type: 'maneuver-blocked'/u);
});

test('combo readout exposes name, contributing arts, reason, proximity, and linked event callouts', () => {
  assert.match(html, /id="comboTitle"/u);
  assert.match(html, /id="comboAvailability"/u);
  assert.match(html, /id="comboArts"[^>]*aria-label="Contributing combo arts"/u);
  assert.match(html, /id="comboProximity"/u);
  assert.match(browser, /snapshot\.combo\.participants/u);
  assert.match(browser, /snapshot\.combo\.separationPx/u);
  assert.match(browser, /event\.type === 'combo-start'/u);
  assert.match(browser, /event\.comboId[\s\S]*linked hit/u);
  assert.match(browser, /dataset\.comboAvailable/u);
  assert.match(browser, /recentMessages\.indexOf\(message\)[\s\S]*recentMessages\.splice\(existingIndex, 1\)/u);
  assert.match(browser, /comboResponseEvent[\s\S]*event\.type === 'combo-start'[\s\S]*event\.type === 'combo-blocked'/u);
  assert.match(browser, /if \(comboResponseEvent\) announce\(describeEvent\(comboResponseEvent, snapshot\)\)/u);
});

test('runtime clones advancement and loadout, reads Storyworld context, and pauses while hidden', () => {
  assert.match(browser, /loadActionLaboratorySeed/u);
  assert.match(browser, /loadStoryworldBattlePresentation/u);
  assert.match(browser, /document\.addEventListener\('visibilitychange'/u);
  assert.match(browser, /if \(!hidden && !session\.outcome\)/u);
  assert.match(browser, /pauseCurtain\.hidden = !hidden/u);
  assert.match(css, /\.pause-curtain\[hidden\] \{ display: none; \}/u);
});

test('shipped party, enemy, boss, and regional stage art retain accessible text fallbacks', () => {
  assert.match(browser, /PARTY_COMBAT_ATLAS/u);
  assert.match(browser, /ENEMY_ATLAS/u);
  assert.match(browser, /BOSS_COMBAT_ATLAS/u);
  assert.match(browser, /getBattleStageArt/u);
  assert.match(browser, /drawFallback/u);
  assert.match(browser, /actorListItem/u);
  assert.match(browser, /elements\.canvas\.dataset\.objectiveSupported/u);
  assert.match(browser, /elements\.canvas\.dataset\.laboratoryResult/u);
});

test('combat impacts expose a flashed hurtbox, outlined damage flyouts, and browser-auditable hits', () => {
  assert.match(browser, /actor\.hitFlashRemainingMs > 0/u);
  assert.match(browser, /brightness\(3\) saturate\(0\)/u);
  assert.match(browser, /context\.strokeText\(item\.text\.toUpperCase\(\)/u);
  assert.match(browser, /text: 'INVULNERABLE'/u);
  assert.match(browser, /dataset\.lastHitTargetId/u);
  assert.match(browser, /dataset\.lastHitDamage/u);
  assert.match(browser, /dataset\.hitStunRemainingMs/u);
  assert.match(browser, /dataset\.hitInvulnerabilityRemainingMs/u);
});

test('vertical-slice battles carry checkpoint vitals, settle receipts, and expose controller input', () => {
  assert.match(browser, /ACTION_SLICE_STORAGE_KEY/u);
  assert.match(browser, /hydrateActionSliceRun/u);
  assert.match(browser, /recordActionSliceBattleReceipt/u);
  assert.match(browser, /displayedObjectiveText/u);
  assert.match(browser, /Defeat the Tithe Hound\./u);
  assert.match(browser, /partyVitals: sliceBattleVitals/u);
  assert.match(browser, /sessionStorage\.setItem/u);
  assert.match(browser, /function pollBattleGamepad\(\)/u);
  assert.match(browser, /navigator\.getGamepads/u);
  assert.match(browser, /queueTagSwitch\(1\)/u);
  assert.match(html, /aria-label="Controller controls"/u);
  assert.match(html, /LB Combo · RB Tag/u);
});
