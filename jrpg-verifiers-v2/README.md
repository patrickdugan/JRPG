# JRPG Game Design Verifiers v2

This is a repo-local, dependency-free verification environment derived from Patrick Holleman's `JRPG Project Plan Template.md`. It turns the template's production order into a 32-node directed acyclic graph (DAG), maps a game's real artifacts onto those nodes, and emits the next bounded extrapolation tasks without pretending that generated documents are proof of completion.

```text
source template -> contract DAG -> project evidence -> verifier report
                                             \-----> extrapolation queue
```

The environment reads the game repository. It does not edit design documents, runtime code, saves, or evidence.

## Quick start

From `jrpg-verifiers-v2`:

```powershell
npm test
npm run verify
npm run extrapolate
npm run graph
npm run report
```

Use `npm run verify:strict` in CI. It exits with code 2 while any required node is incomplete; normal `verify` still emits a useful report and exits successfully.

Direct CLI examples:

```powershell
node src/cli.mjs verify --json
node src/cli.mjs extrapolate --out reports/next-work.md
node src/cli.mjs graph --format mermaid
node src/cli.mjs template --json
node src/cli.mjs verify --project projects/bells-black-chrysanthemum.json --strict
```

## What v2 verifies

The verifier checks four separate things:

1. **Template fidelity.** Every DAG node names an exact heading in the source template. Anchor drift fails the structural check.
2. **DAG integrity.** IDs are unique, dependencies exist, and cycles are rejected before evidence is evaluated.
3. **Evidence contracts.** Declared artifacts must stay inside the project root, exist, be non-empty, use allowed extensions, satisfy required evidence kinds and minimum word counts, and address required topic groups.
4. **Dependency provenance.** A node can verify only after its required upstream nodes verify. Evidence carries SHA-256 hashes into the extrapolation queue so downstream work names the inputs it consumed.

Artifact inspection is intentionally bounded and mechanical. A word or file check is not a design-quality judgment. Human playtest findings, cultural review, comprehension, feel, and release judgment remain explicit human gates.

## Status model

| Status | Meaning |
| --- | --- |
| `verified` | Direct contract passes and all required dependencies verify. |
| `partial` | Evidence exists, but its owner explicitly says the deliverable is unfinished. |
| `missing` | A required node has no ready evidence. |
| `invalid` | Ready evidence violates its contract, provenance, or path boundary. |
| `blocked` | Direct evidence passes but an upstream required node has not verified. |
| `optional-missing` | An optional template recommendation is deliberately absent or planned. |

Declarations cannot promote themselves through the graph. `ready` is evaluated; `partial` remains partial even when its files happen to satisfy all shallow checks.

## Files

- `env.json` — environment paths and fail-closed policies.
- `dag.json` — template-derived nodes, dependencies, evidence contracts, and extrapolation briefs.
- `projects/bells-black-chrysanthemum.json` — adapter from the current JRPG repository to DAG evidence.
- `schemas/` — JSON Schemas for environment, DAG, and project manifests.
- `src/core.mjs` — reusable verifier, queue, and rendering functions.
- `src/cli.mjs` — command-line interface.
- `tests/core.test.mjs` — synthetic tests for anchors, cycles, propagation, provenance, hashing, and path escape.
- `reports/` — reproducible JSON, Markdown, and Mermaid output from the current adapter.

## Extrapolating from the template

Each DAG node contains:

- `templateAnchor`: the source heading that authorizes the node;
- `dependsOn`: verified inputs that must precede it;
- `contract`: the minimum evidence shape;
- `extrapolation.objective`: the decision the output must support;
- `extrapolation.output`: the expected deliverable path;
- `extrapolation.sections`: a bounded outline.

`extrapolate` selects every non-verified node in topological order. The generated task includes its current problems, blockers, acceptance contract, and hashes of available upstream artifacts. It produces work instructions, not fabricated completion evidence.

## Adapting another JRPG

Copy the project manifest and change `id`, `title`, `root`, and `nodeEvidence`. Artifact paths are resolved from `root`, which itself is resolved relative to the project manifest. Paths that escape that root are rejected.

Use `sources: "dependencies"` when a deliverable consumed every direct dependency, or list the exact dependency IDs. Use these declarations conservatively:

- `ready` when the artifact should be judged now;
- `partial` when useful work exists but a meaningful gate is still open;
- `planned` when work has not begun;
- `not-applicable` only for optional nodes.

To change the production model, edit the DAG rather than the verifier. Keep every new node anchored to the source template, or make the changed source authority explicit in a new environment version.

## Current repository read

The included adapter currently reports 28 verified nodes, one optional missing teaser, and three partial required nodes:

- staffing and contractor planning;
- current-build human playtest evidence;
- release-readiness synthesis, which remains blocked by both of the above.

That is the intended result: substantial production evidence is recognized, while plans and automated receipts are not promoted into human validation.
