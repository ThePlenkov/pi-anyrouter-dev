import { isOffline as sharedIsOffline } from "@pi-extensions/shared";

/**
 * The provider id pi stores the entry under.
 */
export const PROVIDER_ID = "aihubmix-com";

/** The display name shown in pi's model picker. */
export const PROVIDER_NAME = "AIHubMix";

/** AIHubMix's OpenAI-compatible base URL. */
export const BASE_URL = "https://aihubmix.com/v1";

/**
 * Whether pi was asked to stay off the network.
 */
export const isOffline = sharedIsOffline;