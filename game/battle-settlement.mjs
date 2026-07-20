/**
 * DOM-free durable settlement for a terminal battle result.
 *
 * This module deliberately knows nothing about combat clocks, movement, input,
 * or presentation. It prepares every affected campaign authority first, then
 * commits them through the existing compensating transaction boundary.
 */

import {
  getEncounterRewardPreview,
  getEncounterWinCount,
  recordEncounterWin,
} from './advancement.mjs';
import { validateBattleResultRecord } from './battle-result-contract.mjs';
import { resolveFieldEncounter } from './field-runtime.mjs';
import { settleBattleLoadout } from './loadout.mjs';
import { commitPersistenceTransaction, stateSaveStep } from './persistence-transaction.mjs';
import { advanceQuestObjective, getQuestProgress } from './quest-runtime.mjs';
import { recordRunFirstClear } from './run-receipt.mjs';
import {
  advanceWitnessChronicle,
  getWitnessChronicleProgress,
} from './witness-chronicle-runtime.mjs';

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

function failure(code, message) {
  return frozen({ ok: false, code, message });
}

function normalizeFlushResult(flushed, fallbackState) {
  if (flushed === false || flushed?.ok === false) return { ok: false, state: fallbackState };
  if (flushed && typeof flushed === 'object' && Object.hasOwn(flushed, 'state')) {
    return { ok: true, state: flushed.state };
  }
  return { ok: true, state: fallbackState };
}

/**
 * Persist one victory and every optional cross-page handoff it carries.
 *
 * `flushPlaytime` may update the run-receipt authority before first-clear
 * evidence is prepared. It returns either a boolean or `{ ok, state }`; the
 * latter keeps this module synchronized with the just-flushed receipt.
 */
