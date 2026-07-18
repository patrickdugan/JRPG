import {
  FULL_SCRIPT_VOLUME_TARGET,
  compileDialogueScript,
  getCompiledDialogue,
  getCompiledScene,
} from '../dialogue-script-contract.mjs';
import { SCRIPT_PROLOGUE_CHAPTER3 } from './dialogue/script-prologue-chapter3.mjs';
import { SCRIPT_CHAPTER4_CHAPTER6 } from './dialogue/script-chapter4-chapter6.mjs';
import { SCRIPT_CHAPTER7_EPILOGUE } from './dialogue/script-chapter7-epilogue.mjs';

export const DIALOGUE_EXPANSION_PACKS = Object.freeze([
  SCRIPT_PROLOGUE_CHAPTER3,
  SCRIPT_CHAPTER4_CHAPTER6,
  SCRIPT_CHAPTER7_EPILOGUE,
]);

const compiled = compileDialogueScript(DIALOGUE_EXPANSION_PACKS);
if (!compiled.ok) throw new TypeError(compiled.errors.join(' '));
if (!compiled.metrics.volumeTargetMet) {
  throw new RangeError(
    `Full dialogue volume is below contract: ${compiled.metrics.dialogueWords}/${FULL_SCRIPT_VOLUME_TARGET.dialogueWords} words, `
    + `${compiled.metrics.dialogueLines}/${FULL_SCRIPT_VOLUME_TARGET.dialogueLines} lines, `
    + `${compiled.metrics.coveredBeats}/${FULL_SCRIPT_VOLUME_TARGET.coveredBeats} beats.`,
  );
}

export const FULL_DIALOGUE_SCRIPT = compiled;
export const FULL_DIALOGUE_METRICS = compiled.metrics;

export function getFullDialogue(beatId) {
  return getCompiledDialogue(FULL_DIALOGUE_SCRIPT, beatId);
}

export function getFullDialogueScene(beatId) {
  return getCompiledScene(FULL_DIALOGUE_SCRIPT, beatId);
}
