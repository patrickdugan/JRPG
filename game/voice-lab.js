/** Developer listening page for the synthetic prototype and its local audition ledger. */
import {
  VOICE_CAST_NAMES,
  VOICE_REVIEW_STORAGE_KEY,
  VOICE_REVIEW_STATES,
  emptyVoiceReviewBook,
  filterVoiceManifestLines,
  updateVoiceReview,
  validateVoiceReviewBook,
  voiceManifestScenes,
  voiceManifestSpeakers,
  voiceReviewIdentity,
  voiceReviewKey,
  voiceReviewSummary,
} from './voice-review.mjs';

const MANIFEST_URL = './assets/audio/voice-prototype-v1/manifest.json';
const DEFAULT_PAUSE_SECONDS = 0.4;
const labTitle = document.querySelector('#labTitle');
const sceneFilter = document.querySelector('#sceneFilter');
const speakerFilter = document.querySelector('#speakerFilter');
const castBrief = document.querySelector('#castBrief');
const sceneElement = document.querySelector('#scene');
const statusElement = document.querySelector('#status');
const playScene = document.querySelector('#playScene');
const stopScene = document.querySelector('#stopScene');
const provenance = document.querySelector('#provenance');
const reviewSummaryElement = document.querySelector('#reviewSummary');
const reviewStatus = document.querySelector('#reviewStatus');
const exportReviews = document.querySelector('#exportReviews');
const importReviews = document.querySelector('#importReviews');
const clearReviews = document.querySelector('#clearReviews');

let manifest = null;
let current = null;
let runToken = 0;
let reviews = emptyVoiceReviewBook();
let reviewLocked = false;

function language() {
  return document.querySelector('input[name="lang"]:checked')?.value ?? 'en';
}

function selectedSceneId() {
  return sceneFilter?.value ?? 'all';
}

function selectedSpeaker() {
  return speakerFilter?.value ?? 'all';
}

function speakerName(speakerId) {
  return manifest?.cast?.[speakerId]?.name ?? VOICE_CAST_NAMES[speakerId] ?? speakerId;
}

function entries() {
  if (!manifest) return [];
  return filterVoiceManifestLines(manifest, {
    language: language(),
    sceneId: selectedSceneId(),
    speaker: selectedSpeaker(),
  });
}

function populateFilters() {
  if (!manifest) return;
  const scenes = voiceManifestScenes(manifest);
  const speakers = voiceManifestSpeakers(manifest);
  const previousScene = selectedSceneId();
  const previousSpeaker = selectedSpeaker();

  sceneFilter.replaceChildren();
  const allScenesOption = document.createElement('option');
  allScenesOption.value = 'all';
  allScenesOption.textContent = `All scenes (${Object.keys(manifest.lines ?? {}).length})`;
  sceneFilter.append(allScenesOption);
  for (const scene of scenes) {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = `${scene.title} (${scene.lineIds.length})`;
    sceneFilter.append(option);
  }
  sceneFilter.value = scenes.some((scene) => scene.id === previousScene) ? previousScene : 'all';

  speakerFilter.replaceChildren();
  const allSpeakersOption = document.createElement('option');
  allSpeakersOption.value = 'all';
  allSpeakersOption.textContent = `All characters (${speakers.length})`;
  speakerFilter.append(allSpeakersOption);
  for (const speaker of speakers) {
    const option = document.createElement('option');
    option.value = speaker.id;
    option.textContent = speaker.name;
    speakerFilter.append(option);
  }
  speakerFilter.value = speakers.some((speaker) => speaker.id === previousSpeaker) ? previousSpeaker : 'all';
}

function updateContextHeader() {
  if (!manifest) return;
  const scenes = voiceManifestScenes(manifest);
  const activeScene = scenes.find((scene) => scene.id === selectedSceneId());
  if (labTitle) {
    labTitle.textContent = activeScene
      ? activeScene.title
      : (scenes.length > 1 ? 'Dawn at the Observatory & Extended Cast' : scenes[0].title);
  }
  const speakerId = selectedSpeaker();
  const brief = speakerId !== 'all' ? manifest?.cast?.[speakerId]?.brief : '';
  if (castBrief) {
    castBrief.hidden = !brief;
    castBrief.textContent = brief ? `${speakerName(speakerId)} — ${brief}` : '';
  }
}

