/**
 * Opt-in Campaign & Storyworld dialogue voice playback controller.
 *
 * Isolation contract:
 * - Persists ONLY under `bbc.dialogueVoice.v1` (never touches any of the 14
 *   canonical campaign, recovery, receipt, or playtime save authorities).
 * - Defaults to OFF (`enabled: false`), making zero network fetches and
 *   creating zero Audio objects until explicitly enabled.
 * - Subtitles remain unconditionally rendered on every surface regardless of
 *   voice state or audio availability.
 */

import { getDefaultBrowserStorage } from './browser-storage.mjs';

export const DIALOGUE_VOICE_STORAGE_KEY = 'bbc.dialogueVoice.v1';
export const DIALOGUE_VOICE_SCHEMA_VERSION = 1;
export const DIALOGUE_VOICE_LANGUAGES = Object.freeze(['en', 'ja']);
export const DEFAULT_DIALOGUE_VOICE_MANIFEST_URL = './assets/audio/voice-prototype-v1/manifest.json';
export const DEFAULT_DIALOGUE_PAUSE_SECONDS = 0.4;

export const DEFAULT_DIALOGUE_VOICE_PREFERENCES = Object.freeze({
  schemaVersion: DIALOGUE_VOICE_SCHEMA_VERSION,
  enabled: false,
  language: 'en',
});

const SPEAKER_ALIASES = Object.freeze({
  kurozane: 'kurozane',
  'shogun kurozane': 'kurozane',
  mateus: 'mateus',
  avelar: 'mateus',
  'father mateus': 'mateus',
  'father mateus avelar': 'mateus',
  nikola: 'nikola',
  lise: 'nikola',
  'count nikola': 'nikola',
  'lord nikola': 'nikola',
  'nikola drazanic': 'nikola',
  'count nikola drazanic': 'nikola',
  'lord nikola drazanic': 'nikola',
  ren: 'ren',
  'ren ishikawa': 'ren',
  miyo: 'miyo',
  'miyo senda': 'miyo',
  aya: 'aya',
  'aya shinohara': 'aya',
  kiku: 'kiku',
  'kiku nawa': 'kiku',
  genta: 'genta',
  'genta mononobe': 'genta',
  'lady enma': 'lady-enma',
  'lady-enma': 'lady-enma',
  enma: 'lady-enma',
  'lady enma of ash': 'lady-enma',
  ujiro: 'ujiro',
  'magistrate ujiro': 'ujiro',
  'magistrate ujiro arata': 'ujiro',
});

const CONFESSION_REVERSAL_REACTION_ID = 'page_sw11_decision_opt_name-the-crime_r_confession-reversal';
const CONFESSION_REVERSAL_LINE_IDS = Object.freeze([
  '18', '19', '20', '21', '22', '23', '24', '25', '26', '27',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validDialogueVoicePreferences(value) {
  return Boolean(
    isRecord(value)
      && value.schemaVersion === DIALOGUE_VOICE_SCHEMA_VERSION
      && typeof value.enabled === 'boolean'
      && DIALOGUE_VOICE_LANGUAGES.includes(value.language),
  );
}

export function loadDialogueVoicePreferences(storage = getDefaultBrowserStorage()) {
  try {
    const raw = storage?.getItem?.(DIALOGUE_VOICE_STORAGE_KEY);
    if (!raw) return DEFAULT_DIALOGUE_VOICE_PREFERENCES;
    const parsed = JSON.parse(raw);
    return validDialogueVoicePreferences(parsed)
      ? Object.freeze({
        schemaVersion: DIALOGUE_VOICE_SCHEMA_VERSION,
        enabled: parsed.enabled,
        language: parsed.language,
      })
      : DEFAULT_DIALOGUE_VOICE_PREFERENCES;
  } catch {
    return DEFAULT_DIALOGUE_VOICE_PREFERENCES;
  }
}

export function saveDialogueVoicePreferences(storage, preferences) {
  if (!validDialogueVoicePreferences(preferences)) return false;
  try {
    storage?.setItem?.(DIALOGUE_VOICE_STORAGE_KEY, JSON.stringify({
      schemaVersion: DIALOGUE_VOICE_SCHEMA_VERSION,
      enabled: preferences.enabled,
      language: preferences.language,
    }));
    return true;
  } catch {
    return false;
  }
}

export function normalizeDialogueSpeaker(speaker) {
  const folded = String(speaker ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim();
  if (!folded) return '';
  return SPEAKER_ALIASES[folded] ?? SPEAKER_ALIASES[folded.replace(/-/g, ' ')] ?? folded.replace(/\s+/g, '-');
}

export function normalizeDialogueText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u30fc]+/gu, '');
}

