# pi-extensions

[![npm version](https://img.shields.io/npm/v/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![npm downloads](https://img.shields.io/npm/dm/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![npm version](https://img.shields.io/npm/v/pi-aihubmix-com.svg)](https://www.npmjs.com/package/pi-aihubmix-com)
[![npm downloads](https://img.shields.io/npm/dm/pi-aihubmix-com.svg)](https://www.npmjs.com/package/pi-aihubmix-com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Provider extensions for the [pi coding agent](https://github.com/earendil-works/pi-coding-agent).

This monorepo contains multiple provider extensions that add model providers to pi using pi's built-in OpenAI-compatible client.

## Packages

| Package | Provider | Registry | Description |
|---------|----------|----------|-------------|
| [`pi-anyrouter-dev`](packages/providers/anyrouter-dev) | AnyRouter (anyrouter.dev) | [npm](https://www.npmjs.com/package/pi-anyrouter-dev) | Full model catalog from AnyRouter |
| [`pi-aihubmix-com`](packages/providers/aihubmix-com) | AIHubMix (aihubmix.com) | [npm](https://www.npmjs.com/package/pi-aihubmix-com) | Unified API for 100+ models |
| [`@pi-extensions/shared`](packages/shared) | — | [npm](https://www.npmjs.com/package/@pi-extensions/shared) | Shared utilities for providers |

## Install

```bash
# Install AnyRouter provider
pi install npm:pi-anyrouter-dev

# Install AIHubMix provider
pi install npm:pi-aihubmix-com
```

Or add to your pi extensions config:

```json
{
  "extensions": ["npm:pi-anyrouter-dev", "npm:pi-aihubmix-com"]
}
```

## Configuration

### AnyRouter (pi-anyrouter-dev)

```bash
export ANYROUTER_DEV_API_KEY=your-key
```

Also accepts `ANYROUTER_API_KEY` as a fallback.

### AIHubMix (pi-aihubmix-com)

```bash
export AIHUBMIX_COM_API_KEY=your-key
```

Also accepts `AIHUBMIX_API_KEY` as a fallback.

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Test all packages
bun test

# Typecheck all packages
bun run typecheck

# Release (triggers CI OIDC publish with provenance)
gh workflow run release.yml --ref main -f specifier=patch -f dryRun=false
# Or push a version tag (e.g., v0.1.8)
```

## CI/CD

Publishes via GitHub Actions OIDC trusted publishing with SLSA provenance.

## License

MIT