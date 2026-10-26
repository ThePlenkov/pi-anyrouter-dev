import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentialApiKey, apiKeyTemplate, resolveApiKey, isOffline, getAgentDir, readStoredCredential } from "../src/index.ts";

/**
 * A throwaway agent directory, so the tests never read or write the real
 * `~/.pi/agent/auth.json`. pi resolves the agent directory from this
 * variable, and `readStoredCredential` reads its auth file from there.
 */
const agentDir = mkdtempSync(join(tmpdir(), "pi-shared-test-"));
process.env.PI_CODING_AGENT_DIR = agentDir;

function writeAuth(credentials: Record<string, unknown>): void {
	writeFileSync(join(agentDir, "auth.json"), JSON.stringify(credentials), { mode: 0o600 });
}

test("getAgentDir returns the temp directory when PI_CODING_AGENT_DIR is set", () => {
	assert.equal(getAgentDir({ PI_CODING_AGENT_DIR: agentDir } as NodeJS.ProcessEnv), agentDir);
});

test("getAgentDir expands tilde", () => {
	const result = getAgentDir({ PI_CODING_AGENT_DIR: "~/custom/path" } as NodeJS.ProcessEnv);
	assert.ok(result.endsWith("custom/path"));
	assert.ok(!result.includes("~"));
});

test("readStoredCredential reads a credential from auth.json", () => {
	writeAuth({ "test-provider": { type: "api_key", key: "stored-key" } });
	const cred = readStoredCredential("test-provider");
	assert.deepEqual(cred, { type: "api_key", key: "stored-key" });
});

test("readStoredCredential returns undefined for missing provider", () => {
	writeAuth({ "other-provider": { type: "api_key", key: "other-key" } });
	const cred = readStoredCredential("test-provider");
	assert.equal(cred, undefined);
});

test("readStoredCredential returns undefined for malformed auth.json", () => {
	writeAuth({} as any); // Invalid content
	const cred = readStoredCredential("test-provider");
	assert.equal(cred, undefined);
});

test("credentialApiKey extracts key from api_key credential", () => {
	assert.equal(credentialApiKey({ type: "api_key", key: "k" }), "k");
});

test("credentialApiKey returns undefined for oauth credential", () => {
	assert.equal(credentialApiKey({ type: "oauth", key: "k" }), undefined);
});

test("credentialApiKey returns undefined for api_key without key", () => {
	assert.equal(credentialApiKey({ type: "api_key" }), undefined);
	assert.equal(credentialApiKey({ type: "api_key", key: "" }), undefined);
});

test("credentialApiKey returns undefined for undefined", () => {
	assert.equal(credentialApiKey(undefined), undefined);
});

test("resolveApiKey prioritizes env vars in order", () => {
	writeAuth({ "test-provider": { type: "api_key", key: "stored-key" } });
	const key = resolveApiKey({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		providerId: "test-provider",
		env: { PRIMARY_KEY: "primary", FALLBACK_KEY: "fallback" } as NodeJS.ProcessEnv,
	});
	assert.equal(key, "primary");
});

test("resolveApiKey falls back to second env var", () => {
	writeAuth({ "test-provider": { type: "api_key", key: "stored-key" } });
	const key = resolveApiKey({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		providerId: "test-provider",
		env: { FALLBACK_KEY: "fallback" } as NodeJS.ProcessEnv,
	});
	assert.equal(key, "fallback");
});

test("resolveApiKey falls back to stored credential", () => {
	writeAuth({ "test-provider": { type: "api_key", key: "stored-key" } });
	const key = resolveApiKey({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		providerId: "test-provider",
		env: {} as NodeJS.ProcessEnv,
	});
	assert.equal(key, "stored-key");
});

test("resolveApiKey returns undefined when nothing is configured", () => {
	writeAuth({});
	const key = resolveApiKey({
		envVars: ["PRIMARY_KEY"],
		providerId: "test-provider",
		env: {} as NodeJS.ProcessEnv,
	});
	assert.equal(key, undefined);
});

test("resolveApiKey treats empty string as not set", () => {
	writeAuth({ "test-provider": { type: "api_key", key: "stored-key" } });
	const key = resolveApiKey({
		envVars: ["PRIMARY_KEY"],
		providerId: "test-provider",
		env: { PRIMARY_KEY: "" } as NodeJS.ProcessEnv,
	});
	assert.equal(key, "stored-key");
});

test("apiKeyTemplate returns template for first set env var", () => {
	const template = apiKeyTemplate({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		env: { PRIMARY_KEY: "primary", FALLBACK_KEY: "fallback" } as NodeJS.ProcessEnv,
	});
	assert.equal(template, "$PRIMARY_KEY");
});

test("apiKeyTemplate falls back to second env var", () => {
	const template = apiKeyTemplate({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		env: { FALLBACK_KEY: "fallback" } as NodeJS.ProcessEnv,
	});
	assert.equal(template, "$FALLBACK_KEY");
});

test("apiKeyTemplate defaults to first env var when none set", () => {
	const template = apiKeyTemplate({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		env: {} as NodeJS.ProcessEnv,
	});
	assert.equal(template, "$PRIMARY_KEY");
});

test("apiKeyTemplate treats empty string as not set", () => {
	const template = apiKeyTemplate({
		envVars: ["PRIMARY_KEY", "FALLBACK_KEY"],
		env: { PRIMARY_KEY: "", FALLBACK_KEY: "fallback" } as NodeJS.ProcessEnv,
	});
	assert.equal(template, "$FALLBACK_KEY");
});

test("isOffline recognizes any defined PI_OFFLINE value", () => {
	assert.equal(isOffline({ PI_OFFLINE: "1" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({ PI_OFFLINE: "0" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({ PI_OFFLINE: "false" } as NodeJS.ProcessEnv), true);
	assert.equal(isOffline({} as NodeJS.ProcessEnv), false);
});