export function resolvePauseBeforeMs(manifest, lineId, sceneId = null) {
  const perLine = manifest?.pauseBeforeSeconds?.[lineId];
  if (Number.isFinite(perLine) && perLine >= 0) {
    return Math.min(10_000, Math.round(perLine * 1000));
  }
  if (sceneId && Array.isArray(manifest?.scenes)) {
    const scene = manifest.scenes.find((entry) => entry?.id === sceneId);
    if (Number.isFinite(scene?.defaultPauseSeconds) && scene.defaultPauseSeconds >= 0) {
      return Math.min(10_000, Math.round(scene.defaultPauseSeconds * 1000));
    }
  }
  const fallback = Number.isFinite(manifest?.defaultPauseSeconds) && manifest.defaultPauseSeconds >= 0
    ? manifest.defaultPauseSeconds
    : DEFAULT_DIALOGUE_PAUSE_SECONDS;
  return Math.min(10_000, Math.round(fallback * 1000));
}

export function createVoiceManifestIndex(manifest) {
  const bySpeakerAndText = new Map();
  const quoteCandidates = [];
  if (!isRecord(manifest?.lines)) {
    return Object.freeze({ manifest: manifest ?? null, bySpeakerAndText, quoteCandidates: Object.freeze([]) });
  }
  for (const [lineId, locales] of Object.entries(manifest.lines)) {
    if (!isRecord(locales)) continue;
    const baseMeta = locales.en ?? locales.ja;
    if (!isRecord(baseMeta)) continue;
    const speaker = normalizeDialogueSpeaker(baseMeta.speaker);
    if (!speaker) continue;
    for (const lang of DIALOGUE_VOICE_LANGUAGES) {
      const entry = locales[lang];
      if (!isRecord(entry) || typeof entry.text !== 'string') continue;
      const normText = normalizeDialogueText(entry.text);
      if (!normText) continue;
      const lookupKey = `${speaker}:${normText}`;
      if (!bySpeakerAndText.has(lookupKey)) {
        bySpeakerAndText.set(lookupKey, lineId);
      }
      if (normText.length >= 12) {
        quoteCandidates.push(Object.freeze({ lineId, speaker, lang, normText }));
      }
    }
  }
  return Object.freeze({
    manifest,
    bySpeakerAndText,
    quoteCandidates: Object.freeze(quoteCandidates),
  });
}

function buildCueForLineId(index, lineId, language) {
  const locales = index?.manifest?.lines?.[lineId];
  const entry = locales?.[language];
  if (!isRecord(entry) || typeof entry.file !== 'string' || !entry.file) return null;
  const sceneId = entry.sceneId ?? locales?.en?.sceneId ?? locales?.ja?.sceneId ?? null;
  return Object.freeze({
    lineId,
    speaker: normalizeDialogueSpeaker(entry.speaker),
    language,
    file: entry.file,
    text: entry.text ?? '',
    pauseBeforeMs: resolvePauseBeforeMs(index.manifest, lineId, sceneId),
  });
}

export function matchManifestDialogueLine(index, {
  speaker,
  text,
  language = 'en',
} = {}) {
  if (!index?.manifest || !DIALOGUE_VOICE_LANGUAGES.includes(language)) return null;
  const normSpeaker = normalizeDialogueSpeaker(speaker);
  const normText = normalizeDialogueText(text);
  if (!normSpeaker || !normText) return null;
  const lineId = index.bySpeakerAndText.get(`${normSpeaker}:${normText}`);
  if (!lineId) return null;
  return buildCueForLineId(index, lineId, language);
}

