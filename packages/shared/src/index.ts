import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** A stored credential as pi keeps it in `~/.pi/agent/auth.json`. */
export interface StoredCredential {
	type?: string;
	key?: string;
}

/**
 * Get the agent config directory (e.g., ~/.pi/agent/)
 * Mirrors the logic in @earendil-works/pi-coding-agent.
 */
export function getAgentDir(env: NodeJS.ProcessEnv = process.env): string {
	const envDir = env.PI_CODING_AGENT_DIR;
	if (envDir) {
		return envDir.startsWith("~") ? envDir.replace("~", homedir()) : envDir;
	}
	return join(homedir(), ".pi", "agent");
}

/**
 * One-off synchronous read of a stored credential from an auth.json file,
 * without instantiating a store or resolving configured key values.
 * Mirrors the function from @earendil-works/pi-coding-agent.
 */
export function readStoredCredential(
	providerId: string,
	authPath: string = join(getAgentDir(), "auth.json"),
): StoredCredential | undefined {
	try {
		const raw = readFileSync(authPath, "utf-8");
		const data = JSON.parse(raw.replace(/^\uFEFF/, "")) as Record<string, StoredCredential>;
		return data[providerId];
	} catch {
		return undefined;
	}
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
export function credentialApiKey(
	credential: { type?: string; key?: unknown } | undefined,
): string | undefined {
	if (!credential || credential.type !== "api_key") return undefined;
	return typeof credential.key === "string" && credential.key !== "" ? credential.key : undefined;
}

/**
 * Options for resolving an API key for a provider.
 */
export interface ResolveApiKeyOptions {
	/** The environment variables to check, in priority order. */
	envVars: readonly string[];
	/** The provider id to look up in the credential store. */
	providerId: string;
	/** The environment to read from. Defaults to `process.env`. */
	env?: NodeJS.ProcessEnv;
}

/**
 * Read the API key for a provider.
 *
 * The environment wins over the stored credential, matching how pi itself
 * resolves a provider: an explicitly exported key is the more immediate
 * signal, and a stored credential is the fallback for a key the user filed
 * once through `/login`.
 *
 * @param options - The resolution options.
 * @returns The key, or `undefined` when none is configured.
 */
export function resolveApiKey(options: ResolveApiKeyOptions): string | undefined {
	const { envVars, providerId, env = process.env } = options;

	for (const name of envVars) {
		const value = env[name];
		if (value !== undefined && value !== "") return value;
	}

	return credentialApiKey(readStoredCredential(providerId));
}

/**
 * Options for creating an API key template for pi.
 */
export interface ApiKeyTemplateOptions {
	/** The environment variables to check, in priority order. */
	envVars: readonly string[];
	/** The environment to read from. Defaults to `process.env`. */
	env?: NodeJS.ProcessEnv;
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
 * fallback alone ends up with the fallback as the template.
 *
 * @param options - The template options.
 * @returns The template pi should resolve.
 */
export function apiKeyTemplate(options: ApiKeyTemplateOptions): string {
	const { envVars, env = process.env } = options;

	for (const name of envVars) {
		const value = env[name];
		if (value !== undefined && value !== "") return `$${name}`;
	}

	// Default to the first (primary) env var name
	return `$${envVars[0]}`;
}

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

/**
 * Allowed catalog domains to prevent SSRF.
 * Only these domains are permitted for catalog fetching.
 */
const ALLOWED_CATALOG_DOMAINS = [
	"anyrouter.dev",
	"aihubmix.com",
	"api.inferera.com",
] as const;

/**
 * Validate that a catalog URL is from an allowed domain.
 * Prevents SSRF by restricting fetch to known provider catalog endpoints.
 */
function validateCatalogUrl(url: string): void {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") {
			throw new Error("Catalog URL must use HTTPS");
		}
		const hostname = parsed.hostname;
		const allowed = ALLOWED_CATALOG_DOMAINS.some(
			(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
		);
		if (!allowed) {
			throw new Error(`Catalog domain not allowed: ${hostname}`);
		}
	} catch (err) {
		if (err instanceof Error && err.message.startsWith("Catalog")) throw err;
		throw new Error(`Invalid catalog URL: ${url}`);
	}
}

/**
 * Options for fetching a model catalog.
 */
export interface CatalogFetchOptions {
	/** Cancels the request. */
	signal: AbortSignal;
	/** The bearer key, when one is configured. The endpoint works without it. */
	apiKey?: string;
}

/**
 * Fetch a JSON catalog from a URL with auth, timeout, and abort handling.
 *
 * The URL is validated against an allowlist of known provider catalog domains
 * to prevent SSRF. Only HTTPS URLs from approved domains are accepted.
 *
 * @param url - The catalog URL (must be from an allowed domain).
 * @param options - The fetch options.
 * @returns The parsed JSON response.
 */
export async function fetchJsonCatalog<T>(url: string, options: CatalogFetchOptions): Promise<T> {
	// codacy[SSRF]: URL validated against allowlist before fetch
	validateCatalogUrl(url);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);

	// If the signal is already aborted, abort the controller immediately so the
	// fetch doesn't proceed. Also add a listener for future aborts.
	const onAbort = (): void => controller.abort();
	if (options.signal.aborted) {
		controller.abort();
	} else {
		options.signal.addEventListener("abort", onAbort);
	}

	try {
		const headers: Record<string, string> = {};
		if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

		// codacy[SSRF]: URL validated by validateCatalogUrl() which throws on invalid input
		const response = await fetch(url, {
			headers,
			redirect: "error",
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`Catalog request failed with HTTP ${response.status}`);
		}
		return (await response.json()) as T;
	} finally {
		clearTimeout(timeout);
		options.signal.removeEventListener("abort", onAbort);
	}
}