function formatCerPercent(cer) {
  const pct = cer * 100;
  return pct > 0 && pct < 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(0)}%`;
}

function metricsText(entry) {
  if (!entry.file) return 'Not generated for this language yet.';
  const parts = [
    `${entry.durationSeconds ?? '?'} s`,
    `exaggeration ${entry.exaggeration}`,
    `cfg ${entry.cfgWeight}`,
    entry.pitchRangeSemitones != null ? `pitch range ${entry.pitchRangeSemitones} st` : null,
    entry.loudnessRangeDb != null ? `loudness range ${entry.loudnessRangeDb} dB` : null,
    `take ${(entry.chosenTake ?? 0) + 1}/${entry.takes?.length ?? 1}`,
    Number.isFinite(entry.cer) ? `ASR error ${formatCerPercent(entry.cer)}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

function showReviewSummary() {
  if (!manifest) return;
  const count = voiceReviewSummary(reviews, manifest, language(), {
    sceneId: selectedSceneId(),
    speaker: selectedSpeaker(),
  });
  reviewSummaryElement.textContent = `${count.accepted}/${count.total} accepted · ${count.retake} retakes · ${count.pronunciation} pronunciation · ${count.script} script/translation · ${count.pending} pending · ${count.audioReady} audio files listed`;
}

function persistReviews() {
  try {
    localStorage.setItem(VOICE_REVIEW_STORAGE_KEY, JSON.stringify(reviews));
    reviewStatus.textContent = 'Review saved on this device. Export JSON to share it.';
  } catch (error) {
    reviewStatus.textContent = `Local save unavailable (${error.message}). Export the review JSON.`;
  }
}

function saveLineReview(lineId, status, note) {
  if (reviewLocked) return;
  try {
    reviews = updateVoiceReview(reviews, manifest, language(), lineId, status, note);
    persistReviews();
    showReviewSummary();
  } catch (error) {
    reviewStatus.textContent = error.message;
  }
}

function buildReviewControls(entry) {
  const lang = language();
  if (!voiceReviewIdentity(manifest, lang, entry.id)) return null;
  const key = voiceReviewKey(lang, entry.id);
  const review = reviews.entries[key];
  const controls = document.createElement('div');
  controls.className = 'review';
  const stateLabel = document.createElement('label');
  stateLabel.textContent = 'Audition verdict';
  const select = document.createElement('select');
  select.dataset.reviewState = key;
  for (const [state, name] of Object.entries(VOICE_REVIEW_STATES)) {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = name;
    if (state === 'accepted' && !entry.file) option.disabled = true;
    select.append(option);
  }
  select.value = review?.status ?? 'pending';
  select.disabled = reviewLocked;
  stateLabel.append(select);
  const noteLabel = document.createElement('label');
  noteLabel.textContent = 'Direction / retake notes';
  const notes = document.createElement('textarea');
  notes.dataset.reviewNotes = key;
  notes.rows = 2;
  notes.maxLength = 1200;
  notes.placeholder = 'Pronunciation, pacing, accent, translation…';
  notes.value = review?.note ?? '';
  notes.disabled = reviewLocked;
  noteLabel.append(notes);
  select.addEventListener('change', () => saveLineReview(entry.id, select.value, notes.value));
  notes.addEventListener('change', () => saveLineReview(entry.id, select.value, notes.value));
  controls.append(stateLabel, noteLabel);
  return controls;
}