export function matchStoryworldVoiceSequence(index, {
  reactionId = '',
  text = '',
  reactionText = '',
  language = 'en',
} = {}) {
  if (!index?.manifest || !DIALOGUE_VOICE_LANGUAGES.includes(language)) return Object.freeze([]);
  if (reactionId === CONFESSION_REVERSAL_REACTION_ID) {
    return Object.freeze(
      CONFESSION_REVERSAL_LINE_IDS
        .map((lineId) => buildCueForLineId(index, lineId, language))
        .filter(Boolean),
    );
  }
  const combined = normalizeDialogueText(`${reactionText || ''}\n${text || ''}`);
  if (!combined) return Object.freeze([]);
  const matchedIds = [];
  const seen = new Set();
  for (const candidate of index.quoteCandidates) {
    if (seen.has(candidate.lineId)) continue;
    const position = combined.indexOf(candidate.normText);
    if (position >= 0) {
      seen.add(candidate.lineId);
      matchedIds.push({ position, lineId: candidate.lineId });
    }
  }
  matchedIds.sort((a, b) => a.position - b.position || a.lineId.localeCompare(b.lineId));
  return Object.freeze(
    matchedIds
      .map(({ lineId }) => buildCueForLineId(index, lineId, language))
      .filter(Boolean),
  );
}

