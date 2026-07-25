import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildExtrapolationQueue,
  extractMarkdownHeadings,
  inferArtifactKinds,
  renderMermaid,
  validateDag,
  verifyProject,
} from "../src/core.mjs";

const POLICIES = {
  requireTemplateAnchors: true,
  requireDependencyProvenance: true,
  maximumArtifactsPerNode: 8,
  allowedArtifactExtensions: [".md", ".json", ".mjs", ".png"],
};

function node(id, anchor, dependsOn = [], contract = { minimumArtifacts: 1 }) {
  return {
    id,
    label: id,
    kind: "document",
    templateAnchor: anchor,
    dependsOn,
    required: true,
    contract,
    extrapolation: { objective: `Create ${id}.`, output: `${id}.md`, sections: ["Intent"] },
  };
}

function fixtureDag() {
  return {
    schemaVersion: 2,
    kind: "jrpg-template-extrapolation-dag",
    id: "fixture",
    nodes: [
      node("source", "Template", [], { minimumArtifacts: 1, minimumWords: 3 }),
      node("vision", "Vision", ["source"], { minimumArtifacts: 1, requiredTermGroups: [["hook"]] }),
      node("slice", "First Playable", ["vision"], { minimumArtifacts: 1 }),
      { ...node("teaser", "Teaser", ["source"]), required: false },
    ],
  };
}

const TEMPLATE = "# Template\n\n## Vision\n\n## First Playable\n\n## Teaser\n";

async function withFixture(files, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "jrpg-verifier-v2-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      await writeFile(path.join(root, relativePath), content, "utf8");
    }
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("extracts normalized template headings with line provenance", () => {
  const headings = extractMarkdownHeadings("# Root\ntext\n### **Battle Mechanics** #\n");
  assert.deepEqual(headings.map(({ depth, normalized, line }) => ({ depth, normalized, line })), [
    { depth: 1, normalized: "root", line: 1 },
    { depth: 3, normalized: "battle mechanics", line: 3 },
  ]);
});

test("validates anchors and rejects cycles", () => {
  const valid = validateDag(fixtureDag(), TEMPLATE, POLICIES);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.order, ["source", "vision", "teaser", "slice"]);

  const broken = fixtureDag();
  broken.nodes.find((entry) => entry.id === "source").dependsOn = ["slice"];
  broken.nodes.find((entry) => entry.id === "vision").templateAnchor = "Missing Section";
  const result = validateDag(broken, TEMPLATE, POLICIES);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === "dag.cycle"));
  assert.ok(result.errors.some((entry) => entry.code === "node.anchor-unresolved"));
});

test("verifies evidence, blocks descendants, and produces an ordered queue", async () => {
  await withFixture(
    {
      "template.md": "Template source has enough words.",
      "vision.md": "A premise without the required keyword.",
      "slice.md": "Playable slice evidence.",
      "project.json": "{}",
    },
    async (root) => {
      const project = {
        schemaVersion: 2,
        kind: "jrpg-verifier-project",
        id: "fixture-project",
        title: "Fixture Project",
        root: ".",
        nodeEvidence: {
          source: { declaredStatus: "ready", sources: [], artifacts: ["template.md"] },
          vision: { declaredStatus: "ready", sources: "dependencies", artifacts: ["vision.md"] },
          slice: { declaredStatus: "ready", sources: ["vision"], artifacts: ["slice.md"] },
          teaser: { declaredStatus: "planned", sources: "dependencies", artifacts: [] },
        },
      };
      const report = await verifyProject({
        env: { id: "fixture-env", policies: POLICIES },
        dag: fixtureDag(),
        project,
        envDirectory: root,
        projectFile: path.join(root, "project.json"),
        templateText: TEMPLATE,
      });
      assert.equal(report.structurallyValid, true);
      assert.equal(report.ok, false);
      assert.equal(report.nodes.find((entry) => entry.id === "source").status, "verified");
      assert.equal(report.nodes.find((entry) => entry.id === "vision").status, "invalid");
      assert.equal(report.nodes.find((entry) => entry.id === "slice").status, "blocked");
      assert.deepEqual(report.nodes.find((entry) => entry.id === "slice").blockedBy, ["vision"]);
      assert.equal(report.nodes.find((entry) => entry.id === "teaser").status, "optional-missing");
      assert.match(report.nodes[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);

      const queue = buildExtrapolationQueue(report);
      assert.deepEqual(queue.tasks.map((entry) => entry.nodeId), ["vision", "teaser", "slice"]);
      assert.equal(queue.tasks.find((entry) => entry.nodeId === "slice").priority, "blocked");
      assert.ok(queue.tasks.find((entry) => entry.nodeId === "slice").upstreamArtifacts.length > 0);
    },
  );
});

test("fails closed on missing dependency provenance and path escape", async () => {
  await withFixture(
    { "template.md": "Template source has enough words.", "project.json": "{}" },
    async (root) => {
      const project = {
        schemaVersion: 2,
        kind: "jrpg-verifier-project",
        id: "unsafe-project",
        root: ".",
        nodeEvidence: {
          source: { declaredStatus: "ready", sources: [], artifacts: ["template.md"] },
          vision: { declaredStatus: "ready", artifacts: ["../outside.md"] },
          slice: { declaredStatus: "planned", sources: "dependencies", artifacts: [] },
          teaser: { declaredStatus: "not-applicable", sources: "dependencies", artifacts: [] },
        },
      };
      const report = await verifyProject({
        env: { id: "fixture-env", policies: POLICIES },
        dag: fixtureDag(),
        project,
        envDirectory: root,
        projectFile: path.join(root, "project.json"),
        templateText: TEMPLATE,
      });
      const vision = report.nodes.find((entry) => entry.id === "vision");
      assert.equal(vision.status, "invalid");
      assert.ok(vision.directErrors.some((entry) => entry.code === "evidence.provenance"));
      assert.ok(vision.directErrors.some((entry) => entry.code === "artifact.escape"));
    },
  );
});

test("infers multi-role test evidence and renders every DAG edge", () => {
  assert.deepEqual(inferArtifactKinds("game/tests/combat.test.mjs").sort(), ["source", "test"]);
  assert.deepEqual(inferArtifactKinds("assets/keyframe.png"), ["image"]);
  const mermaid = renderMermaid(fixtureDag());
  assert.match(mermaid, /^flowchart TD/m);
  assert.match(mermaid, /n_source --> n_vision/);
  assert.match(mermaid, /n_vision --> n_slice/);
});
