#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildExtrapolationQueue,
  extractMarkdownHeadings,
  loadJson,
  renderMermaid,
  renderQueueMarkdown,
  renderVerificationMarkdown,
  validateDag,
  verifyProject,
} from "./core.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENVIRONMENT = path.resolve(SCRIPT_DIRECTORY, "..", "env.json");

function usage() {
  return `JRPG Game Design Verifiers v2

Usage:
  node src/cli.mjs verify [--project FILE] [--json] [--out FILE] [--strict]
  node src/cli.mjs extrapolate [--project FILE] [--json] [--out FILE] [--strict]
  node src/cli.mjs graph [--format mermaid|json] [--out FILE]
  node src/cli.mjs template [--json]

Global options:
  --env FILE      Environment manifest (default: ../env.json)
  --project FILE  Project evidence manifest; relative paths resolve from the environment
  --json          Emit machine-readable JSON
  --out FILE      Write output to a file instead of stdout
  --strict        Exit with code 2 when required verification remains incomplete
  --help          Show this help
`;
}

function parseArguments(argv) {
  const options = { command: null, json: false, strict: false };
  const valueOptions = new Set(["--env", "--project", "--out", "--format"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-") && !options.command) {
      options.command = token;
    } else if (token === "--json") {
      options.json = true;
    } else if (token === "--strict") {
      options.strict = true;
    } else if (token === "--help" || token === "-h") {
      options.help = true;
    } else if (valueOptions.has(token)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      options[token.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return options;
}

async function loadContext(options) {
  const envPath = path.resolve(process.cwd(), options.env ?? DEFAULT_ENVIRONMENT);
  const envDirectory = path.dirname(envPath);
  const env = await loadJson(envPath);
  if (env.schemaVersion !== 2 || env.kind !== "jrpg-game-design-verifier-environment") {
    throw new Error(`Unsupported verifier environment: ${envPath}`);
  }
  const dagPath = path.resolve(envDirectory, env.dag);
  const templatePath = path.resolve(envDirectory, env.template);
  const projectPath = path.resolve(envDirectory, options.project ?? env.defaultProject);
  const [dag, project, templateText] = await Promise.all([
    loadJson(dagPath),
    loadJson(projectPath),
    readFile(templatePath, "utf8"),
  ]);
  return { env, envDirectory, envPath, dag, dagPath, project, projectPath, templatePath, templateText };
}

async function emit(content, outputPath) {
  if (!outputPath) {
    process.stdout.write(content);
    return;
  }
  const absolutePath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  process.stdout.write(`${absolutePath}\n`);
}

async function buildReport(context) {
  return verifyProject({
    env: context.env,
    dag: context.dag,
    project: context.project,
    envDirectory: context.envDirectory,
    projectFile: context.projectPath,
    templateText: context.templateText,
  });
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }

  if (options.help || !options.command) {
    process.stdout.write(usage());
    return;
  }

  const allowedCommands = new Set(["verify", "extrapolate", "graph", "template"]);
  if (!allowedCommands.has(options.command)) {
    process.stderr.write(`Unknown command: ${options.command}\n\n${usage()}`);
    process.exitCode = 1;
    return;
  }

  const context = await loadContext(options);
  if (options.command === "graph") {
    const validation = validateDag(context.dag, context.templateText, context.env.policies);
    if (!validation.ok) {
      throw new Error(`Cannot render an invalid DAG:\n${validation.errors.map((entry) => `- ${entry.message}`).join("\n")}`);
    }
    const content = options.format === "json" || options.json
      ? `${JSON.stringify(context.dag, null, 2)}\n`
      : renderMermaid(context.dag);
    await emit(content, options.out);
    return;
  }

  if (options.command === "template") {
    const headings = extractMarkdownHeadings(context.templateText);
    const content = options.json
      ? `${JSON.stringify({ template: context.templatePath, headings }, null, 2)}\n`
      : `${headings.map((heading) => `${"  ".repeat(heading.depth - 1)}- L${heading.line}: ${heading.text}`).join("\n")}\n`;
    await emit(content, options.out);
    return;
  }

  const report = await buildReport(context);
  if (options.command === "verify") {
    const content = options.json ? `${JSON.stringify(report, null, 2)}\n` : renderVerificationMarkdown(report);
    await emit(content, options.out);
  } else {
    const queue = buildExtrapolationQueue(report);
    const content = options.json ? `${JSON.stringify(queue, null, 2)}\n` : renderQueueMarkdown(queue);
    await emit(content, options.out);
  }
  if (options.strict && !report.ok) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
