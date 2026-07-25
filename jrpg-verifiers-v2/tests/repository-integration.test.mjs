import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadJson, verifyProject } from "../src/core.mjs";

const ENVIRONMENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the current JRPG adapter remains structurally valid and honest about open gates", async () => {
  const envPath = path.join(ENVIRONMENT_ROOT, "env.json");
  const env = await loadJson(envPath);
  const dag = await loadJson(path.resolve(ENVIRONMENT_ROOT, env.dag));
  const projectFile = path.resolve(ENVIRONMENT_ROOT, env.defaultProject);
  const project = await loadJson(projectFile);
  const templateText = await readFile(path.resolve(ENVIRONMENT_ROOT, env.template), "utf8");

  const report = await verifyProject({
    env,
    dag,
    project,
    envDirectory: ENVIRONMENT_ROOT,
    projectFile,
    templateText,
  });

  assert.equal(report.structurallyValid, true);
  assert.equal(report.nodes.length, 32);
  assert.equal(report.counts.verified, 28);
  assert.equal(report.counts["optional-missing"], 1);
  assert.equal(report.counts.partial, 3);
  assert.deepEqual(report.requiredIncomplete, ["production.staffing", "qa.final-playtests", "qa.release-readiness"]);
  assert.equal(report.nodes.find((node) => node.id === "presentation.video-teaser").status, "optional-missing");
  assert.deepEqual(report.nodes.find((node) => node.id === "qa.release-readiness").blockedBy, ["qa.final-playtests", "production.staffing"]);
});

test("all shipped JSON manifests and schemas parse", async () => {
  const files = [
    "env.json",
    "dag.json",
    "projects/bells-black-chrysanthemum.json",
    "schemas/environment.schema.json",
    "schemas/dag.schema.json",
    "schemas/project.schema.json",
  ];
  await Promise.all(files.map((file) => loadJson(path.join(ENVIRONMENT_ROOT, file))));
  assert.ok(true);
});
