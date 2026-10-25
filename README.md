# pi-anyrouter-dev

[![npm version](https://img.shields.io/npm/v/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![npm downloads](https://img.shields.io/npm/dm/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![Provenance](https://img.shields.io/npm/v/pi-anyrouter-dev?label=provenance&logo=npm&color=orange)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[AnyRouter (anyrouter.dev)](https://anyrouter.dev) provider extension for the [pi coding agent](https://github.com/earendil-works/pi-coding-agent).

Adds AnyRouter's model catalog (100+ models from OpenAI, Anthropic, Google, and more) as a provider in pi, using pi's built-in OpenAI-compatible client.

## Install

```bash
pi install npm:pi-anyrouter-dev
```

Or add to your pi extensions config:

```json
{
  "extensions": ["npm:pi-anyrouter-dev"]
}
```

## Configuration

Set your AnyRouter API key:

```bash
export ANYROUTER_DEV_API_KEY=your-key
```

The extension also accepts `ANYROUTER_API_KEY` as a fallback.

## How it works

- Registers `anyrouter-dev` as a provider in pi
- Fetches the live model catalog from AnyRouter on startup (with 15s timeout)
- Caches the catalog locally for offline use
- Refreshes the catalog on model-picker open
- Uses pi's native `openai-completions` streaming client — no custom HTTP/SSE code

## Development

```bash
# Install dependencies
bun install

# Build
cd packages/pi-anyrouter-dev && bun run build

# Test
cd packages/pi-anyrouter-dev && bun test

# Typecheck
cd packages/pi-anyrouter-dev && bun run typecheck

# Release (triggers CI OIDC publish with provenance)
gh workflow run release.yml --ref main -f specifier=patch -f dryRun=false
# Or push a version tag (e.g., v0.1.8)
```

## CI/CD

[![CI](https://github.com/ThePlenkov/pi-anyrouter-dev/actions/workflows/ci.yml/badge.svg)](https://github.com/ThePlenkov/pi-anyrouter-dev/actions/workflows/ci.yml)

Publishes via GitHub Actions OIDC trusted publishing with SLSA provenance.

## License

MIT