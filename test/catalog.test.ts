import { test } from "node:test";
import assert from "node:assert/strict";
import { toModelConfig, toModelConfigs, recomputeCompat } from "../src/catalog.ts";
import type { AnyRouterModel } from "../src/catalog-types.ts";

function model(overrides: Partial<AnyRouterModel> = {}): AnyRouterModel {
	return {
		id: "vendor/model",
		name: "Vendor Model",
		capabilities: ["chat"],
		context_length: 100000,
		architecture: { input_modalities: ["text"] },
		pricing: { input_per_1m: 1, output_per_1m: 2 },
		top_provider: { context_length: 100000, max_completion_tokens: 8000 },
		supported_parameters: ["max_tokens", "temperature"],
		...overrides,
	};
}

test("maps a chat model to a pi model", () => {
	const config = toModelConfig(model());
	assert.equal(config.id, "vendor/model");
	assert.equal(config.name, "Vendor Model");
	assert.equal(config.api, "openai-completions");
	assert.deepEqual(config.input, ["text"]);
	assert.equal(config.contextWindow, 100000);
	assert.equal(config.maxTokens, 8000);
	assert.deepEqual(config.cost, { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 });
});

test("drops entries that are not chat models", () => {
	const models = toModelConfigs([
		model({ id: "chat/one" }),
		model({ id: "classifier/one", capabilities: ["classification"] }),
		model({ id: "image/one", capabilities: ["image"] }),
	]);
	assert.deepEqual(models.map((m) => m.id), ["chat/one"]);
});

test("prices are read as dollars per million, not per token", () => {
	// AnyRouter reports per-million prices; a per-token reading would
	// show a millionth of the real cost.
	const config = toModelConfig(model({ pricing: { input_per_1m: 0.075, output_per_1m: 0.42 } }));
	assert.equal(config.cost.input, 0.075);
	assert.equal(config.cost.output, 0.42);
});

test("a free model costs nothing", () => {
	const config = toModelConfig(
		model({ pricing: { input_per_1m: 0, output_per_1m: 0, billing: "free" } }),
	);
	assert.equal(config.cost.input, 0);
	assert.equal(config.cost.output, 0);
});

test("image input is added only when the model offers it", () => {
	assert.deepEqual(
		toModelConfig(model({ architecture: { input_modalities: ["text", "image"] } })).input,
		["text", "image"],
	);
	assert.deepEqual(toModelConfig(model()).input, ["text"]);
});

test("context window prefers the top provider", () => {
	const config = toModelConfig(
		model({ context_length: 100000, top_provider: { context_length: 200000, max_completion_tokens: 1000 } }),
	);
	assert.equal(config.contextWindow, 200000);
});

test("a model that declares no context window falls back", () => {
	// AnyRouter reports `0` (not a missing field) for an early-access
	// model with no declared limit. Zero would break pi's overflow math.
	const config = toModelConfig(
		model({ context_length: 0, top_provider: { context_length: 0, max_completion_tokens: 4096 } }),
	);
	assert.equal(config.contextWindow, 4096);
});

test("an undeclared output cap falls back to a conservative value", () => {
	const config = toModelConfig(model({ top_provider: { context_length: 100000, max_completion_tokens: null } }));
	assert.equal(config.maxTokens, 4096);
});

test("a model without reasoning support has no thinking map", () => {
	const config = toModelConfig(model());
	assert.equal(config.reasoning, false);
	assert.equal(config.thinkingLevelMap, undefined);
});

test("a reasoning model maps every level it accepts", () => {
	const config = toModelConfig(
		model({
			capabilities: ["chat", "reasoning"],
			supported_parameters: ["max_tokens", "reasoning"],
			reasoning: { levels: ["low", "medium", "high"], default: "medium" },
		}),
	);
	assert.equal(config.reasoning, true);
	assert.deepEqual(config.thinkingLevelMap, {
		off: null,
		minimal: null,
		low: "low",
		medium: "medium",
		high: "high",
		xhigh: null,
		max: null,
	});
});

test("a reasoning model without declared levels gets the full ladder", () => {
	const config = toModelConfig(
		model({ capabilities: ["chat", "reasoning"], supported_parameters: ["max_tokens", "reasoning"] }),
	);
	assert.equal(config.thinkingLevelMap?.off, "none");
	assert.equal(config.thinkingLevelMap?.max, "max");
});

test("compat uses max_tokens and the nested reasoning object", () => {
	const config = toModelConfig(model());
	assert.equal(config.compat.maxTokensField, "max_tokens");
	assert.equal(config.compat.thinkingFormat, "openrouter");
	assert.equal(config.compat.supportsDeveloperRole, false);
	assert.equal(config.compat.supportsStore, false);
});

test("compat uses flat reasoning for models that route to nvidia", () => {
	const config = toModelConfig(
		model({ per_upstream: [{ backend: "nvidia", context: { max_length: 100000 } }] }),
	);
	assert.equal(config.compat.thinkingFormat, "openai");
});

// A model that routes to both nvidia and a non-nvidia upstream has no
// single format that works: flat leaks reasoning into message content on
// kilo, while nested is rejected by nvidia with HTTP 400. pi resolves the
// format once per model, so the safe default is the nested form - correct
// on the routes most models use - and flat is used only when every
// declared route is nvidia.
test("compat uses nested reasoning when a model also has a non-nvidia route", () => {
	const config = toModelConfig(
		model({
			per_upstream: [
				{ backend: "nvidia", context: { max_length: 100000 } },
				{ backend: "kilo", context: { max_length: 4096 } },
			],
		}),
	);
	assert.equal(config.compat.thinkingFormat, "openrouter");
});

test("recomputeCompat restores the format from current upstream routes", () => {
	const restored = recomputeCompat({
		id: "x",
		name: "x",
		api: "openai-completions",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
		compat: { thinkingFormat: "openrouter", maxTokensField: "max_tokens" },
		perUpstream: [{ backend: "nvidia" }],
	});
	assert.equal(restored.compat.thinkingFormat, "openai");
});
