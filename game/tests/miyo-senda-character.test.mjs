import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PARTY_MEMBER_IDS } from '../advancement.mjs';
import { PARTY_PROFILES, PARTY_SKILLS } from '../campaign-combat.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { LEVELS } from '../content/levels.mjs';
import { PARTY_COMBAT_MEMBERS, PARTY_COMBAT_SKILL_POSES } from '../party-combat-atlas.mjs';
import { PARTY_PORTRAIT_MEMBERS } from '../party-portrait-atlas.mjs';
import { PARTY_ATLAS_MEMBERS } from '../sprite-atlas.mjs';

const read = (relativeUrl) => readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
const readJson = (relativeUrl) => JSON.parse(read(relativeUrl));

test('Miyo uses her Japanese public identity while the family-book name remains archival context', () => {
  const miyo = CAMPAIGN.cast.miyo;

  assert.equal(miyo.name, 'Miyo Senda');
  assert.match(miyo.background, /literal granddaughter of Mateus Avelar/u);
  assert.match(miyo.background, /three-quarters Japanese/u);
  assert.match(miyo.background, /Inês Avelar/u);
  assert.match(miyo.background, /baptismal entry/u);
  assert.match(miyo.arc, /without becoming evidence of Mateus's redemption/u);
});

test('Miyo joins permanently at the Chapter 7 map table and remains in every later chapter', () => {
  const chapter7 = CAMPAIGN.chapters.find(({ id }) => id === 'chapter-7');
  const laterChapters = CAMPAIGN.chapters.filter(({ id }) => (
    ['chapter-7', 'chapter-8', 'chapter-9', 'epilogue'].includes(id)
  ));

  assert.deepEqual(chapter7.partyMeta.joins, [{
    id: 'miyo',
    atBeat: 'c7-01-decision-map-table',
    permanent: true,
  }]);
  assert.ok(laterChapters.every(({ party }) => party.includes('miyo')));
  assert.ok(CAMPAIGN.chapters
    .filter(({ id }) => !['chapter-7', 'chapter-8', 'chapter-9', 'epilogue'].includes(id))
    .every(({ party }) => !party.includes('miyo')));
  assert.ok(PARTY_MEMBER_IDS.includes('miyo'));
});

test('Miyo has an exact four-technique weather kit with bounded recovery and repositioning', () => {
  assert.deepEqual(PARTY_PROFILES.miyo.skillIds, [
    'cinder-glyph',
    'white-current',
    'thunder-thread',
    'crosswind-step',
  ]);
  assert.deepEqual(
    PARTY_PROFILES.miyo.skillIds.map((id) => ({
      id,
      essence: PARTY_SKILLS[id].essence ?? null,
      recoveryPulses: PARTY_SKILLS[id].recoveryPulses,
    })),
    [
      { id: 'cinder-glyph', essence: 'ember', recoveryPulses: 2 },
      { id: 'white-current', essence: 'frost', recoveryPulses: 2 },
      { id: 'thunder-thread', essence: 'storm', recoveryPulses: 3 },
      { id: 'crosswind-step', essence: null, recoveryPulses: 1 },
    ],
  );
  assert.deepEqual(PARTY_SKILLS['crosswind-step'].effect, { reposition: { spaces: 2 } });
  assert.deepEqual({
    'cinder-glyph': PARTY_COMBAT_SKILL_POSES['cinder-glyph'],
    'white-current': PARTY_COMBAT_SKILL_POSES['white-current'],
    'thunder-thread': PARTY_COMBAT_SKILL_POSES['thunder-thread'],
    'crosswind-step': PARTY_COMBAT_SKILL_POSES['crosswind-step'],
  }, {
    'cinder-glyph': 'signature-a',
    'white-current': 'signature-a',
    'thunder-thread': 'signature-b',
    'crosswind-step': 'move',
  });
});

test('late encounters and field formations include Miyo without rewriting earlier deployments', () => {
  const lateChapterIds = new Set(['chapter-7', 'chapter-8', 'chapter-9', 'epilogue']);
  const lateEncounters = ENCOUNTERS.filter(({ chapterId }) => lateChapterIds.has(chapterId));
  const earlyEncounters = ENCOUNTERS.filter(({ chapterId }) => !lateChapterIds.has(chapterId));
  const lateLevels = LEVELS.filter(({ chapterId }) => lateChapterIds.has(chapterId));
  const earlyLevels = LEVELS.filter(({ chapterId }) => !lateChapterIds.has(chapterId));

  assert.ok(lateEncounters.length > 0);
  assert.ok(lateEncounters.every(({ party }) => party.roster.includes('miyo')));
  assert.ok(lateEncounters.every(({ party }) => party.deployment.some(({ actorId }) => actorId === 'miyo')));
  assert.ok(earlyEncounters.every(({ party }) => !party.roster.includes('miyo')));
  assert.ok(lateLevels.every(({ spawn }) => spawn.formation.includes('miyo')));
  assert.ok(earlyLevels.every(({ spawn }) => !spawn.formation.includes('miyo')));
});

test('all deterministic party-art contracts carry an original seventh Miyo row', () => {
  assert.deepEqual(PARTY_ATLAS_MEMBERS.at(-1), 'miyo');
  assert.deepEqual(PARTY_COMBAT_MEMBERS.at(-1), 'miyo');
  assert.deepEqual(PARTY_PORTRAIT_MEMBERS.at(-1), 'miyo');

  const sources = [
    readJson('../../assets/art/party-field-suite/party-field-suite.source.json'),
    readJson('../../assets/art/party-combat-suite/party-combat-suite.source.json'),
    readJson('../../assets/art/party-portrait-suite/party-portrait-suite.source.json'),
    readJson('../../assets/art/party-roster-suite/party-roster-suite.source.json'),
  ];
  const sourceText = sources.map((source) => JSON.stringify(source)).join('\n');

  assert.ok(sources[0].characters.some(({ id, originalityPolicy }) => id === 'miyo' && originalityPolicy));
  assert.ok(sources[1].characters.some(({ id, originalityPolicy }) => id === 'miyo' && originalityPolicy));
  assert.ok(sources[2].characters.some(({ id, originalityPolicy }) => id === 'miyo' && originalityPolicy));
  assert.equal(sources[3].rowOrder.at(-1), 'miyo');
  assert.doesNotMatch(sourceText, /sypha|castlevania/iu);
});
