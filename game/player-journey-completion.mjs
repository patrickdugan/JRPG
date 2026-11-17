/**
 * Player-facing journey completion, separate from the clean-run proof receipt.
 *
 * The narrative proof receipt seals only after the five-hour active-play
 * floor. A player who finishes the story sooner can still finish the credits:
 * that records this separate completion and leaves the proof receipt open and
 * accruing playtime, so evidence never claims a duration it did not observe.
 */

export const PLAYER_JOURNEY_STORAGE_KEY = 'bells.player-journey.v1';
export const PLAYER_JOURNEY_SCHEMA_VERSION = 1;

/**
 * True when the only reason the narrative proof cannot seal is the active-play
 * floor and the player (not developer) presentation is showing the page.
 */
export function canFinishJourney({ developerMode, narrativeRun, storyComplete, gateReasons }) {
  if (developerMode || !narrativeRun || !storyComplete) return false;
  const reasons = Array.isArray(gateReasons) ? gateReasons : [];
  return reasons.length > 0 && reasons.every((reason) => reason === 'active-playtime-incomplete');
}

export function validatePlayerJourneyRecord(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') return { ok: false, errors: ['record must be an object.'] };
  if (candidate.schemaVersion !== PLAYER_JOURNEY_SCHEMA_VERSION) errors.push('unsupported schemaVersion.');
  if (typeof candidate.runId !== 'string' || !candidate.runId) errors.push('runId must be a non-empty string.');
  if (!Number.isSafeInteger(candidate.activeMs) || candidate.activeMs < 0) errors.push('activeMs must be a non-negative integer.');
  if (typeof candidate.finishedAt !== 'string' || Number.isNaN(Date.parse(candidate.finishedAt))) {
    errors.push('finishedAt must be an ISO timestamp.');
  }
  return errors.length ? { ok: false, errors } : { ok: true, record: Object.freeze({ ...candidate }) };
}

export function createPlayerJourneyRecord(runId, activeMs, now = new Date()) {
  const result = validatePlayerJourneyRecord({
    schemaVersion: PLAYER_JOURNEY_SCHEMA_VERSION,
    runId,
    activeMs: Math.max(0, Math.round(Number(activeMs) || 0)),
    finishedAt: now.toISOString(),
  });
  if (!result.ok) throw new RangeError(result.errors.join(' '));
  return result.record;
}

export function isJourneyFinished(record, runId) {
  return Boolean(record && runId && record.runId === runId);
}

export function createPlayerJourneyStorageAdapter(storage = globalThis.localStorage) {
  return Object.freeze({
    load() {
      try {
        const raw = storage?.getItem(PLAYER_JOURNEY_STORAGE_KEY);
        if (raw == null) return { ok: true, found: false, record: null };
        const parsed = validatePlayerJourneyRecord(JSON.parse(raw));
        return parsed.ok ? { ok: true, found: true, record: parsed.record } : { ok: false, found: true, record: null };
      } catch {
        return { ok: false, found: false, record: null };
      }
    },
    save(record) {
      const checked = validatePlayerJourneyRecord(record);
      if (!checked.ok) return { ok: false, errors: checked.errors };
      try {
        storage?.setItem(PLAYER_JOURNEY_STORAGE_KEY, JSON.stringify(checked.record));
        return { ok: true };
      } catch {
        return { ok: false, errors: ['storage unavailable.'] };
      }
    },
  });
}
