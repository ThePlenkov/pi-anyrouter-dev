# pi-anyrouter-dev

Universal router for AI providers — one interface, any backend.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`pi-anyrouter-dev`](./packages/pi-anyrouter-dev) | AnyRouter provider for pi coding agent | [![npm](https://img.shields.io/npm/v/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev) |

## Install

```bash
pi install npm:pi-anyrouter-dev
# or
npm install pi-anyrouter-dev
```

## Quick Start

```typescript
import { createRouter } from 'pi-anyrouter-dev';

const router = createRouter({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  },
});

const response = await router.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Providers

- OpenAI
- Anthropic  
- Google Gemini
- Custom OpenAI-compatible endpoints

## Development

This is a monorepo managed with Nx. The publishable package is in `packages/pi-anyrouter-dev/`.

```bash
# Install dependencies
bun install

# Build package
cd packages/pi-anyrouter-dev && bun run build

# Run tests
cd packages/pi-anyrouter-dev && bun test

# Release (triggers CI OIDC publish with provenance)
gh workflow run release.yml --ref main -f specifier=patch
```

## CI/CD

[![CI](https://github.com/ThePlenkov/pi-anyrouter-dev/actions/workflows/release.yml/badge.svg)](https://github.com/ThePlenkov/pi-anyrouter-dev/actions/workflows/release.yml)

Publishes via GitHub Actions OIDC trusted publishing with SLSA provenance.

## License

MIT
