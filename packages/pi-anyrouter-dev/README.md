# pi-anyrouter-dev

[![npm version](https://img.shields.io/npm/v/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![npm downloads](https://img.shields.io/npm/dm/pi-anyrouter-dev.svg)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![Provenance](https://img.shields.io/npm/v/pi-anyrouter-dev?label=provenance&logo=npm&color=orange)](https://www.npmjs.com/package/pi-anyrouter-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal router for AI providers — one interface, any backend.

## Install

```bash
npm install pi-anyrouter-dev
# or
bun add pi-anyrouter-dev
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

## License

MIT
