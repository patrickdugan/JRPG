export const COMPACT_DASH_TAP_WINDOW_MS = 220;

function result(overrides = {}) {
  return {
    handled: true,
    held: {},
    edge: null,
    tap: null,
    ...overrides,
  };
}

export function resolveCompactActionKeyDown({
  key = '',
  repeat = false,
  held = {},
  grounded = true,
  lastDirectionTapAt = {},
  nowMs = 0,
} = {}) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'arrowleft' || normalizedKey === 'arrowright') {
    const direction = normalizedKey === 'arrowleft' ? 'left' : 'right';
    const previousTapAt = lastDirectionTapAt[direction];
    const isDashTap = !repeat
      && Number.isFinite(previousTapAt)
      && nowMs >= previousTapAt
      && nowMs - previousTapAt <= COMPACT_DASH_TAP_WINDOW_MS;
    return result({
      held: { [direction]: true },
      edge: isDashTap ? { type: 'maneuver', id: 'dash' } : null,
      tap: repeat ? null : { direction, at: nowMs },
    });
  }

  if (normalizedKey === 'arrowup') return result({ held: { up: true } });
  if (normalizedKey === 'arrowdown') return result({ held: { down: true } });

  if (normalizedKey === ' ') {
    if (repeat) return result();
    if (held.down) return result({ edge: { type: 'maneuver', id: 'slide' } });
    return result({ held: { jump: true }, edge: { type: 'jump' } });
  }

  if (normalizedKey === 'z') {
    if (repeat) return result();
    if (held.up) return result({ edge: { type: 'maneuver', id: 'uppercut' } });
    if (held.down) {
      return result({
        edge: { type: 'maneuver', id: grounded ? 'slide' : 'thunder-kick' },
      });
    }
    return result({ edge: { type: 'attack', index: 0 } });
  }

  if (normalizedKey === 'x') {
    if (repeat) return result();
    if (held.up) return result({ edge: { type: 'subweapon', id: 'throwing-cross' } });
    if (held.down) return result({ edge: { type: 'subweapon', id: 'holy-water' } });
    return result({ edge: { type: 'attack', index: 1 } });
  }

  return { handled: false, held: {}, edge: null, tap: null };
}

export function resolveCompactActionKeyUp(key = '') {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === 'arrowleft') return result({ held: { left: false } });
  if (normalizedKey === 'arrowright') return result({ held: { right: false } });
  if (normalizedKey === 'arrowup') return result({ held: { up: false } });
  if (normalizedKey === 'arrowdown') return result({ held: { down: false } });
  if (normalizedKey === ' ') return result({ held: { jump: false } });
  return { handled: false, held: {}, edge: null, tap: null };
}
