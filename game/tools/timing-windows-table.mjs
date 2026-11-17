/**
 * Per-encounter enemy timing table for doc 43 (timing-windows pass).
 *
 * "Before" re-derives the pre-pass adapter at a9b7add: every enemy wind-up was
 * 180 + 40 (telegraph) + 60 (complex shape) + min(80, range × 20) ms, every
 * recovery 180 + 60 (complex) + 40 (not dodgeable) ms, and a primary boss's
 * shared cooldown had a 2,000 ms floor. "After" reads the live adapter. Shared
 * cooldowns are level-adjusted at the encounter's enemy level. "Next tell"
 * is the earliest a new wind-up can begin after an attack's active frame
 * (recovery plus the level-adjusted shared cooldown); "cycle" is one full
 * loop of that attack (wind-up, active, recovery, shared cooldown).
 *
 *   node tools/timing-windows-table.mjs            # Markdown tables
 *   node tools/timing-windows-table.mjs --json     # rows as JSON
 */

import { pathToFileURL } from 'node:url';

import { ACTION_FIXED_STEP_MS, levelAdjustedCooldownMs } from '../action-combat.mjs';
import {
  ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS,
  ACTION_ENEMY_TELL_TIERS,
  adaptActionEncounter,
} from '../action-encounter-adapter.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

export const LEGACY_BOSS_SHARED_COOLDOWN_FLOOR_MS = 2_000;
const LEGACY_COMPLEX_SHAPES = new Set(['cross', 'ring', 'markedTiles', 'laneEndpoint']);

function roundToStep(milliseconds) {
  return Math.max(ACTION_FIXED_STEP_MS, Math.round(milliseconds / ACTION_FIXED_STEP_MS) * ACTION_FIXED_STEP_MS);
}

/** The pre-pass (a9b7add) enemy attack timing, kept only for comparison. */
export function legacyEnemyAttackTiming(skill) {
  const range = Math.max(0, Number(skill.range) || 0);
  const complex = LEGACY_COMPLEX_SHAPES.has(skill.shape?.type ?? 'front');
  return {
    windupMs: roundToStep(180 + (skill.telegraph ? 40 : 0) + (complex ? 60 : 0) + Math.min(80, range * 20)),
    activeMs: roundToStep(skill.delivery === 'arcane' || range > 1 ? 100 : 80),
    recoveryMs: roundToStep(180 + (complex ? 60 : 0) + (skill.dodgeable === false ? 40 : 0)),
  };
}

function sourceTemplate(templateId) {
  for (const encounter of ENCOUNTERS) {
    const template = encounter.enemies.find(({ id }) => id === templateId);
    if (template) return template;
  }
  return null;
}

