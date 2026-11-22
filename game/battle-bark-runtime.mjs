/**
 * Opt-in Action Battle bark playback runtime.
 *
 * Isolation contract:
 * - Reuses the read-only preference key `bbc.dialogueVoice.v1` from
 *   `dialogue-voice-runtime.mjs`; never writes to localStorage and never
 *   touches any of the 14 canonical campaign, recovery, receipt, or playtime
 *   save authorities.
 * - Defaults to OFF (`enabled: false`), making zero network fetches and
 *   creating zero Audio instances until explicitly enabled.
 * - Purely observational: never mutates combat snapshots, sessions, or
 *   deterministic combat timing.
 */

import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  DEFAULT_DIALOGUE_VOICE_MANIFEST_URL,
  DIALOGUE_VOICE_LANGUAGES,
  DIALOGUE_VOICE_STORAGE_KEY,
  loadDialogueVoicePreferences,
  normalizeDialogueSpeaker,
} from './dialogue-voice-runtime.mjs';

export { DIALOGUE_VOICE_STORAGE_KEY };

export const DEFAULT_BATTLE_BARK_GLOBAL_COOLDOWN_MS = 1800;
export const DEFAULT_BATTLE_BARK_ACTOR_COOLDOWN_MS = 4000;

const RUNTIME_ACTOR_ALIASES = Object.freeze({
  ren: 'ren',
  aya: 'aya',
  nikola: 'lise',
  lise: 'lise',
  mateus: 'mateus',
  genta: 'genta',
  kiku: 'kiku',
  miyo: 'miyo',
  kurozane: 'kurozane',
  'captain-kaji': 'captain-kaji',
  'widow-of-fog': 'widow-of-fog',
  'furnace-abbot': 'furnace-abbot',
  ujiro: 'ujiro',
  'bell-warden-chiyo': 'bell-warden-chiyo',
  'lady-enma': 'lady-enma',
});

const SPEAKING_BOSS_IDS = new Set([
  'kurozane',
  'mateus',
  'lady-enma',
  'ujiro',
  'captain-kaji',
  'widow-of-fog',
  'furnace-abbot',
  'bell-warden-chiyo',
]);

const WEAPON_ATTACK_PATTERN = /(?:courier-cut|hunter-thrust|pilgrim-maul|weapon|basic|strike|slash|thrust)/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalize a runtime actor ID or manifest speaker ID to the canonical bark actor key.
 * Strips instance suffixes from spawned enemy actors (e.g., `kurozane-1` -> `kurozane`).
 */
export function normalizeBattleBarkActorId(rawActorId, fallbackSpeaker = '') {
  const raw = String(rawActorId ?? '').trim().toLowerCase();
  if (raw) {
    if (RUNTIME_ACTOR_ALIASES[raw]) return RUNTIME_ACTOR_ALIASES[raw];
    const stripped = raw.replace(/-\d+$/, '');
    if (RUNTIME_ACTOR_ALIASES[stripped]) return RUNTIME_ACTOR_ALIASES[stripped];
    const fromSpeaker = normalizeDialogueSpeaker(stripped);
    if (fromSpeaker && RUNTIME_ACTOR_ALIASES[fromSpeaker]) return RUNTIME_ACTOR_ALIASES[fromSpeaker];
    return stripped;
  }
  const speakerNorm = normalizeDialogueSpeaker(fallbackSpeaker);
  if (!speakerNorm) return '';
  return RUNTIME_ACTOR_ALIASES[speakerNorm] ?? speakerNorm;
}

/**
 * Index rendered `battle-barks` entries from a voice manifest by `(actorId, barkType)`
 * and optionally `(actorId, barkType, phaseId)` for phase-specific boss barks.
 */
