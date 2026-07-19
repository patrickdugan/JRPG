/** Browser-only compatibility helpers kept pure enough for Node regression tests. */

function fallbackUuidBytes(cryptoSource, randomSource) {
  const bytes = new Uint8Array(16);
  if (typeof cryptoSource?.getRandomValues === 'function') {
    try {
      cryptoSource.getRandomValues(bytes);
      return bytes;
    } catch {
      // A restricted crypto implementation can still use the compatibility path.
    }
  }
  for (let index = 0; index < bytes.length; index += 1) {
    const sample = Number(randomSource());
    bytes[index] = Number.isFinite(sample) && sample >= 0 && sample < 1
      ? Math.floor(sample * 256)
      : (index * 29 + 17) % 256;
  }
  return bytes;
}
/**
 * Produce the run UUID used by New Game. Modern browsers use randomUUID;
 * older or restricted contexts retain the same valid UUID shape instead of
 * blocking the reset button outright.
 */
export function createBrowserRunUuid({
  cryptoSource = globalThis.crypto,
  randomSource = Math.random,
} = {}) {
  if (typeof cryptoSource?.randomUUID === 'function') {
    try {
      const uuid = cryptoSource.randomUUID();
      if (typeof uuid === 'string' && uuid.length >= 8) return uuid;
    } catch {
      // Fall through to byte generation when randomUUID is denied by context.
    }
  }
  const bytes = fallbackUuidBytes(cryptoSource, randomSource);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
