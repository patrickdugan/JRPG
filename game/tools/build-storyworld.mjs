#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STORYWORLD_CHARACTER_ID,
  STORYWORLD_CLUSTERS,
  STORYWORLD_IFID,
  STORYWORLD_PROPERTIES,
  STORYWORLD_SOURCE_VERSION,
  STORYWORLD_ACT_INTEGRATION,
} from '../../storyworlds/bells-black-chrysanthemum.source.mjs';
import { getNarrativeRouteSchedules } from '../campaign-route-scheduler.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUTPUTS = Object.freeze({
  storyworld: path.join(ROOT, 'storyworlds', 'bells-black-chrysanthemum.storyworld.json'),
  bindings: path.join(ROOT, 'storyworlds', 'bells-black-chrysanthemum.bindings.json'),
  runtime: path.join(ROOT, 'game', 'content', 'storyworld-encounters.generated.mjs'),
});
const CREATED_AT = 1_784_577_000;

function stringConstant(value) {
  return { pointer_type: 'String Constant', script_element_type: 'Pointer', value };
}

function numberConstant(value) {
  return { pointer_type: 'Bounded Number Constant', script_element_type: 'Pointer', value };
}

function propertyPointer(propertyId, coefficient = 1) {
  return {
    pointer_type: 'Bounded Number Pointer',
    script_element_type: 'Pointer',
    character: STORYWORLD_CHARACTER_ID,
    keyring: [propertyId],
    coefficient,
  };
}

function operator(operatorType, operands, operatorSubtype = undefined) {
  return {
    operator_type: operatorType,
    ...(operatorSubtype ? { operator_subtype: operatorSubtype } : {}),
    script_element_type: 'Operator',
    operands,
  };
}

function reactionDesirability(propertyId, invert, authored = undefined) {
  const profile = authored ?? {
    offset: 0.01,
    terms: [{ propertyId, coefficient: 1, invert }],
  };
  const operands = [numberConstant(profile.offset)];
  for (const term of profile.terms) {
    operands.push(term.invert
      ? operator('Addition', [
        numberConstant(term.coefficient),
        propertyPointer(term.propertyId, -term.coefficient),
      ])
      : propertyPointer(term.propertyId, term.coefficient));
  }
  return operator('Addition', operands);
}

function effect(propertyId, delta) {
  return {
    effect_type: 'Bounded Number Effect',
    Set: propertyPointer(propertyId),
    to: operator('Nudge', [propertyPointer(propertyId), numberConstant(delta)]),
  };
}

function afterEffects(effects) {
  return Object.entries(effects).map(([propertyId, delta]) => effect(propertyId, delta));
}

function mergeEffects(...sources) {
  const merged = {};
  for (const source of sources) {
    for (const [propertyId, delta] of Object.entries(source ?? {})) {
      merged[propertyId] = Math.max(-0.1, Math.min(0.1, (merged[propertyId] ?? 0) + delta));
    }
  }
  return merged;
}

function outcomeBranches(cluster) {
  return Object.freeze(['accord', 'revision', ...(cluster.thirdOutcome ? ['negotiated'] : [])]);
}

function clusterNodeIds(index, cluster = STORYWORLD_CLUSTERS[index]) {
  const prefix = `page_sw${String(index + 1).padStart(2, '0')}`;
  const ids = {
    entry: index === 0 ? 'page_0000' : `${prefix}_decision`,
    accord: index === STORYWORLD_CLUSTERS.length - 1 ? 'page_end_corrections_visible' : `${prefix}_accord`,
    revision: index === STORYWORLD_CLUSTERS.length - 1 ? 'page_end_limits_posted' : `${prefix}_revision`,
  };
  if (cluster.thirdOutcome) ids.negotiated = `${prefix}_negotiated`;
  return Object.freeze(ids);
}

function spoolIdForCluster(cluster, index) {
  if (cluster.spoolId) return cluster.spoolId;
  if (index < 2) return 'spool_act1';
  const integration = STORYWORLD_ACT_INTEGRATION[cluster.id];
  if (integration?.actId === 'act-iii') return 'spool_act3';
  if (integration?.actId === 'act-iv') return 'spool_act4';
  if (cluster.id !== 'sw10-corrections-desk' && integration?.actId === 'act-v') return 'spool_act5';
  return 'spool_endings';
}

