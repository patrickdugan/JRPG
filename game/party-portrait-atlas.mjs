export const PARTY_PORTRAIT_MEMBERS = Object.freeze([
  'ren',
  'aya',
  'lise',
  'mateus',
  'genta',
  'kiku',
  'miyo',
]);

export const PARTY_PORTRAIT_EXPRESSIONS = Object.freeze([
  'neutral',
  'resolve',
  'strain',
  'soften',
  'concern',
  'anger',
  'surprise',
  'quiet',
]);

export const PARTY_PORTRAIT_ATLAS = Object.freeze({
  url: './assets/art/party-portrait-suite-v2/party-portrait-expressions-v2.png',
  width: 768,
  height: 672,
  contentWidth: 768,
  transparentReserveWidth: 0,
  columns: 8,
  rows: 7,
  cellWidth: 96,
  cellHeight: 96,
});

export function hasPartyPortraitMember(memberId) {
  return PARTY_PORTRAIT_MEMBERS.includes(memberId);
}

export function getPartyPortraitFrame(memberId, expression = 'neutral') {
  const row = PARTY_PORTRAIT_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party portrait member: ${memberId}`);
  const column = PARTY_PORTRAIT_EXPRESSIONS.indexOf(expression);
  if (column < 0) throw new RangeError(`Unknown party portrait expression: ${expression}`);
  return Object.freeze({
    memberId,
    expression,
    row,
    column,
    x: column * PARTY_PORTRAIT_ATLAS.cellWidth,
    y: row * PARTY_PORTRAIT_ATLAS.cellHeight,
    width: PARTY_PORTRAIT_ATLAS.cellWidth,
    height: PARTY_PORTRAIT_ATLAS.cellHeight,
  });
}

function cssPixels(value) {
  const normalized = Object.is(value, -0) ? 0 : value;
  return `${Number(normalized.toFixed(4))}px`;
}

/**
 * Derive a CSS background crop from the authored source frame.
 * The Camp card intentionally displays a centered 52 x 60 crop of the
 * 96 x 96 portrait cell; callers must supply those display dimensions.
 */
export function getPartyPortraitBackgroundPlacement(frame, { cropWidth, cropHeight } = {}) {
  if (!frame || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)
    || !Number.isFinite(frame.width) || !Number.isFinite(frame.height)
    || frame.width <= 0 || frame.height <= 0) {
    throw new TypeError('Portrait placement requires a valid source frame.');
  }
  if (!Number.isFinite(cropWidth) || !Number.isFinite(cropHeight)
    || cropWidth <= 0 || cropHeight <= 0) {
    throw new TypeError('Portrait placement requires positive crop dimensions.');
  }
  const scale = cropHeight / frame.height;
  const displayedFrameWidth = frame.width * scale;
  if (cropWidth > displayedFrameWidth) {
    throw new RangeError('Portrait crop cannot be wider than the displayed source frame.');
  }
  if (frame.x < 0 || frame.y < 0
    || frame.x + frame.width > PARTY_PORTRAIT_ATLAS.contentWidth
    || frame.y + frame.height > PARTY_PORTRAIT_ATLAS.height) {
    throw new RangeError('Portrait source frame must stay inside the authored content grid.');
  }
  const horizontalInset = (displayedFrameWidth - cropWidth) / 2;
  const backgroundWidth = PARTY_PORTRAIT_ATLAS.width * scale;
  const backgroundHeight = PARTY_PORTRAIT_ATLAS.height * scale;
  const x = -(frame.x * scale + horizontalInset);
  const y = -(frame.y * scale);
  return Object.freeze({
    cropWidth,
    cropHeight,
    scale,
    backgroundWidth,
    backgroundHeight,
    x,
    y,
    backgroundSize: `${cssPixels(backgroundWidth)} ${cssPixels(backgroundHeight)}`,
    backgroundPosition: `${cssPixels(x)} ${cssPixels(y)}`,
  });
}

export function portraitExpressionForGesture(cue = '') {
  const text = String(cue).toLowerCase();
  if (/wince|flinch|strain|pain|stagger|recoil|trembl|bleed|clench|brace/u.test(text)) return 'strain';
  if (/\b(?:anger|angry|glare|glares|scowl|scowls|fury|furious|snarl|snarls|shout|shouts|strike|strikes|struck|slam|slams|slammed)\b/u.test(text)) return 'anger';
  if (/surprise|startl|gasp|eyes? widen|wide eyes|sudden|reveal/u.test(text)) return 'surprise';
  if (/concern|worr|uneasy|frown|shield|patient|medicine|check|protect|careful|safe/u.test(text)) return 'concern';
  if (/quiet|silence|still|whisper|bow(?:s|ed)? (?:his|her|their) head|look down|face down|lower (?:his|her|their)/u.test(text)) return 'quiet';
  if (/smile|soften|relax|exhale|gentl|laugh|open palm|unclench/u.test(text)) return 'soften';
  if (/raise|point|plant|draw|stand|step forward|square|set |face |hold|lift/u.test(text)) return 'resolve';
  return 'neutral';
}

export function partyPortraitImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === PARTY_PORTRAIT_ATLAS.width
    && image.naturalHeight === PARTY_PORTRAIT_ATLAS.height;
}
