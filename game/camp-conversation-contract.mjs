/**
 * Shared schema and deterministic plan for finite two-person camp talks.
 * Content packs may validate independently; the final catalogue validates all
 * fifteen unordered party pairings and six ordered conversations per pairing.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { CAMP_CATALOGUE } from './loadout.mjs';

export const CAMP_CONVERSATION_SCHEMA_VERSION = 1;
export const CAMP_CONVERSATION_SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_CAMP_CONVERSATION_SAVE_KEY = `${CAMPAIGN.id}.camp-conversations.v${CAMP_CONVERSATION_SAVE_SCHEMA_VERSION}`;
export const CAMP_CONVERSATION_TARGETS = Object.freeze({
  pairCount: 15,
  conversationsPerPair: 6,
  conversationCount: 90,
  minimumMainLinesPerConversation: 40,
  minimumResponseLinesPerOption: 3,
  minimumWordsPerConversation: 450,
  minimumCatalogueWords: 40_500,
});

const JOIN_TIER_UNLOCKS = Object.freeze({
  prologue: Object.freeze(['p05-archive-promise', 'c2-06-name-from-europe', 'c4-06-kikus-terms', 'c6-05-all-copies-leave', 'c8-05-gate-opened', 'e00-open-archive']),
  chapter2: Object.freeze(['c2-06-name-from-europe', 'c3-06-first-key', 'c5-06-midpoint-evidence', 'c7-05-rescue-before-ring', 'c9-06-leave-evidence-alive', 'e00-open-archive']),
  chapter3: Object.freeze(['c3-06-first-key', 'c4-06-kikus-terms', 'c5-06-midpoint-evidence', 'c7-05-rescue-before-ring', 'c9-06-leave-evidence-alive', 'e00-open-archive']),
  chapter4: Object.freeze(['c4-06-kikus-terms', 'c5-06-midpoint-evidence', 'c6-05-all-copies-leave', 'c8-05-gate-opened', 'c9-06-leave-evidence-alive', 'e00-open-archive']),
});

const CAMP_SEQUENCE = Object.freeze([
  'roadside-lantern',
  'lantern-safehouse',
  'hidden-infirmary',
  'roadside-lantern',
  'lantern-safehouse',
  'hidden-infirmary',
]);

const PAIR_GROUPS = Object.freeze({
  early: Object.freeze([
    ['ren', 'aya', 'prologue'],
    ['ren', 'lise', 'chapter2'],
    ['aya', 'lise', 'chapter2'],
    ['ren', 'mateus', 'chapter2'],
    ['aya', 'mateus', 'chapter2'],
  ]),
  middle: Object.freeze([
    ['lise', 'mateus', 'chapter2'],
    ['ren', 'genta', 'chapter3'],
    ['aya', 'genta', 'chapter3'],
    ['lise', 'genta', 'chapter3'],
    ['mateus', 'genta', 'chapter3'],
  ]),
  late: Object.freeze([
    ['ren', 'kiku', 'chapter4'],
    ['aya', 'kiku', 'chapter4'],
    ['lise', 'kiku', 'chapter4'],
    ['mateus', 'kiku', 'chapter4'],
    ['genta', 'kiku', 'chapter4'],
  ]),
});

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const plan = [];
for (const [group, pairs] of Object.entries(PAIR_GROUPS)) {
  for (const [left, right, joinTier] of pairs) {
    const pairId = `${left}-${right}`;
    plan.push({
      group,
      pairId,
      participants: [left, right],
      joinTier,
      conversations: JOIN_TIER_UNLOCKS[joinTier].map((unlockAfterBeatId, index) => ({
        id: `camp-${pairId}-${String(index + 1).padStart(2, '0')}`,
        sequence: index + 1,
        unlockAfterBeatId,
        campId: CAMP_SEQUENCE[index],
      })),
    });
  }
}

export const CAMP_CONVERSATION_PLAN = deepFreeze(plan);
export const CAMP_CONVERSATION_GROUPS = deepFreeze(Object.fromEntries(
  Object.keys(PAIR_GROUPS).map((group) => [group, plan.filter((entry) => entry.group === group).map((entry) => entry.pairId)]),
));

const PLAN_BY_PAIR = new Map(CAMP_CONVERSATION_PLAN.map((entry) => [entry.pairId, entry]));
const BEAT_ORDER = new Map(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats).map((beat, index) => [beat.id, index]));
const CAST_IDS = new Set(Object.keys(CAMPAIGN.cast));
const RECORD_KEYS = Object.freeze(['id', 'pairId', 'sequence', 'unlockAfterBeatId', 'campId', 'title', 'theme', 'dialogue', 'choice']);
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

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function forbidden(text) {
  return /adam driver|castlevania|symphony of the night|final fantasy|dracula|metroidvania|TODO|TBD|placeholder|lorem ipsum|holy relic|sacred (?:loot|weapon|treasure)/i.test(text);
}

function validateLine(line, participants, label, errors) {
  if (!exactKeys(line, LINE_KEYS)) errors.push(`${label} must contain exactly speaker and line.`);
  if (!participants.includes(line?.speaker)) errors.push(`${label} speaker must belong to the planned pair.`);
  if (typeof line?.line !== 'string' || line.line.trim().length < 12) errors.push(`${label} text is too short.`);
  if (forbidden(line?.line ?? '')) errors.push(`${label} contains placeholder, borrowed, or prohibited language.`);
}

function metricsFor(conversations) {
  const allMainLines = conversations.flatMap((conversation) => conversation.dialogue ?? []);
  const allResponseLines = conversations.flatMap((conversation) =>
    (conversation.choice?.options ?? []).flatMap((option) => option.response ?? []));
  const wordCount = conversations.reduce((sum, conversation) => {
    const optionWords = (conversation.choice?.options ?? []).reduce((optionSum, option) => optionSum
      + words(option.label)
      + words(option.consequence?.summary)
      + (option.response ?? []).reduce((lineSum, line) => lineSum + words(line.line), 0), 0);
    return sum
      + words(conversation.title)
      + words(conversation.theme)
      + words(conversation.choice?.prompt)
      + optionWords
      + (conversation.dialogue ?? []).reduce((lineSum, line) => lineSum + words(line.line), 0);
  }, 0);
  return {
    conversationCount: conversations.length,
    pairCount: new Set(conversations.map((conversation) => conversation.pairId)).size,
    mainLineCount: allMainLines.length,
    responseLineCount: allResponseLines.length,
    choiceCount: conversations.length,
    choiceOptionCount: conversations.reduce((sum, conversation) => sum + (conversation.choice?.options?.length ?? 0), 0),
    wordCount,
  };
}

/**
 * Validate a partial group or the complete catalogue. `expectedPairIds` fixes
 * exact content ownership and canonical pair/sequence order for parallel packs.
 */
