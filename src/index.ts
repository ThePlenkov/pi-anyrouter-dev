import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AnyModel, ModelsStoreEntry } from "@earendil-works/pi-ai";
import { apiKeyTemplate, resolveApiKey, credentialApiKey, API_KEY_ENV_VARS, PRIMARY_API_KEY_ENV } from "./api-key.ts";
import { toModelConfigs, recomputeCompat, type AnyRouterModelConfig } from "./catalog.ts";
import { fetchCatalog, type CatalogFetchOptions } from "./fetch-catalog.ts";
import { BASE_URL, PROVIDER_ID, PROVIDER_NAME, isOffline } from "./provider-info.ts";

export { PROVIDER_ID, PROVIDER_NAME, BASE_URL, isOffline } from "./provider-info.ts";

/**
 * The env vars holding the AnyRouter API key, in priority order.
 *
 * `ANYROUTER_DEV_API_KEY` is the name this package owns. `ANYROUTER_API_KEY`
 * is AnyRouter's own documented name and is accepted as a fallback, but the
 * other AnyRouter extension on the registry reads that same variable for a
 * different service, so it cannot be the primary name here.
 */
export const API_KEY_ENV = PRIMARY_API_KEY_ENV;

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
	// The key is resolved up front so the catalog request can be
	// authenticated. The endpoint answers without a key, but an
	// authenticated request returns one more model (`minimax/minimax-m3.1-flash`),
	// and the key a user configured is the one whose entitlements apply.
	const apiKey = resolveApiKey(PROVIDER_ID);

	// Offline mode means no catalog request at all. pi hands the persisted
	// snapshot back through `refreshModels` instead, so the model list is
	// still there - just not freshly fetched.
	const offline = isOffline();

	let models: AnyRouterModelConfig[] = [];
	if (!offline) {
		const options: CatalogFetchOptions = { signal: AbortSignal.timeout(15_000), apiKey };
		try {
			models = toModelConfigs(await fetchCatalog(options));
		} catch {
			// A catalog failure must not stop the extension from loading: pi
			// keeps whatever snapshot it already has, and `refreshModels` below
			// retries once the provider is live.
		}
	}

	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: BASE_URL,
		// pi resolves the env template at request time, so a key exported
		// after startup still applies. The stored credential under this
		// provider id is picked up by pi itself.
		apiKey: apiKeyTemplate(),
		api: "openai-completions",
		models,
		refreshModels: async (context): Promise<AnyRouterModelConfig[]> => {
			// The persisted snapshot is restored first, whatever the mode.
			// `context.stored` holds the models of the last successful fetch
			// for this provider id, so an offline start still has a catalog.
			const restored = fromStoredModels(context.stored);
			if (restored.length > 0) models = restored;

			// pi calls this on startup and on every model-picker refresh. In
			// offline mode it must not reach the network - pi says so through
			// `allowNetwork`, and the catalog it already holds stays in place.
			if (context.allowNetwork) {
				const refreshed = toModelConfigs(
					await fetchCatalog({
						signal: context.signal,
						apiKey: credentialApiKey(context.credential) ?? apiKey,
					}),
				);
				if (refreshed.length > 0) models = refreshed;
			}

			// Persist the catalog, so the next start - online or offline -
			// has a model list even before the first refresh completes.
			if (models.length > 0) {
				await context.publish({
					persist: { models: toStoredModels(models), checkedAt: Date.now() },
				});
			}
			return models;
		},
	});
}

/**
 * Convert the model configs into the full model shape pi persists.
 *
 * pi stores models as complete objects, with the provider and base URL
 * already filled in - that is what it hands back through `context.stored`.
 */
function toStoredModels(models: AnyRouterModelConfig[]): AnyModel[] {
	return models.map((model) => ({
		type: "chat",
		id: model.id,
		name: model.name,
		api: model.api,
		provider: PROVIDER_ID,
		baseUrl: BASE_URL,
		input: model.input,
		cost: model.cost,
		reasoning: model.reasoning,
		...(model.thinkingLevelMap ? { thinkingLevelMap: model.thinkingLevelMap } : {}),
		contextWindow: model.contextWindow,
		maxTokens: model.maxTokens,
		compat: model.compat,
		...(model.perUpstream ? { perUpstream: model.perUpstream } : {}),
	}));
}

/**
 * Read the model configs back out of a persisted snapshot.
 *
 * The snapshot is pi's own file, so its shape is not this package's to
 * assume: entries that do not carry the fields a model config needs are
 * skipped rather than turned into a broken model.
 */
function fromStoredModels(stored: Readonly<ModelsStoreEntry> | undefined): AnyRouterModelConfig[] {
	const models = stored?.models ?? [];
	const restored: AnyRouterModelConfig[] = [];
	for (const model of models) {
		if (model.type !== undefined && model.type !== "chat") continue;
		if (typeof model.id !== "string" || typeof model.name !== "string") continue;
		if (typeof model.contextWindow !== "number" || typeof model.maxTokens !== "number") continue;
		// `perUpstream` is this extension's own field, carried through pi's
		// persisted model so a restored catalog can recompute `compat`. pi
		// does not declare it, so it is read through a narrow cast.
		const perUpstream = (model as { perUpstream?: AnyRouterModelConfig["perUpstream"] }).perUpstream;
		restored.push({
			id: model.id,
			name: model.name,
			api: "openai-completions",
			reasoning: model.reasoning === true,
			...(model.thinkingLevelMap ? { thinkingLevelMap: model.thinkingLevelMap } : {}),
			input: model.input ?? ["text"],
			cost: model.cost,
			contextWindow: model.contextWindow,
			maxTokens: model.maxTokens,
			compat: model.compat ?? {},
			...(perUpstream ? { perUpstream } : {}),
		});
	}
	// The persisted snapshot can carry a `compat` that was correct when it
	// was saved, but the reasoning format depends on the upstreams the
	// model routes to, and that can change between refreshes. Recompute it
	// from the routes the snapshot also carries, so a restored NVIDIA-only
	// model does not keep sending the nested reasoning object and getting
	// HTTP 400.
	return restored.map(recomputeCompat);
}

export { toModelConfig, toModelConfigs } from "./catalog.ts";
export { apiKeyTemplate, resolveApiKey, credentialApiKey, API_KEY_ENV_VARS } from "./api-key.ts";
export type { AnyRouterModelConfig } from "./catalog.ts";
export type { AnyRouterCatalog, AnyRouterModel } from "./catalog-types.ts";