function render() {
  const lang = language();
  const scenes = manifest ? voiceManifestScenes(manifest) : [];
  const showSceneBanners = selectedSceneId() === 'all' && scenes.length > 1;
  const sceneTitleById = new Map(scenes.map((scene) => [scene.id, scene.title]));
  updateContextHeader();
  sceneElement.replaceChildren();
  let currentScene = null;
  let section = null;
  for (const entry of entries()) {
    const meta = entry.file ? entry : entry.fallback;
    if (showSceneBanners && entry.sceneId !== currentScene) {
      currentScene = entry.sceneId;
      section = null;
      const banner = document.createElement('h2');
      banner.className = 'scene-banner';
      banner.textContent = sceneTitleById.get(currentScene) ?? currentScene;
      sceneElement.append(banner);
    }
    if (meta.section !== section) {
      section = meta.section;
      const heading = document.createElement('h3');
      heading.className = 'section-title';
      heading.textContent = section ?? 'Scene';
      sceneElement.append(heading);
    }
    const article = document.createElement('article');
    article.className = `line${entry.file ? '' : ' missing'}`;
    article.dataset.lineId = entry.id;
    article.dataset.sceneId = entry.sceneId ?? '';
    article.dataset.speaker = meta.speaker ?? '';
    article.style.setProperty('--speaker', `var(--${meta.speaker})`);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'play';
    button.textContent = '▶';
    button.disabled = !entry.file;
    button.setAttribute('aria-label', `Play line ${entry.id}, ${speakerName(meta.speaker)}`);
    button.addEventListener('click', () => {
      runToken += 1;
      void playEntry(entry);
    });
    const speaker = document.createElement('p');
    speaker.className = 'speaker';
    const beatSuffix = meta.beatId ? ` · ${meta.beatId}` : '';
    speaker.textContent = `${entry.id} · ${speakerName(meta.speaker)}${beatSuffix}`;
    const spokenText = document.createElement('p');
    spokenText.className = 'text';
    spokenText.lang = entry.file ? (entry.languageId === 'it' ? 'la' : lang) : 'en';
    spokenText.textContent = entry.text ?? entry.fallback.text;
    const direction = document.createElement('p');
    direction.className = 'direction';
    direction.textContent = meta.direction ?? '';
    const metrics = document.createElement('p');
    metrics.className = 'metrics';
    metrics.textContent = metricsText(entry);
    if (entry.cer > 0.25) metrics.classList.add('warn');
    article.append(button, speaker, spokenText, direction, metrics);
    const reviewControls = buildReviewControls(entry);
    if (reviewControls) article.append(reviewControls);
    sceneElement.append(article);
  }
  showReviewSummary();
}

function stop() {
  runToken += 1;
  if (current) {
    current.audio.pause();
    current.finish(); // Cancel the awaited clip too, so restarting the scene cannot strand it.
  }
  current = null;
  stopScene.disabled = true;
}

function playEntry(entry) {
  return new Promise((resolve) => {
    if (current) {
      current.audio.pause();
      current.finish();
    }
    const element = sceneElement.querySelector(`[data-line-id="${entry.id}"]`);
    const audio = new Audio(entry.file);
    let finished = false;
    const done = (errorMessage = '') => {
      if (finished) return;
      finished = true;
      element?.classList.remove('playing');
      if (current?.audio === audio) {
        current = null;
        stopScene.disabled = true;
      }
      if (errorMessage) statusElement.textContent = errorMessage;
      resolve();
    };
    current = { audio, element, finish: done };
    element?.classList.add('playing');
    element?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    stopScene.disabled = false;
    statusElement.textContent = `Playing ${entry.id} · ${speakerName(entry.speaker)}`;
    audio.addEventListener('ended', () => done(), { once: true });
    audio.addEventListener('error', () => done(`Could not play ${entry.file}`), { once: true });
    audio.play().catch(() => done(`Playback unavailable for ${entry.id}.`));
  });
}

function sceneDefaultPauseSeconds(sceneId) {
  if (!manifest) return DEFAULT_PAUSE_SECONDS;
  const scene = voiceManifestScenes(manifest).find((candidate) => candidate.id === sceneId);
  return scene?.defaultPauseSeconds ?? manifest.defaultPauseSeconds ?? DEFAULT_PAUSE_SECONDS;
}

/** Silence before a line is direction: the manifest carries the scene's per-line pauses. */
function pauseBeforeMs(entry) {
  const seconds = manifest?.pauseBeforeSeconds?.[entry.id] ?? sceneDefaultPauseSeconds(entry.sceneId);
  return seconds * 1000;
}

