import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".json", ".mjs", ".js", ".html", ".css", ".py", ".svg"]);
const SOURCE_EXTENSIONS = new Set([".mjs", ".js", ".html", ".css", ".py"]);

export async function loadJson(filePath) {
  const text = await readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export function normalizeHeading(value) {
  return String(value ?? "")
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+#+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function extractMarkdownHeadings(markdown) {
  const headings = [];
  for (const match of String(markdown).matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)) {
    headings.push({
      depth: match[1].length,
      text: match[2].replace(/\s+#+\s*$/, "").trim(),
      normalized: normalizeHeading(match[2]),
      line: String(markdown).slice(0, match.index).split("\n").length,
    });
  }
  return headings;
}

export function countWords(text) {
  return String(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

export function inferArtifactKinds(artifactPath) {
  const normalized = String(artifactPath).replaceAll("\\", "/");
  const extension = path.extname(normalized).toLocaleLowerCase("en-US");
  const kinds = new Set();

  if (extension === ".md") kinds.add("markdown");
  if (extension === ".json") kinds.add("data");
  if (SOURCE_EXTENSIONS.has(extension)) kinds.add("source");
  if ([".png", ".svg"].includes(extension)) kinds.add("image");
  if (/(^|\/)tests?\//i.test(normalized) || /(?:^|[.-])test\.(?:m?js|py)$/i.test(normalized)) {
    kinds.add("test");
  }
  return [...kinds];
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function topologicalOrder(nodes, errors) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const dependents = new Map(nodes.map((node) => [node.id, []]));

  for (const node of nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (!byId.has(dependency)) continue;
      indegree.set(node.id, indegree.get(node.id) + 1);
      dependents.get(dependency).push(node.id);
    }
  }

  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    for (const dependent of dependents.get(current)) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) queue.push(dependent);
    }
  }

  if (order.length !== nodes.length) {
    const cycleNodes = nodes.filter((node) => !order.includes(node.id)).map((node) => node.id);
    errors.push(issue("dag.cycle", `Dependency cycle detected among: ${cycleNodes.join(", ")}.`, { nodes: cycleNodes }));
  }
  return order;
}

export function validateDag(dag, templateText, policies = {}) {
  const errors = [];
  const warnings = [];
  const nodes = Array.isArray(dag?.nodes) ? dag.nodes : [];

  if (dag?.schemaVersion !== 2) errors.push(issue("dag.schema", "DAG schemaVersion must be 2."));
  if (dag?.kind !== "jrpg-template-extrapolation-dag") {
    errors.push(issue("dag.kind", "DAG kind must be jrpg-template-extrapolation-dag."));
  }
  if (!Array.isArray(dag?.nodes) || nodes.length === 0) {
    errors.push(issue("dag.nodes", "DAG must contain at least one node."));
  }

  const ids = new Set();
  for (const [index, node] of nodes.entries()) {
    if (!node?.id || typeof node.id !== "string") {
      errors.push(issue("node.id", `Node at index ${index} has no string id.`));
      continue;
    }
    if (ids.has(node.id)) errors.push(issue("node.duplicate", `Duplicate node id: ${node.id}.`, { nodeId: node.id }));
    ids.add(node.id);
    if (!Array.isArray(node.dependsOn)) {
      errors.push(issue("node.dependencies", `${node.id} must declare dependsOn as an array.`, { nodeId: node.id }));
    }
    if (!node.contract || typeof node.contract !== "object") {
      errors.push(issue("node.contract", `${node.id} has no verification contract.`, { nodeId: node.id }));
    }
    if (!node.extrapolation?.objective || !node.extrapolation?.output) {
      errors.push(issue("node.extrapolation", `${node.id} needs an extrapolation objective and output.`, { nodeId: node.id }));
    }
  }

  for (const node of nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (dependency === node.id) {
        errors.push(issue("node.self-dependency", `${node.id} depends on itself.`, { nodeId: node.id }));
      } else if (!ids.has(dependency)) {
        errors.push(issue("node.unknown-dependency", `${node.id} depends on unknown node ${dependency}.`, { nodeId: node.id, dependency }));
      }
    }
  }

  const headings = extractMarkdownHeadings(templateText);
  const headingMap = new Map(headings.map((heading) => [heading.normalized, heading]));
  for (const node of nodes) {
    if (!node.templateAnchor) {
      const target = policies.requireTemplateAnchors ? errors : warnings;
      target.push(issue("node.anchor-missing", `${node.id} has no template anchor.`, { nodeId: node.id }));
      continue;
    }
    if (!headingMap.has(normalizeHeading(node.templateAnchor))) {
      const target = policies.requireTemplateAnchors ? errors : warnings;
      target.push(issue("node.anchor-unresolved", `${node.id} anchor was not found in the source template: ${node.templateAnchor}.`, { nodeId: node.id }));
    }
  }

  const order = topologicalOrder(nodes, errors);
  return { ok: errors.length === 0, errors, warnings, order, headings };
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function artifactLabel(artifact) {
  return typeof artifact === "string" ? artifact : artifact?.path;
}

