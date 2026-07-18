import { CAMPAIGN } from './content/campaign.mjs';

const BORROWED_REFERENCE = /\b(adam driver|castlevania|symphony of the night|final fantasy|dracula)\b/i;
const PLACEHOLDER = /\b(todo|tbd|placeholder|scene text pending|lorem ipsum)\b/i;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function words(value) {
  return String(value ?? '').trim().split(/\s+/u).filter(Boolean);
}

function normalizeLine(entry) {
  return {
    speaker: String(entry?.speaker ?? '').trim(),
    line: String(entry?.line ?? entry?.text ?? '').trim(),
  };
}

function baseDialogue(beat) {
  const source = Array.isArray(beat.text) && beat.text.length
    ? beat.text
    : [{ speaker: 'NARRATOR', line: String(beat.text ?? '') }];
  return source.map(normalizeLine);
}

function canonicalBeatRecords() {
  return CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
    chapterId: chapter.id,
    beat,
  })));
}

export const FULL_SCRIPT_VOLUME_TARGET = deepFreeze({
  dialogueWords: 36_000,
  dialogueLines: 2_400,
  coveredBeats: canonicalBeatRecords().length,
});

export function compileDialogueScript(expansionPacks = [], options = {}) {
  const strictCoverage = options.strictCoverage !== false;
  const records = canonicalBeatRecords();
  const canonicalIds = new Set(records.map(({ beat }) => beat.id));
  const expansions = new Map();
  const errors = [];

  for (const [packIndex, pack] of expansionPacks.entries()) {
    if (!Array.isArray(pack)) {
      errors.push(`Pack ${packIndex + 1} must be an array.`);
      continue;
    }
    for (const [entryIndex, entry] of pack.entries()) {
      const label = `Pack ${packIndex + 1} entry ${entryIndex + 1}`;
      const beatId = String(entry?.beatId ?? '');
      if (!canonicalIds.has(beatId)) {
        errors.push(`${label} has unknown beat ID ${beatId || '(missing)'}.`);
        continue;
      }
      if (expansions.has(beatId)) {
        errors.push(`${label} duplicates beat ${beatId}.`);
        continue;
      }
      const before = Array.isArray(entry.before) ? entry.before.map(normalizeLine) : [];
      const after = Array.isArray(entry.after) ? entry.after.map(normalizeLine) : [];
      if (!before.length && !after.length) errors.push(`${label} must add before or after dialogue.`);
      expansions.set(beatId, { before, after });
    }
  }

  if (strictCoverage) {
    for (const { beat } of records) {
      if (!expansions.has(beat.id)) errors.push(`Missing expansion for canonical beat ${beat.id}.`);
    }
  }

  const scenes = records.map(({ chapterId, beat }) => {
    const expansion = expansions.get(beat.id) ?? { before: [], after: [] };
    const original = baseDialogue(beat);
    const dialogue = [...expansion.before, ...original, ...expansion.after];
    for (const [lineIndex, entry] of dialogue.entries()) {
      const label = `${beat.id} line ${lineIndex + 1}`;
      if (!entry.speaker) errors.push(`${label} needs a speaker.`);
      if (entry.line.length < 2 || entry.line.length > 280) errors.push(`${label} must contain 2-280 characters.`);
      if (PLACEHOLDER.test(entry.line)) errors.push(`${label} contains placeholder prose.`);
      if (BORROWED_REFERENCE.test(`${entry.speaker} ${entry.line}`)) errors.push(`${label} borrows a prohibited real/franchise reference.`);
    }
    return {
      beatId: beat.id,
      chapterId,
      title: beat.title,
      originalLineCount: original.length,
      addedLineCount: expansion.before.length + expansion.after.length,
      dialogue,
    };
  });

  const dialogueLines = scenes.reduce((total, scene) => total + scene.dialogue.length, 0);
  const dialogueWords = scenes.reduce((total, scene) => (
    total + scene.dialogue.reduce((subtotal, entry) => subtotal + words(entry.line).length, 0)
  ), 0);
  const coveredBeats = expansions.size;
  const metrics = {
    sceneCount: scenes.length,
    coveredBeats,
    dialogueLines,
    dialogueWords,
    estimatedReadingMinutesAt150Wpm: Number((dialogueWords / 150).toFixed(2)),
    volumeTargetMet: coveredBeats === FULL_SCRIPT_VOLUME_TARGET.coveredBeats
      && dialogueLines >= FULL_SCRIPT_VOLUME_TARGET.dialogueLines
      && dialogueWords >= FULL_SCRIPT_VOLUME_TARGET.dialogueWords,
  };

  return deepFreeze({
    ok: errors.length === 0,
    errors,
    scenes,
    metrics,
  });
}

export function getCompiledScene(script, beatId) {
  return script?.scenes?.find((scene) => scene.beatId === beatId) ?? null;
}

export function getCompiledDialogue(script, beatId) {
  return getCompiledScene(script, beatId)?.dialogue ?? null;
}
