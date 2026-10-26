import { test } from "node:test";
import assert from "node:assert/strict";
import { toModelConfig, toModelConfigs } from "../src/catalog.ts";
import type { AIHubMixModel } from "../src/catalog-types.ts";

function model(overrides: Partial<AIHubMixModel> = {}): AIHubMixModel {
	return {
		model_id: "vendor/model",
		model_name: "Vendor Model",
		developer_id: 1,
		desc: "Test model",
		vendor: "test",
		types: "llm",
		features: "",
		input_modalities: "text",
		output_modalities: "text",
		endpoints: "chat_completions",
		max_output: 8000,
		context_length: 100000,
		release_date: "2024-01-01",
		last_updated: "2024-01-01",
		open_weights: false,
		schema_checked: false,
		pricing: { input: 1, output: 2 },
		pricing_source: "test",
		has_zdr_provider: false,
		reasoning: false,
		tool_call: false,
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
		model({ model_id: "chat/one" }),
		model({ model_id: "image/one", types: "image_generation" }),
		model({ model_id: "embedding/one", types: "embedding" }),
		model({ model_id: "tts/one", types: "tts" }),
		model({ model_id: "stt/one", types: "stt" }),
		model({ model_id: "rerank/one", types: "rerank" }),
		model({ model_id: "video/one", types: "video" }),
		model({ model_id: "3d/one", types: "3d" }),
		model({ model_id: "search/one", types: "search" }),
	]);
	assert.deepEqual(models.map((m) => m.id), ["chat/one"]);
});

test("keeps models that have llm in types list", () => {
	const models = toModelConfigs([
		model({ model_id: "multi/one", types: "llm,image_generation" }),
	]);
	assert.deepEqual(models.map((m) => m.id), ["multi/one"]);
});

test("prices are read as dollars per million", () => {
	const config = toModelConfig(model({ pricing: { input: 0.075, output: 0.42 } }));
	assert.equal(config.cost.input, 0.075);
	assert.equal(config.cost.output, 0.42);
});

test("cache pricing is read when present", () => {
	const config = toModelConfig(model({ pricing: { input: 1, output: 2, cache_read: 0.1, cache_write: 0.2 } }));
	assert.equal(config.cost.cacheRead, 0.1);
	assert.equal(config.cost.cacheWrite, 0.2);
});

test("a free model costs nothing", () => {
	const config = toModelConfig(model({ pricing: { input: 0, output: 0 } }));
	assert.equal(config.cost.input, 0);
	assert.equal(config.cost.output, 0);
});

test("image input is added when the model offers it", () => {
	assert.deepEqual(
		toModelConfig(model({ input_modalities: "text,image" })).input,
		["text", "image"],
	);
	assert.deepEqual(toModelConfig(model({ input_modalities: "text" })).input, ["text"]);
});

test("audio and video input modalities are filtered (pi only supports text and image)", () => {
	assert.deepEqual(
		toModelConfig(model({ input_modalities: "text,audio,video" })).input,
		["text"],
	);
});

test("context window falls back when zero", () => {
	const config = toModelConfig(model({ context_length: 0 }));
	assert.equal(config.contextWindow, 4096);
});

test("output cap falls back when zero", () => {
	const config = toModelConfig(model({ max_output: 0 }));
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
			reasoning: true,
			reasoning_options: [{ type: "effort", values: ["low", "medium", "high"], default: "medium" }],
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
	const config = toModelConfig(model({ reasoning: true }));
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