export function createBattleBarkIndex(manifest) {
  const byActorBark = new Map();
  const byActorBarkPhase = new Map();
  let clipCount = 0;

  if (!isRecord(manifest?.lines)) {
    return Object.freeze({
      manifest: manifest ?? null,
      byActorBark,
      byActorBarkPhase,
      clipCount: 0,
    });
  }

  for (const [lineId, locales] of Object.entries(manifest.lines)) {
    if (!isRecord(locales)) continue;
    const baseMeta = locales.en ?? locales.ja;
    if (!isRecord(baseMeta)) continue;
    const isBark = baseMeta.sceneId === 'battle-barks'
      || (typeof baseMeta.barkType === 'string' && baseMeta.barkType.length > 0);
    if (!isBark) continue;

    for (const lang of DIALOGUE_VOICE_LANGUAGES) {
      const entry = locales[lang];
      if (!isRecord(entry) || typeof entry.file !== 'string' || !entry.file) continue;
      const barkType = String(entry.barkType ?? baseMeta.barkType ?? '').trim().toLowerCase();
      const actorId = normalizeBattleBarkActorId(
        entry.actorId ?? baseMeta.actorId,
        entry.speaker ?? baseMeta.speaker,
      );
      if (!barkType || !actorId) continue;
      const phaseId = String(entry.phaseId ?? baseMeta.phaseId ?? '').trim().toLowerCase() || null;
      const cue = Object.freeze({
        lineId,
        actorId,
        speaker: normalizeDialogueSpeaker(entry.speaker ?? baseMeta.speaker),
        barkType,
        phaseId,
        language: lang,
        file: entry.file,
        text: entry.text ?? '',
      });
      const baseKey = `${lang}:${actorId}:${barkType}`;
      if (!byActorBark.has(baseKey)) byActorBark.set(baseKey, []);
      byActorBark.get(baseKey).push(cue);
      if (phaseId) {
        const phaseKey = `${lang}:${actorId}:${barkType}:${phaseId}`;
        if (!byActorBarkPhase.has(phaseKey)) byActorBarkPhase.set(phaseKey, []);
        byActorBarkPhase.get(phaseKey).push(cue);
      }
      clipCount += 1;
    }
  }

  return Object.freeze({
    manifest,
    byActorBark,
    byActorBarkPhase,
    clipCount,
  });
}

export function lookupBattleBarkCue(index, {
  actorId,
  barkType,
  phaseId = null,
  fallbackActorId = null,
  fallbackBarkType = null,
  language = 'en',
  cursor = 0,
} = {}) {
  if (!index || !DIALOGUE_VOICE_LANGUAGES.includes(language)) return null;
  const normActor = normalizeBattleBarkActorId(actorId);
  const normBark = String(barkType ?? '').trim().toLowerCase();
  const normPhase = String(phaseId ?? '').trim().toLowerCase() || null;

  const pickFrom = (list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = Math.abs(Math.trunc(cursor)) % list.length;
    return list[idx];
  };

  if (normActor && normBark) {
    if (normPhase) {
      const phaseMatch = pickFrom(index.byActorBarkPhase.get(`${language}:${normActor}:${normBark}:${normPhase}`));
      if (phaseMatch) return phaseMatch;
    }
    const direct = pickFrom(index.byActorBark.get(`${language}:${normActor}:${normBark}`));
    if (direct) return direct;
  }

  const fbActor = normalizeBattleBarkActorId(fallbackActorId ?? normActor);
  const fbBark = String(fallbackBarkType ?? '').trim().toLowerCase();
  if (fbActor && fbBark) {
    const fallback = pickFrom(index.byActorBark.get(`${language}:${fbActor}:${fbBark}`));
    if (fallback) return fallback;
  }
  return null;
}

function findActor(snapshot, actorId) {
  if (!actorId || !Array.isArray(snapshot?.kernel?.actors)) return null;
  return snapshot.kernel.actors.find((actor) => actor?.id === actorId) ?? null;
}

function findBossActorId(snapshot) {
  if (snapshot?.bossPhase?.bossActorId) {
    return normalizeBattleBarkActorId(snapshot.bossPhase.bossActorId);
  }
  const actors = snapshot?.kernel?.actors;
  if (!Array.isArray(actors)) return '';
  for (const actor of actors) {
    if (actor?.faction !== 'enemy') continue;
    const normalized = normalizeBattleBarkActorId(actor.id);
    if (SPEAKING_BOSS_IDS.has(normalized)) return normalized;
  }
  return '';
}

function classifyPlayerAttackBark(event, resolveAttackSlot) {
  if (typeof resolveAttackSlot === 'function') {
    const slot = resolveAttackSlot(event.actorId, event.attackId);
    if (slot === 0) return { barkType: 'attack', fallbackBarkType: 'art' };
    if (slot > 0) return { barkType: 'art', fallbackBarkType: 'attack' };
  }
  if (Number.isInteger(event.attackIndex)) {
    return event.attackIndex === 0
      ? { barkType: 'attack', fallbackBarkType: 'art' }
      : { barkType: 'art', fallbackBarkType: 'attack' };
  }
  if (WEAPON_ATTACK_PATTERN.test(String(event.attackId ?? ''))) {
    return { barkType: 'attack', fallbackBarkType: 'art' };
  }
  return { barkType: 'art', fallbackBarkType: 'attack' };
}

