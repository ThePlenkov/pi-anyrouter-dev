/**
 * Where the AIHubMix API key comes from.
 *
 * The key is looked up in three places, in this order:
 *
 * 1. `AIHUBMIX_COM_API_KEY` - the name this package owns. It matches the
 *    provider id, so a user can give each provider its own key.
 * 2. `AIHUBMIX_API_KEY` - the name AIHubMix's own documentation uses.
 * 3. A stored credential under the provider id in `~/.pi/agent/auth.json`.
 */
import { resolveApiKey as sharedResolveApiKey, apiKeyTemplate as sharedApiKeyTemplate, credentialApiKey as sharedCredentialApiKey, type ResolveApiKeyOptions, type ApiKeyTemplateOptions } from "@pi-extensions/shared";
import { PROVIDER_ID } from "./provider-info";

/** The env var this package owns and documents first. */
export const PRIMARY_API_KEY_ENV = "AIHUBMIX_COM_API_KEY";

/** The env var AIHubMix's own documentation uses. Kept as a fallback. */
export const FALLBACK_API_KEY_ENV = "AIHUBMIX_API_KEY";

/** The env vars checked for the key, in priority order. */
export const API_KEY_ENV_VARS = [PRIMARY_API_KEY_ENV, FALLBACK_API_KEY_ENV] as const;

/** The primary env var name (for external use). */
export const API_KEY_ENV = PRIMARY_API_KEY_ENV;

/**
 * The `apiKey` template pi resolves at request time.
 */
export function apiKeyTemplate(env: NodeJS.ProcessEnv = process.env): string {
	return sharedApiKeyTemplate({ envVars: API_KEY_ENV_VARS, env } as ApiKeyTemplateOptions);
}

/**
 * Read the API key out of a credential pi resolved for a provider.
 */
export const credentialApiKey = sharedCredentialApiKey;

/**
 * Read the API key for a provider id.
 */
export function resolveApiKey(providerId: string = PROVIDER_ID, env: NodeJS.ProcessEnv = process.env): string | undefined {
	return sharedResolveApiKey({ envVars: API_KEY_ENV_VARS, providerId, env } as ResolveApiKeyOptions);
}