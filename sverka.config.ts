import { Project, Pipeline, ShellStep, Entry, push } from "@sverka/workflow";

const proj = new Project("pi-anyrouter-dev");

const ci = new Pipeline(proj, "ci");

// Typecheck first so a config typo fails before any step runs.
const typecheck = new ShellStep(ci, "typecheck", {
  command: "bun run typecheck",
  timeout: 120_000,
});

// The test suite. Depends on typecheck so a broken config does not run tests.
const test = new ShellStep(ci, "test", {
  command: "bun test",
  dependsOn: [typecheck.node.id],
  timeout: 120_000,
});

// Build the ESM bundle into dist/. Depends on tests passing.
const build = new ShellStep(ci, "build", {
  command: "bun run build",
  dependsOn: [test.node.id],
  timeout: 120_000,
  outputs: { dist: { type: "artifact", path: "dist" } },
});

// Publish artifacts: pack the bundle and run publint against it.
const pack = new ShellStep(ci, "pack", {
  command: "bun pm pack",
  dependsOn: [build.node.id],
  timeout: 60_000,
});

// Every push runs the whole chain: typecheck -> test -> build -> pack.
new Entry(ci, "on-push", {
  trigger: push(),
  roots: [pack.node.id],
});

export default proj;