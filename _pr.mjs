import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const branch = "bun-sverka-ci";
try {
  execSync(`git checkout -b ${branch} 2>&1`, { timeout: 30000 });
} catch {
  // branch already exists from a previous run — switch to it
  execSync(`git checkout ${branch} 2>&1`, { timeout: 30000 });
}
execSync(`git add -A 2>&1`, { timeout: 30000 });
execSync(
  `git commit -m "feat: switch to bun and drive CI through sverka" 2>&1`,
  { timeout: 30000 },
);
execSync(`git push -u origin ${branch} 2>&1`, { timeout: 60000 });

const body = `Switch the package manager from npm to bun and drive CI through sverka.

## Why

- **bun** is faster and lighter than npm for this single-package extension, and
  the global toolchain already runs bun 1.4.3.
- **sverka** (via \`@nx-devkit/sverka\`) turns the CI chain into a single
  TypeScript config that Nx infers into cached per-step targets, instead of
  hand-maintaining \`project.json\`.

## What changed

- \`package.json\`: \`packageManager: bun@1.4.3\`; scripts now \`bun test\` /
  \`bun run build\` / \`bun run prepack\`; added \`@nx-devkit/sverka\` and
  \`sverka\` devDependencies.
- \`package-lock.json\`: removed (git-tracked) and replaced by \`bun.lock\`.
- \`nx.json\`: registered the \`@nx-devkit/sverka\` plugin.
- \`sverka.config.ts\`: new \`ci\` pipeline \`typecheck -> test -> build -> pack\`,
  wired to a \`push()\` entry.
- \`.gitignore\`: added \`.sverka/\`.
- \`README.md\`: Development section rewritten for bun + sverka.

## Verified

- \`bun install --frozen-lockfile\` — clean install from the committed lockfile.
- \`bun test\` — 32/32 pass.
- \`bun run typecheck\` — clean.
- \`bun run build\` — \`dist/index.mjs\` + \`dist/index.d.mts\`, publint clean.
- \`bunx sverka validate\` — config valid (1 pipeline, 4 steps, 1 entry).
- \`nx run pi-anyrouter-dev:ci:typecheck\`, \`:ci:test\`, \`:ci:build\`, \`:ci:pack\`
  — all green, with dependency chaining and Nx caching working.

## Note

\`@nx-devkit/sverka\` declares \`@nx/devkit ^22.0.0 || ^23.0.0\` as a peer, but this
repo runs nx 24. It works because the plugin only uses \`@nx/devkit\`'s
\`logger\` (the \`createNodesV2\` shape is stable across those versions).`;

writeFileSync("/tmp/pr-body.md", body);

const out = execSync(
  `gh pr create --base main --draft --title "feat: switch to bun and drive CI through sverka" --body-file /tmp/pr-body.md --repo ThePlenkov/pi-anyrouter-dev 2>&1`,
  { timeout: 60000 },
);
console.log(out.toString());