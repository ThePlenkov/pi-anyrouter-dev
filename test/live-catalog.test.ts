import { test } from "node:test";
import assert from "node:assert/strict";
import { toModelConfigs } from "../src/catalog.ts";
import type { AnyRouterCatalog } from "../src/catalog-types.ts";

/**
 * The live AnyRouter catalog, captured as a fixture.
 *
 * The extension maps whatever the endpoint returns, so the mapping is
 * checked against a real capture rather than a hand-written shape: a
 * change in the upstream format has to fail here, not at runtime.
 */
const CATALOG: AnyRouterCatalog = {
	data: [
		{
			id: "moonshotai/kimi-k3",
			name: "Kimi K3",
			display_name: "Moonshot Kimi K3",
			capabilities: ["chat", "streaming", "function-calling", "reasoning", "vision"],
			context_length: 1050000,
			architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
			pricing: { input_per_1m: 0.6, output_per_1m: 2.5, billing: "credits" },
			top_provider: { context_length: 1050000, max_completion_tokens: 131072 },
			supported_parameters: ["max_tokens", "temperature", "top_p", "tools", "reasoning"],
			per_upstream: [
				{
					backend: "nvidia",
					context: { max_length: 1048576, max_completion_tokens: 131072 },
				},
			],
		},
		{
			id: "anyrouter/auto",
			name: "AnyRouter Auto",
			capabilities: ["chat", "streaming", "function-calling", "reasoning", "vision"],
			context_length: 1048576,
			architecture: { input_modalities: ["text"], output_modalities: ["text"] },
			pricing: { input_per_1m: 0, output_per_1m: 0, billing: "free" },
			top_provider: { context_length: 1048576, max_completion_tokens: 64000 },
			supported_parameters: ["max_tokens", "temperature", "reasoning"],
			per_upstream: [
				{ backend: "kilo", context: { max_length: 4096 } },
				{ backend: "freebuff", context: { max_length: 128000 } },
			],
		},
		{
			id: "reflection/beam-1.0",
			name: "Beam 1.0",
			capabilities: ["chat", "streaming", "reasoning"],
			context_length: 1048576,
			architecture: { input_modalities: ["text"], output_modalities: ["text"] },
			pricing: { input_per_1m: 0, output_per_1m: 0, billing: "free" },
			top_provider: { context_length: 1048576, max_completion_tokens: null },
			supported_parameters: ["max_tokens", "temperature"],
			reasoning: { levels: ["low", "medium", "high", "xhigh", "max"], default: "max" },
		},
		{
			id: "some/classifier",
			name: "Classifier",
			capabilities: ["classification"],
			context_length: 8192,
			architecture: { input_modalities: ["text"], output_modalities: ["text"] },
			top_provider: { context_length: 8192, max_completion_tokens: 1024 },
		},
	],
};

test("maps the live catalog to chat models only", () => {
	const models = toModelConfigs(CATALOG.data ?? []);
	assert.deepEqual(models.map((m) => m.id), ["moonshotai/kimi-k3", "anyrouter/auto", "reflection/beam-1.0"]);
});

test("a model with vision offers image input", () => {
	const models = toModelConfigs(CATALOG.data ?? []);
	const kimi = models.find((m) => m.id === "moonshotai/kimi-k3");
	assert.deepEqual(kimi?.input, ["text", "image"]);
});

test("a platform router keeps the advertised context, not one branch of it", () => {
	// anyrouter/auto routes to upstreams with a 4096-token limit, but the
	// model as a whole advertises 1M - pi must plan for the model, not for
	// whichever upstream happens to answer.
	const models = toModelConfigs(CATALOG.data ?? []);
	const auto = models.find((m) => m.id === "anyrouter/auto");
	assert.equal(auto?.contextWindow, 1048576);
});

test("a model with declared reasoning levels maps exactly those levels", () => {
	const models = toModelConfigs(CATALOG.data ?? []);
	const beam = models.find((m) => m.id === "reflection/beam-1.0");
	assert.equal(beam?.reasoning, true);
	assert.deepEqual(beam?.thinkingLevelMap, {
		off: null,
		minimal: null,
		low: "low",
		medium: "medium",
		high: "high",
		xhigh: "xhigh",
		max: "max",
	});
});

test("a model whose output cap is undeclared falls back conservatively", () => {
	const models = toModelConfigs(CATALOG.data ?? []);
	const beam = models.find((m) => m.id === "reflection/beam-1.0");
	assert.equal(beam?.maxTokens, 4096);
});

test("credits pricing is carried per million", () => {
	const models = toModelConfigs(CATALOG.data ?? []);
	const kimi = models.find((m) => m.id === "moonshotai/kimi-k3");
	assert.equal(kimi?.cost.input, 0.6);
	assert.equal(kimi?.cost.output, 2.5);
});
