import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AnyModel, ModelsStoreEntry } from "@earendil-works/pi-ai";
import { apiKeyTemplate, resolveApiKey, credentialApiKey, API_KEY_ENV_VARS, PRIMARY_API_KEY_ENV } from "./api-key";
import { toModelConfigs, recomputeCompat, type AnyRouterModelConfig } from "./catalog";
import { fetchCatalog, type CatalogFetchOptions } from "./fetch-catalog";
import { BASE_URL, PROVIDER_ID, PROVIDER_NAME, isOffline } from "./provider-info";

export { PROVIDER_ID, PROVIDER_NAME, BASE_URL, isOffline } from "./provider-info";

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
	// Serializes overlapping refreshes: pi can call `refreshModels` again
	// while a catalog fetch is still in flight (startup, model-picker open,
	// retry). A newer refresh must not let an older one overwrite its result, so
	// each call stamps a generation and the result is applied only when its
	// generation is still the latest.
	let refreshGeneration = 0;
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
			let refreshed: AnyRouterModelConfig[] = [];
			if (context.allowNetwork) {
				const generation = ++refreshGeneration;
				refreshed = toModelConfigs(
					await fetchCatalog({
						signal: context.signal,
						apiKey: credentialApiKey(context.credential) ?? apiKey,
					}),
				);
				// A newer refresh may have started while this one fetched; ignore a
				// stale result so it cannot overwrite the current catalog and its
				// per-upstream reasoning formats.
				if (generation === refreshGeneration && refreshed.length > 0) models = refreshed;
			}

			// Persist the catalog, so the next start - online or offline -
			// has a model list even before the first refresh completes.
			// Only update checkedAt when a successful network fetch returns models.
			// If the fetch returned empty, we keep the old checkedAt from stored.
			if (models.length > 0) {
				const hasNewModels = context.allowNetwork && refreshed.length > 0;
				const checkedAt = hasNewModels ? Date.now() : context.stored?.checkedAt;
				await context.publish({
					persist: {
						models: toStoredModels(models),
						...(checkedAt !== undefined ? { checkedAt } : {}),
					},
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
 * Validate the `perUpstream` array a persisted model may carry.
 *
 * `perUpstream` is this extension's own field, so a snapshot written by a
 * future or foreign version of the package can hold anything. A bare cast
 * would accept a string or an array of nulls, and `recomputeCompat` would
 * then call `.every()` on it and fail the refresh. Validate the shape
 * before restoring: an array whose every entry is an object with a
 * `backend` field.
 */
function validPerUpstream(value: unknown): value is AnyRouterModelConfig["perUpstream"] {
	if (!Array.isArray(value) || value.length === 0) return false;
	return value.every(
		(u) =>
			u !== null &&
			typeof u === "object" &&
			typeof (u as { backend?: unknown }).backend === "string",
	);
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
		// does not declare it, so it is read through a narrow cast and
		// validated before use.
		// `perUpstream` is this extension's own field, carried through pi's
		// persisted model so a restored catalog can recompute `compat`. pi
		// does not declare it on its `Model` type, so read it through a cast
		// and validate the untyped persisted value before use.
		const rawPerUpstream = (model as { perUpstream?: unknown }).perUpstream;
		const perUpstream =
			validPerUpstream(rawPerUpstream) ? (rawPerUpstream as AnyRouterModelConfig["perUpstream"]) : undefined;
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

export { toModelConfig, toModelConfigs } from "./catalog";
export { apiKeyTemplate, resolveApiKey, credentialApiKey, API_KEY_ENV_VARS } from "./api-key";
export type { AnyRouterModelConfig } from "./catalog";
export type { AnyRouterCatalog, AnyRouterModel } from "./catalog-types";