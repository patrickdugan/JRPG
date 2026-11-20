/**
 * Git-pinned July 2026 image archive. Each runtime image is an unchanged alias
 * of the original Git blob. Source drawings are PNGs, not editable SVG files.
 */
export const ILLUSTRATION_SOURCE_VERSION = 1;
export const ILLUSTRATION_REVIEW_STORAGE_KEY = 'bells-black-chrysanthemum.illustration-review.v1';

export const ILLUSTRATION_REFERENCES = Object.freeze([
  {
    id: 'nikola',
    label: 'Nikola Dražanić',
    detail: 'The Croatian hunter and Longinus spear. This July board is itself pixel-styled, so treat it as character identity evidence while tracing the separate Occidental vector artwork.',
    approvedUse: 'Historical design evidence: silhouette, cloak, weapon and heraldic construction. Its pixel-style rendering is not the requested vector-art finish.',
    source: {
      path: 'assets/art/concepts/dravanic-lance-of-longinus-concept-v2.png',
      file: 'nikola-original-v2.png',
      sha: '840e856e010e0eda5989f90ca8b3e195bd947399',
      commit: '7d7ca2d6bdab5df81da86e2e991064a46098362b',
    },
    later: {
      path: 'assets/art/concepts/pixelified/dravanic-longinus-pixelified-native-384x256-v1.png',
      file: 'nikola-pixel-study.png',
      sha: '20331006563da45343c94acbd2407b1a294e947d',
      label: 'Pixelified study, 384 × 256',
      note: 'Later pixel treatment. Evaluate loss of facial and costume identity rather than treating its pixels as the illustration source.',
      pixel: true,
    },
  },
  {
    id: 'mateus',
    label: 'Father Mateus Avelar',
    detail: 'The vampire priest in a textured, painterly July concept with a restrained European Gothic bearing.',
    approvedUse: 'Historical design evidence: coat, collar, grave expression and character proportions. The painterly treatment is not yet an Occidental vector-style approval.',
    source: {
      path: 'assets/art/concepts/vampire-priest-concept-v2.png',
      file: 'mateus-original-v2.png',
      sha: '2a753993b4bf64b477c47c574484cc7fd1d220fd',
      commit: '7d7ca2d6bdab5df81da86e2e991064a46098362b',
    },
    later: {
      path: 'assets/art/party-portrait-suite-v2/party-portrait-expressions-v2.png',
      file: 'party-portrait-pixel-atlas-v2.png',
      sha: 'a9e64fc4e0eba68f62f3b7d113d0f54d283f84f3',
      label: 'Later party portrait atlas, seven character rows',
      note: 'A collective 7 × 8 runtime atlas, not a direct pixelification of this Mateus concept. Compare overall direction only.',
      pixel: true,
    },
  },
  {
    id: 'kurozane',
    label: 'Shogun Kurozane',
    detail: 'The Japanese ruler in human, Oni-armored and demon states. This source is a painterly illustration, with facial and armor continuity worth preserving.',
    approvedUse: 'Historical design evidence: Japanese period identity, early-Edo armor geometry, and transformation continuity. A future graphic/vector treatment needs separate approval.',
    source: {
      path: 'assets/art/concepts/kurozane-three-state-demon-mode-concept-v3.png',
      file: 'kurozane-original-v3.png',
      sha: '571c39e645e50927a1316d46570fed6db412add7',
      commit: '217e50c7179798cb0d00f530fb6546e234423b19',
    },
    later: {
      path: 'assets/art/kurozane-final-battle-v1/kurozane-final-battle-contact-sheet-v1.png',
      file: 'kurozane-runtime-contact-v1.png',
      sha: '0f18d2252264f3825f0d94c03f7956c03de675e7',
      label: 'Final-battle animation contact sheet',
      note: 'Production animation overview, not frame-for-frame equivalent to the illustration. Preserve Japanese facial identity and armor design.',
      pixel: true,
    },
  },
  {
    id: 'world',
    label: 'The hidden shore',
    detail: 'The original July 17 world/story composition, retained as a setting reference with a separate historical pixel-art brief.',
    approvedUse: 'Settlement scale, traversable bridge, chapel pressure, wet cedar, and the distant authoritarian fortress.',
    source: {
      path: 'assets/concepts/bells-world-story-target-v1.png',
      file: 'world-story-july-source-v1.png',
      sha: '030ed5f6ed09a5d155f545c9f6fd7bb8bb1d1583',
      commit: '5030f5d6641891eeec28a80cf6015006bbe2e513',
    },
    later: {
      path: 'assets/art/scene-backdrop-suite/scene-backdrop-contact-sheet.png',
      file: 'scene-backdrop-runtime-contact.png',
      sha: 'b5970a31a4f1d316dca272bb5318edcaa8f4b911',
      label: 'Later scene-backdrop contact sheet',
      note: 'A production overview, with different scene framing and scale. The July world target itself was originally briefed as pixel art.',
      pixel: true,
    },
  },
]);

export function runtimeIllustrationPath(file) {
  return './assets/art/july-illustrations-v1/' + String(file);
}

export function allIllustrationFiles(references = ILLUSTRATION_REFERENCES) {
  return references.flatMap((reference) => [
    { ...reference.source, id: reference.id, lane: 'source' },
    ...(reference.later ? [{ ...reference.later, id: reference.id, lane: 'later' }] : []),
  ]);
}

export const ILLUSTRATION_REVIEW_VERDICTS = Object.freeze([
  'unreviewed', 'use-as-reference', 'needs-revision',
]);

export function validIllustrationReview(review, catalog = ILLUSTRATION_REFERENCES) {
  if (!review || review.schemaVersion !== ILLUSTRATION_SOURCE_VERSION || !Array.isArray(review.entries)) return false;
  if (review.entries.length > catalog.length) return false;
  const seen = new Set();
  for (const entry of review.entries) {
    const reference = catalog.find((asset) => asset.id === entry?.id);
    if (!reference || seen.has(entry.id)) return false;
    if (entry.sourceSha !== reference.source.sha) return false;
    if (!ILLUSTRATION_REVIEW_VERDICTS.includes(entry.verdict)) return false;
    if (typeof entry.note !== 'string' || entry.note.length > 2500) return false;
    seen.add(entry.id);
  }
  return true;
}
