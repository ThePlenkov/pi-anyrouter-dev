# pi-hub

[![npm version](https://img.shields.io/npm/v/pi-hub.svg)](https://www.npmjs.com/package/pi-hub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**All-in-one pi extension** — AnyRouter (anyrouter.dev) + AIHubMix (aihubmix.com) providers in a single zero-dependency bundle.

## Install

```bash
# Registers both providers
pi install npm:pi-hub
```

## What It Does

Registers **two providers** in pi with a single install:

| Provider | ID | Models |
|----------|-----|--------|
| AnyRouter | `anyrouter-dev` | 100+ from anyrouter.dev |
| AIHubMix | `aihubmix-com` | 800+ from aihubmix.com |

- **Zero dependencies** — tsdown bundles shared utilities + both providers into one ESM file
- **Works offline** — catalogs persisted and restored on restart
- **Live catalogs** — fetched on startup and model-picker refresh

## Configuration

```bash
# AnyRouter
export ANYROUTER_DEV_API_KEY=sk-...

# AIHubMix
export AIHUBMIX_COM_API_KEY=sk-...
```

## Alternative: Individual Providers

Install only what you need:

```bash
# AnyRouter only
pi install npm:pi-anyrouter-dev

# AIHubMix only
pi install npm:pi-aihubmix-com
```

Both individual packages are also zero-dependency bundles.

## Architecture

- `pi-hub` — single extension registering both providers (this package)
- `pi-anyrouter-dev` — AnyRouter only
- `pi-aihubmix-com` — AIHubMix only
- All three bundle shared utilities via tsdown — **zero runtime deps**

## Requirements

- pi ≥ 1.3.0
- Node.js ≥ 22
- Bun ≥ 1.2

## License

MIT