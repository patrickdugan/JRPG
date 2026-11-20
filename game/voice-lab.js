/** Developer review page for the voice prototype manifest. Presentation only. */
const MANIFEST_URL = './assets/audio/voice-prototype-v1/manifest.json';
const SPEAKER_NAMES = {
  kurozane: 'Shogun Kurozane',
  mateus: 'Father Mateus Avelar',
  nikola: 'Nikola Dražanić',
  ren: 'Ren Ishikawa',
  miyo: 'Miyo Senda',
};
const DEFAULT_PAUSE_SECONDS = 0.4;

const sceneElement = document.querySelector('#scene');
const statusElement = document.querySelector('#status');
const playScene = document.querySelector('#playScene');
const stopScene = document.querySelector('#stopScene');
const provenance = document.querySelector('#provenance');

let manifest = null;
let current = null;
let runToken = 0;

function language() {
  return document.querySelector('input[name="lang"]:checked')?.value ?? 'en';
}

function entries() {
  if (!manifest) return [];
  return Object.entries(manifest.lines)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, byLanguage]) => ({ id, ...byLanguage[language()], fallback: byLanguage.en ?? byLanguage.ja }))
    .filter((entry) => entry.fallback);
}

function metricsText(entry) {
  if (!entry.file) return 'Not generated for this language yet.';
  const parts = [
    `${entry.durationSeconds ?? '?'} s`,
    `exaggeration ${entry.exaggeration}`,
    `cfg ${entry.cfgWeight}`,
    entry.pitchRangeSemitones != null ? `pitch range ${entry.pitchRangeSemitones} st` : null,
    entry.loudnessRangeDb != null ? `loudness range ${entry.loudnessRangeDb} dB` : null,
    `take ${entry.chosenTake + 1}/${entry.takes?.length ?? 1}`,
    `ASR error ${(entry.cer * 100).toFixed(0)}%`,
  ];
  return parts.filter(Boolean).join(' · ');
}

function render() {
  const lang = language();
  sceneElement.replaceChildren();
  let section = null;
  for (const entry of entries()) {
    const meta = entry.file ? entry : entry.fallback;
    if (meta.section !== section) {
      section = meta.section;
      const heading = document.createElement('h2');
      heading.className = 'section-title';
      heading.textContent = section ?? 'Scene';
      sceneElement.append(heading);
    }
    const article = document.createElement('article');
    article.className = `line${entry.file ? '' : ' missing'}`;
    article.dataset.lineId = entry.id;
    article.style.setProperty('--speaker', `var(--${meta.speaker})`);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'play';
    button.textContent = '▶';
    button.disabled = !entry.file;
    button.setAttribute('aria-label', `Play line ${entry.id}, ${SPEAKER_NAMES[meta.speaker] ?? meta.speaker}`);
    button.addEventListener('click', () => {
      runToken += 1;
      playEntry(entry);
    });
    const speaker = document.createElement('p');
    speaker.className = 'speaker';
    speaker.textContent = `${entry.id} · ${SPEAKER_NAMES[meta.speaker] ?? meta.speaker}`;
    const text = document.createElement('p');
    text.className = 'text';
    text.lang = entry.file ? (entry.languageId === 'it' ? 'la' : lang) : 'en';
    text.textContent = entry.text ?? entry.fallback.text;
    const direction = document.createElement('p');
    direction.className = 'direction';
    direction.textContent = meta.direction ?? '';
    const metrics = document.createElement('p');
    metrics.className = 'metrics';
    metrics.textContent = metricsText(entry);
    if (entry.cer > 0.25) metrics.classList.add('warn');
    article.append(button, speaker, text, direction, metrics);
    sceneElement.append(article);
  }
}

function stop() {
  runToken += 1;
  if (current) {
    current.audio.pause();
    current.element?.classList.remove('playing');
  }
  current = null;
  stopScene.disabled = true;
}

function playEntry(entry) {
  return new Promise((resolve) => {
    if (current) {
      current.audio.pause();
      current.element?.classList.remove('playing');
    }
    const element = sceneElement.querySelector(`[data-line-id="${entry.id}"]`);
    const audio = new Audio(entry.file);
    current = { audio, element };
    element?.classList.add('playing');
    element?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    stopScene.disabled = false;
    statusElement.textContent = `Playing ${entry.id} · ${SPEAKER_NAMES[entry.speaker] ?? entry.speaker}`;
    const done = () => {
      element?.classList.remove('playing');
      resolve();
    };
    audio.addEventListener('ended', done, { once: true });
    audio.addEventListener('error', () => {
      statusElement.textContent = `Could not play ${entry.file}`;
      done();
    }, { once: true });
    audio.play().catch(done);
  });
}

/** Silence before a line is direction: the manifest carries the scene's per-line pauses. */
function pauseBeforeMs(id) {
  const seconds = manifest?.pauseBeforeSeconds?.[id] ?? manifest?.defaultPauseSeconds ?? DEFAULT_PAUSE_SECONDS;
  return seconds * 1000;
}

async function playAll() {
  stop();
  const token = runToken;
  let first = true;
  for (const entry of entries()) {
    if (!entry.file) continue;
    if (!first) {
      await new Promise((resolve) => setTimeout(resolve, pauseBeforeMs(entry.id)));
      if (token !== runToken) return;
    }
    first = false;
    await playEntry(entry);
    if (token !== runToken) return;
  }
  stopScene.disabled = true;
  statusElement.textContent = 'Scene complete.';
}

playScene.addEventListener('click', playAll);
stopScene.addEventListener('click', () => {
  stop();
  statusElement.textContent = 'Stopped.';
});
function showReadyCount() {
  const generated = entries().filter((entry) => entry.file).length;
  statusElement.textContent = `${generated} lines ready in ${language() === 'ja' ? 'Japanese' : 'English'}.`;
}

for (const input of document.querySelectorAll('input[name="lang"]')) {
  input.addEventListener('change', () => {
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
  render();
  showReadyCount();
} catch (error) {
  statusElement.textContent = `No voice manifest yet (${error.message}). Run assets/audio/voice-prototype-v1/build_voice_prototype.py.`;
}
