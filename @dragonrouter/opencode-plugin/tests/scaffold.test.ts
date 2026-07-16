import test from "node:test";
import assert from "node:assert/strict";
import {
  DragonRouterPlugin,
  DRAGONROUTER_PROVIDER_KEY,
  DEFAULT_MODEL_CACHE_TTL_MS,
  resolveDragonRouterPluginOptions,
} from "../src/index.js";

test("scaffold: exports public surface", () => {
  assert.equal(
    typeof DragonRouterPlugin,
    "function",
    "DragonRouterPlugin must be a function (Plugin factory)"
  );
  assert.equal(DRAGONROUTER_PROVIDER_KEY, "dragonrouter");
  assert.equal(DEFAULT_MODEL_CACHE_TTL_MS, 300_000);
});

test("scaffold: default export is v1 plugin shape { id, server: DragonRouterPlugin }", async () => {
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.default, "object");
  assert.equal(mod.default.id, "@dragonrouter/opencode-plugin");
  assert.equal(mod.default.server, mod.DragonRouterPlugin);
});

test("resolveDragonRouterPluginOptions: defaults", () => {
  const r = resolveDragonRouterPluginOptions();
  assert.equal(r.providerId, "opencode-dragonrouter");
  assert.equal(r.displayName, "DragonRouter");
  assert.equal(r.modelCacheTtl, 300_000);
  assert.equal(r.baseURL, undefined);
});

test("resolveDragonRouterPluginOptions: custom providerId derives displayName", () => {
  const r = resolveDragonRouterPluginOptions({ providerId: "dragonrouter-preprod" });
  assert.equal(r.providerId, "opencode-dragonrouter-preprod");
  assert.equal(r.displayName, "DragonRouter (opencode-dragonrouter-preprod)");
});

test("resolveDragonRouterPluginOptions: explicit displayName wins", () => {
  const r = resolveDragonRouterPluginOptions({
    providerId: "dragonrouter-x",
    displayName: "Custom Label",
  });
  assert.equal(r.displayName, "Custom Label");
});

test("resolveDragonRouterPluginOptions: invalid TTL falls back to default", () => {
  assert.equal(resolveDragonRouterPluginOptions({ modelCacheTtl: 0 }).modelCacheTtl, 300_000);
  assert.equal(resolveDragonRouterPluginOptions({ modelCacheTtl: -1 }).modelCacheTtl, 300_000);
});

test("resolveDragonRouterPluginOptions: positive TTL respected", () => {
  assert.equal(resolveDragonRouterPluginOptions({ modelCacheTtl: 60_000 }).modelCacheTtl, 60_000);
});

test("DragonRouterPlugin: returns an empty hooks object (scaffold)", async () => {
  const fakeCtx = {} as Parameters<typeof DragonRouterPlugin>[0];
  const hooks = await DragonRouterPlugin(fakeCtx);
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