export function createDialogueVoiceRuntime({
  storage = getDefaultBrowserStorage(),
  manifestUrl = DEFAULT_DIALOGUE_VOICE_MANIFEST_URL,
  fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
  createAudio = typeof globalThis.Audio === 'function' ? (src) => new globalThis.Audio(src) : null,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id),
  getVolume = () => 0.85,
  onStateChange = null,
} = {}) {
  let preferences = loadDialogueVoicePreferences(storage);
  let manifestIndex = null;
  let manifestPromise = null;
  let runToken = 0;
  let pendingTimerId = null;
  let finishPendingTimer = null;
  let activeClip = null;
  let destroyed = false;
  let lastPresentation = null;
  let lastPlayedSignature = '';
  let statusKind = preferences.enabled ? 'ready' : 'off';
  let activeLineId = null;

  function notify() {
    if (typeof onStateChange === 'function') onStateChange(getState());
  }

  function getState() {
    return Object.freeze({
      enabled: preferences.enabled,
      language: preferences.language,
      subtitlesAlwaysOn: true,
      manifestLoaded: manifestIndex !== null,
      playing: activeClip !== null,
      waitingPause: pendingTimerId !== null,
      activeLineId,
      statusKind,
      destroyed,
    });
  }

  function persist(nextPreferences) {
    preferences = Object.freeze({
      schemaVersion: DIALOGUE_VOICE_SCHEMA_VERSION,
      enabled: Boolean(nextPreferences.enabled),
      language: DIALOGUE_VOICE_LANGUAGES.includes(nextPreferences.language) ? nextPreferences.language : 'en',
    });
    saveDialogueVoicePreferences(storage, preferences);
  }

  function cancelActivePlayback({ resetSignature = false } = {}) {
    runToken += 1;
    if (pendingTimerId !== null) {
      clearTimer(pendingTimerId);
      pendingTimerId = null;
    }
    if (finishPendingTimer) {
      const resolvePause = finishPendingTimer;
      finishPendingTimer = null;
      resolvePause(false);
    }
    if (activeClip) {
      const clip = activeClip;
      activeClip = null;
      try {
        clip.audio.pause?.();
      } catch {
        // Fail closed silently if a host Audio stub throws on pause.
      }
      clip.finish(false);
    }
    activeLineId = null;
    if (resetSignature) lastPlayedSignature = '';
    statusKind = preferences.enabled ? 'ready' : 'off';
    notify();
  }

  async function ensureManifestLoaded() {
    if (manifestIndex) return manifestIndex;
    if (manifestPromise) return manifestPromise;
    if (typeof fetchImpl !== 'function') return null;
    manifestPromise = (async () => {
      try {
        const response = await fetchImpl(manifestUrl, { cache: 'force-cache' });
        if (!response?.ok) return null;
        const json = await response.json();
        manifestIndex = createVoiceManifestIndex(json);
        return manifestIndex;
      } catch {
        return null;
      } finally {
        if (!manifestIndex) manifestPromise = null;
      }
    })();
    return manifestPromise;
  }

  function waitPause(ms, token) {
    if (!(ms > 0)) return Promise.resolve(token === runToken && !destroyed);
    return new Promise((resolve) => {
      if (token !== runToken || destroyed) {
        resolve(false);
        return;
      }
      const done = (completed) => {
        if (finishPendingTimer === done) finishPendingTimer = null;
        pendingTimerId = null;
        resolve(completed && token === runToken && !destroyed);
      };
      finishPendingTimer = done;
      pendingTimerId = setTimer(() => done(true), ms);
      notify();
    });
  }

  function playCueClip(cue, token) {
    if (token !== runToken || destroyed || typeof createAudio !== 'function') {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let audio;
      try {
        audio = createAudio(cue.file);
      } catch {
        resolve(false);
        return;
      }
      if (!audio) {
        resolve(false);
        return;
      }
      try {
        const requestedVolume = Number(getVolume?.());
        if (Number.isFinite(requestedVolume)) {
          audio.volume = Math.max(0, Math.min(1, requestedVolume));
        }
      } catch {
        // Ignore read-only volume implementations.
      }
      let settled = false;
      const onEnded = () => finish(true);
      const onError = () => finish(false);
      function finish(completed) {
        if (settled) return;
        settled = true;
        audio.removeEventListener?.('ended', onEnded);
        audio.removeEventListener?.('error', onError);
        if (activeClip?.audio === audio) {
          activeClip = null;
          activeLineId = null;
          statusKind = preferences.enabled ? 'ready' : 'off';
          notify();
        }
        resolve(completed && token === runToken && !destroyed);
      }
      activeClip = { audio, finish };
      activeLineId = cue.lineId;
      statusKind = 'playing';
      notify();
      audio.addEventListener?.('ended', onEnded, { once: true });
      audio.addEventListener?.('error', onError, { once: true });
      try {
        const maybePromise = audio.play?.();
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch(() => finish(false));
        }
      } catch {
        finish(false);
      }
    });
  }

  async function runQueue(resolveQueue, signature) {
    if (destroyed || !preferences.enabled) return false;
    if (signature && signature === lastPlayedSignature) return false;
    cancelActivePlayback();
    lastPlayedSignature = signature;
    const token = runToken;
    const index = await ensureManifestLoaded();
    if (!index || token !== runToken || destroyed || !preferences.enabled) {
      if (token === runToken && preferences.enabled && !index) {
        statusKind = 'unavailable';
        notify();
      }
      return false;
    }
    const cues = resolveQueue(index, preferences.language);
    if (!cues.length) {
      statusKind = 'unvoiced-line';
      notify();
      return false;
    }
    for (const cue of cues) {
      const afterPause = await waitPause(cue.pauseBeforeMs, token);
      if (!afterPause) return false;
      const played = await playCueClip(cue, token);
      if (!played) return false;
    }
    return true;
  }

  function presentDialogueLine({
    beatId = '',
    lineIndex = 0,
    speaker = '',
    text = '',
  } = {}) {
    if (destroyed) return Promise.resolve(false);
    const normSpeaker = normalizeDialogueSpeaker(speaker);
    const normText = normalizeDialogueText(text);
    if (!normSpeaker || !normText) {
      lastPresentation = null;
      cancelActivePlayback({ resetSignature: true });
      return Promise.resolve(false);
    }
    const baseKey = `dialogue:${beatId}:${lineIndex}:${normSpeaker}:${normText}`;
    lastPresentation = {
      kind: 'dialogue',
      baseKey,
      speaker,
      text,
    };
    if (!preferences.enabled) return Promise.resolve(false);
    const signature = `${preferences.language}:${baseKey}`;
    return runQueue(
      (index, language) => {
        const cue = matchManifestDialogueLine(index, { speaker, text, language });
        return cue ? [cue] : [];
      },
      signature,
    );
  }

  function presentStoryworld({
    clusterId = '',
    phase = '',
    reactionId = '',
    text = '',
    reactionText = '',
  } = {}) {
    if (destroyed) return Promise.resolve(false);
    const normCombined = normalizeDialogueText(`${reactionId}:${reactionText}:${text}`);
    if (!normCombined) {
      if (lastPresentation?.kind === 'storyworld') {
        lastPresentation = null;
        cancelActivePlayback({ resetSignature: true });
      }
      return Promise.resolve(false);
    }
    const baseKey = `storyworld:${clusterId}:${phase}:${reactionId}:${normCombined.slice(0, 120)}`;
    lastPresentation = {
      kind: 'storyworld',
      baseKey,
      reactionId,
      text,
      reactionText,
    };
    if (!preferences.enabled) return Promise.resolve(false);
    const signature = `${preferences.language}:${baseKey}`;
    return runQueue(
      (index, language) => matchStoryworldVoiceSequence(index, {
        reactionId,
        text,
        reactionText,
        language,
      }),
      signature,
    );
  }

  function replayCurrentPresentation() {
    if (!preferences.enabled || !lastPresentation) return Promise.resolve(false);
    lastPlayedSignature = '';
    if (lastPresentation.kind === 'storyworld') {
      return runQueue(
        (index, language) => matchStoryworldVoiceSequence(index, {
          reactionId: lastPresentation.reactionId,
          text: lastPresentation.text,
          reactionText: lastPresentation.reactionText,
          language,
        }),
        `${preferences.language}:${lastPresentation.baseKey}`,
      );
    }
    return runQueue(
      (index, language) => {
        const cue = matchManifestDialogueLine(index, {
          speaker: lastPresentation.speaker,
          text: lastPresentation.text,
          language,
        });
        return cue ? [cue] : [];
      },
      `${preferences.language}:${lastPresentation.baseKey}`,
    );
  }

  function setEnabled(enabled) {
    if (destroyed) return Promise.resolve(false);
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === preferences.enabled) return Promise.resolve(preferences.enabled);
    persist({ ...preferences, enabled: nextEnabled });
    if (!nextEnabled) {
      cancelActivePlayback({ resetSignature: true });
      return Promise.resolve(false);
    }
    statusKind = 'ready';
    notify();
    return replayCurrentPresentation().then(() => true);
  }

  function toggleEnabled() {
    return setEnabled(!preferences.enabled);
  }

  function setLanguage(language) {
    if (destroyed) return Promise.resolve(false);
    if (!DIALOGUE_VOICE_LANGUAGES.includes(language)) {
      throw new RangeError(`Unsupported dialogue voice language: ${language}`);
    }
    if (language === preferences.language) return Promise.resolve(true);
    persist({ ...preferences, language });
    cancelActivePlayback({ resetSignature: true });
    if (preferences.enabled) {
      return replayCurrentPresentation().then(() => true);
    }
    notify();
    return Promise.resolve(true);
  }

  function cancel() {
    lastPresentation = null;
    cancelActivePlayback({ resetSignature: true });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    lastPresentation = null;
    cancelActivePlayback({ resetSignature: true });
  }

  return Object.freeze({
    presentDialogueLine,
    presentStoryworld,
    setEnabled,
    toggleEnabled,
    setLanguage,
    cancel,
    destroy,
    getState,
  });
}

