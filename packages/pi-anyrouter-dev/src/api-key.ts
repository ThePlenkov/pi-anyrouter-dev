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
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** The env var this package owns and documents first. */
export const PRIMARY_API_KEY_ENV = "ANYROUTER_DEV_API_KEY";

/** The env var AnyRouter's own documentation uses. Kept as a fallback. */
export const FALLBACK_API_KEY_ENV = "ANYROUTER_API_KEY";

/** The env vars checked for the key, in priority order. */
export const API_KEY_ENV_VARS = [PRIMARY_API_KEY_ENV, FALLBACK_API_KEY_ENV] as const;


/**
 * Get the agent config directory (e.g., ~/.pi/agent/)
 * Mirrors the logic in @earendil-works/pi-coding-agent.
 */
function getAgentDir(): string {
	const envDir = process.env.PI_CODING_AGENT_DIR;
	if (envDir) {
		return envDir.startsWith('~') ? envDir.replace('~', homedir()) : envDir;
	}
	return join(homedir(), '.pi', 'agent');
}

/**
 * One-off synchronous read of a stored credential from an auth.json file,
 * without instantiating a store or resolving configured key values.
 * Mirrors the function from @earendil-works/pi-coding-agent.
 */
function readStoredCredential(
	providerId: string,
	authPath: string = join(getAgentDir(), 'auth.json'),
): StoredCredential | undefined {
	try {
		const raw = readFileSync(authPath, 'utf-8');
		const data = JSON.parse(raw.replace(/^﻿/, '')) as Record<string, StoredCredential>;
		return data[providerId];
	} catch {
		return undefined;
	}
}
/**
 * A stored credential as pi keeps it in `~/.pi/agent/auth.json`.
 *
 * Only the api-key shape is read. An OAuth credential has no `key` field, and
 * AnyRouter does not use OAuth.
 */
interface StoredCredential {
	type?: string;
	key?: string;
}

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
	const primary = env[PRIMARY_API_KEY_ENV];
	if (primary !== undefined && primary !== "") return `$${PRIMARY_API_KEY_ENV}`;
	const fallback = env[FALLBACK_API_KEY_ENV];
	if (fallback !== undefined && fallback !== "") return `$${FALLBACK_API_KEY_ENV}`;
	return `$${PRIMARY_API_KEY_ENV}`;
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
export function credentialApiKey(credential: { type?: string; key?: unknown } | undefined): string | undefined {
	if (!credential || credential.type !== "api_key") return undefined;
	return typeof credential.key === "string" && credential.key !== "" ? credential.key : undefined;
}

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
export function resolveApiKey(providerId: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
	for (const name of API_KEY_ENV_VARS) {
		const value = env[name];
		if (value !== undefined && value !== "") return value;
	}

	return credentialApiKey(readStoredCredential(providerId) as StoredCredential | undefined);
}
