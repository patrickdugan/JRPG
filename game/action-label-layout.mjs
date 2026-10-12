/**
 * Pure, deterministic layout for floating canvas labels (actor names and
 * objective tags) in the side-view battle page.
 *
 * Labels are placed in priority order. Each label first tries its preferred
 * box with the full text, then the short text, then the same pair lifted one
 * row at a time, then any explicit `fallbackBottoms` (for example below an
 * object's feet). A label that cannot be placed without overlap is hidden; the
 * DOM readouts remain the accessible text authority. Placed boxes never
 * overlap each other or any fixed obstacle.
 */

export const PARTY_SHORT_NAMES = Object.freeze({
  ren: 'Ren',
  aya: 'Aya',
  lise: 'Nikola',
  nikola: 'Nikola',
  mateus: 'Mateus',
  genta: 'Genta',
  kiku: 'Kiku',
  miyo: 'Miyo',
});

const TITLES = new Set([
  'father', 'lady', 'lord', 'captain', 'magistrate', 'shogun', 'abbot', 'sister', 'brother', 'master',
]);

/**
 * Deterministic short form of an actor display name.
 * Party members use their given name; titled names drop the title; other
 * names keep their final noun ("Masked Clerk" -> "Clerk").
 */
export function shortenActorName(name, { actorId = null } = {}) {
  const known = actorId ? PARTY_SHORT_NAMES[String(actorId).replace(/-\d+$/u, '')] : null;
  if (known) return known;
  const base = String(name ?? '').split(/\s+[—–-]\s+/u)[0].trim();
  const words = base.split(/\s+/u).filter(Boolean);
  if (words.length <= 1) return base;
  let index = 0;
  while (index < words.length - 1 && TITLES.has(words[index].toLowerCase())) index += 1;
  if (index > 0) return words[index];
  if (words.length === 3 && words[1].toLowerCase() === 'warden') return words[2];
  const last = words[words.length - 1];
  if (/^\d+$/u.test(last)) return `${words[words.length - 2]} ${last}`;
  return last;
}

function rect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height };
}

/** True when two boxes overlap or sit closer than `gap` pixels. */
export function labelBoxesOverlap(a, b, gap = 0) {
  return a.left < b.right + gap
    && b.left < a.right + gap
    && a.top < b.bottom + gap
    && b.top < a.bottom + gap;
}

function candidateBox(request, width, bottom, bounds) {
  const maxLeft = bounds.right - width;
  const left = Math.round(Math.max(bounds.left, Math.min(maxLeft, request.x - width / 2)));
  const top = Math.round(bottom - request.height);
  if (top < bounds.top || top + request.height > bounds.bottom) return null;
  return rect(left, top, width, request.height);
}

function compareRequests(a, b) {
  return (a.request.priority ?? 9) - (b.request.priority ?? 9)
    || a.request.x - b.request.x
    || String(a.request.id).localeCompare(String(b.request.id))
    || a.index - b.index;
}

function blocks(other, request) {
  return other.only == null || other.only === request.type;
}

/**
 * @param {Array<{id:string,x:number,bottom:number,width:number,height:number,
 *   shortWidth?:number,priority?:number,lockFull?:boolean,maxLift?:number,type?:string}>} requests
 * @param {{bounds?:object,gap?:number,maxLift?:number,obstacles?:Array}} options
 *   Obstacles may carry `only: <request type>` to block just that type.
 * @returns {{labels:Array, summary:{placed:number,shortened:number,moved:number,hidden:number}}}
 */
export function layoutCanvasLabels(requests, options = {}) {
  const bounds = { left: 0, top: 0, right: 960, bottom: 540, ...(options.bounds ?? {}) };
  const gap = Number.isFinite(options.gap) ? options.gap : 2;
  const defaultMaxLift = Number.isSafeInteger(options.maxLift) ? options.maxLift : 5;
  const placed = (options.obstacles ?? []).map((box) => ({ ...box }));
  const ordered = requests.map((request, index) => ({ request, index })).sort(compareRequests);
  const labels = new Array(requests.length);
  for (const { request, index } of ordered) {
    const canShorten = !request.lockFull
      && Number.isFinite(request.shortWidth)
      && request.shortWidth > 0
      && request.shortWidth < request.width;
    const variants = canShorten ? [false, true] : [false];
    const maxLift = Number.isSafeInteger(request.maxLift) ? request.maxLift : defaultMaxLift;
    const bottoms = [];
    for (let level = 0; level <= maxLift; level += 1) bottoms.push(request.bottom - level * (request.height + gap));
    for (const bottom of request.fallbackBottoms ?? []) if (Number.isFinite(bottom)) bottoms.push(bottom);
    let chosen = null;
    for (const bottom of bottoms) {
      if (chosen) break;
      for (const short of variants) {
        const box = candidateBox(request, short ? request.shortWidth : request.width, bottom, bounds);
        if (!box || placed.some((other) => blocks(other, request) && labelBoxesOverlap(other, box, gap))) continue;
        chosen = { ...box, short, lift: request.bottom - box.bottom };
        break;
      }
    }
    if (chosen) {
      placed.push(chosen);
      labels[index] = Object.freeze({ id: request.id, hidden: false, ...chosen });
    } else {
      labels[index] = Object.freeze({ id: request.id, hidden: true, short: false, lift: 0, left: 0, top: 0, right: 0, bottom: 0 });
    }
  }
  const visible = labels.filter((label) => !label.hidden);
  return Object.freeze({
    labels: Object.freeze(labels),
    summary: Object.freeze({
      placed: visible.length,
      shortened: visible.filter((label) => label.short).length,
      moved: visible.filter((label) => label.lift !== 0).length,
      hidden: labels.length - visible.length,
    }),
  });
}