function formatVoiceStatus(state) {
  if (!state.enabled) return 'Subtitles always on.';
  const langLabel = state.language === 'ja' ? 'JA' : 'EN';
  if (state.playing && state.activeLineId) return `Voice ${langLabel} playing · subtitles on.`;
  if (state.statusKind === 'unavailable') return `Voice ${langLabel} unavailable · subtitles on.`;
  return `Voice ${langLabel} on · subtitles always on.`;
}

export function mountDialogueVoiceControls({
  root = document,
  storage = getDefaultBrowserStorage(),
  getVolume = () => 0.85,
  runtimeOptions = {},
} = {}) {
  const toggle = root.querySelector('#voiceToggle');
  const languageWrap = root.querySelector('#voiceLanguageWrap');
  const languageSelect = root.querySelector('#voiceLanguage');
  const status = root.querySelector('#voiceStatus');
  if (!toggle || !languageWrap || !languageSelect || !status) {
    throw new Error('Dialogue voice controls require #voiceToggle, #voiceLanguageWrap, #voiceLanguage, and #voiceStatus.');
  }

  function renderControls(state) {
    toggle.disabled = state.destroyed;
    toggle.setAttribute('aria-pressed', String(state.enabled));
    toggle.textContent = state.enabled ? 'Voice: On' : 'Voice: Off';
    languageWrap.hidden = !state.enabled;
    languageSelect.disabled = !state.enabled || state.destroyed;
    languageSelect.value = state.language;
    status.textContent = formatVoiceStatus(state);
  }

  const runtime = createDialogueVoiceRuntime({
    storage,
    getVolume,
    ...runtimeOptions,
    onStateChange: renderControls,
  });

  function handleToggle() {
    void runtime.toggleEnabled();
  }

  function handleLanguageChange() {
    void runtime.setLanguage(languageSelect.value);
  }

  toggle.addEventListener('click', handleToggle);
  languageSelect.addEventListener('change', handleLanguageChange);
  renderControls(runtime.getState());

  return Object.freeze({
    ...runtime,
    destroy() {
      toggle.removeEventListener('click', handleToggle);
      languageSelect.removeEventListener('change', handleLanguageChange);
      runtime.destroy();
      renderControls(runtime.getState());
    },
  });
}
