import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import { SCRIPT_PROLOGUE_CHAPTER3 } from '../content/dialogue/script-prologue-chapter3.mjs';
import { SCRIPT_CHAPTER4_CHAPTER6 } from '../content/dialogue/script-chapter4-chapter6.mjs';
import { SCRIPT_CHAPTER7_EPILOGUE } from '../content/dialogue/script-chapter7-epilogue.mjs';
import {
  DIALOGUE_EXPANSION_PACKS,
  FULL_DIALOGUE_METRICS,
  FULL_DIALOGUE_SCRIPT,
} from '../content/full-dialogue.mjs';
import {
  FULL_SCRIPT_VOLUME_TARGET,
  compileDialogueScript,
} from '../dialogue-script-contract.mjs';

const PACK_EXPORTS = Object.freeze([
  SCRIPT_PROLOGUE_CHAPTER3,
  SCRIPT_CHAPTER4_CHAPTER6,
  SCRIPT_CHAPTER7_EPILOGUE,
]);

const CANONICAL_RECORDS = CAMPAIGN.chapters.flatMap((chapter) => (
  chapter.beats.map((beat) => ({ chapterId: chapter.id, beat }))
));

const CANONICAL_BEAT_IDS = CANONICAL_RECORDS.map(({ beat }) => beat.id);

function wordCount(value) {
  return String(value ?? '').trim().split(/\s+/u).filter(Boolean).length;
}

function normalizeLine(entry) {
  return {
    speaker: String(entry?.speaker ?? '').trim(),
    line: String(entry?.line ?? entry?.text ?? '').trim(),
  };
}

function originalDialogue(beat) {
  const source = Array.isArray(beat.text) && beat.text.length
    ? beat.text
    : [{ speaker: 'NARRATOR', line: String(beat.text ?? '') }];
  return source.map(normalizeLine);
}

function addedLines(entry) {
  return [...entry.before, ...entry.after].map(normalizeLine);
}

function isDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

function cloneChoices(choices) {
  return JSON.parse(JSON.stringify(choices ?? []));
}

test('full dialogue covers the exact 60-beat campaign in canonical order and meets volume targets', () => {
  assert.equal(CANONICAL_RECORDS.length, 60, 'The authored campaign contract must remain exactly 60 beats.');
  assert.equal(new Set(CANONICAL_BEAT_IDS).size, 60, 'Canonical beat IDs must be unique.');

  const authoredBeatIds = DIALOGUE_EXPANSION_PACKS.flatMap((pack) => pack.map(({ beatId }) => beatId));
  assert.equal(authoredBeatIds.length, 60, 'The three packs must contain exactly one entry per canonical beat.');
  assert.equal(new Set(authoredBeatIds).size, 60, 'The three packs must not duplicate a beat.');
  assert.deepEqual(authoredBeatIds, CANONICAL_BEAT_IDS, 'Pack order must match canonical campaign order exactly.');
  assert.deepEqual(
    FULL_DIALOGUE_SCRIPT.scenes.map(({ beatId }) => beatId),
    CANONICAL_BEAT_IDS,
    'Compiled scene order must match canonical campaign order exactly.',
  );

  assert.equal(FULL_DIALOGUE_SCRIPT.ok, true, FULL_DIALOGUE_SCRIPT.errors.join('\n'));
  assert.deepEqual(FULL_DIALOGUE_SCRIPT.errors, []);
  assert.equal(FULL_DIALOGUE_SCRIPT.scenes.length, 60);
  assert.equal(FULL_DIALOGUE_METRICS, FULL_DIALOGUE_SCRIPT.metrics);
  assert.equal(FULL_DIALOGUE_METRICS.coveredBeats, 60);
  assert.equal(FULL_SCRIPT_VOLUME_TARGET.coveredBeats, 60);
  assert.equal(FULL_SCRIPT_VOLUME_TARGET.dialogueWords, 36_000);
  assert.equal(FULL_SCRIPT_VOLUME_TARGET.dialogueLines, 2_400);
  assert.ok(
    FULL_DIALOGUE_METRICS.dialogueWords >= 36_000,
    `Expected at least 36,000 compiled words; found ${FULL_DIALOGUE_METRICS.dialogueWords}.`,
  );
  assert.ok(
    FULL_DIALOGUE_METRICS.dialogueLines >= 2_400,
    `Expected at least 2,400 compiled lines; found ${FULL_DIALOGUE_METRICS.dialogueLines}.`,
  );
  assert.equal(FULL_DIALOGUE_METRICS.volumeTargetMet, true);
});

test('all pack exports and compiled scenes are deeply frozen', () => {
  assert.equal(DIALOGUE_EXPANSION_PACKS.length, 3);
  assert.deepEqual(DIALOGUE_EXPANSION_PACKS, PACK_EXPORTS);
  assert.equal(isDeeplyFrozen(DIALOGUE_EXPANSION_PACKS), true, 'Aggregate pack export must be deeply frozen.');

  for (const [packIndex, pack] of PACK_EXPORTS.entries()) {
    assert.equal(isDeeplyFrozen(pack), true, `Dialogue pack ${packIndex + 1} must be deeply frozen.`);
  }

  assert.equal(isDeeplyFrozen(FULL_DIALOGUE_SCRIPT), true, 'The compiled full-dialogue artifact must be deeply frozen.');
  assert.equal(isDeeplyFrozen(FULL_DIALOGUE_METRICS), true, 'Compiled metrics must be deeply frozen.');
  for (const scene of FULL_DIALOGUE_SCRIPT.scenes) {
    assert.equal(isDeeplyFrozen(scene), true, `Compiled scene ${scene.beatId} must be deeply frozen.`);
  }
});