export function validateCampConversationPack(conversations, {
  expectedPairIds = CAMP_CONVERSATION_PLAN.map((entry) => entry.pairId),
  strictCatalogue = false,
} = {}) {
  const errors = [];
  if (!Array.isArray(conversations)) {
    return deepFreeze({ ok: false, errors: ['Camp conversation pack must be an array.'], metrics: metricsFor([]) });
  }
  const expected = expectedPairIds.flatMap((pairId) => PLAN_BY_PAIR.get(pairId)?.conversations ?? []);
  const expectedIds = expected.map((entry) => entry.id);
  const seenIds = new Set();
  const seenFlags = new Set();
  const seenText = new Set();

  if (conversations.length !== expected.length) errors.push(`Expected ${expected.length} conversations; received ${conversations.length}.`);
  conversations.forEach((conversation, index) => {
    const label = `conversation ${index + 1}`;
    const spec = PLAN_BY_PAIR.get(conversation?.pairId);
    const expectedConversation = spec?.conversations[conversation?.sequence - 1];
    if (!exactKeys(conversation, RECORD_KEYS)) errors.push(`${label} must contain exactly the conversation record keys.`);
    if (!spec || !expectedPairIds.includes(conversation?.pairId)) errors.push(`${label} has an unassigned pairId.`);
    if (!expectedConversation || conversation?.id !== expectedConversation.id) errors.push(`${label} id/sequence does not match the plan.`);
    if (conversation?.id !== expectedIds[index]) errors.push(`${label} is outside canonical pack order.`);
    if (seenIds.has(conversation?.id)) errors.push(`${label} duplicates id ${conversation?.id}.`);
    seenIds.add(conversation?.id);
    if (conversation?.unlockAfterBeatId !== expectedConversation?.unlockAfterBeatId || !BEAT_ORDER.has(conversation?.unlockAfterBeatId)) {
      errors.push(`${label} unlock beat does not match the plan.`);
    }
    if (conversation?.campId !== expectedConversation?.campId || !CAMP_CATALOGUE[conversation?.campId]) errors.push(`${label} campId does not match the plan.`);
    if (typeof conversation?.title !== 'string' || conversation.title.trim().length < 5) errors.push(`${label} needs a specific title.`);
    if (typeof conversation?.theme !== 'string' || conversation.theme.trim().length < 20) errors.push(`${label} needs a concrete theme.`);
    if (forbidden(`${conversation?.title ?? ''} ${conversation?.theme ?? ''}`)) errors.push(`${label} contains borrowed or placeholder framing.`);

    const participants = spec?.participants ?? [];
    if (!participants.every((id) => CAST_IDS.has(id))) errors.push(`${label} references an unknown party member.`);
    if (!Array.isArray(conversation?.dialogue) || conversation.dialogue.length < CAMP_CONVERSATION_TARGETS.minimumMainLinesPerConversation) {
      errors.push(`${label} needs at least ${CAMP_CONVERSATION_TARGETS.minimumMainLinesPerConversation} main lines.`);
    } else {
      conversation.dialogue.forEach((line, lineIndex) => validateLine(line, participants, `${label} line ${lineIndex + 1}`, errors));
      for (const participant of participants) {
        if (conversation.dialogue.filter((line) => line.speaker === participant).length < 15) errors.push(`${label} underuses ${participant}.`);
      }
    }

    if (!exactKeys(conversation?.choice, CHOICE_KEYS)) errors.push(`${label} choice has invalid keys.`);
    if (typeof conversation?.choice?.prompt !== 'string' || conversation.choice.prompt.trim().length < 15) errors.push(`${label} choice needs a concrete prompt.`);
    if (!Array.isArray(conversation?.choice?.options) || conversation.choice.options.length !== 2) {
      errors.push(`${label} choice must have exactly two options.`);
    } else {
      conversation.choice.options.forEach((option, optionIndex) => {
        const optionLabel = `${label} option ${optionIndex + 1}`;
        if (!exactKeys(option, OPTION_KEYS)) errors.push(`${optionLabel} has invalid keys.`);
        if (option?.id !== `${conversation.id}-choice-${optionIndex + 1}`) errors.push(`${optionLabel} id is not canonical.`);
        if (typeof option?.label !== 'string' || option.label.trim().length < 8) errors.push(`${optionLabel} needs a readable label.`);
        if (!Array.isArray(option?.response) || option.response.length < CAMP_CONVERSATION_TARGETS.minimumResponseLinesPerOption) {
          errors.push(`${optionLabel} needs at least ${CAMP_CONVERSATION_TARGETS.minimumResponseLinesPerOption} response lines.`);
        } else option.response.forEach((line, lineIndex) => validateLine(line, participants, `${optionLabel} response ${lineIndex + 1}`, errors));
        if (!exactKeys(option?.consequence, CONSEQUENCE_KEYS)) errors.push(`${optionLabel} consequence has invalid keys.`);
        const flag = option?.consequence?.flag;
        if (flag !== `camp.${conversation.id}.choice.${optionIndex + 1}`) errors.push(`${optionLabel} flag is not canonical.`);
        if (seenFlags.has(flag)) errors.push(`${optionLabel} duplicates consequence flag.`);
        seenFlags.add(flag);
        if (typeof option?.consequence?.summary !== 'string' || option.consequence.summary.trim().length < 15) errors.push(`${optionLabel} needs a concrete consequence summary.`);
      });
    }

    const conversationText = [
      conversation?.title,
      conversation?.theme,
      conversation?.choice?.prompt,
      ...(conversation?.dialogue ?? []).map((line) => line.line),
      ...(conversation?.choice?.options ?? []).flatMap((option) => [
        option.label,
        option.consequence?.summary,
        ...(option.response ?? []).map((line) => line.line),
      ]),
    ].filter(Boolean);
    for (const text of conversationText) {
      const normalized = text.trim().toLowerCase();
      if (seenText.has(normalized)) errors.push(`${label} repeats exact authored text: ${text}`);
      seenText.add(normalized);
    }
    if (conversationText.reduce((sum, text) => sum + words(text), 0) < CAMP_CONVERSATION_TARGETS.minimumWordsPerConversation) {
      errors.push(`${label} is below ${CAMP_CONVERSATION_TARGETS.minimumWordsPerConversation} words.`);
    }
  });

  const metrics = metricsFor(conversations);
  if (strictCatalogue) {
    if (metrics.pairCount !== CAMP_CONVERSATION_TARGETS.pairCount) errors.push('Complete catalogue does not cover all 15 pairings.');
    if (metrics.conversationCount !== CAMP_CONVERSATION_TARGETS.conversationCount) errors.push('Complete catalogue does not contain 90 conversations.');
    if (metrics.wordCount < CAMP_CONVERSATION_TARGETS.minimumCatalogueWords) errors.push('Complete catalogue is below the minimum word target.');
  }
  return deepFreeze({ ok: errors.length === 0, errors, metrics });
}

export function getCampConversationPlan(pairId) {
  return PLAN_BY_PAIR.get(pairId) ?? null;
}
