/**
 * The provider id pi stores the entry under.
 *
 * The id carries the `-dev` suffix because it addresses anyrouter.dev, the
 * endpoint with the full model catalog. The unscoped `anyrouter` id belongs
 * to the other AnyRouter extension, which serves anyrouter.top and only the
 * Claude and Codex routes; two extensions must not claim one id, or the
 * second registration silently replaces the first.
 */
export const PROVIDER_ID = "anyrouter-dev";

/** The display name shown in pi's model picker. */
export const PROVIDER_NAME = "AnyRouter (dev)";

/** AnyRouter's OpenAI-compatible base URL. */
export const BASE_URL = "https://anyrouter.dev/api/v1";

/**
 * Whether pi was asked to stay off the network.
 *
 * pi reads the same variable to decide whether model catalogs may be
 * refreshed, and it treats any defined value as offline - not only the
 * truthy ones its own flag parser accepts. Matching that exactly keeps the
 * extension consistent with the rest of pi: no catalog request at load, and
 * the persisted snapshot is used instead.
 */
export function isOffline(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.PI_OFFLINE !== undefined;
}