async function inspectArtifact(projectRoot, artifact, policies) {
  const declaredPath = artifactLabel(artifact);
  const result = {
    path: declaredPath ?? "",
    role: typeof artifact === "object" ? artifact.role ?? null : null,
    kinds: declaredPath ? inferArtifactKinds(declaredPath) : [],
    exists: false,
    bytes: 0,
    words: 0,
    sha256: null,
    text: "",
    errors: [],
  };
  if (!declaredPath || typeof declaredPath !== "string") {
    result.errors.push(issue("artifact.path", "Artifact has no path."));
    return result;
  }

  const absolutePath = path.resolve(projectRoot, declaredPath);
  if (!isWithinRoot(projectRoot, absolutePath)) {
    result.errors.push(issue("artifact.escape", `Artifact leaves the project root: ${declaredPath}.`, { artifact: declaredPath }));
    return result;
  }

  const extension = path.extname(absolutePath).toLocaleLowerCase("en-US");
  if (policies.allowedArtifactExtensions?.length && !policies.allowedArtifactExtensions.includes(extension)) {
    result.errors.push(issue("artifact.extension", `Artifact extension is not allowed: ${declaredPath}.`, { artifact: declaredPath }));
  }

  try {
    const metadata = await stat(absolutePath);
    if (!metadata.isFile()) {
      result.errors.push(issue("artifact.not-file", `Artifact is not a file: ${declaredPath}.`, { artifact: declaredPath }));
      return result;
    }
    result.exists = true;
    result.bytes = metadata.size;
    const data = await readFile(absolutePath);
    result.sha256 = createHash("sha256").update(data).digest("hex");
    if (TEXT_EXTENSIONS.has(extension)) {
      result.text = data.toString("utf8");
      result.words = countWords(result.text);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      result.errors.push(issue("artifact.missing", `Artifact does not exist: ${declaredPath}.`, { artifact: declaredPath }));
    } else {
      result.errors.push(issue("artifact.read", `Could not inspect ${declaredPath}: ${error.message}.`, { artifact: declaredPath }));
    }
  }
  return result;
}

function checkProvenance(node, evidence, policies) {
  if (!policies.requireDependencyProvenance || node.dependsOn.length === 0) return [];
  if (evidence?.sources === "dependencies") return [];
  if (!Array.isArray(evidence?.sources)) {
    return [issue("evidence.provenance", `${node.id} must cite its dependency evidence.`, { nodeId: node.id })];
  }
  const missing = node.dependsOn.filter((dependency) => !evidence.sources.includes(dependency));
  return missing.length
    ? [issue("evidence.provenance", `${node.id} does not cite dependencies: ${missing.join(", ")}.`, { nodeId: node.id, dependencies: missing })]
    : [];
}