/**
 * Common interface for a model config that providers produce.
 */
export interface BaseModelConfig {
	id: string;
	name: string;
	api: "openai-completions";
	reasoning: boolean;
	thinkingLevelMap?: Record<string, string | null>;
	input: ("text" | "image")[];
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	contextWindow: number;
	maxTokens: number;
	compat: Record<string, unknown>;
}

/**
 * Options for creating a provider extension.
 */
export interface ProviderExtensionOptions<TModelConfig extends BaseModelConfig> {
	/** Unique provider id (e.g., "anyrouter-dev", "aihubmix-com"). */
	providerId: string;
	/** Display name for the provider. */
	providerName: string;
	/** Base URL for the provider's API. */
	baseUrl: string;
	/** Environment variable names for the API key, in priority order. */
	apiKeyEnvVars: readonly string[];
	/** Fetch the model catalog. */
	fetchCatalog: (options: CatalogFetchOptions) => Promise<any[]>;
	/** Convert a raw catalog entry to a pi model config. */
	toModelConfig: (entry: any) => TModelConfig;
	/** Convert a catalog array to model configs. */
	toModelConfigs: (entries: readonly any[]) => TModelConfig[];
	/** Convert model configs to stored models. */
	toStoredModels: (models: TModelConfig[]) => any[];
	/** Restore model configs from stored snapshot. */
	fromStoredModels: (stored: any) => TModelConfig[];
	/** Whether a model serves chat (for filtering). */
	isChatModel?: (entry: any) => boolean;
}

/**
 * Create a pi provider extension with common boilerplate.
 *
 * This handles:
 * - API key resolution and templates
 * - Catalog fetching with offline support
 * - Refresh logic with generation-based deduplication
 * - Persistence with checkedAt handling
 * - Stale refresh detection via generation counters
 *
 * @param options - Provider-specific configuration.
 * @returns An async function that registers the provider with pi.
 */
export function createProviderExtension<TModelConfig extends BaseModelConfig>(
	options: ProviderExtensionOptions<TModelConfig>,
) {
	const {
		providerId,
		providerName,
		baseUrl,
		apiKeyEnvVars,
		fetchCatalog,
		toModelConfig,
		toModelConfigs,
		toStoredModels,
		fromStoredModels,
		isChatModel,
	} = options;

	// Create API key functions for this provider
	const resolveProviderApiKey = (providerId: string, env: NodeJS.ProcessEnv = process.env) =>
		resolveApiKey({ envVars: apiKeyEnvVars, providerId, env });

	return async function providerExtension(pi: any): Promise<void> {
		const apiKey = resolveApiKey({ envVars: apiKeyEnvVars, providerId });
		const offline = isOffline();

		let models: TModelConfig[] = [];
		let refreshGeneration = 0;

		if (!offline) {
			const options = { signal: AbortSignal.timeout(15_000), apiKey };
			try {
				const entries = await fetchCatalog(options);
				const chatEntries = isChatModel ? entries.filter(isChatModel) : entries;
				models = toModelConfigs(chatEntries);
			} catch {
				// A catalog failure must not stop the extension from loading.
			}
		}

		pi.registerProvider(providerId, {
			name: providerName,
			baseUrl,
			apiKey: apiKeyTemplate({ envVars: apiKeyEnvVars }),
			api: "openai-completions",
			models,
			refreshModels: async (context: any): Promise<TModelConfig[]> => {
				// Restore persisted snapshot first
				const restored = fromStoredModels(context.stored);
				if (restored.length > 0) models = restored;

				let refreshed: TModelConfig[] = [];
				let refreshAccepted = false;

				if (context.allowNetwork) {
					const generation = ++refreshGeneration;
					const entries = await fetchCatalog({
						signal: context.signal,
						apiKey: credentialApiKey(context.credential) ?? resolveApiKey({ envVars: apiKeyEnvVars, providerId }),
					});
					const chatEntries = isChatModel ? entries.filter(isChatModel) : entries;
					refreshed = toModelConfigs(chatEntries);

					if (generation === refreshGeneration && refreshed.length > 0) {
						models = refreshed;
					}
				}

				if (models.length > 0) {
					await context.publish({
						persist: {
							models: toStoredModels(models),
						},
					});
				}
				return models;
			},
		});
	}
};

export type { BaseModelConfig, ProviderExtensionOptions, CatalogFetchOptions };
export { getAgentDir, readStoredCredential, credentialApiKey, resolveApiKey, apiKeyTemplate, isOffline, fetchJsonCatalog, validateCatalogUrl, createProviderExtension };