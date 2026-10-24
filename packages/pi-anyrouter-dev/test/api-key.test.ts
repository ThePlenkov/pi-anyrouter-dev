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
const agentDir = mkdtempSync(join(tmpdir(), "pi-anyrouter-dev-test-"));
process.env.PI_CODING_AGENT_DIR = agentDir;

function writeAuth(credentials: Record<string, unknown>): void {
	writeFileSync(join(agentDir, "auth.json"), JSON.stringify(credentials), { mode: 0o600 });
}

test("the package owns its own env var name", () => {
	// `ANYROUTER_API_KEY` belongs to the other AnyRouter extension on the
	// registry, and the two services issue keys from different pools - a key
	// valid for anyrouter.dev is rejected by anyrouter.top. The name this
	// package reads first must therefore be its own.
	assert.equal(PRIMARY_API_KEY_ENV, "ANYROUTER_DEV_API_KEY");
	assert.deepEqual(API_KEY_ENV_VARS, ["ANYROUTER_DEV_API_KEY", "ANYROUTER_API_KEY"]);
});

test("the package's own env var wins over AnyRouter's documented one", () => {
	writeAuth({});
	const key = resolveApiKey("anyrouter-dev", {
		ANYROUTER_DEV_API_KEY: "dev-key",
		ANYROUTER_API_KEY: "shared-key",
	} as NodeJS.ProcessEnv);
	assert.equal(key, "dev-key");
});

test("AnyRouter's documented env var still works", () => {
	writeAuth({});
	const key = resolveApiKey("anyrouter-dev", {
		ANYROUTER_API_KEY: "shared-key",
	} as NodeJS.ProcessEnv);
	assert.equal(key, "shared-key");
});

test("an empty env var is not a key", () => {
	writeAuth({});
	const key = resolveApiKey("anyrouter-dev", {
		ANYROUTER_DEV_API_KEY: "",
	} as NodeJS.ProcessEnv);
	assert.equal(key, undefined);
});

test("a stored credential is read under the provider id", () => {
	// The credential is filed under the provider id, so a user who has both
	// AnyRouter extensions installed can keep the two keys apart.
	writeAuth({ "anyrouter-dev": { type: "api_key", key: "stored-dev-key" } });
	assert.equal(resolveApiKey("anyrouter-dev", {} as NodeJS.ProcessEnv), "stored-dev-key");

	// A credential filed under the other extension's id is not ours.
	writeAuth({ anyrouter: { type: "api_key", key: "stored-other-key" } });
	assert.equal(resolveApiKey("anyrouter-dev", {} as NodeJS.ProcessEnv), undefined);
});

test("only the api-key credential shape carries a key", () => {
	assert.equal(credentialApiKey({ type: "api_key", key: "k" }), "k");
	assert.equal(credentialApiKey({ type: "oauth", key: "k" }), undefined);
	assert.equal(credentialApiKey({ type: "api_key" }), undefined);
	assert.equal(credentialApiKey({ type: "api_key", key: "" }), undefined);
	assert.equal(credentialApiKey(undefined), undefined);
});

test("the api key template names the variable that holds the key", () => {
	// pi requires every env name in the template to be set, so the template
	// can only name one variable. The name is picked at load time; the value
	// stays a live reference that pi resolves per request.
	assert.equal(
		apiKeyTemplate({ ANYROUTER_DEV_API_KEY: "dev", ANYROUTER_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$ANYROUTER_DEV_API_KEY",
	);
	assert.equal(
		apiKeyTemplate({ ANYROUTER_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$ANYROUTER_API_KEY",
	);
	assert.equal(apiKeyTemplate({} as NodeJS.ProcessEnv), "$ANYROUTER_DEV_API_KEY");
});

test("an empty variable is not treated as the key", () => {
	assert.equal(
		apiKeyTemplate({ ANYROUTER_DEV_API_KEY: "", ANYROUTER_API_KEY: "shared" } as NodeJS.ProcessEnv),
		"$ANYROUTER_API_KEY",
	);
	assert.equal(apiKeyTemplate({ ANYROUTER_DEV_API_KEY: "" } as NodeJS.ProcessEnv), "$ANYROUTER_DEV_API_KEY");
});

test("the provider id and base URL address anyrouter.dev", () => {
	// The unscoped `anyrouter` id belongs to the other AnyRouter extension,
	// which serves anyrouter.top; two extensions must not claim one id.
	assert.equal(PROVIDER_ID, "anyrouter-dev");
	assert.equal(BASE_URL, "https://anyrouter.dev/api/v1");
});

test("offline mode is recognized the way pi recognizes it", () => {
	// pi treats any defined value as offline, not only the truthy ones its
	// own flag parser accepts.
	assert.equal(isOffline({ PI_OFFLINE: "1" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({ PI_OFFLINE: "0" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({} as NodeJS.ProcessEnv), false);
});
