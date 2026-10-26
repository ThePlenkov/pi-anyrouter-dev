import type { AIHubMixModel } from "./catalog-types";

/** The pi model shape this extension produces (the subset it fills in). */
export interface AIHubMixModelConfig {
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
 * Reasoning effort values AIHubMix accepts. A request carrying any other
 * value is rejected with HTTP 400, so a level map may only contain these.
 */
const EFFORT_VALUES = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

/** Pi's thinking levels, in the order the picker shows them. */
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;

/** Fallback output cap for models whose upstream declares none. */
const DEFAULT_MAX_TOKENS = 4096;

/** Fallback context window when the catalog declares none. */
const DEFAULT_CONTEXT_WINDOW = 4096;

/**
 * A model serves chat when the catalog says it's an LLM type.
 */
function isChatModel(model: AIHubMixModel): boolean {
	const types = model.types.split(",").map((t) => t.trim());
	return types.includes("llm");
}

/**
 * The reasoning levels a model accepts, as a pi thinking-level map.
 *
 * AIHubMix reports reasoning controls in `reasoning_options` with `type: "effort"`
 * and lists the available values. A model with an explicit list gets exactly those
 * levels; a model that merely supports reasoning gets the standard ladder.
 */
function thinkingLevelMap(model: AIHubMixModel): Record<string, string | null> | undefined {
	if (!model.reasoning) return undefined;

	const effortOption = model.reasoning_options?.find((opt) => opt.type === "effort");
	const declared = effortOption?.values;
	const allowed = new Set<string>(declared ?? EFFORT_VALUES);

	const map: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
	for (const level of THINKING_LEVELS) {
		map[level] = allowed.has(level) ? level : null;
	}
	return map;
}

/**
 * The context window pi should assume for a model.
 */
function contextWindow(model: AIHubMixModel): number {
	const declared = model.context_length;
	return typeof declared === "number" && declared > 0 ? declared : DEFAULT_CONTEXT_WINDOW;
}

/** The output cap AIHubMix advertises, with a conservative fallback. */
function maxTokens(model: AIHubMixModel): number {
	const declared = model.max_output;
	return typeof declared === "number" && declared > 0 ? declared : DEFAULT_MAX_TOKENS;
}

/**
 * What the user actually pays, in dollars per million tokens.
 *
 * AIHubMix reports prices per million already.
 */
function cost(model: AIHubMixModel): AIHubMixModelConfig["cost"] {
	const pricing = model.pricing ?? {};
	return {
		input: pricing.input ?? 0,
		output: pricing.output ?? 0,
		cacheRead: pricing.cache_read ?? 0,
		cacheWrite: pricing.cache_write ?? 0,
	};
}

/** The input modalities pi can express (text and image only). */
function inputModalities(model: AIHubMixModel): ("text" | "image")[] {
	const modalities = model.input_modalities.split(",").map((m) => m.trim());
	const input: ("text" | "image")[] = [];
	if (modalities.includes("text")) input.push("text");
	if (modalities.includes("image")) input.push("image");
	return input.length > 0 ? input : ["text"];
}

/**
 * Per-model compatibility flags.
 *
 * AIHubMix uses OpenAI-compatible API, so max_tokens is the field to use.
 * Reasoning format follows OpenAI's nested format.
 */
function compat(model: AIHubMixModel): Record<string, unknown> {
	return {
		maxTokensField: "max_tokens",
		thinkingFormat: "openrouter",
		supportsDeveloperRole: false,
		supportsStore: false,
	};
}

/** Map one catalog entry to a pi chat model. */
export function toModelConfig(model: AIHubMixModel): AIHubMixModelConfig {
	const levelMap = thinkingLevelMap(model);
	return {
		id: model.model_id,
		name: model.model_name,
		api: "openai-completions",
		reasoning: model.reasoning,
		...(levelMap ? { thinkingLevelMap: levelMap } : {}),
		input: inputModalities(model),
		cost: cost(model),
		contextWindow: contextWindow(model),
		maxTokens: maxTokens(model),
		compat: compat(model),
	};
}

/** Map a whole catalog to pi chat models, dropping non-chat entries. */
export function toModelConfigs(models: readonly AIHubMixModel[]): AIHubMixModelConfig[] {
	return models.filter(isChatModel).map(toModelConfig);
}