/**
 * Pure event-to-bark request mapper for Action Battle kernel events.
 * Returns null for events that should not trigger a voice bark.
 */
export function mapCombatEventToBarkRequest(event, snapshot = null, {
  resolveAttackSlot = null,
} = {}) {
  if (!isRecord(event) || typeof event.type !== 'string') return null;

  if (event.type === 'combo-start') {
    const initiator = normalizeBattleBarkActorId(
      event.initiatorActorId ?? snapshot?.kernel?.controlledActorId ?? 'lise',
    );
    const partner = initiator === 'mateus' ? 'lise' : 'mateus';
    return Object.freeze({
      actorId: initiator || 'lise',
      barkType: 'duo',
      fallbackActorId: partner,
      fallbackBarkType: 'duo',
      phaseId: null,
      priority: 'high',
      overrideThrottle: true,
    });
  }

  if (event.type === 'boss-phase-entered') {
    const bossId = normalizeBattleBarkActorId(event.bossActorId ?? snapshot?.bossPhase?.bossActorId);
    if (!bossId) return null;
    return Object.freeze({
      actorId: bossId,
      barkType: 'boss-phase',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: event.toPhaseId ?? event.phaseId ?? null,
      priority: 'high',
      overrideThrottle: true,
    });
  }

  if (event.type === 'boss-phase-warning') {
    const bossId = normalizeBattleBarkActorId(event.bossActorId ?? snapshot?.bossPhase?.bossActorId);
    if (!bossId) return null;
    return Object.freeze({
      actorId: bossId,
      barkType: 'boss-tell',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: event.toPhaseId ?? event.phaseId ?? null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  if (event.type === 'combat-end') {
    const controlledId = normalizeBattleBarkActorId(snapshot?.kernel?.controlledActorId ?? 'ren');
    if (event.outcome === 'victory') {
      const bossId = findBossActorId(snapshot);
      if (bossId) {
        return Object.freeze({
          actorId: bossId,
          barkType: 'boss-defeat',
          fallbackActorId: controlledId,
          fallbackBarkType: 'victory',
          phaseId: null,
          priority: 'high',
          overrideThrottle: true,
        });
      }
      return Object.freeze({
        actorId: controlledId,
        barkType: 'victory',
        fallbackActorId: null,
        fallbackBarkType: null,
        phaseId: null,
        priority: 'high',
        overrideThrottle: true,
      });
    }
    return Object.freeze({
      actorId: controlledId,
      barkType: 'hurt',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: null,
      priority: 'high',
      overrideThrottle: true,
    });
  }

  if (event.type === 'poise-broken') {
    const targetActor = findActor(snapshot, event.actorId);
    const targetId = normalizeBattleBarkActorId(event.actorId);
    const sourceId = normalizeBattleBarkActorId(event.sourceActorId);
    if (targetActor?.faction === 'enemy' && SPEAKING_BOSS_IDS.has(targetId)) {
      return Object.freeze({
        actorId: targetId,
        barkType: 'stagger',
        fallbackActorId: sourceId || null,
        fallbackBarkType: sourceId ? 'stagger' : null,
        phaseId: null,
        priority: 'elevated',
        overrideThrottle: false,
      });
    }
    if (!sourceId) return null;
    return Object.freeze({
      actorId: sourceId,
      barkType: 'stagger',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: null,
      priority: 'elevated',
      overrideThrottle: false,
    });
  }

  if (event.type === 'subweapon-used') {
    const actorId = normalizeBattleBarkActorId(event.actorId);
    if (!actorId) return null;
    return Object.freeze({
      actorId,
      barkType: 'subweapon',
      fallbackActorId: actorId,
      fallbackBarkType: 'heal',
      phaseId: null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  if (event.type === 'attack-start') {
    if (event.comboId) return null;
    const actor = findActor(snapshot, event.actorId);
    const actorId = normalizeBattleBarkActorId(event.actorId);
    if (!actorId) return null;
    if (actor?.faction === 'enemy') {
      if (!SPEAKING_BOSS_IDS.has(actorId)) return null;
      return Object.freeze({
        actorId,
        barkType: 'boss-tell',
        fallbackActorId: null,
        fallbackBarkType: null,
        phaseId: snapshot?.bossPhase?.phaseId ?? null,
        priority: 'normal',
        overrideThrottle: false,
      });
    }
    const { barkType, fallbackBarkType } = classifyPlayerAttackBark(event, resolveAttackSlot);
    return Object.freeze({
      actorId,
      barkType,
      fallbackActorId: actorId,
      fallbackBarkType,
      phaseId: null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  if (event.type === 'control-switch') {
    const actorId = normalizeBattleBarkActorId(
      event.actorId ?? event.toActorId ?? snapshot?.kernel?.controlledActorId,
    );
    if (!actorId) return null;
    return Object.freeze({
      actorId,
      barkType: 'tag',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  if (event.type === 'hit') {
    if (!(event.damage > 0)) return null;
    const target = findActor(snapshot, event.targetId);
    if (target?.faction !== 'player') return null;
    const targetId = normalizeBattleBarkActorId(event.targetId);
    if (!targetId) return null;
    return Object.freeze({
      actorId: targetId,
      barkType: 'hurt',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  if (event.type === 'hit-ignored') {
    const target = findActor(snapshot, event.targetId);
    if (target?.faction !== 'player') return null;
    const targetId = normalizeBattleBarkActorId(event.targetId);
    if (!targetId) return null;
    return Object.freeze({
      actorId: targetId,
      barkType: 'guard',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: null,
      priority: 'normal',
      overrideThrottle: false,
    });
  }

  return null;
}

export function createBattleBarkRuntime({
  storage = getDefaultBrowserStorage(),
  manifestUrl = DEFAULT_DIALOGUE_VOICE_MANIFEST_URL,
  fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
  createAudio = typeof globalThis.Audio === 'function' ? (src) => new globalThis.Audio(src) : null,
  now = () => (typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now()),
  getVolume = () => 0.85,
  globalCooldownMs = DEFAULT_BATTLE_BARK_GLOBAL_COOLDOWN_MS,
  perActorCooldownMs = DEFAULT_BATTLE_BARK_ACTOR_COOLDOWN_MS,
  resolveAttackSlot = null,
  onStateChange = null,
} = {}) {
  let preferences = loadDialogueVoicePreferences(storage);
  let barkIndex = null;
  let manifestPromise = null;
  let activePlayback = null;
  let lastGlobalPlayedAtMs = -Infinity;
  const lastActorPlayedAtMs = new Map();
  let playCursor = 0;
  let activeLineId = null;
  let lastBarkId = null;
  let statusKind = preferences.enabled ? 'ready' : 'off';
  let destroyed = false;
  let introPlayedForEncounter = '';

  function getState() {
    return Object.freeze({
      enabled: preferences.enabled,
      language: preferences.language,
      manifestLoaded: barkIndex !== null,
      barkCount: barkIndex?.clipCount ?? 0,
      playing: activePlayback !== null,
      activeLineId,
      lastBarkId,
      statusKind,
      destroyed,
    });
  }

  function notify() {
    if (typeof onStateChange === 'function') onStateChange(getState());
  }

  function refreshPreferences() {
    if (destroyed) return preferences;
    const next = loadDialogueVoicePreferences(storage);
    const changed = next.enabled !== preferences.enabled || next.language !== preferences.language;
    preferences = next;
    if (!preferences.enabled) {
      stopActivePlayback();
      statusKind = 'off';
    } else if (statusKind === 'off') {
      statusKind = barkIndex === null ? 'ready' : (barkIndex.clipCount > 0 ? 'ready' : 'unavailable');
    }
    if (changed) notify();
    return preferences;
  }

  function stopActivePlayback() {
    if (!activePlayback) return;
    const current = activePlayback;
    activePlayback = null;
    activeLineId = null;
    try {
      current.audio.pause?.();
    } catch {
      // Fail closed if host Audio stub throws on pause.
    }
    current.cleanup();
    statusKind = preferences.enabled ? 'ready' : 'off';
    notify();
  }

  async function ensureManifestLoaded() {
    if (barkIndex) return barkIndex;
    if (manifestPromise) return manifestPromise;
    if (typeof fetchImpl !== 'function') return null;
    manifestPromise = (async () => {
      try {
        const response = await fetchImpl(manifestUrl, { cache: 'force-cache' });
        if (!response?.ok) return null;
        const json = await response.json();
        barkIndex = createBattleBarkIndex(json);
        return barkIndex;
      } catch {
        return null;
      } finally {
        if (!barkIndex) manifestPromise = null;
      }
    })();
    return manifestPromise;
  }

  function playCue(cue, request, timestampMs) {
    if (destroyed || !preferences.enabled || typeof createAudio !== 'function') return false;
    if (activePlayback) {
      if (!request.overrideThrottle) return false;
      stopActivePlayback();
    }
    let audio;
    try {
      audio = createAudio(cue.file);
    } catch {
      return false;
    }
    if (!audio) return false;
    try {
      const vol = Number(getVolume?.());
      if (Number.isFinite(vol)) {
        audio.volume = Math.max(0, Math.min(1, vol));
      }
    } catch {
      // Ignore read-only volume properties on stubs.
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      audio.removeEventListener?.('ended', onFinish);
      audio.removeEventListener?.('error', onFinish);
      if (activePlayback?.audio === audio) {
        activePlayback = null;
        activeLineId = null;
        statusKind = preferences.enabled ? 'ready' : 'off';
        notify();
      }
    };
    const onFinish = () => cleanup();

    activePlayback = { audio, cue, priority: request.priority, cleanup };
    activeLineId = cue.lineId;
    lastBarkId = cue.lineId;
    lastGlobalPlayedAtMs = timestampMs;
    lastActorPlayedAtMs.set(cue.actorId, timestampMs);
    playCursor += 1;
    statusKind = 'playing';
    notify();

    audio.addEventListener?.('ended', onFinish, { once: true });
    audio.addEventListener?.('error', onFinish, { once: true });
    try {
      const maybePromise = audio.play?.();
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(() => cleanup());
      }
    } catch {
      cleanup();
      return false;
    }
    return true;
  }

  function isThrottled(request, timestampMs) {
    if (request.overrideThrottle) return false;
    if (activePlayback) return true;
    if (timestampMs - lastGlobalPlayedAtMs < globalCooldownMs) return true;
    const lastActor = lastActorPlayedAtMs.get(request.actorId) ?? -Infinity;
    if (timestampMs - lastActor < perActorCooldownMs) return true;
    return false;
  }

  async function triggerRequest(request) {
    if (destroyed || !request) return false;
    refreshPreferences();
    if (!preferences.enabled) return false;
    const timestampMs = Number(now());
    if (isThrottled(request, timestampMs)) return false;

    const index = await ensureManifestLoaded();
    if (!index || destroyed || !preferences.enabled) {
      if (!index && preferences.enabled) {
        statusKind = 'unavailable';
        notify();
      }
      return false;
    }
    // Re-check throttle after async manifest load so stale triggers do not overlap.
    const postLoadNow = Number(now());
    if (isThrottled(request, postLoadNow)) return false;

    const cue = lookupBattleBarkCue(index, {
      actorId: request.actorId,
      barkType: request.barkType,
      phaseId: request.phaseId,
      fallbackActorId: request.fallbackActorId,
      fallbackBarkType: request.fallbackBarkType,
      language: preferences.language,
      cursor: playCursor,
    });
    if (!cue) return false;
    return playCue(cue, request, postLoadNow);
  }

  async function handleCombatEvents(events, snapshot = null) {
    if (destroyed || !Array.isArray(events) || events.length === 0) return false;
    refreshPreferences();
    if (!preferences.enabled) return false;

    // Prioritize high-impact events (combo-start, boss-phase-entered, combat-end)
    // before routine attack/hit events emitted in the same fixed tick.
    const requests = [];
    for (const event of events) {
      const req = mapCombatEventToBarkRequest(event, snapshot, { resolveAttackSlot });
      if (req) requests.push(req);
    }
    if (requests.length === 0) return false;
    const priorityRank = { high: 0, elevated: 1, normal: 2 };
    requests.sort((a, b) => (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2));
    for (const request of requests) {
      const played = await triggerRequest(request);
      if (played) return true;
    }
    return false;
  }

  async function playEncounterIntro(snapshot) {
    if (destroyed || !snapshot?.encounterId) return false;
    refreshPreferences();
    if (!preferences.enabled) return false;
    if (introPlayedForEncounter === snapshot.encounterId) return false;
    const bossId = findBossActorId(snapshot);
    if (!bossId) return false;
    introPlayedForEncounter = snapshot.encounterId;
    return triggerRequest(Object.freeze({
      actorId: bossId,
      barkType: 'boss-intro',
      fallbackActorId: null,
      fallbackBarkType: null,
      phaseId: snapshot?.bossPhase?.phaseId ?? null,
      priority: 'high',
      overrideThrottle: true,
    }));
  }

  function resetEncounter() {
    introPlayedForEncounter = '';
    stopActivePlayback();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopActivePlayback();
    notify();
  }

  return Object.freeze({
    handleCombatEvents,
    playEncounterIntro,
    refreshPreferences,
    resetEncounter,
    stop: stopActivePlayback,
    destroy,
    getState,
  });
}
