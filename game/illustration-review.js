import {
  ILLUSTRATION_REFERENCES as catalog,
  ILLUSTRATION_REVIEW_STORAGE_KEY as STORAGE_KEY,
  ILLUSTRATION_SOURCE_VERSION as SCHEMA_VERSION,
  ILLUSTRATION_REVIEW_VERDICTS as verdicts,
  runtimeIllustrationPath,
  validIllustrationReview,
} from './illustration-catalog.mjs';

const el = (id) => document.getElementById(id);
const list = el('assetList');
const status = el('reviewStatus');
const byId = new Map(catalog.map((asset) => [asset.id, asset]));
let currentIndex = 0;
let reviews = Object.create(null);

function announce(message) { status.textContent = message; }

function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (validIllustrationReview(data)) {
      for (const row of data.entries) reviews[row.id] = { verdict: row.verdict, note: row.note };
    }
  } catch { /* Local storage can be disabled without affecting the archive. */ }
}

function packageReviews() {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: 'Bells of the Black Chrysanthemum / July illustration archive',
    entries: catalog.map((asset) => ({
      id: asset.id,
      sourceSha: asset.source.sha,
      verdict: reviews[asset.id]?.verdict || 'unreviewed',
      note: reviews[asset.id]?.note || '',
    })),
  };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packageReviews()));
    announce('Review saved in this browser.');
  } catch { announce('Browser storage unavailable. Export JSON to preserve your review.'); }
}

function originalGithubUrl(path) {
  return 'https://github.com/patrickdugan/JRPG/blob/main/' + path;
}

function displayImage(node, file, label, pixel) {
  node.classList.toggle('pixelated', Boolean(pixel));
  node.alt = label;
  node.src = runtimeIllustrationPath(file);
}

function selectAsset(index) {
  currentIndex = (index + catalog.length) % catalog.length;
  const asset = catalog[currentIndex];
  for (const button of list.querySelectorAll('button')) {
    button.setAttribute('aria-current', String(button.dataset.assetId === asset.id));
  }
  el('assetCounter').textContent = 'Archived reference ' + (currentIndex + 1) + ' of ' + catalog.length;
  el('assetTitle').textContent = asset.label;
  el('assetDetail').textContent = asset.detail;
  el('assetUse').textContent = asset.approvedUse;
  el('assetSha').textContent = asset.source.sha;
  el('sourceStatus').textContent = 'Source: ' + asset.source.path;
  el('sourceLink').href = originalGithubUrl(asset.source.path);
  displayImage(el('sourceImage'), asset.source.file, asset.label + ' original illustration', false);
  el('laterTitle').textContent = asset.later.label;
  el('laterNote').textContent = asset.later.note;
  displayImage(el('laterImage'), asset.later.file, asset.later.label + ' comparison artwork', asset.later.pixel);
  el('verdict').value = reviews[asset.id]?.verdict || 'unreviewed';
  el('note').value = reviews[asset.id]?.note || '';
  announce('Viewing ' + asset.label + '. Source artwork is unchanged.');
}

for (const [index, asset] of catalog.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.assetId = asset.id;
  button.textContent = asset.label;
  button.addEventListener('click', () => selectAsset(index));
  list.appendChild(button);
}
function updateReview() {
  const id = catalog[currentIndex].id;
  reviews[id] = { verdict: el('verdict').value, note: el('note').value };
  persist();
}
el('verdict').addEventListener('change', updateReview);
el('note').addEventListener('input', updateReview);
el('nextAsset').addEventListener('click', () => selectAsset(currentIndex + 1));

el('exportReview').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(packageReviews(), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bells-july-illustration-review.json';
  link.click();
  URL.revokeObjectURL(url);
  announce('Exported a Git-blob-bound review of ' + catalog.length + ' source studies.');
});

el('importReview').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 100000) throw new Error('Review JSON exceeds the size limit.');
    const data = JSON.parse(await file.text());
    if (!validIllustrationReview(data)) throw new Error('Invalid, outdated, or mismatched source hashes.');
    const incoming = Object.create(null);
    for (const row of data.entries) incoming[row.id] = { verdict: row.verdict, note: row.note };
    reviews = incoming;
    persist();
    selectAsset(currentIndex);
    announce('Imported ' + data.entries.length + ' Git-bound art reviews.');
  } catch (error) {
    announce('Import rejected: ' + error.message);
  } finally {
    event.target.value = '';
  }
});

for (const id of ['sourceImage', 'laterImage']) {
  const node = el(id);
  node.addEventListener('error', () => announce('Could not load an archived illustration: ' + node.src));
}
restore();
const requested = new URLSearchParams(window.location.search).get('asset');
selectAsset(requested && byId.has(requested) ? catalog.findIndex((asset) => asset.id === requested) : 0);
