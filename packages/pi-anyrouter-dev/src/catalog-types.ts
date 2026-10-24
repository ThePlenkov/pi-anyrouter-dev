/**
 * Wire types for AnyRouter's OpenAI-compatible catalog.
 *
 * The catalog at `GET /api/v1/models` follows the OpenRouter shape, but the
 * pricing fields are denominated per million tokens (not per token, as
 * OpenRouter reports them) and the reasoning block uses `levels`/`default`
 * instead of `supported_efforts`/`default_effort`. Only the fields this
 * extension maps are declared here.
 */

/** One upstream AnyRouter can route a model to. */
export interface AnyRouterUpstream {
	backend?: string;
	model_name?: string;
	llm_provider?: string;
	pricing?: {
		input_per_1m?: number;
		output_per_1m?: number;
	};
	list_pricing?: {
		input_per_1m?: number;
		output_per_1m?: number;
	};
	context?: {
		max_length?: number;
		max_completion_tokens?: number;
	};
	supported_parameters?: string[];
	features?: {
		streaming?: boolean;
		function_calling?: boolean;
		vision?: boolean;
		reasoning?: boolean;
	};
}

/** Reasoning controls a model exposes, as AnyRouter reports them. */
export interface AnyRouterReasoning {
	/** Effort values the model accepts. */
	levels?: string[];
	/** The effort used when the request does not pick one. */
	default?: string;
}

/** One catalog entry. */
export interface AnyRouterModel {
	id: string;
	name?: string;
	display_name?: string;
	owned_by?: string;
	provider?: string;
	capabilities?: string[];
	context_length?: number;
	architecture?: {
		modality?: string;
		input_modalities?: string[];
		output_modalities?: string[];
	};
	pricing?: {
		/** Per million tokens, already in the unit pi expects. */
		input_per_1m?: number;
		output_per_1m?: number;
		billing?: string;
	};
	top_provider?: {
		context_length?: number;
		max_completion_tokens?: number | null;
	};
	supported_parameters?: string[];
	reasoning?: AnyRouterReasoning;
	per_upstream?: AnyRouterUpstream[];
}

/** The catalog envelope. */
export interface AnyRouterCatalog {
	data?: AnyRouterModel[];
}
