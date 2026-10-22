import type { AnyRouterModel } from "./catalog-types.ts";

/**
 * Reasoning effort values AnyRouter accepts. A request carrying any other
 * value is rejected with HTTP 400, so a level map may only contain these.
 */
const EFFORT_VALUES = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

/** Pi's thinking levels, in the order the picker shows them. */
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;

/** The pi model shape this extension produces (the subset it fills in). */
export interface AnyRouterModelConfig {
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
 * Fallback output cap for models whose upstream declares none. Mirrors the
 * convention in pi's own OpenRouter catalog builder, which falls back to
 * 4096 when `max_completion_tokens` is absent. Asking for more than an
 * upstream accepts is a hard 400, so the conservative value is the safe one.
 */
const DEFAULT_MAX_TOKENS = 4096;

/** Fallback context window when the catalog declares none. */
const DEFAULT_CONTEXT_WINDOW = 4096;

/**
 * A model serves chat when the catalog says so. AnyRouter also lists
 * classifier-only and image-only entries under the same endpoint, and pi
 * would reject them as chat models.
 */
function isChatModel(model: AnyRouterModel): boolean {
	return (model.capabilities ?? []).includes("chat");
}

/**
 * The reasoning levels a model accepts, as a pi thinking-level map.
 *
 * AnyRouter reports reasoning controls in two shapes: a `reasoning` block
 * with explicit `levels`, and models that only advertise the `reasoning`
 * parameter. A model with an explicit list gets exactly those levels; a
 * model that merely supports reasoning gets the standard ladder, since
 * AnyRouter normalizes effort names across its upstreams.
 */
function thinkingLevelMap(model: AnyRouterModel): Record<string, string | null> | undefined {
	const declared = model.reasoning?.levels;
	const supportsReasoningParam = (model.supported_parameters ?? []).includes("reasoning");
	if (!declared && !supportsReasoningParam) return undefined;

	const allowed = new Set<string>(declared ?? EFFORT_VALUES);

	// A level the model does not accept must map to null, never to an
	// unmapped value: pi sends the mapped value verbatim, and AnyRouter
	// rejects unknown effort names with a 400.
	const map: Record<string, string | null> = { off: allowed.has("none") ? "none" : null };
	for (const level of THINKING_LEVELS) {
		map[level] = allowed.has(level) ? level : null;
	}
	return map;
}

/**
 * The context window pi should assume for a model.
 *
 * `top_provider.context_length` is the limit AnyRouter advertises for the
 * model as a whole, and it equals the top-level `context_length` for every
 * catalog entry. The per-upstream limits are narrower and vary per route,
 * so they describe one branch of the routing pool rather than the model.
 *
 * A model in early access can declare no limit at all: the catalog then
 * carries `0` rather than omitting the field. Zero is not a usable
 * context window for pi, so it falls back like a missing value does.
 */
function contextWindow(model: AnyRouterModel): number {
	const declared = model.top_provider?.context_length ?? model.context_length;
	return typeof declared === "number" && declared > 0 ? declared : DEFAULT_CONTEXT_WINDOW;
}

/** The output cap AnyRouter advertises, with a conservative fallback. */
function maxTokens(model: AnyRouterModel): number {
	const declared = model.top_provider?.max_completion_tokens;
	return typeof declared === "number" && declared > 0 ? declared : DEFAULT_MAX_TOKENS;
}

/**
 * What the user actually pays, in dollars per million tokens.
 *
 * AnyRouter reports prices per million already. For a `byok` model the
 * entry price equals the upstream list price, because the user's own
 * provider key is charged; for a `credits` model it is the pooled price.
 * Either way the entry price is what pi should show.
 */
function cost(model: AnyRouterModel): AnyRouterModelConfig["cost"] {
	return {
		input: model.pricing?.input_per_1m ?? 0,
		output: model.pricing?.output_per_1m ?? 0,
		// AnyRouter's catalog carries no cache pricing at the model level.
		cacheRead: 0,
		cacheWrite: 0,
	};
}

/** The input modalities pi can express: text always, image when offered. */
function inputModalities(model: AnyRouterModel): ("text" | "image")[] {
	const modalities = model.architecture?.input_modalities ?? [];
	const input: ("text" | "image")[] = ["text"];
	if (modalities.includes("image")) input.push("image");
	return input;
}

/**
 * Per-model compatibility flags.
 *
 * Every chat model in the catalog advertises the `max_tokens` parameter,
 * and AnyRouter accepts `max_completion_tokens` on the same routes, so
 * `max_tokens` is the field pi sends.
 *
 * Reasoning format is chosen per-model:
 * - Models that can route to nvidia upstreams use flat `reasoning_effort`
 *   (thinkingFormat: "openai") because nvidia rejects the nested
 *   `reasoning: { effort }` object with HTTP 400.
 * - All other models use nested `reasoning: { effort }`
 *   (thinkingFormat: "openrouter") to avoid the leak that occurs on some
 *   upstreams (notably kilo) when using the flat format.
 *
 * The `developer` role is not used: AnyRouter routes to upstreams with
 * differing role support, and `system` is understood everywhere.
 */
function compat(model: AnyRouterModel): Record<string, unknown> {
	// nvidia upstreams reject the nested `reasoning: { effort }` field.
	// AnyRouter passes it through and nvidia returns 400.
	// Use flat `reasoning_effort` for models that have an nvidia route.
	const hasNvidiaRoute = (model.per_upstream ?? []).some(
		(u) => u.backend === "nvidia" || u.backend?.startsWith("nvidia-"),
	);

	return {
		maxTokensField: "max_tokens",
		thinkingFormat: hasNvidiaRoute ? "openai" : "openrouter",
		supportsDeveloperRole: false,
		supportsStore: false,
	};
}

/** Map one catalog entry to a pi chat model. */
export function toModelConfig(model: AnyRouterModel): AnyRouterModelConfig {
	const name = model.display_name ?? model.name ?? model.id;
	const levelMap = thinkingLevelMap(model);
	return {
		id: model.id,
		name,
		api: "openai-completions",
		reasoning:
			(model.capabilities ?? []).includes("reasoning") ||
			(model.supported_parameters ?? []).includes("reasoning"),
		...(levelMap ? { thinkingLevelMap: levelMap } : {}),
		input: inputModalities(model),
		cost: cost(model),
		contextWindow: contextWindow(model),
		maxTokens: maxTokens(model),
		compat: compat(model),
	};
}

/** Map a whole catalog to pi chat models, dropping non-chat entries. */
export function toModelConfigs(models: readonly AnyRouterModel[]): AnyRouterModelConfig[] {
	return models.filter(isChatModel).map(toModelConfig);
}


