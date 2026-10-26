import type { AIHubMixCatalog, AIHubMixModel } from "./catalog-types";
import { fetchJsonCatalog } from "@pi-extensions/shared";

/** The catalog endpoint. It is public - no key is required to list models. */
export const CATALOG_URL = "https://aihubmix.com/api/v1/models";

/** What the catalog fetch needs to know. */
export interface CatalogFetchOptions {
	/** Cancels the request. */
	signal: AbortSignal;
	/** The bearer key, when one is configured. The endpoint works without it. */
	apiKey?: string;
}

/**
 * Fetch the AIHubMix model catalog.
 *
 * The endpoint is public, so the key is optional here. It is sent when one
 * is configured, because an authenticated request may return additional models.
 */
export async function fetchCatalog(options: CatalogFetchOptions): Promise<AIHubMixModel[]> {
	const payload = await fetchJsonCatalog<AIHubMixCatalog>(CATALOG_URL, options);
	return payload.data ?? [];
}