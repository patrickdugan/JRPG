/** Transparent full-catalog pacing ceiling; not a selected-route duration claim. */

import { STORYWORLD_CLUSTERS } from './content/storyworld-encounters.generated.mjs';

export const STORYWORLD_PACING_ASSUMPTIONS = Object.freeze({
  fullCanonicalCatalogReferenceMinutes: 314.253,
  readingWordsPerMinute: 200,
  decisionDwellSeconds: 20,
  narrativeTargetMinimumMinutes: 300,
  narrativeTargetMaximumMinutes: 360,
});

const wordCount = (text) => text.trim().split(/\s+/u).filter(Boolean).length;

function pathMetrics(cluster, entryOption, entryReaction) {
  const outcome = cluster.outcomes.find(({ id }) => id === entryReaction.consequenceId);
  const fixedWords = wordCount(cluster.entry.text)
    + wordCount(entryOption.text)
    + wordCount(entryReaction.text)
    + wordCount(outcome.text);
  if (outcome.terminal) return { visibleWords: fixedWords, decisions: 1 };
  const continuationWords = Math.max(...outcome.options.flatMap((option) => (
    option.reactions.map((reaction) => wordCount(option.text) + wordCount(reaction.text))
  )));
  return { visibleWords: fixedWords + continuationWords, decisions: 2 };
}

const perCluster = STORYWORLD_CLUSTERS.map((cluster) => {
  const paths = cluster.entry.options.flatMap((option) => (
    option.reactions.map((reaction) => pathMetrics(cluster, option, reaction))
  ));
  return Object.freeze({
    clusterId: cluster.id,
    maximumVisibleWords: Math.max(...paths.map(({ visibleWords }) => visibleWords)),
    maximumDecisionCount: Math.max(...paths.map(({ decisions }) => decisions)),
  });
});

const maximumVisibleWords = perCluster.reduce((sum, cluster) => sum + cluster.maximumVisibleWords, 0);
const maximumDecisionCount = perCluster.reduce((sum, cluster) => sum + cluster.maximumDecisionCount, 0);
const readingMinutes = maximumVisibleWords / STORYWORLD_PACING_ASSUMPTIONS.readingWordsPerMinute;
const decisionMinutes = (maximumDecisionCount * STORYWORLD_PACING_ASSUMPTIONS.decisionDwellSeconds) / 60;
const storyworldReferenceMinutes = readingMinutes + decisionMinutes;
const fullCatalogReferenceMinutes = STORYWORLD_PACING_ASSUMPTIONS.fullCanonicalCatalogReferenceMinutes
  + storyworldReferenceMinutes;

export const STORYWORLD_PACING_REPORT = Object.freeze({
  perCluster: Object.freeze(perCluster),
  maximumVisibleWords,
  maximumDecisionCount,
  readingMinutes,
  decisionMinutes,
  storyworldReferenceMinutes,
  fullCatalogReferenceMinutes,
  fullCatalogReferenceHours: fullCatalogReferenceMinutes / 60,
  fullCatalogWithinFiveToSixHourTarget: fullCatalogReferenceMinutes
    >= STORYWORLD_PACING_ASSUMPTIONS.narrativeTargetMinimumMinutes
    && fullCatalogReferenceMinutes
      <= STORYWORLD_PACING_ASSUMPTIONS.narrativeTargetMaximumMinutes,
  selectedRouteDurationClaim: false,
  diagnosticOnly: true,
  observedPlaytimeProof: false,
});
