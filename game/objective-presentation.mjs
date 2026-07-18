import { isBlocked, isInBounds, parseTileKey, tileKey } from './content/levels.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[-_:]/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

const ACTION_PRESENTATION = deepFreeze({
  exit: { verb: 'Reach', noun: 'River Exit', buttonLabel: 'Use Exit', marker: 'gate', color: '#77d7cf', hint: 'Move onto the marked exit space, then commit the route.' },
  escortToken: { verb: 'Escort', noun: 'Witness', buttonLabel: 'Escort Witness', marker: 'chevron', color: '#f1d386', hint: 'Advance the witness route while the party holds a safe lane.' },
  protect: { verb: 'Secure', noun: 'Protected Target', buttonLabel: 'Secure Target', marker: 'shield', color: '#82c8ef', hint: 'Commit one activation to secure the named civilian or evidence object.' },
  clearAnchor: { verb: 'Clear', noun: 'Fog Anchor', buttonLabel: 'Clear Anchor', marker: 'anchor', color: '#a8e0e8', hint: 'Dispel one marked fog anchor to open the lantern route.' },
  releaseTarget: { verb: 'Return Name To', noun: 'Bound Target', buttonLabel: 'Return Name', marker: 'release', color: '#f0e0ad', hint: 'Return the recorded name; defeating the bound target is not the intended resolution.' },
  breakObject: { verb: 'Break', noun: 'Bell Node', buttonLabel: 'Break Node', marker: 'node', color: '#e27d68', hint: 'Commit to the marked seal or node while managing the resulting Recovery.' },
  disableOrders: { verb: 'Disable', noun: 'Command Orders', buttonLabel: 'Disable Orders', marker: 'orders', color: '#e9b46d', hint: 'Interrupt the command ledger so protected evidence can leave.' },
  returnItem: { verb: 'Return', noun: 'Name Slip', buttonLabel: 'Return Name Slip', marker: 'water', color: '#75cbe8', hint: 'Carry the name slip to either marked flowing-water space.' },
  extract: { verb: 'Extract', noun: 'Prisoner', buttonLabel: 'Extract Prisoner', marker: 'chain', color: '#f0c77d', hint: 'Break one marked chain and move that prisoner into the escape route.' },
  activateRelay: { verb: 'Light', noun: 'Lantern Relay', buttonLabel: 'Light Relay', marker: 'lantern', color: '#f5d06f', hint: 'Stabilize one lantern relay before committing to the court formation.' },
  releaseGarrison: { verb: 'Release', noun: 'Ashen Garrison', buttonLabel: 'Release Garrison', marker: 'release', color: '#d9d0b5', hint: 'Turn the ash lanes safe, then release the garrison from its court order.' },
  evacuate: { verb: 'Evacuate', noun: 'Archive Evidence', buttonLabel: 'Evacuate Evidence', marker: 'gate', color: '#8ad6c4', hint: 'Secure the surviving evidence and commit the evacuation route.' },
  interact: { verb: 'Open', noun: 'Memorial Record', buttonLabel: 'Record Testimony', marker: 'record', color: '#d8c9a0', hint: 'Complete the next named memorial or archive interaction.' },
});

const DEFAULT_PRESENTATION = deepFreeze({
  verb: 'Advance', noun: 'Objective', buttonLabel: 'Advance Objective', marker: 'objective', color: '#d0b36b',
  hint: 'Commit one activation to the next explicit encounter requirement.',
});

const ACTION_TERMS = deepFreeze({
  escortToken: ['witness', 'boat', 'escort'],
  clearAnchor: ['anchor'],
  disableOrders: ['order', 'ledger'],
  releaseGarrison: ['garrison', 'release'],
  breakObject: ['node', 'seal', 'ward'],
  evacuate: ['exit', 'evidence'],
});

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getObjectiveActionPresentation(requirementOrAction) {
  const action = typeof requirementOrAction === 'string' ? requirementOrAction : requirementOrAction?.action;
  const targetId = typeof requirementOrAction === 'object' ? requirementOrAction?.targetId : null;
  const base = ACTION_PRESENTATION[action] ?? DEFAULT_PRESENTATION;
  const targetName = targetId ? titleCase(targetId) : base.noun;
  return deepFreeze({
    ...base,
    action: action ?? 'objective',
    targetName,
    label: `${base.verb} ${targetName}`,
    buttonLabel: targetId ? `${base.verb} ${targetName}` : base.buttonLabel,
  });
}

function openCells(level, occupied) {
  const cells = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = tileKey(x, y);
      if (!isBlocked(level, x, y) && !occupied.has(key)) cells.push(key);
    }
  }
  return cells;
}

function matchingInteractables(level, requirement) {
  const interactables = level.interactables ?? [];
  if (requirement.targetId) {
    const exact = interactables.find((entry) => entry.id === requirement.targetId);
    if (exact) return [exact.at];
  }
  const terms = ACTION_TERMS[requirement.action] ?? [];
  return interactables
    .filter((entry) => terms.some((term) => `${entry.id} ${entry.action ?? ''}`.includes(term)))
    .map((entry) => entry.at);
}

export function getObjectiveTokenPlacements(level, requirements = [], occupiedKeys = []) {
  const occupied = new Set(occupiedKeys);
  const used = new Set();
  const fallbackCells = openCells(level, occupied);
  const placements = [];

  for (const requirement of requirements.filter((entry) => !entry.automatic)) {
    const presentation = getObjectiveActionPresentation(requirement);
    const wanted = Math.max(1, Number.isSafeInteger(requirement.count) ? requirement.count : 1);
    let candidates = [];
    if (requirement.tile) candidates = [requirement.tile];
    else if (requirement.tiles?.length) candidates = [...requirement.tiles];
    else candidates = matchingInteractables(level, requirement);

    const placementCount = requirement.tiles?.length ? requirement.tiles.length : wanted;
    const hasAuthoritativePosition = candidates.length > 0;
    for (let index = 0; index < placementCount; index += 1) {
      let at = candidates[index] ?? candidates.find((key) => !used.has(key));
      if (!at || used.has(at) || (!hasAuthoritativePosition && occupied.has(at))) {
        const available = fallbackCells.filter((key) => !used.has(key));
        at = available.length
          ? available[stableHash(`${requirement.key}:${index}`) % available.length]
          : fallbackCells[0];
      }
      if (!at) continue;
      const position = parseTileKey(at);
      if (!position || !isInBounds(level, position.x, position.y) || isBlocked(level, position.x, position.y)) continue;
      used.add(at);
      placements.push({
        requirementKey: requirement.key,
        action: requirement.action,
        targetId: requirement.targetId ?? null,
        at,
        x: position.x,
        y: position.y,
        index,
        alternative: Boolean(requirement.tiles?.length > 1),
        complete: requirement.complete || index < (requirement.progress ?? 0),
        presentation,
      });
    }
  }
  return deepFreeze(placements);
}

export function formatObjectiveRequirement(requirement) {
  const presentation = getObjectiveActionPresentation(requirement);
  return `${requirement.complete ? 'Complete' : presentation.label} ${requirement.progress}/${requirement.count}`;
}
