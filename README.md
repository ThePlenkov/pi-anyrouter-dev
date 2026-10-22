# pi-anyrouter

AnyRouter provider for the [pi coding agent](https://pi.dev).

AnyRouter routes one API key to many upstream providers - OpenAI, Anthropic,
Google, NVIDIA, Moonshot and others - behind a single OpenAI-compatible
endpoint. This extension exposes that catalog to pi.

## What it is

A thin layer. The extension registers one provider with pi and maps
AnyRouter's model catalog onto pi's model shape. Everything else - the
OpenAI-compatible client, the streaming implementation, retries, tool calls,
usage accounting - is pi's own, reached through the built-in
`openai-completions` API.

The package contains no HTTP client, no SSE parser, and no reimplementation
of a request pipeline.

## Install

```bash
pi install npm:@theplenkov/pi-anyrouter
```

Or try it for one run without installing:

```bash
pi -e npm:@theplenkov/pi-anyrouter
```

From a checkout:

```bash
pi -e /path/to/pi-anyrouter
```

## Configure

Set the API key:

```bash
export ANYROUTER_API_KEY=your-key
```

pi also reads a stored credential from `~/.pi/agent/auth.json`:

```json
{
  "anyrouter": { "type": "api_key", "key": "your-key" }
}
```

## Models

The catalog is fetched from `GET https://anyrouter.dev/api/v1/models` when
the extension loads, so the model list is current rather than a snapshot
that goes stale. Chat-capable models are the ones that can serve a
conversation; classifier-only and image-only entries are dropped.

Every model reports its own context window, output cap, input modalities
and price per million tokens, as AnyRouter advertises them.

## Reasoning

Reasoning effort travels in the nested `reasoning: { effort }` object, which
is the shape AnyRouter normalizes across its upstreams. The flat
`reasoning_effort` field is accepted by the server, but the upstream then
leaks the reasoning text into the message content, which corrupts the
conversation.

A model that declares its accepted levels is limited to those; one that only
advertises the `reasoning` parameter gets the full ladder.

## Layout

| File | Purpose |
| --- | --- |
| `src/index.ts` | Registers the provider and fetches the catalog |
| `src/catalog.ts` | Maps a catalog entry to a pi model |
| `src/catalog-types.ts` | Wire types for the catalog |
| `src/fetch-catalog.ts` | The one network call |

## Development

```bash
npm test        # unit tests over the catalog mapping
npm run typecheck
```

## License

MIT
