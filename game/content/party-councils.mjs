/** Complete finite party-council catalogue in canonical campaign order. */

import {
  PARTY_COUNCIL_PLAN,
  PARTY_COUNCIL_SCHEMA_VERSION,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';
import { PARTY_COUNCILS_EARLY } from './party-councils-early.mjs';
import { PARTY_COUNCILS_MIDDLE } from './party-councils-middle.mjs';
import { PARTY_COUNCILS_LATE } from './party-councils-late.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const wordCount = (value) => typeof value === 'string'
  ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  : 0;

const councils = [
  ...PARTY_COUNCILS_EARLY,
  ...PARTY_COUNCILS_MIDDLE,
  ...PARTY_COUNCILS_LATE,
];
const validation = validatePartyCouncilPack(councils, { strictCatalogue: true });
if (!validation.ok) throw new Error(`Invalid complete party-council catalogue:\n${validation.errors.join('\n')}`);

export const PARTY_COUNCIL_METRICS = validation.metrics;
export const PARTY_COUNCIL_PLAYABLE_METRICS = deepFreeze(councils.reduce((metrics, council) => {
  const selectedOption = council.choice.options[0];
  const visibleText = [
    council.title,
    council.theme,
    council.choice.prompt,
    ...council.dialogue.map((line) => line.line),
    ...council.choice.options.map((option) => option.label),
    ...selectedOption.response.map((line) => line.line),
    selectedOption.consequence.summary,
  ];
  return {
    councilCount: metrics.councilCount + 1,
    mainLineCount: metrics.mainLineCount + council.dialogue.length,
    selectedResponseLineCount: metrics.selectedResponseLineCount + selectedOption.response.length,
    dialogueLineCount: metrics.dialogueLineCount + council.dialogue.length + selectedOption.response.length,
    choiceCount: metrics.choiceCount + 1,
    visibleWordCount: metrics.visibleWordCount + visibleText.reduce((sum, text) => sum + wordCount(text), 0),
  };
}, {
  councilCount: 0,
  mainLineCount: 0,
  selectedResponseLineCount: 0,
  dialogueLineCount: 0,
  choiceCount: 0,
  visibleWordCount: 0,
}));

export const PARTY_COUNCILS = deepFreeze({
  schemaVersion: PARTY_COUNCIL_SCHEMA_VERSION,
  finite: true,
  repeatable: false,
  completionPolicy: 'once-per-save',
  councils,
  metrics: PARTY_COUNCIL_METRICS,
  playableMetrics: PARTY_COUNCIL_PLAYABLE_METRICS,
});

const byId = new Map(councils.map((council) => [council.id, council]));
const byCamp = new Map([...new Set(PARTY_COUNCIL_PLAN.map((slot) => slot.campId))].map((campId) => [
  campId,
  deepFreeze(councils.filter((council) => council.campId === campId)),
]));
const byChapter = new Map([...new Set(PARTY_COUNCIL_PLAN.map((slot) => slot.chapterId))].map((chapterId) => [
  chapterId,
  deepFreeze(councils.filter((council) => council.chapterId === chapterId)),
]));
const EMPTY_COUNCILS = Object.freeze([]);

export function getPartyCouncil(councilId) {
  return byId.get(councilId) ?? null;
}

export function getPartyCouncilsForCamp(campId) {
  return byCamp.get(campId) ?? EMPTY_COUNCILS;
}

export function getPartyCouncilsForChapter(chapterId) {
  return byChapter.get(chapterId) ?? EMPTY_COUNCILS;
}
