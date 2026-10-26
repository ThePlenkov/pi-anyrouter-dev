# pi-aihubmix-com

[![npm version](https://img.shields.io/npm/v/pi-aihubmix-com.svg)](https://www.npmjs.com/package/pi-aihubmix-com)
[![npm downloads](https://img.shields.io/npm/dm/pi-aihubmix-com.svg)](https://www.npmjs.com/package/pi-aihubmix-com)
[![Provenance](https://img.shields.io/npm/v/pi-aihubmix-com?label=provenance&logo=npm&color=orange)](https://www.npmjs.com/package/pi-aihubmix-com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AIHubMix provider for the pi coding agent.** Adds AIHubMix (aihubmix.com) as a provider using pi's built-in OpenAI-compatible client with a dynamically fetched model catalog.

## Install

```bash
# Required: registers the extension with pi so the provider is available
pi install npm:pi-aihubmix-com
```

> **Note:** `npm install pi-aihubmix-com` alone only adds the package to your project. You must run `pi install npm:pi-aihubmix-com` (or use `--extension`) to register the provider with pi.

## Quick Start

```bash
# Set your AIHubMix API key
export AIHUBMIX_COM_API_KEY=sk-...

# Use the aihubmix-com provider explicitly with a specific model
pi --provider aihubmix-com --model gpt-4o -p "Hello, world!"
```

## What It Does

This extension registers `aihubmix-com` as a provider in pi. It:

- **Uses pi's native OpenAI-compatible client** for provider requests — no custom HTTP/SSE code for chat/completions
- **Fetches the live model catalog** from AIHubMix at startup (online) or restores persisted models (offline)
- **Maps AIHubMix models to pi's model format** — pricing, context, reasoning, vision
- **Persists the catalog** so it works offline and restores instantly on next start
- **Handles API keys** via `AIHUBMIX_COM_API_KEY` (owned by this package) with fallback to `AIHUBMIX_API_KEY`

## Configuration

### API Key

| Variable | Priority | Notes |
|----------|----------|-------|
| `AIHUBMIX_COM_API_KEY` | 1st (owned) | This package's own variable |
| `AIHUBMIX_API_KEY` | 2nd (fallback) | AIHubMix's documented name |

Keys can also be stored in pi's credential store under provider `aihubmix-com`.

### Model Selection

The extension fetches the full model catalog from AIHubMix dynamically. To use a specific model, pass it explicitly:

```bash
pi --provider aihubmix-com --model gpt-4o -p "Your prompt"
```

Or select it in pi's model picker after the catalog loads. The extension does not read static model lists — the catalog is always fetched from AIHubMix (or restored from pi's persisted store offline).

## How It Works

1. **Startup (online)**: Extension loads, resolves API key, fetches live catalog from AIHubMix
2. **Startup (offline)**: Restores persisted models from pi's store without contacting AIHubMix
3. **Mapping**: `catalog.ts` converts AIHubMix models → pi model configs (cost, context, reasoning, compat)
4. **Registration**: Provider registered with pi using `api: "openai-completions"`
5. **Refresh**: `refreshModels` re-fetches the catalog when pi requests a refresh (e.g., model picker)
6. **Persist**: Catalog saved to pi's store; restored on next start (works offline)

## Architecture

- `src/index.ts` — Extension entry point, provider registration, refresh logic
- `src/catalog.ts` — Model mapping, cost parsing, reasoning/compat computation
- `src/fetch-catalog.ts` — HTTP fetch with auth, timeout, error handling (uses shared catalog fetcher)
- `src/api-key.ts` — Key resolution priority, credential templates (uses shared key resolver)
- `src/provider-info.ts` — Provider constants (id, name, base URL)

## Requirements

- pi ≥ 1.3.0
- Node.js ≥ 22.19
- Bun ≥ 1.2
- AIHubMix API key (free at aihubmix.com)

## License

MIT