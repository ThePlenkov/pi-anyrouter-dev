import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentialApiKey, apiKeyTemplate, resolveApiKey, API_KEY_ENV_VARS, PRIMARY_API_KEY_ENV } from "../src/api-key.ts";
import { isOffline, PROVIDER_ID, BASE_URL } from "../src/provider-info.ts";

/**
 * A throwaway agent directory, so the tests never read or write the real
 * `~/.pi/agent/auth.json`. pi resolves the agent directory from this
 * variable, and `readStoredCredential` reads its auth file from there.
 */
const agentDir = mkdtempSync(join(tmpdir(), "pi-aihubmix-com-test-"));
process.env.PI_CODING_AGENT_DIR = agentDir;

function writeAuth(credentials: Record<string, unknown>): void {
	writeFileSync(join(agentDir, "auth.json"), JSON.stringify(credentials), { mode: 0o600 });
}

test("the package owns its own env var name", () => {
	assert.equal(PRIMARY_API_KEY_ENV, "AIHUBMIX_COM_API_KEY");
	assert.deepEqual(API_KEY_ENV_VARS, ["AIHUBMIX_COM_API_KEY", "AIHUBMIX_API_KEY"]);
});

test("the package's own env var wins over AIHubMix's documented one", () => {
	writeAuth({});
	const key = resolveApiKey("aihubmix-com", {
		AIHUBMIX_COM_API_KEY: "com-key",
		AIHUBMIX_API_KEY: "shared-key",
	} as NodeJS.ProcessEnv);
	assert.equal(key, "com-key");
});

test("AIHubMix's documented env var still works", () => {
	writeAuth({});
	const key = resolveApiKey("aihubmix-com", {
		AIHUBMIX_API_KEY: "shared-key",
	} as NodeJS.ProcessEnv);
	assert.equal(key, "shared-key");
});

test("an empty env var is not a key", () => {
	writeAuth({});
	const key = resolveApiKey("aihubmix-com", {
		AIHUBMIX_COM_API_KEY: "",
	} as NodeJS.ProcessEnv);
	assert.equal(key, undefined);
});

test("a stored credential is read under the provider id", () => {
	writeAuth({ "aihubmix-com": { type: "api_key", key: "stored-com-key" } });
	assert.equal(resolveApiKey("aihubmix-com", {} as NodeJS.ProcessEnv), "stored-com-key");

	// A credential filed under a different id is not ours.
	writeAuth({ other: { type: "api_key", key: "stored-other-key" } });
	assert.equal(resolveApiKey("aihubmix-com", {} as NodeJS.ProcessEnv), undefined);
});

test("only the api-key credential shape carries a key", () => {
	assert.equal(credentialApiKey({ type: "api_key", key: "k" }), "k");
	assert.equal(credentialApiKey({ type: "oauth", key: "k" }), undefined);
	assert.equal(credentialApiKey({ type: "api_key" }), undefined);
	assert.equal(credentialApiKey({ type: "api_key", key: "" }), undefined);
	assert.equal(credentialApiKey(undefined), undefined);
});

test("the api key template names the variable that holds the key", () => {
	assert.equal(
		apiKeyTemplate({ AIHUBMIX_COM_API_KEY: "com", AIHUBMIX_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$AIHUBMIX_COM_API_KEY",
	);
	assert.equal(
		apiKeyTemplate({ AIHUBMIX_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$AIHUBMIX_API_KEY",
	);
	assert.equal(apiKeyTemplate({} as NodeJS.ProcessEnv), "$AIHUBMIX_COM_API_KEY");
});

test("an empty variable is not treated as the key", () => {
	assert.equal(
		apiKeyTemplate({ AIHUBMIX_COM_API_KEY: "", AIHUBMIX_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$AIHUBMIX_API_KEY",
	);
	assert.equal(apiKeyTemplate({ AIHUBMIX_COM_API_KEY: "" } as NodeJS.ProcessEnv), "$AIHUBMIX_COM_API_KEY");
});

test("the provider id and base URL address aihubmix.com", () => {
	assert.equal(PROVIDER_ID, "aihubmix-com");
	assert.equal(BASE_URL, "https://aihubmix.com/v1");
});

test("offline mode is recognized the way pi recognizes it", () => {
	assert.equal(isOffline({ PI_OFFLINE: "1" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({ PI_OFFLINE: "0" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({} as NodeJS.ProcessEnv), false);
});