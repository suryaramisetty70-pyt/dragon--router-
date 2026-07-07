import test from "node:test";
import assert from "node:assert/strict";
import {
  Dragon RouterPlugin,
  DRAGONROUTER_PROVIDER_KEY,
  DEFAULT_MODEL_CACHE_TTL_MS,
  resolveDragon RouterPluginOptions,
} from "../src/index.js";

test("scaffold: exports public surface", () => {
  assert.equal(
    typeof Dragon RouterPlugin,
    "function",
    "Dragon RouterPlugin must be a function (Plugin factory)"
  );
  assert.equal(DRAGONROUTER_PROVIDER_KEY, "dragonrouter");
  assert.equal(DEFAULT_MODEL_CACHE_TTL_MS, 300_000);
});

test("scaffold: default export is v1 plugin shape { id, server: Dragon RouterPlugin }", async () => {
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.default, "object");
  assert.equal(mod.default.id, "@dragonrouter/opencode-plugin");
  assert.equal(mod.default.server, mod.Dragon RouterPlugin);
});

test("resolveDragon RouterPluginOptions: defaults", () => {
  const r = resolveDragon RouterPluginOptions();
  assert.equal(r.providerId, "opencode-dragonrouter");
  assert.equal(r.displayName, "Dragon Router");
  assert.equal(r.modelCacheTtl, 300_000);
  assert.equal(r.baseURL, undefined);
});

test("resolveDragon RouterPluginOptions: custom providerId derives displayName", () => {
  const r = resolveDragon RouterPluginOptions({ providerId: "dragonrouter-preprod" });
  assert.equal(r.providerId, "opencode-dragonrouter-preprod");
  assert.equal(r.displayName, "Dragon Router (opencode-dragonrouter-preprod)");
});

test("resolveDragon RouterPluginOptions: explicit displayName wins", () => {
  const r = resolveDragon RouterPluginOptions({
    providerId: "dragonrouter-x",
    displayName: "Custom Label",
  });
  assert.equal(r.displayName, "Custom Label");
});

test("resolveDragon RouterPluginOptions: invalid TTL falls back to default", () => {
  assert.equal(resolveDragon RouterPluginOptions({ modelCacheTtl: 0 }).modelCacheTtl, 300_000);
  assert.equal(resolveDragon RouterPluginOptions({ modelCacheTtl: -1 }).modelCacheTtl, 300_000);
});

test("resolveDragon RouterPluginOptions: positive TTL respected", () => {
  assert.equal(resolveDragon RouterPluginOptions({ modelCacheTtl: 60_000 }).modelCacheTtl, 60_000);
});

test("Dragon RouterPlugin: returns an empty hooks object (scaffold)", async () => {
  const fakeCtx = {} as Parameters<typeof Dragon RouterPlugin>[0];
  const hooks = await Dragon RouterPlugin(fakeCtx);
  assert.equal(typeof hooks, "object");
  assert.notEqual(hooks, null);
});

test("scaffold: built ESM default export resolves with the v1 plugin shape", async () => {
  // The plugin is ESM-only now — the CJS bundle was dropped to fix the OpenCode
  // loader (#3883), so there is no more ../dist/index.cjs. Validate that the built
  // distributable's default export still carries the OpenCode v1 { id, server } shape.
  const mod = await import("../dist/index.js");
  assert.strictEqual(typeof mod.default, "object");
  assert.strictEqual(mod.default.id, "@dragonrouter/opencode-plugin");
  assert.strictEqual(typeof mod.default.server, "function");
});
