/**
 * Wire types for AIHubMix's model catalog.
 *
 * The catalog at `GET /api/v1/models` returns models with pricing, context,
 * capabilities, and endpoint information.
 */

/** One catalog entry. */
export interface AIHubMixModel {
	model_id: string;
	model_name: string;
	developer_id: number;
	desc: string;
	vendor: string;
	types: string;
	features: string;
	input_modalities: string;
	output_modalities: string;
	endpoints: string;
	max_output: number;
	context_length: number;
	release_date: string;
	last_updated: string;
	open_weights: boolean;
	schema_checked: boolean;
	pricing: {
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
		tiers?: Array<{
			tier: { type: string; size: number };
			input: number;
			output: number;
			cache_read: number;
			cache_write: number;
		}>;
	};
	pricing_source: string;
	has_zdr_provider: boolean;
	reasoning: boolean;
	tool_call: boolean;
	reasoning_options?: Array<{
		type: "toggle" | "effort" | "budget_tokens";
		values?: string[];
		default?: string;
	}>;
	interleaved?: Record<string, boolean | { field: string }>;
	variant_of?: string;
	variant_kind?: string;
	retire_stage: string;
	deprecated_at?: string;
	retired_at?: string;
	successor_model?: string;
	promotion?: {
		name: string;
		off_percent: number;
		time_type: "absolute" | "daily" | "weekly";
	};
}

/** The catalog envelope. */
export interface AIHubMixCatalog {
	data: AIHubMixModel[];
}