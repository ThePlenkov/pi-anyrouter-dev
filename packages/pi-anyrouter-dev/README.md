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
```

> **Note:** `npm install pi-anyrouter-dev` alone only adds the package to your project. You must run `pi install npm:pi-anyrouter-dev` (or use `--extension`) to register the provider with pi.

## Quick Start

```bash
# Set your AnyRouter API key
export ANYROUTER_DEV_API_KEY=sk-...

# Use the anyrouter-dev provider explicitly with a specific model
pi --provider anyrouter-dev --model gpt-4o -p "Hello, world!"
```

## What It Does

This extension registers `anyrouter-dev` as a provider in pi. It:

- **Uses pi's native OpenAI-compatible client** for provider requests — no custom HTTP/SSE code for chat/completions
- **Fetches the live model catalog** from AnyRouter at startup (online) or restores persisted models (offline)
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

### Provider Settings (models.json)

```json
{
  "providers": {
    "anyrouter-dev": {
      "models": [
        { "id": "gpt-4o" },
        { "id": "claude-3-5-sonnet" }
      ]
    }
  }
}
```

## How It Works

1. **Startup (online)**: Extension loads, resolves API key, fetches live catalog from AnyRouter
2. **Startup (offline)**: Restores persisted models from pi's store without contacting AnyRouter
3. **Mapping**: `catalog.ts` converts AnyRouter models → pi model configs (cost, context, reasoning, compat)
4. **Registration**: Provider registered with pi using `api: "openai-completions"`
5. **Refresh**: `refreshModels` re-fetches the catalog when pi requests a refresh (e.g., model picker)
6. **Persist**: Catalog saved to pi's store; restored on next start (works offline)

## Architecture

- `src/index.ts` — Extension entry point, provider registration, refresh logic
- `src/catalog.ts` — Model mapping, cost parsing, reasoning/compat computation
- `src/fetch-catalog.ts` — HTTP fetch with auth, timeout, error handling (custom HTTP for catalog)
- `src/api-key.ts` — Key resolution priority, credential templates
- `src/provider-info.ts` — Provider constants (id, name, base URL)

## Requirements

- pi ≥ 1.3.0
- Node.js ≥ 22.19
- Bun ≥ 1.2
- AnyRouter API key (free at anyrouter.dev)

## License

MIT