function buildReaction({
  id,
  text,
  propertyId,
  invert,
  consequenceId,
  effects,
  desirability,
}) {
  return {
    id,
    text_script: stringConstant(text),
    consequence_id: consequenceId,
    desirability_script: reactionDesirability(propertyId, invert, desirability),
    after_effects: afterEffects(effects),
  };
}

function buildEntryEncounter(cluster, index, ids, creationIndex) {
  return {
    id: ids.entry,
    title: cluster.title,
    text_script: stringConstant(cluster.text),
    acceptability_script: true,
    desirability_script: propertyPointer(cluster.options[0].gateProperty),
    earliest_turn: index * 2,
    latest_turn: index * 2,
    creation_index: creationIndex,
    creation_time: CREATED_AT,
    modified_time: CREATED_AT,
    graph_position_x: index * 440,
    graph_position_y: 0,
    connected_spools: [spoolIdForCluster(cluster, index)],
    options: cluster.options.map((sourceOption, optionIndex) => {
      const optionId = `${ids.entry}_opt_${sourceOption.id}`;
      return {
        id: optionId,
        text_script: stringConstant(sourceOption.text),
        visibility_script: true,
        performability_script: true,
        reactions: [
          buildReaction({
            id: `${optionId}_r_accord`,
            text: sourceOption.accord.text,
            propertyId: sourceOption.gateProperty,
            invert: false,
            consequenceId: ids[sourceOption.accord.outcomeKey ?? 'accord'],
            effects: mergeEffects(sourceOption.accord.effects, cluster.entryRouteEffects),
            desirability: sourceOption.accord.desirability,
          }),
          buildReaction({
            id: `${optionId}_r_revision`,
            text: sourceOption.revision.text,
            propertyId: sourceOption.gateProperty,
            invert: true,
            consequenceId: ids[sourceOption.revision.outcomeKey ?? 'revision'],
            effects: mergeEffects(sourceOption.revision.effects, cluster.entryRouteEffects),
            desirability: sourceOption.revision.desirability,
          }),
        ],
        benchmark_tags: [`slot:${cluster.id}`, `option:${optionIndex + 1}`],
      };
    }),
  };
}

function buildOutcomeEncounter(cluster, index, ids, branch, nextEntryId, creationIndex, branchIndex) {
  const source = branch === 'accord'
    ? cluster.accordOutcome
    : branch === 'revision'
      ? cluster.revisionOutcome
      : cluster.thirdOutcome;
  const encounterId = ids[branch];
  const terminal = index === STORYWORLD_CLUSTERS.length - 1;
  const optionId = `${encounterId}_opt_carry`;
  return {
    id: encounterId,
    title: source.title,
    text_script: stringConstant(source.text),
    prompt_script: stringConstant(source.prompt),
    acceptability_script: true,
    desirability_script: propertyPointer(source.gateProperty),
    earliest_turn: index * 2 + 1,
    latest_turn: index * 2 + 1,
    creation_index: creationIndex,
    creation_time: CREATED_AT,
    modified_time: CREATED_AT,
    graph_position_x: index * 440 + 220,
    graph_position_y: [-220, 220, 0][branchIndex] ?? branchIndex * 180,
    connected_spools: [spoolIdForCluster(cluster, index)],
    options: terminal ? [] : [{
      id: optionId,
      text_script: stringConstant(source.prompt),
      visibility_script: true,
      performability_script: true,
      reactions: [
        buildReaction({
          id: `${optionId}_r_accord`,
          text: source.accord.text,
          propertyId: source.gateProperty,
          invert: false,
          consequenceId: nextEntryId,
          effects: mergeEffects(source.accord.effects, cluster.outcomeRouteEffects),
        }),
        buildReaction({
          id: `${optionId}_r_revision`,
          text: source.revision.text,
          propertyId: source.gateProperty,
          invert: true,
          consequenceId: nextEntryId,
          effects: mergeEffects(source.revision.effects, cluster.outcomeRouteEffects),
        }),
      ],
      benchmark_tags: [`slot:${cluster.id}`, `outcome:${branch}`],
    }],
  };
}

