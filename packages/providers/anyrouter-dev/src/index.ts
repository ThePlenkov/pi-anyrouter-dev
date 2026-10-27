import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AnyModel, ModelsStoreEntry } from "@earendil-works/pi-ai";
import { createProviderExtension, type BaseModelConfig } from "@pi-extensions/shared";
import { toModelConfig, toModelConfigs, recomputeCompat, type AnyRouterModelConfig } from "./catalog";
import { fetchCatalog, type CatalogFetchOptions } from "./fetch-catalog";
import { BASE_URL, PROVIDER_ID, PROVIDER_NAME, isOffline } from "./provider-info";
import { PRIMARY_API_KEY_ENV, API_KEY_ENV_VARS } from "./api-key";

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
export default createProviderExtension<AnyRouterModelConfig>({
	providerId: PROVIDER_ID,
	providerName: PROVIDER_NAME,
	baseUrl: BASE_URL,
	apiKeyEnvVars: API_KEY_ENV_VARS,
	fetchCatalog,
	toModelConfig,
	toModelConfigs,
	toStoredModels: (models) => models.map((model) => ({
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
	})),
	fromStoredModels: (stored) => {
		const models = stored?.models ?? [];
		const restored: any[] = [];
		for (const model of models) {
			if (model.type !== undefined && model.type !== "chat") continue;
			if (typeof model.id !== "string" || typeof model.name !== "string") continue;
			if (typeof model.contextWindow !== "number" || typeof model.maxTokens !== "number") continue;
			const rawPerUpstream = (model as { perUpstream?: unknown }).perUpstream;
			const validPerUpstream = (value: unknown): value is any[] => {
				if (!Array.isArray(value) || value.length === 0) return false;
				return value.every(
					(u) => u !== null && typeof u === "object" && typeof (u as { backend?: unknown }).backend === "string",
				);
			};
			const perUpstream = validPerUpstream(rawPerUpstream) ? (rawPerUpstream as any[]) : undefined;
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
		return restored.map((model) => ({
			...model,
			compat: { ...model.compat, ...(model.compat || {}) },
		})).map((model) => {
			// Recompute compat from perUpstream
			const upstreams = model.perUpstream ?? [];
			const allNvidia = upstreams.length > 0 && upstreams.every((u: any) =>
				u.backend === "nvidia" || u.backend?.startsWith("nvidia-") === true
			);
			return {
				...model,
				compat: { ...model.compat, thinkingFormat: allNvidia ? "openai" : "openrouter" },
			};
		});
	},
	isChatModel: (entry: any) => (entry.capabilities ?? []).includes("chat"),
});