test('every original line remains in order between authored before and after dialogue', () => {
  const expansionByBeat = new Map(DIALOGUE_EXPANSION_PACKS.flat().map((entry) => [entry.beatId, entry]));

  for (const { beat } of CANONICAL_RECORDS) {
    const scene = FULL_DIALOGUE_SCRIPT.scenes.find(({ beatId }) => beatId === beat.id);
    const expansion = expansionByBeat.get(beat.id);
    const original = originalDialogue(beat);
    assert.ok(scene, `Missing compiled scene ${beat.id}.`);
    assert.ok(expansion, `Missing authored expansion ${beat.id}.`);
    assert.equal(scene.originalLineCount, original.length, `${beat.id} original line count changed.`);
    assert.equal(
      scene.addedLineCount,
      expansion.before.length + expansion.after.length,
      `${beat.id} added line count changed.`,
    );
    assert.deepEqual(
      scene.dialogue.slice(expansion.before.length, expansion.before.length + original.length),
      original,
      `${beat.id} no longer preserves its original dialogue at the before/after seam.`,
    );
  }
});

test('added dialogue is unique, nonrepeating, and substantial in every scene', () => {
  const expansionByBeat = new Map();
  const firstLocationByText = new Map();
  const duplicateTexts = [];

  for (const [packIndex, pack] of DIALOGUE_EXPANSION_PACKS.entries()) {
    for (const entry of pack) {
      expansionByBeat.set(entry.beatId, entry);
      const lines = addedLines(entry);
      const words = lines.reduce((total, authoredLine) => total + wordCount(authoredLine.line), 0);
      assert.ok(
        lines.length >= 35,
        `${entry.beatId} needs at least 35 added lines; found ${lines.length}.`,
      );
      assert.ok(
        words >= 550,
        `${entry.beatId} needs at least 550 added words; found ${words}.`,
      );

      for (const [lineIndex, authoredLine] of lines.entries()) {
        const normalizedText = authoredLine.line.replace(/\s+/gu, ' ').trim();
        const location = `pack ${packIndex + 1}, ${entry.beatId}, added line ${lineIndex + 1}`;
        if (firstLocationByText.has(normalizedText)) {
          duplicateTexts.push(`${JSON.stringify(normalizedText)} at ${firstLocationByText.get(normalizedText)} and ${location}`);
        } else {
          firstLocationByText.set(normalizedText, location);
        }
      }
    }
  }

  assert.deepEqual(duplicateTexts, [], `Duplicate added line text found:\n${duplicateTexts.join('\n')}`);
  assert.equal(expansionByBeat.size, 60);

  for (const scene of FULL_DIALOGUE_SCRIPT.scenes) {
    for (let index = 1; index < scene.dialogue.length; index += 1) {
      const previous = scene.dialogue[index - 1];
      const current = scene.dialogue[index];
      assert.ok(
        previous.speaker !== current.speaker || previous.line !== current.line,
        `${scene.beatId} repeats the same speaker/line at compiled lines ${index} and ${index + 1}.`,
      );
    }
  }
});

test('compilation leaves campaign choice prompts source-owned and sequenced after dialogue', () => {
  const choiceReferences = new Map(CANONICAL_RECORDS.map(({ beat }) => [beat.id, beat.choices]));
  const choiceSnapshots = new Map(CANONICAL_RECORDS.map(({ beat }) => [beat.id, cloneChoices(beat.choices)]));
  const recompiled = compileDialogueScript(DIALOGUE_EXPANSION_PACKS);
  assert.equal(recompiled.ok, true, recompiled.errors.join('\n'));

  for (const { beat } of CANONICAL_RECORDS) {
    const scene = recompiled.scenes.find(({ beatId }) => beatId === beat.id);
    assert.ok(scene, `Missing recompiled scene ${beat.id}.`);
    assert.equal(
      beat.choices,
      choiceReferences.get(beat.id),
      `${beat.id} source choice array reference was replaced during compilation.`,
    );
    assert.deepEqual(
      beat.choices,
      choiceSnapshots.get(beat.id),
      `${beat.id} source choice prompts were mutated during compilation.`,
    );
    assert.equal(
      Object.hasOwn(scene, 'choices'),
      false,
      `${beat.id} choices must remain source-owned rather than being inserted into compiled dialogue.`,
    );
    for (const entry of scene.dialogue) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['line', 'speaker'],
        `${beat.id} compiled dialogue must contain only speaker/line entries before source choices are shown.`,
      );
    }

    const dialogueThenChoices = [...scene.dialogue, ...beat.choices];
    assert.deepEqual(
      dialogueThenChoices.slice(0, scene.dialogue.length),
      scene.dialogue,
      `${beat.id} dialogue must remain ahead of every choice prompt.`,
    );
    assert.deepEqual(
      dialogueThenChoices.slice(scene.dialogue.length),
      beat.choices,
      `${beat.id} source choice prompts must remain after the final dialogue entry.`,
    );
  }
});
