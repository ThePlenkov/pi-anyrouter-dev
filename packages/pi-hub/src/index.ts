import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import anyRouterExtension from "../../providers/anyrouter-dev/src/index";
import aihubmixExtension from "../../providers/aihubmix-com/src/index";

/**
 * pi-hub: All-in-one pi extension registering both providers.
 *
 * This bundle contains:
 * - Shared utilities (API key resolution, catalog fetching, etc.)
 * - AnyRouter (anyrouter.dev) provider
 * - AIHubMix (aihubmix.com) provider
 *
 * Zero external dependencies at runtime — tsdown bundles everything.
 */
export default async function piHubExtension(pi: ExtensionAPI): Promise<void> {
	await anyRouterExtension(pi);
	await aihubmixExtension(pi);
}