/** One row per enemy skill per encounter, in canonical encounter order. */
export function buildTimingWindowsRows() {
  const rows = [];
  for (const encounter of ENCOUNTERS) {
    if (encounter.format === 'noncombat-resolution') continue;
    const spec = adaptActionEncounter(encounter.id);
    const actorsByTemplate = new Map();
    for (const profile of [...spec.profiles.enemies, ...spec.profiles.summons]) {
      const actorId = profile.instanceIds[0] ?? profile.dormantInstanceIds[0];
      actorsByTemplate.set(profile.templateId, {
        profile,
        actor: spec.kernelConfig.actors.find(({ id }) => id === actorId),
      });
    }
    for (const entry of spec.attackManifest) {
      if (entry.sourceKind !== 'enemy' || entry.sourceVariant) continue;
      const { profile, actor } = actorsByTemplate.get(entry.ownerTemplateId);
      const template = encounter.enemies.find(({ id }) => id === entry.ownerTemplateId)
        ?? sourceTemplate(entry.ownerTemplateId);
      const skill = template.skills.find(({ id }) => id === entry.sourceSkillId);
      const before = legacyEnemyAttackTiming(skill);
      const after = spec.kernelConfig.attacks[entry.adapterAttackId];
      const primaryBoss = profile.tellTier === 'boss';
      const sharedAfterMs = actor.offensiveCooldownMs;
      const sharedBeforeMs = primaryBoss
        ? Math.max(LEGACY_BOSS_SHARED_COOLDOWN_FLOOR_MS, sharedAfterMs)
        : sharedAfterMs;
      const level = actor.level;
      rows.push(Object.freeze({
        encounterId: encounter.id,
        encounterName: encounter.name,
        templateId: entry.ownerTemplateId,
        enemyName: template.name,
        tier: profile.tellTier,
        skillId: skill.id,
        skillName: skill.name,
        tellClass: entry.tellClass,
        dodgeable: skill.dodgeable !== false,
        recoveryPulses: entry.sourceRecoveryPulses,
        poiseMax: actor.poise?.max ?? 0,
        level,
        before: Object.freeze({
          ...before,
          sharedCooldownMs: levelAdjustedCooldownMs(sharedBeforeMs, level),
          nextTellMs: before.recoveryMs + levelAdjustedCooldownMs(sharedBeforeMs, level),
          cycleMs: before.windupMs + before.activeMs + before.recoveryMs + levelAdjustedCooldownMs(sharedBeforeMs, level),
          tellPoiseBonus: 0,
        }),
        after: Object.freeze({
          windupMs: after.windupMs,
          activeMs: after.activeMs,
          recoveryMs: after.recoveryMs,
          sharedCooldownMs: levelAdjustedCooldownMs(sharedAfterMs, level),
          nextTellMs: after.recoveryMs + levelAdjustedCooldownMs(sharedAfterMs, level),
          cycleMs: after.windupMs + after.activeMs + after.recoveryMs + levelAdjustedCooldownMs(sharedAfterMs, level),
          tellPoiseBonus: after.tellPoiseBonus,
        }),
      }));
    }
  }
  return Object.freeze(rows);
}

function arrow(before, after) {
  return before === after ? `${after}` : `${before} → ${after}`;
}

export function renderTimingWindowsMarkdown(rows = buildTimingWindowsRows()) {
  const lines = [];
  lines.push('| Tell class | Wind-up ms (before → after) | Recovery ms (before → after) | Tell poise bonus |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const tellClass of Object.keys(ACTION_ENEMY_TELL_TIERS)) {
    const members = rows.filter((row) => row.tellClass === tellClass);
    if (!members.length) continue;
    const range = (values) => {
      const low = Math.min(...values);
      const high = Math.max(...values);
      return low === high ? `${low}` : `${low}–${high}`;
    };
    lines.push(`| ${tellClass} (${members.length}) | ${range(members.map((row) => row.before.windupMs))} → ${range(members.map((row) => row.after.windupMs))} | ${range(members.map((row) => row.before.recoveryMs))} → ${range(members.map((row) => row.after.recoveryMs))} | ${range(members.map((row) => row.after.tellPoiseBonus))} |`);
  }
  lines.push('');
  lines.push(`Primary-boss shared cooldown floor: ${LEGACY_BOSS_SHARED_COOLDOWN_FLOOR_MS} → ${ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS} ms before level scaling.`);
  lines.push('');
  lines.push('| Encounter | Enemy (tier, level) | Attack (class) | Wind-up ms | Active ms | Recovery ms | Next tell ≥ ms | Cycle ms | Tell poise bonus |');
  lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of rows) {
    const bonus = row.poiseMax > 0 ? arrow(row.before.tellPoiseBonus, row.after.tellPoiseBonus) : 'no poise';
    lines.push(`| ${row.encounterName} | ${row.enemyName} (${row.tier}, L${row.level}) | ${row.skillName} (${row.tellClass}${row.dodgeable ? '' : ', not dodgeable'}) | ${arrow(row.before.windupMs, row.after.windupMs)} | ${arrow(row.before.activeMs, row.after.activeMs)} | ${arrow(row.before.recoveryMs, row.after.recoveryMs)} | ${arrow(row.before.nextTellMs, row.after.nextTellMs)} | ${arrow(row.before.cycleMs, row.after.cycleMs)} | ${bonus} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = buildTimingWindowsRows();
  process.stdout.write(process.argv.includes('--json')
    ? `${JSON.stringify(rows, null, 2)}\n`
    : renderTimingWindowsMarkdown(rows));
}
