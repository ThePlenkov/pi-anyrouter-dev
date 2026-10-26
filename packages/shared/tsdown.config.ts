import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "src/index.ts",
	format: ["esm"],
	dts: true,
	platform: "node",
	target: "ES2022",
});