function buildStoryworld() {
  const nodeIds = STORYWORLD_CLUSTERS.map((cluster, index) => clusterNodeIds(index, cluster));
  const encounters = [];
  let creationIndex = 0;
  for (const [index, cluster] of STORYWORLD_CLUSTERS.entries()) {
    const ids = nodeIds[index];
    const nextEntryId = nodeIds[index + 1]?.entry ?? '';
    encounters.push(buildEntryEncounter(cluster, index, ids, creationIndex));
    creationIndex += 1;
    for (const [branchIndex, branch] of outcomeBranches(cluster).entries()) {
      encounters.push(buildOutcomeEncounter(
        cluster,
        index,
        ids,
        branch,
        nextEntryId,
        creationIndex,
        branchIndex,
      ));
      creationIndex += 1;
    }
  }

  const propertyDefaults = Object.fromEntries(STORYWORLD_PROPERTIES.map(({ id, defaultValue }) => [id, defaultValue]));
  const spools = [
    ['spool_act1', 'Acts I-II — Arrival, Witness, and Terms', true],
    ['spool_act3', 'Act III — The Three-Road War', false],
    ['spool_act4', 'Act IV — The Black Gate', false],
    ['spool_enma', 'The Cinder Fan — Death, Custody, or Compact', false],
    ['spool_act5', 'Act V — The Living Castle', false],
    ['spool_endings', 'The Last Command — Transfer or Civil War', false],
  ].map(([id, spoolName, startsActive], creationIndex) => ({
    id,
    spool_name: spoolName,
    starts_active: startsActive,
    creation_index: creationIndex,
    creation_time: CREATED_AT,
    modified_time: CREATED_AT,
    encounters: encounters
      .filter(({ connected_spools: connectedSpools }) => connectedSpools.includes(id))
      .map(({ id: encounterId }) => encounterId),
  }));

  return {
    IFID: STORYWORLD_IFID,
    storyworld_title: 'Bells of the Black Chrysanthemum — Reactions and Consequences',
    storyworld_author: 'Bells of the Black Chrysanthemum team',
    sweepweave_version: '0.1.9',
    creation_time: CREATED_AT,
    modified_time: CREATED_AT,
    debug_mode: false,
    display_mode: 'standard',
    css_theme: 'bells-black-chrysanthemum',
    font_size: 16,
    language: 'en',
    rating: 'Teen',
    about_text: 'Thirty-five reaction-driven interstitial scene nodes anchored to a sixty-scene authored JRPG catalog. A complete Salt or Ash route experiences ten decisions and consequences; Paper experiences eleven. The Act III war table and Lady Enma hearing each have three distinct outcomes.',
    characters: [{
      id: STORYWORLD_CHARACTER_ID,
      name: 'The Lantern Network',
      pronoun: 'they',
      bnumber_properties: propertyDefaults,
      creation_index: 0,
      creation_time: CREATED_AT,
      modified_time: CREATED_AT,
    }],
    authored_properties: STORYWORLD_PROPERTIES.map(({ id, label, defaultValue }, creationIndex) => ({
      id,
      property_name: id,
      property_label: label,
      property_type: 'bounded number',
      default_value: defaultValue,
      depth: id.startsWith('p_') ? 1 : 0,
      attribution_target: 'all cast members',
      affected_characters: [STORYWORLD_CHARACTER_ID],
      creation_index: creationIndex,
      creation_time: CREATED_AT,
      modified_time: CREATED_AT,
    })),
    spools,
    encounters,
    meta: {
      source_version: STORYWORLD_SOURCE_VERSION,
      canonical_scene_count: 60,
      storyworld_authored_scene_count: encounters.length,
      complete_run_storyworld_scene_count: STORYWORLD_CLUSTERS.length * 2,
      complete_run_total_scene_count: 60 + STORYWORLD_CLUSTERS.length * 2,
      reaction_tie_break: 'later-authored-wins',
    },
  };
}

function textValue(script) {
  return script?.value ?? '';
}

function compileEffect(sourceEffect) {
  return Object.freeze({
    propertyId: sourceEffect.Set.keyring[0],
    delta: sourceEffect.to.operands[1].value,
  });
}

