# pi-anyrouter-dev

AnyRouter provider for the [pi coding agent](https://pi.dev).

AnyRouter routes one API key to many upstream providers - OpenAI, Anthropic,
Google, NVIDIA, Moonshot and others - behind a single OpenAI-compatible
endpoint. This extension exposes that catalog to pi.

The `-dev` suffix is the endpoint: this package serves **anyrouter.dev**, the
host with the full model catalog. The other AnyRouter extension on the
registry - the unscoped `pi-anyrouter` - serves anyrouter.top and covers only
the Claude and Codex routes. The two services issue keys from separate pools:
a key valid for anyrouter.dev is rejected by anyrouter.top.

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
pi install npm:pi-anyrouter-dev
```

Or try it for one run without installing:

```bash
pi -e npm:pi-anyrouter-dev
```

From a checkout:

```bash
pi -e /path/to/pi-anyrouter-dev
```

## Configure

Set the API key:

```bash
export ANYROUTER_DEV_API_KEY=your-key
```

`ANYROUTER_API_KEY`, the name AnyRouter's own documentation uses, is accepted
as a fallback. The package reads its own name first, because the other
AnyRouter extension on the registry reads `ANYROUTER_API_KEY` for a different
service - the two issue keys from separate pools, and a key valid for
`anyrouter.dev` is rejected by `anyrouter.top`.

pi also reads a stored credential from `~/.pi/agent/auth.json`:

```json
{
  "anyrouter-dev": { "type": "api_key", "key": "your-key" }
}
```

The provider id is `anyrouter-dev`, so the credential is filed under that
name. It differs from the id of the other AnyRouter extension on purpose:
two extensions must not claim one provider id, or the second registration
silently replaces the first.

## Models

The catalog is fetched from `GET https://anyrouter.dev/api/v1/models` when
the extension loads, so the model list is current rather than a snapshot
that goes stale. Chat-capable models are the ones that can serve a
conversation; classifier-only and image-only entries are dropped.

Every model reports its own context window, output cap, input modalities
and price per million tokens, as AnyRouter advertises them.

The catalog endpoint answers without a key, but the request is authenticated
when a key is configured - the authenticated catalog lists one model more
(`minimax/minimax-m3.1-flash`), and it reflects the entitlements of the key
in use.

The catalog is persisted through pi's own model store, so a start without a
network still has a model list. In offline mode (`PI_OFFLINE`) the extension
makes no request at all and serves the persisted snapshot.

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
| `src/api-key.ts` | Where the API key comes from |
| `src/provider-info.ts` | Provider id, base URL, offline detection |

## Development

```bash
npm test        # unit tests over the catalog mapping
npm run typecheck
```

## License

MIT
