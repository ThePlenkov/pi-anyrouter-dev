import type { AnyRouterCatalog, AnyRouterModel } from "./catalog-types.ts";

/** The catalog endpoint. It is public - no key is required to list models. */
export const CATALOG_URL = "https://anyrouter.dev/api/v1/models";

/** How long to wait for the catalog before giving up. */
const CATALOG_TIMEOUT_MS = 15_000;

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
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
	const onAbort = (): void => controller.abort();
	options.signal.addEventListener("abort", onAbort);

	try {
		const headers: Record<string, string> = {};
		if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;

		const response = await fetch(CATALOG_URL, {
			headers,
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`AnyRouter catalog request failed with HTTP ${response.status}`);
		}
		const payload = (await response.json()) as AnyRouterCatalog;
		return payload.data ?? [];
	} finally {
		clearTimeout(timeout);
		options.signal.removeEventListener("abort", onAbort);
	}
}


