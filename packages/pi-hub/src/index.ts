import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createProviderExtension, type BaseModelConfig } from "@pi-extensions/shared";
import { toModelConfig, toModelConfigs, type AnyRouterModelConfig } from "../providers/anyrouter-dev/src/catalog";
import { fetchCatalog as fetchAnyRouterCatalog, type CatalogFetchOptions } from "../providers/anyrouter-dev/src/fetch-catalog";
import { toModelConfig as toAIHubMixModelConfig, toModelConfigs as toAIHubMixModelConfigs, type AIHubMixModelConfig } from "../providers/aihubmix-com/src/catalog";
import { fetchCatalog as fetchAIHubMixCatalog } from "../providers/aihubmix-com/src/fetch-catalog";
import { BASE_URL as ANYROUTER_BASE_URL, PROVIDER_ID as ANYROUTER_PROVIDER_ID, PROVIDER_NAME as ANYROUTER_PROVIDER_NAME, API_KEY_ENV_VARS as ANYROUTER_API_KEY_ENV_VARS } from "../providers/anyrouter-dev/src/provider-info";
import { BASE_URL as AIHUBMIX_BASE_URL, PROVIDER_ID as AIHUBMIX_PROVIDER_ID, PROVIDER_NAME as AIHUBMIX_PROVIDER_NAME, API_KEY_ENV_VARS as AIHUBMIX_API_KEY_ENV_VARS } from "../providers/aihubmix-com/src/provider-info";
import { PRIMARY_API_KEY_ENV as ANYROUTER_PRIMARY_API_KEY_ENV, API_KEY_ENV_VARS as ANYROUTER_API_KEY_ENV_VARS } from "../providers/anyrouter-dev/src/api-key";
import { PRIMARY_API_KEY_ENV as AIHUBMIX_PRIMARY_API_KEY_ENV, API_KEY_ENV_VARS as AIHUBMIX_API_KEY_ENV_VARS } from "../providers/aihubmix-com/src/api-key";

/**
 * pi-hub: All-in-one pi extension registering both providers.
 *
 * This bundle contains:
 * - Shared utilities (API key resolution, catalog fetching, etc.)
 * - AnyRouter (anyrouter.dev) provider
 * - AIHubMix (aihubmix.com) provider
 *
 * Zero external dependencies at runtime — tsdown bundles everything.
 */