function checkContract(node, inspectedArtifacts, policies) {
  const errors = inspectedArtifacts.flatMap((artifact) => artifact.errors);
  const contract = node.contract ?? {};
  const maximum = policies.maximumArtifactsPerNode ?? Number.POSITIVE_INFINITY;
  if (inspectedArtifacts.length > maximum) {
    errors.push(issue("contract.maximum-artifacts", `${node.id} declares ${inspectedArtifacts.length} artifacts; maximum is ${maximum}.`, { nodeId: node.id }));
  }
  if (inspectedArtifacts.length < (contract.minimumArtifacts ?? 0)) {
    errors.push(issue("contract.minimum-artifacts", `${node.id} needs at least ${contract.minimumArtifacts} artifact(s).`, { nodeId: node.id }));
  }
  const emptyArtifacts = inspectedArtifacts.filter((artifact) => artifact.exists && artifact.bytes === 0);
  for (const artifact of emptyArtifacts) {
    errors.push(issue("artifact.empty", `Artifact is empty: ${artifact.path}.`, { nodeId: node.id, artifact: artifact.path }));
  }

  const kinds = new Set(inspectedArtifacts.flatMap((artifact) => artifact.kinds));
  for (const requiredKind of contract.requiredKinds ?? []) {
    if (!kinds.has(requiredKind)) {
      errors.push(issue("contract.kind", `${node.id} needs an artifact of kind ${requiredKind}.`, { nodeId: node.id, kind: requiredKind }));
    }
  }

  const combinedText = inspectedArtifacts.map((artifact) => artifact.text).filter(Boolean).join("\n");
  const wordCount = countWords(combinedText);
  if (wordCount < (contract.minimumWords ?? 0)) {
    errors.push(issue("contract.words", `${node.id} has ${wordCount} text words; minimum is ${contract.minimumWords}.`, { nodeId: node.id, actual: wordCount, expected: contract.minimumWords }));
  }
  const normalizedText = combinedText.toLocaleLowerCase("en-US");
  for (const group of contract.requiredTermGroups ?? []) {
    if (!group.some((term) => normalizedText.includes(String(term).toLocaleLowerCase("en-US")))) {
      errors.push(issue("contract.terms", `${node.id} is missing one of: ${group.join(" | ")}.`, { nodeId: node.id, terms: group }));
    }
  }
  return { errors, wordCount, kinds: [...kinds].sort() };
}

function validateProjectManifest(project) {
  const errors = [];
  if (project?.schemaVersion !== 2) errors.push(issue("project.schema", "Project schemaVersion must be 2."));
  if (project?.kind !== "jrpg-verifier-project") errors.push(issue("project.kind", "Project kind must be jrpg-verifier-project."));
  if (!project?.id) errors.push(issue("project.id", "Project id is required."));
  if (!project?.root) errors.push(issue("project.root", "Project root is required."));
  if (!project?.nodeEvidence || typeof project.nodeEvidence !== "object") {
    errors.push(issue("project.evidence", "Project nodeEvidence is required."));
  }
  return errors;
}

