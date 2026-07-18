/**
 * Contract and deterministic plan for finite multi-character party councils.
 *
 * Councils are authored story conversations, never repeatable activity or a
 * source of progression value. Content packs own prose; this module owns exact
 * order, join-safe casts, schema, volume, and safety validation.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { CAMP_CATALOGUE } from './loadout.mjs';

export const PARTY_COUNCIL_SCHEMA_VERSION = 1;
export const PARTY_COUNCIL_SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_PARTY_COUNCIL_SAVE_KEY = `${CAMPAIGN.id}.party-councils.v${PARTY_COUNCIL_SAVE_SCHEMA_VERSION}`;

export const PARTY_COUNCIL_TARGETS = Object.freeze({
  councilCount: 30,
  groupCount: 3,
  councilsPerGroup: 10,
  minimumParticipants: 3,
  maximumParticipants: 6,
  minimumMainLinesPerCouncil: 30,
  minimumMainLinesPerParticipant: 4,
  choiceOptionsPerCouncil: 2,
  minimumResponseLinesPerOption: 3,
  minimumWordsPerCouncil: 500,
  minimumCatalogueWords: 15_000,
});

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export const PARTY_COUNCIL_GUARDRAILS = deepFreeze([
  'Every council and speaker is original fictional material with no performer or historical-person likeness.',
  'Councils preserve consent, evidence limits, correction routes, and community agency rather than granting moral certainty.',
  'Persecution, illness, death, survival, testimony, and spiritual practice are never framed as prizes or possessions.',
  'Councils grant no currency, items, combat power, completion value, elapsed-time claim, or repeatable benefit.',
  'No council may use a speaker before that party member has joined the canonical story.',
  'Every consequence is a finite story flag and a concrete summary, never a hidden failure or progression gate.',
]);

export const PARTY_COUNCIL_GROUP_NAMES = Object.freeze(['early', 'middle', 'late']);

const CANONICAL_BEATS = CAMPAIGN.chapters.flatMap((chapter) => (
  chapter.beats.map((beat) => ({ id: beat.id, chapterId: chapter.id }))
));
const BEAT_BY_ID = new Map(CANONICAL_BEATS.map((beat) => [beat.id, beat]));
const BEAT_ORDER = new Map(CANONICAL_BEATS.map((beat, index) => [beat.id, index]));
const CAST_IDS = new Set(Object.keys(CAMPAIGN.cast));

export const PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER = deepFreeze({
  ren: 'p00-delivery-in-rain',
  aya: 'p05-archive-promise',
  lise: 'c2-06-name-from-europe',
  mateus: 'c2-06-name-from-europe',
  genta: 'c3-05-gentas-order',
  kiku: 'c4-06-kikus-terms',
});

const COUNCIL_SLOTS = [
  ['c2-06-name-from-europe', 'hidden-infirmary', ['ren', 'aya', 'lise', 'mateus']],
  ['c3-01-separate-arrivals', 'roadside-lantern', ['ren', 'aya', 'lise', 'mateus']],
  ['c3-03-ledger-customs-house', 'lantern-safehouse', ['aya', 'lise', 'mateus']],
  ['c3-05-gentas-order', 'hidden-infirmary', ['ren', 'lise', 'genta']],
  ['c3-06-first-key', 'roadside-lantern', ['ren', 'aya', 'lise', 'mateus', 'genta']],
  ['c4-01-nets-in-fog', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta']],
  ['c4-02-tide-caves', 'hidden-infirmary', ['ren', 'lise', 'mateus', 'genta']],
  ['c4-04-survivors-hold', 'roadside-lantern', ['aya', 'lise', 'mateus', 'genta']],
  ['c4-06-kikus-terms', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c5-02-ash-fields', 'hidden-infirmary', ['ren', 'aya', 'genta', 'kiku']],

  ['c5-04-prison-locks', 'roadside-lantern', ['ren', 'lise', 'mateus', 'genta', 'kiku']],
  ['c5-06-midpoint-evidence', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c6-01-city-competing-needs', 'hidden-infirmary', ['aya', 'lise', 'kiku']],
  ['c6-03-tribunal', 'roadside-lantern', ['ren', 'aya', 'mateus', 'genta']],
  ['c6-05-all-copies-leave', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c7-01-decision-map-table', 'hidden-infirmary', ['ren', 'lise', 'genta', 'kiku']],
  ['c7-03-aqueduct-names', 'roadside-lantern', ['aya', 'mateus', 'genta', 'kiku']],
  ['c7-05-rescue-before-ring', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c8-01-three-homecomings', 'hidden-infirmary', ['ren', 'aya', 'lise', 'kiku']],
  ['c8-03-black-gate-bargain', 'roadside-lantern', ['lise', 'mateus', 'genta', 'kiku']],

  ['c8-05-gate-opened', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c9-01-archive-breathes', 'hidden-infirmary', ['ren', 'aya', 'mateus']],
  ['c9-02-ujiros-last-ledger', 'roadside-lantern', ['aya', 'lise', 'mateus', 'genta']],
  ['c9-03-conservatory-offers', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c9-04-yearless-bell', 'hidden-infirmary', ['ren', 'lise', 'mateus', 'kiku']],
  ['c9-05-dawn-at-observatory', 'roadside-lantern', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['c9-06-leave-evidence-alive', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['e00-open-archive', 'hidden-infirmary', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
  ['e01-repair-work', 'roadside-lantern', ['ren', 'aya', 'genta', 'kiku']],
  ['e02-repaired-tower', 'lantern-safehouse', ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']],
];

const plan = COUNCIL_SLOTS.map(([unlockAfterBeatId, campId, participants], index) => {
  const sequence = index + 1;
  const beat = BEAT_BY_ID.get(unlockAfterBeatId);
  return {
    id: `council-${String(sequence).padStart(2, '0')}-${unlockAfterBeatId}`,
    group: PARTY_COUNCIL_GROUP_NAMES[Math.floor(index / PARTY_COUNCIL_TARGETS.councilsPerGroup)],
    sequence,
    chapterId: beat?.chapterId,
    unlockAfterBeatId,
    campId,
    participants,
    repeatable: false,
  };
});

const PLAN_KEYS = Object.freeze([
  'id', 'group', 'sequence', 'chapterId', 'unlockAfterBeatId', 'campId', 'participants', 'repeatable',
]);
const COUNCIL_KEYS = Object.freeze([
  'id', 'sequence', 'chapterId', 'unlockAfterBeatId', 'campId', 'participants', 'title', 'theme', 'dialogue', 'choice',
]);
const LINE_KEYS = Object.freeze(['speaker', 'line']);
const CHOICE_KEYS = Object.freeze(['prompt', 'options']);
const OPTION_KEYS = Object.freeze(['id', 'label', 'response', 'consequence']);
const CONSEQUENCE_KEYS = Object.freeze(['flag', 'summary']);

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function wordCount(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function prohibited(text) {
  return /adam\s+driver|castlevania|symphony\s+of\s+the\s+night|final\s+fantasy|metroidvania|dracula|belmont|alucard|tokugawa|ieyasu|hidetada|iemitsu|oda\s+nobunaga|toyotomi\s+hideyoshi|francis\s+xavier|alessandro\s+valignano|jo[a\u00e3]o\s+rodrigues|william\s+adams|date\s+masamune|portrayed\s+by|played\s+by|likeness\s+of|celebrity\s+likeness|real[-\s]world\s+(?:official|person)|historical\s+(?:official|person)\s+likeness|TODO|TBD|placeholder|lorem\s+ipsum|holy\s+relic|sacred\s+(?:artifact|loot|object|relic|treasure|weapon)|collectible|trophy|loot|treasure\s+chest|rare\s+drop|quest\s+reward|completion\s+(?:bonus|prize|reward)|archive\s+(?:points|token)|record\s+token|experience\s+points|\brewards?\b|\bminutes?\b/i.test(text);
}

function expectedChoiceId(councilId, optionIndex) {
  return `${councilId}-choice-${optionIndex + 1}`;
}

function expectedConsequenceFlag(councilId, optionIndex) {
  return `party-council.${councilId}.choice.${optionIndex + 1}`;
}

function validatePlan(entries) {
  const errors = [];
  if (!Array.isArray(entries) || entries.length !== PARTY_COUNCIL_TARGETS.councilCount) {
    return deepFreeze({ ok: false, errors: [`Party council plan must contain ${PARTY_COUNCIL_TARGETS.councilCount} slots.`] });
  }
  const seenIds = new Set();
  let priorBeatOrder = -1;
  entries.forEach((slot, index) => {
    const label = `plan slot ${index + 1}`;
    const expectedGroup = PARTY_COUNCIL_GROUP_NAMES[Math.floor(index / PARTY_COUNCIL_TARGETS.councilsPerGroup)];
    const beat = BEAT_BY_ID.get(slot?.unlockAfterBeatId);
    const beatOrder = BEAT_ORDER.get(slot?.unlockAfterBeatId);
    if (!exactKeys(slot, PLAN_KEYS)) errors.push(`${label} has unsupported or missing keys.`);
    if (slot?.sequence !== index + 1) errors.push(`${label} sequence is not canonical.`);
    if (slot?.id !== `council-${String(index + 1).padStart(2, '0')}-${slot?.unlockAfterBeatId}`) errors.push(`${label} id is not canonical.`);
    if (slot?.group !== expectedGroup) errors.push(`${label} group is not canonical.`);
    if (!beat || slot?.chapterId !== beat.chapterId) errors.push(`${label} chapter or unlock beat is not canonical.`);
    if (!Number.isInteger(beatOrder) || beatOrder <= priorBeatOrder) errors.push(`${label} is outside canonical story order.`);
    priorBeatOrder = beatOrder ?? priorBeatOrder;
    if (!CAMP_CATALOGUE[slot?.campId]) errors.push(`${label} uses an unknown camp.`);
    if (slot?.repeatable !== false) errors.push(`${label} must be non-repeatable.`);
    if (!Array.isArray(slot?.participants)
      || slot.participants.length < PARTY_COUNCIL_TARGETS.minimumParticipants
      || slot.participants.length > PARTY_COUNCIL_TARGETS.maximumParticipants
      || new Set(slot.participants).size !== slot.participants.length) {
      errors.push(`${label} must contain 3-6 unique participants.`);
    } else {
      for (const participant of slot.participants) {
        if (!CAST_IDS.has(participant)) errors.push(`${label} has unknown participant ${participant}.`);
        const joinBeat = PARTY_COUNCIL_JOIN_BEAT_BY_MEMBER[participant];
        if (!joinBeat || BEAT_ORDER.get(joinBeat) > beatOrder) errors.push(`${label} uses locked participant ${participant}.`);
      }
    }
    if (seenIds.has(slot?.id)) errors.push(`${label} duplicates ${slot?.id}.`);
    seenIds.add(slot?.id);
  });
  for (const group of PARTY_COUNCIL_GROUP_NAMES) {
    if (entries.filter((slot) => slot.group === group).length !== PARTY_COUNCIL_TARGETS.councilsPerGroup) {
      errors.push(`Party council group ${group} must contain 10 slots.`);
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

const planValidation = validatePlan(plan);
if (!planValidation.ok) throw new Error(`Invalid party council plan:\n${planValidation.errors.join('\n')}`);

export const PARTY_COUNCIL_PLAN = deepFreeze(plan);
export const PARTY_COUNCIL_GROUPS = deepFreeze(Object.fromEntries(
  PARTY_COUNCIL_GROUP_NAMES.map((group) => [
    group,
    PARTY_COUNCIL_PLAN.filter((slot) => slot.group === group).map((slot) => slot.id),
  ]),
));

const PLAN_BY_ID = new Map(PARTY_COUNCIL_PLAN.map((slot) => [slot.id, slot]));

export function getPartyCouncilPlan(councilId) {
  return PLAN_BY_ID.get(councilId) ?? null;
}

export function getPartyCouncilGroupPlan(group) {
  if (!PARTY_COUNCIL_GROUP_NAMES.includes(group)) return null;
  return deepFreeze(PARTY_COUNCIL_GROUPS[group].map((id) => PLAN_BY_ID.get(id)));
}

function metricsFor(councils) {
  const inferredGroups = councils.map((council) => PLAN_BY_ID.get(council?.id)?.group).filter(Boolean);
  return {
    councilCount: councils.length,
    mainLineCount: councils.reduce((sum, council) => sum + (council?.dialogue?.length ?? 0), 0),
    responseLineCount: councils.reduce((sum, council) => sum + (council?.choice?.options ?? [])
      .reduce((optionSum, option) => optionSum + (option?.response?.length ?? 0), 0), 0),
    choiceCount: councils.length,
    choiceOptionCount: councils.reduce((sum, council) => sum + (council?.choice?.options?.length ?? 0), 0),
    wordCount: councils.reduce((sum, council) => {
      const text = [
        council?.title,
        council?.theme,
        council?.choice?.prompt,
        ...(council?.dialogue ?? []).map((line) => line?.line),
        ...(council?.choice?.options ?? []).flatMap((option) => [
          option?.label,
          option?.consequence?.summary,
          ...(option?.response ?? []).map((line) => line?.line),
        ]),
      ];
      return sum + text.reduce((textSum, value) => textSum + wordCount(value), 0);
    }, 0),
    byGroup: Object.fromEntries(PARTY_COUNCIL_GROUP_NAMES.map((group) => [
      group,
      inferredGroups.filter((candidate) => candidate === group).length,
    ])),
  };
}

function failClosed(message) {
  return deepFreeze({ ok: false, errors: [message], metrics: metricsFor([]) });
}

function expectedSlotsFor(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { error: 'Party council validation options must be an object.' };
  }
  const allowed = new Set(['expectedGroup', 'strictCatalogue']);
  if (Object.keys(options).some((key) => !allowed.has(key))) {
    return { error: 'Party council validation options contain unsupported keys.' };
  }
  const strictCatalogue = options.strictCatalogue === true;
  const expectedGroup = options.expectedGroup ?? null;
  if (options.strictCatalogue != null && typeof options.strictCatalogue !== 'boolean') {
    return { error: 'strictCatalogue must be a boolean.' };
  }
  if (strictCatalogue) {
    if (expectedGroup != null) return { error: 'A full catalogue cannot also select a partial group.' };
    return { slots: PARTY_COUNCIL_PLAN, strictCatalogue: true };
  }
  if (!PARTY_COUNCIL_GROUP_NAMES.includes(expectedGroup)) {
    return { error: 'A partial pack must select expectedGroup early, middle, or late.' };
  }
  return {
    slots: PARTY_COUNCIL_GROUPS[expectedGroup].map((id) => PLAN_BY_ID.get(id)),
    strictCatalogue: false,
  };
}

function validateLine(line, participants, label, errors) {
  if (!exactKeys(line, LINE_KEYS)) errors.push(`${label} must contain exactly speaker and line.`);
  if (!participants.includes(line?.speaker)) errors.push(`${label} speaker is outside the planned council.`);
  if (typeof line?.line !== 'string' || line.line.trim().length < 12) errors.push(`${label} text is too short.`);
  if (prohibited(line?.line ?? '')) errors.push(`${label} contains borrowed, real-person, placeholder, duration, or prize language.`);
}

/**
 * Validate one exact ten-council authoring group or the complete catalogue.
 *
 * Partial: `validatePartyCouncilPack(councils, { expectedGroup: 'early' })`
 * Full:    `validatePartyCouncilPack(councils, { strictCatalogue: true })`
 */
