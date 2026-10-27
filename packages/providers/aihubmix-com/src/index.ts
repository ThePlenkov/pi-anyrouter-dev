import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createProviderExtension, type BaseModelConfig } from "@pi-extensions/shared";
import { toModelConfig, toModelConfigs, type AIHubMixModelConfig } from "./catalog";
import { fetchCatalog, type CatalogFetchOptions } from "./fetch-catalog";
import { BASE_URL, PROVIDER_ID, PROVIDER_NAME, isOffline } from "./provider-info";
import { PRIMARY_API_KEY_ENV, API_KEY_ENV_VARS } from "./api-key";

export { PROVIDER_ID, PROVIDER_NAME, BASE_URL, isOffline } from "./provider-info";
export { PRIMARY_API_KEY_ENV, API_KEY_ENV_VARS, PRIMARY_API_KEY_ENV as API_KEY_ENV } from "./api-key";

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
 * without shipping a static catalog that goes stale.
 */
export default createProviderExtension({
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
	})),
	fromStoredModels: (stored) => {
		const models = stored?.models ?? [];
		const restored: any[] = [];
		for (const model of models) {
			if (model.type !== undefined && model.type !== "chat") continue;
			if (typeof model.id !== "string" || typeof model.name !== "string") continue;
			if (typeof model.contextWindow !== "number" || typeof model.maxTokens !== "number") continue;
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
			});
		}
		return restored;
	},
	isChatModel: (entry: any) => (entry.types ?? "").split(",").map((t: string) => t.trim()).includes("llm"),
});