export function settleBattleVictory({
  resultRecord,
  encounter,
  states = {},
  adapters = {},
  handoff = {},
  flushPlaytime,
} = {}) {
  if (!encounter?.id) throw new TypeError('Battle settlement requires an encounter.');
  if (typeof flushPlaytime !== 'function') throw new TypeError('Battle settlement requires flushPlaytime().');

  const validated = validateBattleResultRecord(resultRecord, { expectedEncounterId: encounter.id });
  if (!validated.ok) {
    return failure('invalid-battle-result', `Battle result was rejected: ${validated.errors.join(' ')}`);
  }
  const result = validated.value;
  if (result.result !== 'victory') {
    return failure('victory-required', 'Only a victory result may enter the durable settlement boundary.');
  }

  const priorWins = getEncounterWinCount(states.advancement, encounter.id);
  const reward = getEncounterRewardPreview(encounter.id, priorWins);
  const flushed = normalizeFlushResult(flushPlaytime(), states.runReceipt ?? null);
  if (!flushed.ok) {
    return failure(
      'playtime-save-failed',
      'Victory is earned, but active clean-run time could not be saved. Continue remains locked while the battle retries the write.',
    );
  }

  const currentRunReceiptState = flushed.state;
  let nextRunReceiptState = currentRunReceiptState;
  if (priorWins === 0 && currentRunReceiptState?.status === 'active') {
    const receiptResult = recordRunFirstClear(
      currentRunReceiptState,
      currentRunReceiptState.runId,
      encounter.id,
    );
    if (!receiptResult.ok) {
      return failure(
        'first-clear-rejected',
        `Victory is earned, but first-clear evidence was rejected (${receiptResult.code ?? 'unknown receipt error'}). Continue remains locked.`,
      );
    }
    nextRunReceiptState = receiptResult.state;
  }

  const nextAdvancementState = recordEncounterWin(states.advancement, encounter.id, {
    partyIds: encounter.party?.roster,
  });
  const loadoutSettlement = settleBattleLoadout(states.loadout, {
    itemDebits: result.itemDebits,
    reward: { currency: reward.currency, items: reward.items },
    partyVitals: result.partyVitals,
  });
  if (!loadoutSettlement.ok) {
    return failure(
      'loadout-settlement-rejected',
      `Victory is earned, but its item use, vitals, and camp reward could not be prepared: ${loadoutSettlement.reason}`,
    );
  }
  const nextLoadoutState = loadoutSettlement.state;

  const changes = [
    { id: 'advancement', adapter: adapters.advancement, previousState: states.advancement, nextState: nextAdvancementState },
    { id: 'loadout', adapter: adapters.loadout, previousState: states.loadout, nextState: nextLoadoutState },
  ];
  const messages = [];

  if (handoff.questId && handoff.questObjectiveId) {
    const loadedQuestState = adapters.quest?.load?.();
    if (!loadedQuestState?.ok) {
      return failure('quest-load-failed', 'Victory is earned, but the side-story save could not be read. Continue remains locked.');
    }
    const questResult = advanceQuestObjective(
      loadedQuestState.state,
      handoff.questId,
      handoff.questObjectiveId,
    );
    if (questResult.ok) {
      changes.push({ id: 'quest', adapter: adapters.quest, previousState: loadedQuestState.state, nextState: questResult.state });
      messages.push(`Side-story objective recorded: ${handoff.questObjectiveId}.`);
    } else {
      const progress = getQuestProgress(loadedQuestState.state, handoff.questId);
      const requestedIndex = progress?.quest.objectives.findIndex((objective, index) => (
        (objective.id ?? `objective-${index + 1}`) === handoff.questObjectiveId
      )) ?? -1;
      if (requestedIndex < 0 || progress.objectiveIndex <= requestedIndex) {
        return failure('quest-evidence-rejected', `Victory is earned, but side-story evidence was rejected: ${questResult.reason}`);
      }
    }
  }

  if (handoff.chronicleId && handoff.chronicleStageId) {
    const loadedWitnessState = adapters.witness?.load?.();
    if (!loadedWitnessState?.ok) {
      return failure('witness-load-failed', 'Victory is earned, but the witness-chronicle save could not be read. Continue remains locked.');
    }
    const evidence = {
      encounterId: encounter.id,
      victory: true,
      ...(handoff.chronicleChoiceId ? { choiceId: handoff.chronicleChoiceId } : {}),
    };
    const witnessResult = advanceWitnessChronicle(
      loadedWitnessState.state,
      handoff.chronicleId,
      handoff.chronicleStageId,
      evidence,
    );
    if (witnessResult.ok) {
      changes.push({ id: 'witness', adapter: adapters.witness, previousState: loadedWitnessState.state, nextState: witnessResult.state });
      messages.push(`Witness chronicle stage recorded: ${handoff.chronicleStageId}.`);
    } else {
      const progress = getWitnessChronicleProgress(loadedWitnessState.state, handoff.chronicleId);
      const requestedIndex = progress?.chronicle.stages.findIndex(({ id }) => id === handoff.chronicleStageId) ?? -1;
      if (requestedIndex < 0 || progress.stageIndex <= requestedIndex) {
        return failure('witness-evidence-rejected', `Victory is earned, but witness evidence was rejected: ${witnessResult.reason}`);
      }
    }
  }

  if (handoff.fieldTriggerId) {
    const loadedFieldState = adapters.field?.load?.();
    if (!loadedFieldState?.ok || !loadedFieldState.found) {
      return failure('field-load-failed', 'Victory is earned, but its field route could not be read. Continue remains locked.');
    }
    const fieldResult = resolveFieldEncounter(loadedFieldState.state, handoff.fieldTriggerId);
    if (!fieldResult.ok) {
      return failure(
        'field-evidence-rejected',
        `Victory is earned, but its field trigger was rejected (${fieldResult.code}). Continue remains locked.`,
      );
    }
    if (fieldResult.state !== loadedFieldState.state) {
      changes.push({ id: 'field', adapter: adapters.field, previousState: loadedFieldState.state, nextState: fieldResult.state });
    }
    messages.push(`Field encounter ${handoff.fieldTriggerId} resolved for the route.`);
  }

  if (nextRunReceiptState !== currentRunReceiptState) {
    changes.push({
      id: 'run-receipt',
      adapter: adapters.runReceipt,
      previousState: currentRunReceiptState,
      nextState: nextRunReceiptState,
    });
  }

  const persisted = commitPersistenceTransaction(changes.map(({
    id,
    adapter,
    previousState,
    nextState,
  }) => stateSaveStep(id, adapter, previousState, nextState, { supportsOverwriteRollback: true })));
  if (!persisted.ok) {
    const rollback = persisted.rollbackComplete
      ? 'Earlier writes were restored.'
      : `Rollback also failed for ${persisted.rollbackFailedIds.join(', ')}; reload before continuing.`;
    return failure(
      'transaction-failed',
      `Victory is earned, but ${persisted.failedId} could not be saved. ${rollback} Continue remains locked while the battle retries.`,
    );
  }

  messages.push(`Victory reward: ${reward.xpPerMember} XP per active member, ${reward.currency} mon${reward.repeat ? ' (repeat grind reward)' : ' plus first-clear loot'}.`);
  return frozen({
    ok: true,
    code: 'settled',
    priorWins,
    reward,
    messages,
    states: {
      advancement: nextAdvancementState,
      loadout: nextLoadoutState,
      runReceipt: nextRunReceiptState,
    },
  });
}