async function playAll() {
  stop();
  const token = runToken;
  let first = true;
  for (const entry of entries()) {
    if (!entry.file) continue;
    if (!first) {
      await new Promise((resolve) => setTimeout(resolve, pauseBeforeMs(entry)));
      if (token !== runToken) return;
    }
    first = false;
    await playEntry(entry);
    if (token !== runToken) return;
  }
  stopScene.disabled = true;
  statusElement.textContent = 'Selection complete.';
}

function showReadyCount() {
  const visible = entries();
  const generated = visible.filter((entry) => entry.file).length;
  statusElement.textContent = `${generated}/${visible.length} lines ready in ${language() === 'ja' ? 'Japanese' : 'English'}.`;
}

function loadSavedReviews() {
  try {
    const saved = localStorage.getItem(VOICE_REVIEW_STORAGE_KEY);
    if (!saved) return;
    const checked = validateVoiceReviewBook(JSON.parse(saved), manifest);
    if (!checked.valid) {
      reviewLocked = true;
      reviewStatus.textContent = `Saved audition notes do not match the current takes (${checked.errors.slice(0, 2).join('; ')}). Export the old file, then import a matching version or clear the local reviews.`;
      return;
    }
    reviews = checked.book;
    reviewStatus.textContent = 'Recovered saved audition notes from this browser.';
  } catch (error) {
    reviewLocked = true;
    reviewStatus.textContent = `Saved review data could not be read (${error.message}). Export a backup before clearing.`;
  }
}

function downloadJSON(data) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bells-voice-reviews-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportReviews.addEventListener('click', () => {
  if (!manifest) return;
  // Preserve the original, even if its take identity is now stale.
  const oldRaw = reviewLocked ? localStorage.getItem(VOICE_REVIEW_STORAGE_KEY) : null;
  downloadJSON(oldRaw ?? `${JSON.stringify(reviews, null, 2)}\n`);
  reviewStatus.textContent = 'Downloaded review JSON.';
});

importReviews.addEventListener('change', async () => {
  const file = importReviews.files?.[0];
  if (!file || !manifest) return;
  try {
    if (file.size > 256_000) throw new Error('Review file exceeds 256 KB.');
    const result = validateVoiceReviewBook(JSON.parse(await file.text()), manifest);
    if (!result.valid) throw new Error(result.errors.slice(0, 3).join('; '));
    reviews = result.book;
    reviewLocked = false;
    persistReviews();
    render();
    reviewStatus.textContent = `Imported ${Object.keys(reviews.entries).length} audition reviews.`;
  } catch (error) {
    reviewStatus.textContent = `Import rejected: ${error.message}`;
  } finally {
    importReviews.value = '';
  }
});

clearReviews.addEventListener('click', () => {
  if (!confirm('Clear all local voice audition notes? Export your reviews first if you need a backup.')) return;
  try {
    localStorage.removeItem(VOICE_REVIEW_STORAGE_KEY);
    reviews = emptyVoiceReviewBook();
    reviewLocked = false;
    render();
    reviewStatus.textContent = 'Local voice audition notes cleared.';
  } catch (error) {
    reviewStatus.textContent = `Could not clear local notes: ${error.message}`;
  }
});

playScene.addEventListener('click', () => { void playAll(); });
stopScene.addEventListener('click', () => {
  stop();
  statusElement.textContent = 'Stopped.';
});
for (const input of document.querySelectorAll('input[name="lang"]')) {
  input.addEventListener('change', () => {
    stop();
    render();
    showReadyCount();
  });
}
for (const filterElement of [sceneFilter, speakerFilter]) {
  filterElement?.addEventListener('change', () => {
    stop();
    render();
    showReadyCount();
  });
}

try {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  manifest = await response.json();
  provenance.textContent = manifest.provenance ?? '';
  populateFilters();
  loadSavedReviews();
  render();
  showReadyCount();
  exportReviews.disabled = false;
} catch (error) {
  statusElement.textContent = `No voice manifest yet (${error.message}). Run assets/audio/voice-prototype-v1/build_voice_prototype.py.`;
  reviewStatus.textContent = 'The audition ledger needs the rendered voice manifest.';
}
