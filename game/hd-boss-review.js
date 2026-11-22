import {
  HD_BOSSES, REVIEW_CLIPS, REVIEW_SCHEMA, REVIEW_STORAGE_KEY,
  originalSourcePath, intakeSourcePath, frameRect,
  validateReviewCatalog, sanitizeReviewDraft, buildVisualReceipt,
} from './hd-boss-review-contract.mjs';

const $ = selector => document.querySelector(selector);
const artRoot = './assets/art/hd-painted-v1/';
const el = {
  rail: $('#bossRail'), activeBoss: $('#activeBoss'), sourceMeta: $('#sourceMeta'),
  source: $('#sourceImage'), clip: $('#clip'), speed: $('#speed'), frame: $('#frame'),
  frameReadout: $('#frameReadout'), frameCounter: $('#frameCounter'),
  clipMeta: $('#clipMeta'), technical: $('#motionTechnical'),
  motion: $('#motionCanvas'), poses: $('#poseGrid'), backdrop: $('#backdrop'),
  play: $('#play'), back: $('#stepBack'), next: $('#stepNext'),
  bossDecision: $('#bossDecision'), bossNote: $('#bossNote'),
  clipDecision: $('#clipDecision'), clipNote: $('#clipNote'),
  capture: $('#capture'), receipt: $('#receipt'), exportDraft: $('#exportDraft'),
  status: $('#eventStatus'),
};
const ctx = el.motion.getContext('2d');
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
const pretty = value => value.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const time = () => new Date().toISOString();

let keys, motion, roster, intake = null;
let bossId = '', clipId = 'idle', frame = 0, playSpeed = 1;
let sourceImage = null, keyImage = null, motionImage = null;
let bossToken = 0, clipToken = 0, running = false, raf = null, previousTick = 0, accumulated = 0;
let draft, lastReceipt = null, localStorageAvailable = true;