export function validatePartyCouncilPack(councils, options = {}) {
  if (!Array.isArray(councils)) return failClosed('Party council pack must be an array.');
  const expected = expectedSlotsFor(options);
  if (expected.error) return failClosed(expected.error);

  const errors = [];
  const seenIds = new Set();
  const seenFlags = new Set();
  const seenText = new Set();
  if (councils.length !== expected.slots.length) {
    errors.push(`Expected ${expected.slots.length} party councils; received ${councils.length}.`);
  }

  councils.forEach((council, index) => {
    const label = `council ${index + 1}`;
    const slot = expected.slots[index];
    const planned = PLAN_BY_ID.get(council?.id);
    if (!exactKeys(council, COUNCIL_KEYS)) errors.push(`${label} must contain exactly the authored council keys.`);
    if (!planned || council?.id !== slot?.id) errors.push(`${label} is outside canonical pack order.`);
    if (seenIds.has(council?.id)) errors.push(`${label} duplicates id ${council?.id}.`);
    seenIds.add(council?.id);
    if (council?.sequence !== slot?.sequence) errors.push(`${label} sequence does not match the plan.`);
    if (council?.chapterId !== slot?.chapterId) errors.push(`${label} chapterId does not match the plan.`);
    if (council?.unlockAfterBeatId !== slot?.unlockAfterBeatId) errors.push(`${label} unlock beat does not match the plan.`);
    if (council?.campId !== slot?.campId) errors.push(`${label} campId does not match the plan.`);
    if (!sameArray(council?.participants, slot?.participants)) errors.push(`${label} participants do not match the join-safe plan.`);

    if (typeof council?.title !== 'string' || council.title.trim().length < 8
      || council.title.trim().split(/\s+/).length < 2) errors.push(`${label} needs a concrete multi-word title.`);
    if (typeof council?.theme !== 'string' || council.theme.trim().length < 24) errors.push(`${label} needs a concrete theme.`);
    if (prohibited(`${council?.title ?? ''} ${council?.theme ?? ''}`)) {
      errors.push(`${label} contains borrowed, real-person, placeholder, duration, or prize framing.`);
    }

    const participants = slot?.participants ?? [];
    if (!Array.isArray(council?.dialogue)
      || council.dialogue.length < PARTY_COUNCIL_TARGETS.minimumMainLinesPerCouncil) {
      errors.push(`${label} needs at least 30 main dialogue lines.`);
    } else {
      council.dialogue.forEach((line, lineIndex) => validateLine(line, participants, `${label} line ${lineIndex + 1}`, errors));
      for (const participant of participants) {
        if (council.dialogue.filter((line) => line?.speaker === participant).length
          < PARTY_COUNCIL_TARGETS.minimumMainLinesPerParticipant) {
          errors.push(`${label} underuses planned participant ${participant}.`);
        }
      }
    }

    if (!exactKeys(council?.choice, CHOICE_KEYS)) errors.push(`${label} choice has invalid keys.`);
    if (typeof council?.choice?.prompt !== 'string' || council.choice.prompt.trim().length < 15) {
      errors.push(`${label} choice needs a concrete prompt.`);
    }
    if (!Array.isArray(council?.choice?.options)
      || council.choice.options.length !== PARTY_COUNCIL_TARGETS.choiceOptionsPerCouncil) {
      errors.push(`${label} choice must contain exactly two options.`);
    } else {
      council.choice.options.forEach((option, optionIndex) => {
        const optionLabel = `${label} option ${optionIndex + 1}`;
        if (!exactKeys(option, OPTION_KEYS)) errors.push(`${optionLabel} has invalid keys.`);
        if (option?.id !== expectedChoiceId(council.id, optionIndex)) errors.push(`${optionLabel} id is not canonical.`);
        if (typeof option?.label !== 'string' || option.label.trim().length < 8) errors.push(`${optionLabel} needs a readable label.`);
        if (!Array.isArray(option?.response)
          || option.response.length < PARTY_COUNCIL_TARGETS.minimumResponseLinesPerOption) {
          errors.push(`${optionLabel} needs at least three response lines.`);
        } else {
          option.response.forEach((line, lineIndex) => validateLine(
            line,
            participants,
            `${optionLabel} response ${lineIndex + 1}`,
            errors,
          ));
        }
        if (!exactKeys(option?.consequence, CONSEQUENCE_KEYS)) errors.push(`${optionLabel} consequence has invalid keys.`);
        const flag = option?.consequence?.flag;
        if (flag !== expectedConsequenceFlag(council.id, optionIndex)) errors.push(`${optionLabel} consequence flag is not canonical.`);
        if (seenFlags.has(flag)) errors.push(`${optionLabel} duplicates a consequence flag.`);
        seenFlags.add(flag);
        if (typeof option?.consequence?.summary !== 'string' || option.consequence.summary.trim().length < 20) {
          errors.push(`${optionLabel} needs a concrete consequence summary.`);
        }
      });
    }

    const authoredText = [
      council?.title,
      council?.theme,
      council?.choice?.prompt,
      ...(council?.dialogue ?? []).map((line) => line?.line),
      ...(council?.choice?.options ?? []).flatMap((option) => [
        option?.label,
        option?.consequence?.summary,
        ...(option?.response ?? []).map((line) => line?.line),
      ]),
    ].filter((value) => typeof value === 'string');
    for (const text of authoredText) {
      if (prohibited(text)) errors.push(`${label} contains borrowed, real-person, placeholder, duration, or prize language.`);
      const normalized = text.trim().toLowerCase();
      if (seenText.has(normalized)) errors.push(`${label} repeats exact authored text: ${text}`);
      seenText.add(normalized);
    }
    if (authoredText.reduce((sum, text) => sum + wordCount(text), 0)
      < PARTY_COUNCIL_TARGETS.minimumWordsPerCouncil) {
      errors.push(`${label} is below 500 counted words.`);
    }
  });

  const metrics = metricsFor(councils);
  if (expected.strictCatalogue) {
    if (metrics.councilCount !== PARTY_COUNCIL_TARGETS.councilCount) errors.push('Full catalogue must contain 30 councils.');
    if (metrics.wordCount < PARTY_COUNCIL_TARGETS.minimumCatalogueWords) errors.push('Full catalogue is below the minimum word target.');
    for (const group of PARTY_COUNCIL_GROUP_NAMES) {
      if (metrics.byGroup[group] !== PARTY_COUNCIL_TARGETS.councilsPerGroup) {
        errors.push(`Full catalogue must contain 10 ${group} councils.`);
      }
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors, metrics });
}