export default async function piHubExtension(pi: ExtensionAPI): Promise<void> {
	// Register AnyRouter provider
	await createProviderExtension({
		providerId: "anyrouter-dev",
		providerName: "AnyRouter (dev)",
		baseUrl: "https://anyrouter.dev/api/v1",
		apiKeyEnvVars: ["ANYROUTER_DEV_API_KEY", "ANYROUTER_API_KEY"],
		fetchCatalog: async (options) => {
			const response = await fetch("https://anyrouter.dev/api/v1/models?all=1", {
				headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {},
				signal: options.signal,
			});
			if (!response.ok) throw new Error(`AnyRouter catalog request failed with HTTP ${response.status}`);
			const payload = await response.json() as any;
			return payload.data ?? [];
		},
		toModelConfig: (entry: any) => {
			const capabilities = entry.capabilities ?? [];
			const reasoning = capabilities.includes("reasoning") || (entry.supported_parameters ?? []).includes("reasoning");
			const declared = entry.reasoning?.levels;
			const allowed = new Set<string>(declared ?? ["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
			const thinkingLevels = ["minimal", "low", "medium", "high", "xhigh", "max"];
			const thinkingLevelMap: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
			for (const level of thinkingLevels) {
				thinkingLevelMap[level] = allowed.has(level) ? level : null;
			}
			return {
				id: entry.id,
				name: entry.display_name ?? entry.name ?? entry.id,
				api: "openai-completions",
				reasoning,
				thinkingLevelMap,
				input: entry.architecture?.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
				cost: {
					input: entry.pricing?.input_per_1m ?? 0,
					output: entry.pricing?.output_per_1m ?? 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
				contextWindow: entry.top_provider?.context_length ?? entry.context_length ?? 4096,
				maxTokens: entry.top_provider?.max_completion_tokens ?? 4096,
				compat: {
					maxTokensField: "max_tokens",
					thinkingFormat: "openrouter",
					supportsDeveloperRole: false,
					supportsStore: false,
				},
			};
		},
		toModelConfigs: (entries: readonly any[]) => entries.filter((e) => (e.capabilities ?? []).includes("chat")).map((e) => {
			const capabilities = e.capabilities ?? [];
			const reasoning = capabilities.includes("reasoning") || (e.supported_parameters ?? []).includes("reasoning");
			const declared = e.reasoning?.levels;
			const allowed = new Set<string>(declared ?? ["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
			const thinkingLevels = ["minimal", "low", "medium", "high", "xhigh", "max"];
			const thinkingLevelMap: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
			for (const level of thinkingLevels) {
				thinkingLevelMap[level] = allowed.has(level) ? level : null;
			}
			return {
				id: e.id,
				name: e.display_name ?? e.name ?? e.id,
				api: "openai-completions",
				reasoning,
				thinkingLevelMap,
				input: e.architecture?.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
				cost: {
					input: e.pricing?.input_per_1m ?? 0,
					output: e.pricing?.output_per_1m ?? 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
				contextWindow: e.top_provider?.context_length ?? e.context_length ?? 4096,
				maxTokens: e.top_provider?.max_completion_tokens ?? 4096,
				compat: {
					maxTokensField: "max_tokens",
					thinkingFormat: "openrouter",
					supportsDeveloperRole: false,
					supportsStore: false,
				},
			};
		}).filter((e) => (e.capabilities ?? []).includes("chat")),
		toStoredModels: (models) => models.map((model) => ({
			type: "chat",
			id: model.id,
			name: model.name,
			api: model.api,
			provider: "anyrouter-dev",
			baseUrl: "https://anyrouter.dev/api/v1",
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
		return restored.map((model) => ({
			...model,
			compat: { ...model.compat, ...(model.compat || {}) },
		})).map((model) => {
			const upstreams = model.perUpstream ?? [];
			const allNvidia = upstreams.length > 0 && upstreams.every((u: any) =>
				u.backend === "nvidia" || u.backend?.startsWith("nvidia-") === true
			);
			return {
				...model,
				compat: { ...model.compat, thinkingFormat: allNvidia ? "openai" : "openrouter" },
			};
		}),
	isChatModel: (entry: any) => (entry.capabilities ?? []).includes("chat"),
	fetchCatalog: async (options) => {
		const response = await fetch("https://anyrouter.dev/api/v1/models?all=1", {
			headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {},
			signal: options.signal,
		});
		if (!response.ok) throw new Error(`AnyRouter catalog request failed with HTTP ${response.status}`);
		const payload = await response.json() as any;
		return payload.data ?? [];
	},
	toModelConfig: (entry: any) => {
		const capabilities = entry.capabilities ?? [];
		const reasoning = entry.capabilities.includes("reasoning") || (entry.supported_parameters ?? []).includes("reasoning");
		const declared = entry.reasoning?.levels;
		const allowed = new Set<string>(declared ?? ["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
		const thinkingLevels = ["minimal", "low", "medium", "high", "xhigh", "max"];
		const thinkingLevelMap: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
		for (const level of thinkingLevels) {
			thinkingLevelMap[level] = allowed.has(level) ? level : null;
		}
		return {
			id: entry.id,
			name: entry.display_name ?? entry.name ?? entry.id,
			api: "openai-completions",
			reasoning,
			thinkingLevelMap,
			input: entry.architecture?.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
			cost: {
				input: entry.pricing?.input_per_1m ?? 0,
				output: entry.pricing?.output_per_1m ?? 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: entry.top_provider?.context_length ?? entry.context_length ?? 4096,
			maxTokens: entry.top_provider?.max_completion_tokens ?? 4096,
			compat: {
				maxTokensField: "max_tokens",
				thinkingFormat: "openrouter",
				supportsDeveloperRole: false,
				supportsStore: false,
			},
		};
	},
	toModelConfigs: (entries: readonly any[]) => entries.filter((e) => (e.capabilities ?? []).includes("chat")).map((e) => {
		const capabilities = e.capabilities ?? [];
		const reasoning = e.capabilities.includes("reasoning") || (e.supported_parameters ?? []).includes("reasoning");
		const declared = e.reasoning?.levels;
		const allowed = new Set<string>(declared ?? ["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
		const thinkingLevels = ["minimal", "low", "medium", "high", "xhigh", "max"];
		const thinkingLevelMap: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
		for (const level of thinkingLevels) {
			thinkingLevelMap[level] = allowed.has(level) ? level : null;
		}
		return {
			id: e.id,
			name: e.display_name ?? e.name ?? e.id,
			api: "openai-completions",
			reasoning: e.capabilities.includes("reasoning") || (e.supported_parameters ?? []).includes("reasoning"),
			thinkingLevelMap,
			input: e.architecture?.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
			cost: {
				input: e.pricing?.input_per_1m ?? 0,
				output: e.pricing?.output_per_1m ?? 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: e.top_provider?.context_length ?? e.context_length ?? 4096,
			maxTokens: e.top_provider?.max_completion_tokens ?? 4096,
			compat: {
				maxTokensField: "max_tokens",
				thinkingFormat: "openrouter",
				supportsDeveloperRole: false,
				supportsStore: false,
			},
		};
	}).filter((e) => (e.capabilities ?? []).includes("chat")),
});