export async function verifyProject({ env, dag, project, envDirectory, projectFile, templateText }) {
  const policies = env.policies ?? {};
  const dagValidation = validateDag(dag, templateText, policies);
  const errors = [...dagValidation.errors, ...validateProjectManifest(project)];
  const warnings = [...dagValidation.warnings];
  const projectDirectory = path.dirname(projectFile);
  const projectRoot = path.resolve(projectDirectory, project.root ?? ".");
  const nodesById = new Map(dag.nodes.map((node) => [node.id, node]));
  const resultById = new Map();

  for (const evidenceId of Object.keys(project.nodeEvidence ?? {})) {
    if (!nodesById.has(evidenceId)) {
      warnings.push(issue("project.unknown-evidence", `Evidence is declared for unknown node ${evidenceId}.`, { nodeId: evidenceId }));
    }
  }

  for (const nodeId of dagValidation.order) {
    const node = nodesById.get(nodeId);
    const evidence = project.nodeEvidence?.[nodeId];
    const declaredStatus = evidence?.declaredStatus ?? "planned";
    const statusErrors = [];
    const allowedStatuses = new Set(["ready", "partial", "planned", "not-applicable"]);
    if (!allowedStatuses.has(declaredStatus)) {
      statusErrors.push(issue("evidence.status", `${nodeId} has invalid declaredStatus ${declaredStatus}.`, { nodeId }));
    }
    if (declaredStatus === "not-applicable" && node.required) {
      statusErrors.push(issue("evidence.required-na", `${nodeId} is required and cannot be not-applicable.`, { nodeId }));
    }

    const artifacts = [];
    for (const artifact of evidence?.artifacts ?? []) {
      artifacts.push(await inspectArtifact(projectRoot, artifact, policies));
    }
    const provenanceErrors = checkProvenance(node, evidence, policies);
    const contract = checkContract(node, artifacts, policies);
    const directErrors = [...statusErrors, ...provenanceErrors, ...contract.errors];
    const blockedBy = node.dependsOn.filter((dependency) => {
      const status = resultById.get(dependency)?.status;
      return status !== "verified" && status !== "optional-missing";
    });

    let status;
    if (declaredStatus === "not-applicable" && !node.required) status = "optional-missing";
    else if (!evidence || declaredStatus === "planned") status = node.required ? "missing" : "optional-missing";
    else if (declaredStatus === "partial") status = "partial";
    else if (directErrors.length) status = "invalid";
    else if (blockedBy.length) status = "blocked";
    else status = "verified";

    resultById.set(nodeId, {
      id: node.id,
      label: node.label,
      kind: node.kind,
      required: node.required,
      templateAnchor: node.templateAnchor,
      declaredStatus,
      status,
      dependsOn: [...node.dependsOn],
      blockedBy,
      contract: node.contract,
      metrics: { artifacts: artifacts.length, words: contract.wordCount, kinds: contract.kinds },
      artifacts: artifacts.map(({ text, ...artifact }) => artifact),
      directErrors,
      extrapolation: node.extrapolation,
    });
  }

  if (dagValidation.order.length !== dag.nodes.length) {
    for (const node of dag.nodes) {
      if (!resultById.has(node.id)) {
        resultById.set(node.id, {
          id: node.id,
          label: node.label,
          required: node.required,
          status: "invalid",
          dependsOn: node.dependsOn ?? [],
          blockedBy: [],
          artifacts: [],
          directErrors: [issue("dag.unordered", "Node could not be ordered because the DAG is invalid.", { nodeId: node.id })],
          extrapolation: node.extrapolation,
        });
      }
    }
  }

  const nodes = dag.nodes.map((node) => resultById.get(node.id));
  const counts = nodes.reduce((summary, node) => {
    summary[node.status] = (summary[node.status] ?? 0) + 1;
    return summary;
  }, {});
  const requiredIncomplete = nodes.filter((node) => node.required && node.status !== "verified");
  return {
    schemaVersion: 2,
    kind: "jrpg-verification-report",
    generatedAt: new Date().toISOString(),
    environment: { id: env.id, directory: envDirectory },
    dag: { id: dag.id, nodes: dag.nodes.length, order: dagValidation.order },
    project: { id: project.id, title: project.title, root: projectRoot },
    ok: errors.length === 0 && requiredIncomplete.length === 0,
    structurallyValid: errors.length === 0,
    counts,
    requiredIncomplete: requiredIncomplete.map((node) => node.id),
    errors,
    warnings,
    nodes,
  };
}

function contractAcceptance(contract = {}) {
  const acceptance = [];
  if (contract.minimumArtifacts) acceptance.push(`At least ${contract.minimumArtifacts} declared artifact(s) exist and are non-empty.`);
  if (contract.minimumWords) acceptance.push(`Combined text contains at least ${contract.minimumWords} words.`);
  if (contract.requiredKinds?.length) acceptance.push(`Evidence includes: ${contract.requiredKinds.join(", ")}.`);
  for (const group of contract.requiredTermGroups ?? []) acceptance.push(`Evidence addresses: ${group.join(" or ")}.`);
  return acceptance;
}

export function buildExtrapolationQueue(report) {
  const byId = new Map(report.nodes.map((node) => [node.id, node]));
  const order = new Map(report.dag.order.map((id, index) => [id, index]));
  const candidates = report.nodes.filter((node) => node.status !== "verified");
  const tasks = candidates.map((node) => {
    const upstreamArtifacts = node.dependsOn.flatMap((dependency) => {
      const dependencyNode = byId.get(dependency);
      return (dependencyNode?.artifacts ?? [])
        .filter((artifact) => artifact.exists)
        .map((artifact) => ({ nodeId: dependency, path: artifact.path, sha256: artifact.sha256 }));
    });
    return {
      nodeId: node.id,
      label: node.label,
      required: node.required,
      status: node.status,
      priority: node.required ? (node.status === "blocked" ? "blocked" : "required") : "optional",
      blockedBy: node.blockedBy,
      objective: node.extrapolation?.objective,
      output: node.extrapolation?.output,
      sections: node.extrapolation?.sections ?? [],
      acceptance: contractAcceptance(node.contract),
      currentProblems: node.directErrors.map((entry) => entry.message),
      upstreamArtifacts,
    };
  });
  tasks.sort((left, right) => (order.get(left.nodeId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.nodeId) ?? Number.MAX_SAFE_INTEGER));
  return {
    schemaVersion: 2,
    kind: "jrpg-extrapolation-queue",
    generatedAt: new Date().toISOString(),
    project: report.project,
    sourceReportOk: report.ok,
    tasks,
  };
}

