/** Local-only audition ledger for synthetic voice takes. Never touches campaign saves. */
export const VOICE_REVIEW_STORAGE_KEY = 'bells-black-chrysanthemum.voice-review.v1';
export const VOICE_REVIEW_SCHEMA = 1;
export const VOICE_REVIEW_STATES = Object.freeze({
  pending: 'Unreviewed',
  accepted: 'Accept this take',
  retake: 'Retake needed',
  pronunciation: 'Pronunciation review',
  script: 'Script / translation review',
});
export const VOICE_CAST_NAMES = Object.freeze({
  kurozane: 'Shogun Kurozane',
  mateus: 'Father Mateus Avelar',
  nikola: 'Nikola Dražanić',
  ren: 'Ren Ishikawa',
  miyo: 'Miyo Senda',
  aya: 'Aya Shinohara',
  kiku: 'Kiku Nawa',
  genta: 'Genta Mononobe',
  'lady-enma': 'Lady Enma of Ash',
  ujiro: 'Magistrate Ujiro Arata',
});
const CANONICAL_SPEAKER_ORDER = Object.freeze(Object.keys(VOICE_CAST_NAMES));
const LANGUAGES = new Set(['en', 'ja']);
const MAX_NOTE_LENGTH = 1200;
const MAX_RECORDS = 2000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function voiceReviewKey(language, lineId) {
  if (!LANGUAGES.has(language) || !/^[A-Za-z0-9-]{1,80}$/.test(String(lineId))) {
    throw new Error('Invalid voice-review language or line ID.');
  }
  return `${language}:${lineId}`;
}

export function voiceReviewIdentity(manifest, language, lineId) {
  const item = manifest?.lines?.[lineId]?.[language];
  if (!item || typeof item.text !== 'string' || typeof item.speaker !== 'string') return null;
  // Voice IDs alone survive text edits and new takes. Identity binds each review
  // to its spoken text, actor, output file and exact selected take metadata.
  return JSON.stringify([
    language, String(lineId), item.speaker, item.text, item.file ?? null,
    item.seed ?? null, item.chosenTake ?? null,
  ]);
}

export function emptyVoiceReviewBook() {
  return { schemaVersion: VOICE_REVIEW_SCHEMA, entries: {} };
}

export function voiceManifestScenes(manifest) {
  const allLineIds = Object.keys(manifest?.lines ?? {}).sort((a, b) => a.localeCompare(b));
  if (Array.isArray(manifest?.scenes) && manifest.scenes.length > 0) {
    const listed = manifest.scenes
      .filter((scene) => isRecord(scene) && typeof scene.id === 'string')
      .map((scene) => Object.freeze({
        id: scene.id,
        title: typeof scene.title === 'string' && scene.title ? scene.title : scene.id,
        defaultPauseSeconds: Number.isFinite(scene.defaultPauseSeconds)
          ? scene.defaultPauseSeconds
          : (manifest?.defaultPauseSeconds ?? 0.4),
        lineIds: Object.freeze(
          Array.isArray(scene.lineIds)
            ? scene.lineIds.map(String).filter((id) => Object.hasOwn(manifest?.lines ?? {}, id))
            : allLineIds.filter((id) => {
              const locales = manifest?.lines?.[id];
              const meta = locales?.en ?? locales?.ja;
              return meta?.sceneId === scene.id;
            }),
        ),
      }));
    if (listed.length > 0) return Object.freeze(listed);
  }
  return Object.freeze([
    Object.freeze({
      id: 'last-command',
      title: 'Dawn at the Observatory — The Last Command',
      defaultPauseSeconds: manifest?.defaultPauseSeconds ?? 0.4,
      lineIds: Object.freeze(allLineIds),
    }),
  ]);
}

export function voiceManifestSpeakers(manifest) {
  const seen = new Set();
  for (const speakerId of Object.keys(manifest?.cast ?? {})) seen.add(speakerId);
  for (const locales of Object.values(manifest?.lines ?? {})) {
    for (const lang of ['en', 'ja']) {
      if (typeof locales?.[lang]?.speaker === 'string') seen.add(locales[lang].speaker);
    }
  }
  const orderedIds = [
    ...CANONICAL_SPEAKER_ORDER.filter((id) => seen.has(id)),
    ...[...seen].filter((id) => !CANONICAL_SPEAKER_ORDER.includes(id)).sort((a, b) => a.localeCompare(b)),
  ];
  return Object.freeze(orderedIds.map((id) => Object.freeze({
    id,
    name: manifest?.cast?.[id]?.name ?? VOICE_CAST_NAMES[id] ?? id,
    brief: manifest?.cast?.[id]?.brief ?? '',
  })));
}

function resolveLineSceneId(manifest, lineId, sceneIndex) {
  const locales = manifest?.lines?.[lineId];
  const explicit = locales?.en?.sceneId ?? locales?.ja?.sceneId;
  if (typeof explicit === 'string' && explicit) return explicit;
  return sceneIndex.get(lineId) ?? 'last-command';
}

