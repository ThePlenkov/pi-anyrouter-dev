import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { toModelConfigs, type AnyRouterModelConfig } from "./catalog.ts";
import { fetchCatalog, type CatalogFetchOptions } from "./fetch-catalog.ts";

/** The provider id pi stores the entry under. */
export const PROVIDER_ID = "anyrouter";

/** The display name shown in pi's model picker. */
export const PROVIDER_NAME = "AnyRouter";

/** AnyRouter's OpenAI-compatible base URL. */
export const BASE_URL = "https://anyrouter.dev/api/v1";

/** The env var holding the AnyRouter API key. */
export const API_KEY_ENV = "ANYROUTER_API_KEY";

/**
 * The plugin entry point.
 *
 * This is the whole extension: pi already ships an OpenAI-compatible
 * client, so registering the provider with `api: "openai-completions"`
 * makes pi route the models through its own streaming implementation.
 * No HTTP client, no SSE parser, and no retry logic live here - the only
 * code this package owns is the catalog mapping in `catalog.ts`.
 *
 * The factory is async on purpose. pi awaits it before it resolves models,
 * so the catalog is fetched once here and the provider is registered with
 * the result. That keeps the model list correct from the first prompt,
 * without shipping a static catalog that goes stale - the model list on
 * AnyRouter changes daily.
 */
export default async function anyRouterExtension(pi: ExtensionAPI): Promise<void> {
	const options: CatalogFetchOptions = { signal: AbortSignal.timeout(15_000) };
	let models: AnyRouterModelConfig[] = [];
	try {
		models = toModelConfigs(await fetchCatalog(options));
	} catch {
		// A catalog failure must not stop the extension from loading: pi
		// keeps whatever snapshot it already has, and `refreshModels` below
		// retries once the provider is live.
	}

	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: BASE_URL,
		apiKey: `$${API_KEY_ENV}`,
		api: "openai-completions",
		models,
		refreshModels: async (context): Promise<AnyRouterModelConfig[]> => {
			const refreshed = toModelConfigs(await fetchCatalog({ signal: context.signal }));
			return refreshed.length > 0 ? refreshed : models;
		},
	});
}

export { toModelConfig, toModelConfigs } from "./catalog.ts";
export type { AnyRouterModelConfig } from "./catalog.ts";
export type { AnyRouterCatalog, AnyRouterModel } from "./catalog-types.ts";