function setStatus(message) { el.status.textContent = message; }
function enableReady(ready) {
  el.capture.disabled = !ready;
  el.play.disabled = !ready;
  el.back.disabled = !ready;
  el.next.disabled = !ready;
  el.frame.disabled = !ready;
}
function invalidateEvidence() {
  lastReceipt = null;
  el.receipt.disabled = true;
}
function loadDraft() {
  try {
    const stored = localStorage.getItem(REVIEW_STORAGE_KEY);
    return sanitizeReviewDraft(stored ? JSON.parse(stored) : null);
  } catch {
    localStorageAvailable = false;
    return sanitizeReviewDraft(null);
  }
}
function persistDraft() {
  try { localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(draft)); }
  catch { localStorageAvailable = false; }
  invalidateEvidence();
  renderRail();
}
function stop() {
  running = false;
  if (raf !== null) window.cancelAnimationFrame(raf);
  raf = null;
  el.play.textContent = '▶ Play';
  el.play.setAttribute('aria-pressed', 'false');
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2) + '\n';
  downloadBlob(new Blob([json], { type: 'application/json' }), filename);
}
async function fetchJSON(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' reading ' + path);
  return response.json();
}
function imageAt(path) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      if (!im.naturalWidth || !im.naturalHeight) reject(new Error('Empty image: ' + path));
      else resolve(im);
    };
    im.onerror = () => reject(new Error('Cannot decode image: ' + path));
    im.src = path;
  });
}
function selectBackground() {
  document.querySelectorAll('.art-ground').forEach(node => {
    node.dataset.backdrop = el.backdrop.value;
  });
  invalidateEvidence();
}
function renderRail() {
  for (const button of el.rail.querySelectorAll('button[data-boss]')) {
    const id = button.dataset.boss;
    const proposed = draft.bosses[id].decision;
    const state = button.querySelector('span');
    button.setAttribute('aria-current', String(id === bossId));
    state.className = proposed === 'needs-fixes' ? 'fixes' : proposed === 'ready-for-signoff' ? 'ready' : '';
    state.textContent = proposed === 'needs-fixes' ? 'Needs cleanup' :
      proposed === 'ready-for-signoff' ? 'Signoff recommended' : 'Approval pending';
  }
}
function setupRail() {
  el.rail.replaceChildren();
  for (const boss of HD_BOSSES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'boss-tile';
    button.dataset.boss = boss.id;
    const label = document.createElement('strong');
    label.textContent = boss.name;
    const status = document.createElement('span');
    button.append(label, status);
    button.addEventListener('click', () => chooseBoss(boss.id));
    el.rail.append(button);
  }
  renderRail();
}
function syncBossReview() {
  if (!bossId) return;
  const review = draft.bosses[bossId];
  el.bossDecision.value = review.decision;
  el.bossNote.value = review.note;
}
function syncClipReview() {
  if (!bossId || !clipId) return;
  const review = draft.bosses[bossId].clips[clipId];
  el.clipDecision.value = review.decision;
  el.clipNote.value = review.note;
}
function saveReview(section) {
  if (!bossId) return;
  const row = draft.bosses[bossId];
  if (section === 'boss') {
    row.decision = el.bossDecision.value;
    row.note = el.bossNote.value.slice(0, 3000);
  } else {
    row.clips[clipId].decision = el.clipDecision.value;
    row.clips[clipId].note = el.clipNote.value.slice(0, 3000);
  }
  persistDraft();
  if (!localStorageAvailable) setStatus('Local storage blocked. Use Export all review notes to preserve this session.');
}
function drawMotion() {
  ctx.clearRect(0, 0, 384, 384);
  if (!motionImage) return;
  const rect = frameRect(frame);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(motionImage, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, 384, 384);
  el.motion.dataset.imageReady = 'true';
  el.motion.dataset.boss = bossId;
  el.motion.dataset.clip = clipId;
  el.motion.dataset.frame = String(frame);
  el.frame.value = String(frame);
  el.frameReadout.value = (frame + 1) + ' / 24';
  el.frameReadout.textContent = (frame + 1) + ' / 24';
  el.frameCounter.textContent = String(frame + 1).padStart(2, '0') + ' / 24';
  invalidateEvidence();
}
function tick(now) {
  if (!running) return;
  if (previousTick > 0) accumulated += Math.min(200, now - previousTick);
  previousTick = now;
  const ms = motion.actors[bossId].clipSet[clipId].frameMs / playSpeed;
  if (accumulated >= ms) {
    frame = (frame + Math.floor(accumulated / ms)) % 24;
    accumulated %= ms;
    drawMotion();
  }
  raf = requestAnimationFrame(tick);
}
function startPlay() {
  if (running) { stop(); return; }
  if (media.matches) {
    setStatus('Reduced-motion setting is active. Use the frame slider or stepping buttons.');
    return;
  }
  if (!motionImage) return;
  running = true;
  previousTick = 0;
  accumulated = 0;
  el.play.textContent = '■ Pause';
  el.play.setAttribute('aria-pressed', 'true');
  raf = requestAnimationFrame(tick);
}
function seek(delta) {
  stop();
  if (!motionImage) return;
  frame = (frame + delta + 24) % 24;
  drawMotion();
}
function displayPoses() {
  el.poses.replaceChildren();
  const actor = keys.actors[bossId];
  for (let index = 0; index < 6; index++) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'pose-tile art-ground';
    tile.dataset.backdrop = el.backdrop.value;
    tile.dataset.pose = String(index);
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const pctx = canvas.getContext('2d');
    pctx.imageSmoothingEnabled = true;
    pctx.drawImage(keyImage, index * 384, 0, 384, 384, 0, 0, 384, 384);
    const label = document.createElement('span');
    label.textContent = actor.poses[index].replaceAll('-', ' ');
    const small = document.createElement('small');
    small.textContent = 'KEY ' + String(index + 1).padStart(2, '0');
    tile.append(canvas, label, small);
    tile.addEventListener('click', () => {
      const clips = motion.actors[bossId].clipSet;
      const match = REVIEW_CLIPS.find(name => clips[name]?.sourcePose === index);
      if (!match) { setStatus('Pose ' + (index + 1) + ' is visible above; no motion clip maps to that exact key.'); return; }
      el.clip.value = match;
      chooseClip();
    });
    el.poses.append(tile);
  }
  highlightPose();
}
function highlightPose() {
  if (!bossId || !keys || !motion) return;
  const pose = motion.actors[bossId].clipSet[clipId]?.sourcePose;
  for (const tile of el.poses.querySelectorAll('.pose-tile')) {
    tile.dataset.active = String(Number(tile.dataset.pose) === pose);
  }
}
async function chooseBoss(id) {
  if (!HD_BOSSES.some(x => x.id === id)) return;
  stop();
  invalidateEvidence();
  enableReady(false);
  el.motion.dataset.imageReady = 'false';
  const token = ++bossToken;
  ++clipToken;
  bossId = id;
  frame = 0;
  sourceImage = keyImage = motionImage = null;
  renderRail();
  el.source.removeAttribute('src');
  el.poses.replaceChildren();
  const boss = HD_BOSSES.find(x => x.id === id);
  el.activeBoss.textContent = boss.name;
  el.sourceMeta.textContent = 'Loading Git-tracked source painting and six-key atlas…';
  setStatus('Loading ' + boss.name + ' source art…');
  el.clip.replaceChildren();
  try {
    const [source, keysImage, sourceIntake] = await Promise.all([
      imageAt(originalSourcePath(id)),
      imageAt(artRoot + keys.actors[id].file),
      fetchJSON(intakeSourcePath(id)),
    ]);
    if (token !== bossToken) return;
    if (source.naturalWidth !== 1536 || source.naturalHeight !== 1024 ||
        keysImage.naturalWidth !== 2304 || keysImage.naturalHeight !== 384)
      throw new Error('Source painting or atlas has unexpected pixel dimensions');
    if (sourceIntake.bossId !== id || sourceIntake.sixKeyAtlasSha256 !== keys.actors[id].sha256)
      throw new Error('Source receipt does not match the runtime atlas');
    intake = sourceIntake;
    sourceImage = source;
    keyImage = keysImage;
    el.source.src = source.src;
    el.source.alt = 'Original high-resolution six-pose source painting for ' + boss.name;
    el.sourceMeta.textContent = 'Master PNG · 1536 × 1024 · six keys · approval: ' +
      roster.identities.find(x => x.id === id).visualApproval;
    displayPoses();
    for (const name of REVIEW_CLIPS) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = pretty(name);
      el.clip.append(option);
    }
    clipId = 'idle';
    el.clip.value = clipId;
    syncBossReview();
    await chooseClip();
  } catch (error) {
    if (token !== bossToken) return;
    setStatus('Review load failed: ' + String(error.message || error) + '. Serve from the repository root.');
  }
}
async function chooseClip() {
  if (!bossId || !motion.actors[bossId]) return;
  stop();
  invalidateEvidence();
  enableReady(false);
  motionImage = null;
  frame = 0;
  const token = ++clipToken, selectedBoss = bossId;
  clipId = el.clip.value;
  el.motion.dataset.imageReady = 'false';
  ctx.clearRect(0, 0, 384, 384);
  const entry = motion.actors[bossId].clipSet[clipId];
  highlightPose();
  syncClipReview();
  el.clipMeta.textContent = pretty(clipId) + ' · source key ' + (entry.sourcePose + 1) + ' · ' + entry.frameMs + ' ms/frame';
  el.technical.textContent = '24 distinct decoded frame hashes · 192 × 192 cells · ' + entry.frameMs + ' ms/frame source tempo.';
  setStatus('Loading ' + selectedBoss + ' / ' + clipId + ' motion atlas…');
  try {
    const image = await imageAt(artRoot + entry.path);
    if (token !== clipToken || selectedBoss !== bossId) return;
    if (image.naturalWidth !== entry.width || image.naturalHeight !== entry.height)
      throw new Error('Motion atlas has incorrect dimensions');
    motionImage = image;
    drawMotion();
    enableReady(true);
    setStatus('Showing ' + selectedBoss + ' / ' + clipId +
      '. Save local notes or capture a PNG with its SHA-256 JSON receipt.');
  } catch (error) {
    if (token !== clipToken) return;
    setStatus('Motion clip unavailable: ' + String(error.message || error));
  }
}
function drawBackdrop(rctx, x, y, w, h) {
  const kind = el.backdrop.value;
  rctx.save();
  rctx.beginPath(); rctx.rect(x, y, w, h); rctx.clip();
  if (kind === 'checker') {
    rctx.fillStyle = '#525c64'; rctx.fillRect(x, y, w, h);
    rctx.fillStyle = '#81888c';
    const step = 24;
    for (let row = 0; row < Math.ceil(h / step); row++)
      for (let col = 0; col < Math.ceil(w / step); col++)
        if ((row + col) % 2 === 0) rctx.fillRect(x + col * step, y + row * step, step, step);
  } else {
    const g = rctx.createLinearGradient(x, y, x, y + h);
    if (kind === 'light') { g.addColorStop(0, '#e4cfb3'); g.addColorStop(1, '#a29a8e'); }
    else if (kind === 'arena') { g.addColorStop(0, '#151925'); g.addColorStop(.7, '#3d464d'); g.addColorStop(1, '#10131b'); }
    else { g.addColorStop(0, '#45464c'); g.addColorStop(1, '#131721'); }
    rctx.fillStyle = g; rctx.fillRect(x, y, w, h);
  }
  rctx.restore();
}
function fitImage(rctx, image, x, y, w, h) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const sw = image.naturalWidth * scale, sh = image.naturalHeight * scale;
  rctx.drawImage(image, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
}
function panel(rctx, x, y, w, h, label) {
  rctx.fillStyle = '#1c2229'; rctx.fillRect(x, y, w, h);
  rctx.strokeStyle = '#736654'; rctx.lineWidth = 2; rctx.strokeRect(x, y, w, h);
  rctx.fillStyle = '#e2c092'; rctx.font = 'bold 20px sans-serif'; rctx.fillText(label, x + 18, y + 36);
}
function writeWrapped(rctx, text, x, y, width, lineHeight, maxLines) {
  const words = String(text || 'No reviewer note entered.').split(/\s+/);
  let line = '', lines = 0;
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (rctx.measureText(trial).width > width && line) {
      rctx.fillText(line, x, y + lines * lineHeight);
      lines++; line = word;
      if (lines >= maxLines) return;
    } else line = trial;
  }
  if (line && lines < maxLines) rctx.fillText(line, x, y + lines * lineHeight);
}
function composeScreenshot() {
  const board = document.createElement('canvas');
  board.width = 1680; board.height = 1120;
  const c = board.getContext('2d');
  c.fillStyle = '#10151b'; c.fillRect(0, 0, 1680, 1120);
  c.fillStyle = '#d7ba8e'; c.font = '18px sans-serif';
  c.fillText('BELLS OF THE BLACK CHRYSANTHEMUM / VISUAL CANDIDATE EVIDENCE', 35, 45);
  c.fillStyle = '#f4eadb'; c.font = '48px Georgia,serif';
  c.fillText(HD_BOSSES.find(x => x.id === bossId).name, 35, 103);

  panel(c, 32, 135, 766, 558, '01  ORIGINAL PAINTING / 1536 × 1024');
  drawBackdrop(c, 47, 190, 736, 481);
  fitImage(c, sourceImage, 47, 190, 736, 481);

  panel(c, 816, 135, 832, 558, '02  SIX-KEY TRANSPARENT ATLAS');
  const poses = keys.actors[bossId].poses;
  for (let i = 0; i < 6; i++) {
    const px = 836 + (i % 3) * 270, py = 188 + Math.floor(i / 3) * 245;
    drawBackdrop(c, px, py, 232, 214);
    c.drawImage(keyImage, i * 384, 0, 384, 384, px + 8, py, 214, 214);
    c.fillStyle = '#e7c596'; c.font = '17px sans-serif';
    c.fillText(String(i + 1).padStart(2, '0') + ' ' + poses[i].replaceAll('-', ' '), px, py + 238, 255);
  }

  panel(c, 32, 713, 448, 371, '03  MOTION / FRAME ' + String(frame + 1).padStart(2, '0') + '/24');
  drawBackdrop(c, 52, 760, 306, 300);
  const rect = frameRect(frame);
  c.drawImage(motionImage, rect.sx, rect.sy, rect.sw, rect.sh, 55, 761, 298, 298);
  c.fillStyle = '#e2c092'; c.font = '17px sans-serif';
  c.fillText(clipId.toUpperCase(), 368, 840, 106);
  c.fillText(playSpeed + '×', 368, 870);

  panel(c, 498, 713, 1150, 371, '04  REVIEW NOTES / CANDIDATE ONLY');
  const review = draft.bosses[bossId];
  const clipReview = review.clips[clipId];
  c.fillStyle = '#ddc5a6'; c.font = '20px sans-serif';
  c.fillText('Boss: ' + review.decision + '   |   Clip: ' + clipReview.decision, 523, 797);
  c.fillStyle = '#f0e6db'; c.font = '17px sans-serif';
  writeWrapped(c, review.note, 523, 840, 1060, 25, 3);
  c.fillStyle = '#d5b48a';
  writeWrapped(c, 'Clip note: ' + clipReview.note, 523, 933, 1060, 25, 3);
  c.fillStyle = '#aea69a'; c.font = '15px ui-monospace,monospace';
  c.fillText('ATLAS SHA-256  ' + keys.actors[bossId].sha256, 523, 1053, 1070);
  return board;
}
async function capture() {
  if (!sourceImage || !keyImage || !motionImage || !intake) return;
  stop();
  const selection = {
    bossId, clipId, frame, backdrop: el.backdrop.value, speed: playSpeed,
    intake, draft: sanitizeReviewDraft(draft),
  };
  const reviewAtCapture = JSON.stringify(selection.draft);
  el.capture.disabled = true;
  invalidateEvidence();
  try {
    const canvas = composeScreenshot();
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Browser could not serialize PNG');
    if (!crypto.subtle) throw new Error('Secure context required to hash PNG receipt');
    const digest = await crypto.subtle.digest('SHA-256', await png.arrayBuffer());
    const screenshotSha256 = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
    if (bossId !== selection.bossId || clipId !== selection.clipId ||
        frame !== selection.frame || el.backdrop.value !== selection.backdrop ||
        playSpeed !== selection.speed || JSON.stringify(sanitizeReviewDraft(draft)) !== reviewAtCapture)
      throw new Error('Selection or notes changed during capture. Capture the current frame again.');
    const stamp = time();
    const json = buildVisualReceipt({
      ...selection, timestamp: stamp, screenshotSha256, keys, motion, roster,
    });
    const base = 'jrpg-review-' + selection.bossId + '-' + selection.clipId +
      '-f' + String(selection.frame + 1).padStart(2, '0');
    lastReceipt = { data: json, name: base + '.json' };
    el.receipt.disabled = false;
    downloadBlob(png, base + '.png');
    setStatus('PNG captured. Download its paired JSON receipt for the SHA-256 and source hashes.');
  } catch (error) {
    setStatus('Screenshot capture failed: ' + String(error.message || error));
  } finally {
    el.capture.disabled = false;
  }
}
function exportDraft() {
  const status = {};
  for (const { id } of HD_BOSSES) {
    const row = roster.identities.find(x => x.id === id);
    status[id] = { canonicalVisualApproval: row.visualApproval, candidateInGit: row.assetInGit };
  }
  downloadJSON({
    schema: REVIEW_SCHEMA, evidenceType: 'local-review-notes-export',
    exportedAt: time(), rosterStatus: status, draft,
    reviewAuthority: 'recommendations only; no promotion into Roster Keystone',
  }, 'jrpg-seven-boss-review-notes.json');
  setStatus('Exported local reviewer notes. Canonical Roster Keystone remains unchanged.');
}
function attachControls() {
  el.clip.addEventListener('change', chooseClip);
  el.play.addEventListener('click', startPlay);
  el.back.addEventListener('click', () => seek(-1));
  el.next.addEventListener('click', () => seek(1));
  el.frame.addEventListener('input', () => {
    stop();
    if (!motionImage) return;
    frame = Number(el.frame.value); drawMotion();
  });
  el.speed.addEventListener('change', () => {
    playSpeed = Number(el.speed.value);
    accumulated = 0;
    invalidateEvidence();
  });
  el.backdrop.addEventListener('change', selectBackground);
  for (const key of ['bossDecision', 'bossNote'])
    el[key].addEventListener('input', () => saveReview('boss'));
  for (const key of ['clipDecision', 'clipNote'])
    el[key].addEventListener('input', () => saveReview('clip'));
  el.capture.addEventListener('click', capture);
  el.receipt.addEventListener('click', () => {
    if (lastReceipt) downloadJSON(lastReceipt.data, lastReceipt.name);
  });
  el.exportDraft.addEventListener('click', exportDraft);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  media.addEventListener('change', () => { if (media.matches) stop(); });
}
async function main() {
  draft = loadDraft();
  enableReady(false);
  el.receipt.disabled = true;
  el.exportDraft.disabled = true;
  attachControls();
  setupRail();
  try {
    [keys, motion, roster] = await Promise.all([
      fetchJSON(artRoot + 'manifest.json'),
      fetchJSON(artRoot + 'motion-manifest.json'),
      fetchJSON('../assets/art/roster-keystone/roster.json'),
    ]);
    const counts = validateReviewCatalog(keys, motion, roster);
    if (counts.bosses !== 7 || counts.clips !== 70)
      throw new Error('Seven-boss delivery incomplete');
    el.exportDraft.disabled = false;
    const requested = new URLSearchParams(location.search).get('boss');
    await chooseBoss(HD_BOSSES.some(x => x.id === requested) ? requested : HD_BOSSES[0].id);
    if (!localStorageAvailable) setStatus('Local storage blocked; export review notes before closing the page.');
  } catch (error) {
    setStatus('Archive unavailable: ' + String(error.message || error) + '. Run npm run review:serve from game/.');
  }
}
main();
