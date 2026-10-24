# pi-anyrouter-dev

[![npm version](https://img.shields.io/npm/v/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![npm downloads](https://img.shields.io/npm/dm/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![Provenance](https://img.shields.io/npm/v/pi-anyrouter-dev?label=provenance&logo=npm&color=orange)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AnyRouter provider for the pi coding agent.** Adds AnyRouter (anyrouter.dev) as a provider using pi's built-in OpenAI-compatible client with a dynamically fetched model catalog.

## Install

```bash
# Required: registers the extension with pi so the provider is available
pi install npm:pi-anyrouter-dev

# Or install via npm and manually register (advanced)
# npm install pi-anyrouter-dev
```

## Quick Start

```bash
# Set your AnyRouter API key
export ANYROUTER_DEV_API_KEY=sk-...

# Use the anyrouter-dev provider explicitly
pi -p "What models does anyrouter-dev have?" --provider anyrouter-dev
```

## What It Does

This extension registers `anyrouter-dev` as a provider in pi. It:

- **Uses pi's native OpenAI-compatible client** — no custom HTTP/SSE code
- **Fetches the live model catalog** from AnyRouter at startup and on refresh
- **Maps AnyRouter models to pi's model format** — pricing, context, reasoning, vision
- **Persists the catalog** so it works offline and restores instantly on next start
- **Handles API keys** via `ANYROUTER_DEV_API_KEY` (owned by this package) with fallback to `ANYROUTER_API_KEY`

## Configuration

### API Key

| Variable | Priority | Notes |
|----------|----------|-------|
| `ANYROUTER_DEV_API_KEY` | 1st (owned) | This package's own variable |
| `ANYROUTER_API_KEY` | 2nd (fallback) | AnyRouter's documented name |

Keys can also be stored in pi's credential store under provider `anyrouter-dev`.

### Provider Settings

Select the provider when running pi:
```bash
pi --provider anyrouter-dev -p "Your prompt here"
```

Or set it as default in pi's settings.

## How It Works

1. **Startup**: Extension loads, resolves API key, fetches catalog from AnyRouter
2. **Mapping**: `catalog.ts` converts AnyRouter models → pi model configs (cost, context, reasoning, compat)
3. **Registration**: Provider registered with pi using `api: "openai-completions"`
4. **Refresh**: `refreshModels` re-fetches catalog on model-picker open / retry
5. **Persist**: Catalog saved to pi's store; restored on next start (works offline)

## Architecture

- `src/index.ts` — Extension entry point, provider registration, refresh logic
- `src/catalog.ts` — Model mapping, cost parsing, reasoning/compat computation
- `src/fetch-catalog.ts` — HTTP fetch with auth, timeout, error handling
- `src/api-key.ts` — Key resolution priority, credential templates
- `src/provider-info.ts` — Provider constants (id, name, base URL)

## Requirements

- pi ≥ 1.3.0
- Node.js ≥ 22 / Bun ≥ 1.2
- AnyRouter API key (free at anyrouter.dev)

## License

MIT