function compileReaction(sourceReaction, index) {
  const [offsetOperand, ...scoreOperands] = sourceReaction.desirability_script.operands;
  const terms = scoreOperands.map((scoreOperand) => {
    if (scoreOperand.pointer_type === 'Bounded Number Pointer') {
      return {
        propertyId: scoreOperand.keyring[0],
        coefficient: scoreOperand.coefficient,
        invert: false,
      };
    }
    const [constant, pointer] = scoreOperand.operands;
    return {
      propertyId: pointer.keyring[0],
      coefficient: constant.value,
      invert: true,
    };
  });
  const score = terms.length === 1 && terms[0].coefficient === 1
    ? {
      propertyId: terms[0].propertyId,
      invert: terms[0].invert,
      offset: offsetOperand.value,
    }
    : {
      terms,
      offset: offsetOperand.value,
    };
  return {
    id: sourceReaction.id,
    text: textValue(sourceReaction.text_script),
    consequenceId: sourceReaction.consequence_id,
    score,
    effects: sourceReaction.after_effects.map(compileEffect),
    authoredIndex: index,
  };
}

function compileOption(sourceOption) {
  return {
    id: sourceOption.id,
    text: textValue(sourceOption.text_script),
    visible: sourceOption.visibility_script === true,
    performable: sourceOption.performability_script === true,
    reactions: sourceOption.reactions.map(compileReaction),
  };
}

function compileEncounter(sourceEncounter) {
  return {
    id: sourceEncounter.id,
    title: sourceEncounter.title,
    text: textValue(sourceEncounter.text_script),
    prompt: textValue(sourceEncounter.prompt_script),
    terminal: sourceEncounter.options.length === 0,
    options: sourceEncounter.options.map(compileOption),
  };
}