export function filterVoiceManifestLines(manifest, {
  language = 'en',
  sceneId = 'all',
  speaker = 'all',
} = {}) {
  if (!isRecord(manifest?.lines)) return [];
  const scenes = voiceManifestScenes(manifest);
  const sceneByLineId = new Map();
  const orderedIds = [];
  for (const scene of scenes) {
    for (const id of scene.lineIds) {
      if (!sceneByLineId.has(id)) {
        sceneByLineId.set(id, scene.id);
        orderedIds.push(id);
      }
    }
  }
  for (const id of Object.keys(manifest.lines).sort((a, b) => a.localeCompare(b))) {
    if (!sceneByLineId.has(id)) orderedIds.push(id);
  }
  const results = [];
  for (const id of orderedIds) {
    const byLanguage = manifest.lines[id];
    if (!isRecord(byLanguage)) continue;
    const fallback = byLanguage.en ?? byLanguage.ja;
    if (!fallback) continue;
    const current = byLanguage[language];
    const resolvedSceneId = resolveLineSceneId(manifest, id, sceneByLineId);
    const resolvedSpeaker = current?.speaker ?? fallback.speaker;
    if (sceneId !== 'all' && resolvedSceneId !== sceneId) continue;
    if (speaker !== 'all' && resolvedSpeaker !== speaker) continue;
    results.push({
      id,
      sceneId: resolvedSceneId,
      ...current,
      fallback,
    });
  }
  return results;
}

export function validateVoiceReviewBook(input, manifest) {
  const errors = [];
  const clean = emptyVoiceReviewBook();
  if (!isRecord(input) || input.schemaVersion !== VOICE_REVIEW_SCHEMA || !isRecord(input.entries)) {
    return { valid: false, errors: ['Unrecognized voice-review file format.'], book: clean };
  }
  const records = Object.entries(input.entries);
  if (records.length > MAX_RECORDS) errors.push('Too many audition records.');
  for (const [key, entry] of records.slice(0, MAX_RECORDS)) {
    const match = /^(en|ja):([A-Za-z0-9-]{1,80})$/.exec(key);
    if (!match || !isRecord(entry)) {
      errors.push(`Invalid review key: ${key.slice(0, 100)}`);
      continue;
    }
    const [, language, lineId] = match;
    const identity = voiceReviewIdentity(manifest, language, lineId);
    if (!identity || entry.identity !== identity) {
      errors.push(`Stale or missing take: ${key}`);
      continue;
    }
    if (!Object.hasOwn(VOICE_REVIEW_STATES, entry.status) ||
        typeof entry.note !== 'string' || entry.note.length > MAX_NOTE_LENGTH ||
        typeof entry.reviewedAt !== 'string' || !Number.isFinite(Date.parse(entry.reviewedAt))) {
      errors.push(`Invalid review contents: ${key}`);
      continue;
    }
    // JSON payloads can contain '__proto__'. Own-property assignment avoids a
    // prototype mutation even though valid keys already have a strict grammar.
    Object.defineProperty(clean.entries, key, {
      value: {
        identity,
        status: entry.status,
        note: entry.note,
        reviewedAt: entry.reviewedAt,
      },
      enumerable: true, writable: true, configurable: true,
    });
  }
  return { valid: errors.length === 0, errors, book: clean };
}

export function updateVoiceReview(book, manifest, language, lineId, status, note = '', now = new Date().toISOString()) {
  const key = voiceReviewKey(language, lineId);
  const identity = voiceReviewIdentity(manifest, language, lineId);
  if (!identity) throw new Error(`Missing spoken line: ${key}`);
  if (!Object.hasOwn(VOICE_REVIEW_STATES, status)) throw new Error(`Invalid review status: ${status}`);
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) throw new Error('Review note is too long.');
  const valid = validateVoiceReviewBook(book, manifest);
  if (!valid.valid) throw new Error(valid.errors.join(' '));
  const entries = { ...valid.book.entries };
  if (status === 'pending' && !note.trim()) delete entries[key];
  else entries[key] = { identity, status, note, reviewedAt: now };
  return { schemaVersion: VOICE_REVIEW_SCHEMA, entries };
}

export function voiceReviewSummary(book, manifest, language = 'all', {
  sceneId = 'all',
  speaker = 'all',
} = {}) {
  const counts = Object.fromEntries(Object.keys(VOICE_REVIEW_STATES).map((state) => [state, 0]));
  const scenes = voiceManifestScenes(manifest);
  const sceneByLineId = new Map();
  for (const scene of scenes) {
    for (const id of scene.lineIds) {
      if (!sceneByLineId.has(id)) sceneByLineId.set(id, scene.id);
    }
  }
  let available = 0;
  let audioReady = 0;
  for (const [id, locales] of Object.entries(manifest?.lines ?? {})) {
    const resolvedSceneId = resolveLineSceneId(manifest, id, sceneByLineId);
    if (sceneId !== 'all' && resolvedSceneId !== sceneId) continue;
    for (const lang of ['en', 'ja']) {
      if (language !== 'all' && language !== lang) continue;
      if (!locales?.[lang]) continue;
      if (speaker !== 'all' && locales[lang].speaker !== speaker) continue;
      available++;
      if (locales[lang].file) audioReady++;
      const key = voiceReviewKey(lang, id);
      const entry = book?.entries?.[key];
      const match = entry?.identity === voiceReviewIdentity(manifest, lang, id);
      counts[match && Object.hasOwn(VOICE_REVIEW_STATES, entry.status) ? entry.status : 'pending']++;
    }
  }
  return { total: available, audioReady, ...counts };
}
