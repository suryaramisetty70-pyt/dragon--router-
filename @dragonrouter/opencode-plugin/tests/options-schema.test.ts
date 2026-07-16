/**
 * T-08 options-schema tests.
 *
 * Covers `parseDragonRouterPluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseDragonRouterPluginOptions } from "../src/index.js";

test("parseDragonRouterPluginOptions: undefined → {}", () => {
  assert.deepEqual(parseDragonRouterPluginOptions(undefined), {});
});

test("parseDragonRouterPluginOptions: null → {}", () => {
  assert.deepEqual(parseDragonRouterPluginOptions(null), {});
});

test("parseDragonRouterPluginOptions: empty object → {}", () => {
  assert.deepEqual(parseDragonRouterPluginOptions({}), {});
});

test("parseDragonRouterPluginOptions: valid providerId → returns it", () => {
  const r = parseDragonRouterPluginOptions({ providerId: "dragonrouter-preprod" });
  assert.equal(r.providerId, "dragonrouter-preprod");
});

test("parseDragonRouterPluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(
    () => parseDragonRouterPluginOptions({ providerId: "dragonrouter prod!" }),
    /providerId.*slug/i
  );
});

test("parseDragonRouterPluginOptions: empty providerId → throws", () => {
  assert.throws(() => parseDragonRouterPluginOptions({ providerId: "" }), /providerId/i);
});

test("parseDragonRouterPluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parseDragonRouterPluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parseDragonRouterPluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parseDragonRouterPluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parseDragonRouterPluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parseDragonRouterPluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parseDragonRouterPluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parseDragonRouterPluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parseDragonRouterPluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parseDragonRouterPluginOptions({
        providerId: "dragonrouter",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parseDragonRouterPluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "dragonrouter-prod",
    displayName: "DragonRouter Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parseDragonRouterPluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parseDragonRouterPluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parseDragonRouterPluginOptions({
      providerId: "",
      baseURL: "garbage",
    });
    assert.fail("expected throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /providerId/);
    assert.match(msg, /baseURL/);
  }
});

test("parseDragonRouterPluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parseDragonRouterPluginOptions / DragonRouterPlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parseDragonRouterPluginOptions, "function");
});
