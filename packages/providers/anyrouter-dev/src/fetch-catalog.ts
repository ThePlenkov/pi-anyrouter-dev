import type { AnyRouterCatalog, AnyRouterModel } from "./catalog-types";
import { fetchJsonCatalog } from "@pi-extensions/shared";

/** The catalog endpoint. It is public - no key is required to list models. */
export const CATALOG_URL = "https://anyrouter.dev/api/v1/models";

/** What the catalog fetch needs to know. */
export interface CatalogFetchOptions {
	/** Cancels the request. */
	signal: AbortSignal;
	/** The bearer key, when one is configured. The endpoint works without it. */
	apiKey?: string;
}

/**
 * Fetch the AnyRouter model catalog.
 *
 * The endpoint is public, so the key is optional here. It is sent when one
 * is configured, because an authenticated request returns the same catalog.
 */
export async function fetchCatalog(options: CatalogFetchOptions): Promise<AnyRouterModel[]> {
	// `all=1` returns the full catalog, including BYOK-only models that the
	// default endpoint omits until the caller can reach them. The extension
	// lists every model AnyRouter advertises, so an unconfigured BYOK model
	// is listed and answers `404 model_unavailable` - AnyRouter's billing
	// rule, not a catalog defect.
	const payload = await fetchJsonCatalog<AnyRouterCatalog>(`${CATALOG_URL}?all=1`, options);
	return payload.data ?? [];
}