export function renderVerificationMarkdown(report) {
  const lines = [
    `# Verification report: ${report.project.title ?? report.project.id}`,
    "",
    `- Result: **${report.ok ? "PASS" : "INCOMPLETE"}**`,
    `- DAG structure: **${report.structurallyValid ? "valid" : "invalid"}**`,
    `- Generated: ${report.generatedAt}`,
    `- Nodes: ${report.nodes.length}`,
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...Object.entries(report.counts).sort().map(([status, count]) => `| ${status} | ${count} |`),
    "",
  ];
  if (report.errors.length) {
    lines.push("## Structural errors", "", ...report.errors.map((entry) => `- ${entry.message}`), "");
  }
  if (report.warnings.length) {
    lines.push("## Warnings", "", ...report.warnings.map((entry) => `- ${entry.message}`), "");
  }
  lines.push("## Node results", "", "| Node | Status | Evidence | Blocked by |", "| --- | --- | ---: | --- |");
  for (const node of report.nodes) {
    lines.push(`| ${node.id} | ${node.status} | ${node.metrics?.artifacts ?? 0} | ${node.blockedBy.join(", ") || "-"} |`);
  }
  const problems = report.nodes.filter((node) => node.directErrors.length);
  if (problems.length) {
    lines.push("", "## Direct evidence problems", "");
    for (const node of problems) {
      lines.push(`### ${node.id}`, "", ...node.directErrors.map((entry) => `- ${entry.message}`), "");
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderQueueMarkdown(queue) {
  const lines = [
    `# Extrapolation queue: ${queue.project.title ?? queue.project.id}`,
    "",
    `Generated from the template DAG on ${queue.generatedAt}. Work in listed order; blocked tasks consume only verified upstream evidence.`,
    "",
  ];
  if (!queue.tasks.length) lines.push("No extrapolation work remains.", "");
  for (const [index, task] of queue.tasks.entries()) {
    lines.push(
      `## ${index + 1}. ${task.label} (${task.nodeId})`,
      "",
      `- Status: ${task.status}${task.required ? " / required" : " / optional"}`,
      `- Target: ${task.output}`,
      `- Objective: ${task.objective}`,
    );
    if (task.blockedBy.length) lines.push(`- Blocked by: ${task.blockedBy.join(", ")}`);
    if (task.sections.length) lines.push("", "Suggested sections:", "", ...task.sections.map((section) => `- ${section}`));
    if (task.acceptance.length) lines.push("", "Acceptance contract:", "", ...task.acceptance.map((criterion) => `- ${criterion}`));
    if (task.currentProblems.length) lines.push("", "Current evidence problems:", "", ...task.currentProblems.map((problem) => `- ${problem}`));
    if (task.upstreamArtifacts.length) {
      lines.push("", "Verified inputs:", "", ...task.upstreamArtifacts.map((artifact) => `- ${artifact.nodeId}: ${artifact.path} (${artifact.sha256.slice(0, 12)})`));
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderMermaid(dag) {
  const safeId = (id) => `n_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
  const lines = ["flowchart TD"];
  for (const node of dag.nodes) {
    const label = `${node.label}${node.required ? "" : " (optional)"}`.replaceAll('"', "'");
    lines.push(`  ${safeId(node.id)}["${label}"]`);
  }
  for (const node of dag.nodes) {
    for (const dependency of node.dependsOn) lines.push(`  ${safeId(dependency)} --> ${safeId(node.id)}`);
  }
  return `${lines.join("\n")}\n`;
}