function buildBindings(storyworld) {
  const narrativeRoutes = getNarrativeRouteSchedules();
  return {
    schemaVersion: 1,
    campaignId: 'bells-black-chrysanthemum',
    sourceIFID: storyworld.IFID,
    authoredSceneCount: storyworld.encounters.length,
    clusters: STORYWORLD_CLUSTERS.map((cluster, index) => {
      const requiredOnRoutes = narrativeRoutes
        .filter(({ storyworldDecisionIds }) => storyworldDecisionIds.includes(cluster.id))
        .map(({ priorityTheater }) => priorityTheater);
      return {
        id: cluster.id,
        chapterId: cluster.chapterId,
        anchorBeatId: cluster.anchorBeatId,
        placement: cluster.placement,
        sequenceRole: cluster.sequenceRole,
        relatedEncounterIds: cluster.relatedEncounterIds,
        actIntegration: STORYWORLD_ACT_INTEGRATION[cluster.id] ?? null,
        requiredForNarrativeCredits: requiredOnRoutes.length === narrativeRoutes.length,
        requiredOnRoutes,
        entryEncounterId: clusterNodeIds(index, cluster).entry,
        outcomeKeys: outcomeBranches(cluster),
        outcomeEncounterIds: outcomeBranches(cluster).map((branch) => clusterNodeIds(index, cluster)[branch]),
      };
    }),
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function buildRuntime(storyworld, bindings, sourceHash, bindingHash) {
  const encounterById = new Map(storyworld.encounters.map((encounter) => [encounter.id, encounter]));
  const narrativeRouteMetrics = Object.fromEntries(getNarrativeRouteSchedules().map((schedule) => [
    schedule.priorityTheater,
    {
      canonicalSceneCount: schedule.playedCanonicalSceneCount,
      storyworldSceneCount: schedule.playedStoryworldSceneCount,
      playedSceneCount: schedule.playedSceneCount,
    },
  ]));
  const routeMetrics = Object.values(narrativeRouteMetrics);
  const compiled = {
    schemaVersion: 1,
    sourceVersion: STORYWORLD_SOURCE_VERSION,
    sourceIFID: storyworld.IFID,
    sourceHash: `sha256:${sourceHash}`,
    bindingHash: `sha256:${bindingHash}`,
    reactionTieBreak: 'later-authored-wins',
    properties: STORYWORLD_PROPERTIES,
    clusters: bindings.clusters.map((binding) => ({
      ...binding,
      entry: compileEncounter(encounterById.get(binding.entryEncounterId)),
      outcomes: binding.outcomeEncounterIds.map((encounterId, index) => ({
        ...compileEncounter(encounterById.get(encounterId)),
        resolutionKey: binding.outcomeKeys[index],
      })),
    })),
    metrics: {
      canonicalSceneCount: 60,
      storyworldAuthoredSceneCount: storyworld.encounters.length,
      authoredSceneCount: 60 + storyworld.encounters.length,
      narrativeRoutes: narrativeRouteMetrics,
      completeRunStoryworldSceneCountRange: {
        minimum: Math.min(...routeMetrics.map(({ storyworldSceneCount }) => storyworldSceneCount)),
        maximum: Math.max(...routeMetrics.map(({ storyworldSceneCount }) => storyworldSceneCount)),
      },
      completeRunSceneCountRange: {
        minimum: Math.min(...routeMetrics.map(({ playedSceneCount }) => playedSceneCount)),
        maximum: Math.max(...routeMetrics.map(({ playedSceneCount }) => playedSceneCount)),
      },
      clusterCount: STORYWORLD_CLUSTERS.length,
      entryOptionCount: STORYWORLD_CLUSTERS.reduce((sum, cluster) => sum + cluster.options.length, 0),
    },
  };
  const signature = `sha256:${sha256(JSON.stringify(compiled))}`;
  return `/** Generated by tools/build-storyworld.mjs. Do not edit by hand. */\n\n`
    + `const deepFreeze = (value) => {\n  if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n    Object.freeze(value);\n    for (const child of Object.values(value)) deepFreeze(child);\n  }\n  return value;\n};\n\n`
    + `export const STORYWORLD_CATALOG_SIGNATURE = ${JSON.stringify(signature)};\n`
    + `export const STORYWORLD_CATALOG = deepFreeze(${JSON.stringify(compiled, null, 2)});\n`
    + `export const STORYWORLD_PROPERTIES = STORYWORLD_CATALOG.properties;\n`
    + `export const STORYWORLD_CLUSTERS = STORYWORLD_CATALOG.clusters;\n`
    + `export const STORYWORLD_METRICS = STORYWORLD_CATALOG.metrics;\n`
    + `export const STORYWORLD_CLUSTER_BY_ID = new Map(STORYWORLD_CLUSTERS.map((cluster) => [cluster.id, cluster]));\n`
    + `export const STORYWORLD_CLUSTER_BY_ANCHOR_BEAT_ID = new Map(STORYWORLD_CLUSTERS.map((cluster) => [cluster.anchorBeatId, cluster]));\n`;
}

function assertPropertyReferences(storyworld) {
  const propertyIds = new Set(STORYWORLD_PROPERTIES.map(({ id }) => id));
  for (const encounter of storyworld.encounters) {
    for (const optionRecord of encounter.options) {
      for (const reactionRecord of optionRecord.reactions) {
        for (const effectRecord of reactionRecord.after_effects) {
          const propertyId = effectRecord.Set?.keyring?.[0];
          if (!propertyIds.has(propertyId)) throw new Error(`Unknown effect property ${propertyId}.`);
        }
      }
    }
  }
}

function buildOutputs() {
  const storyworld = buildStoryworld();
  assertPropertyReferences(storyworld);
  const storyworldText = stableJson(storyworld);
  const bindings = buildBindings(storyworld);
  const bindingsText = stableJson(bindings);
  const runtimeText = buildRuntime(storyworld, bindings, sha256(storyworldText), sha256(bindingsText));
  return new Map([
    [OUTPUTS.storyworld, storyworldText],
    [OUTPUTS.bindings, bindingsText],
    [OUTPUTS.runtime, runtimeText],
  ]);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const outputs = buildOutputs();
  const differences = [];
  for (const [outputPath, expected] of outputs) {
    if (checkOnly) {
      const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
      if (actual !== expected) differences.push(path.relative(ROOT, outputPath));
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, expected, 'utf8');
    process.stdout.write(`${path.relative(ROOT, outputPath)}\n`);
  }
  if (differences.length) {
    throw new Error(`Generated Storyworld artifacts are stale: ${differences.join(', ')}`);
  }
  if (checkOnly) process.stdout.write('Storyworld generated artifacts are current.\n');
}

main();
