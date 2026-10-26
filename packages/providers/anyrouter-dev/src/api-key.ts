/**
 * Where the AnyRouter API key comes from.
 *
 * The key is looked up in three places, in this order:
 *
 * 1. `ANYROUTER_DEV_API_KEY` - the name this package owns. It matches the
 *    provider id, so a user with two AnyRouter extensions installed can give
 *    each one its own key.
 * 2. `ANYROUTER_API_KEY` - the name AnyRouter's own documentation uses. It is
 *    accepted so a key exported for the upstream service keeps working, but it
 *    is not the primary name: the other AnyRouter extension on the registry
 *    reads the same variable, and the two services issue keys from different
 *    pools. A key valid for `anyrouter.dev` is rejected by `anyrouter.top`
 *    with "无效的令牌", and the other way around.
 * 3. A stored credential under the provider id in `~/.pi/agent/auth.json`.
 *
 * The two services are genuinely separate: `anyrouter.dev` serves the full
 * catalog over `https://anyrouter.dev/api/v1`, while the other extension
 * targets `https://anyrouter.top` and only the Claude and Codex routes.
 */
import { resolveApiKey as sharedResolveApiKey, apiKeyTemplate as sharedApiKeyTemplate, credentialApiKey as sharedCredentialApiKey, type ResolveApiKeyOptions, type ApiKeyTemplateOptions } from "@pi-extensions/shared";
import { PROVIDER_ID } from "./provider-info";

/** The env var this package owns and documents first. */
export const PRIMARY_API_KEY_ENV = "ANYROUTER_DEV_API_KEY";

/** The env var AnyRouter's own documentation uses. Kept as a fallback. */
export const FALLBACK_API_KEY_ENV = "ANYROUTER_API_KEY";

/** The env vars checked for the key, in priority order. */
export const API_KEY_ENV_VARS = [PRIMARY_API_KEY_ENV, FALLBACK_API_KEY_ENV] as const;

/** The primary env var name (for external use). */
export const API_KEY_ENV = PRIMARY_API_KEY_ENV;

/**
 * The `apiKey` template pi resolves at request time.
 *
 * pi requires *every* env name in the template to be set, so a template
 * cannot express "either variable" - it can only express "all of them".
 * The name of the variable that actually holds the key is therefore chosen
 * here, while the value stays a live reference: pi resolves the template on
 * every request, so a key exported after startup still applies.
 *
 * The primary name wins whenever it is set. Only a process that exports the
 * fallback alone - a user following AnyRouter's own documentation - ends up
 * with the fallback as the template.
 *
 * @param env - The environment to inspect. Defaults to `process.env`.
 * @returns The template pi should resolve.
 */
export function apiKeyTemplate(env: NodeJS.ProcessEnv = process.env): string {
	return sharedApiKeyTemplate({ envVars: API_KEY_ENV_VARS, env } as ApiKeyTemplateOptions);
}

/**
 * Read the API key out of a credential pi resolved for a provider.
 *
 * The credential is a union of the api-key and OAuth shapes, and the OAuth
 * shape has an open index signature, so `credential.key` is not a string
 * there. Only the api-key shape carries a key.
 *
 * @param credential - The credential pi resolved, if any.
 * @returns The key, or `undefined` when the credential carries none.
 */
export const credentialApiKey = sharedCredentialApiKey;

/**
 * Read the API key for a provider id.
 *
 * The environment wins over the stored credential, matching how pi itself
 * resolves a provider: an explicitly exported key is the more immediate
 * signal, and a stored credential is the fallback for a key the user filed
 * once through `/login`.
 *
 * @param providerId - The provider id the credential is filed under.
 * @param env - The environment to read from. Defaults to `process.env`.
 * @returns The key, or `undefined` when none is configured.
 */
export function resolveApiKey(providerId: string = PROVIDER_ID, env: NodeJS.ProcessEnv = process.env): string | undefined {
	return sharedResolveApiKey({ envVars: API_KEY_ENV_VARS, providerId, env } as ResolveApiKeyOptions);
}