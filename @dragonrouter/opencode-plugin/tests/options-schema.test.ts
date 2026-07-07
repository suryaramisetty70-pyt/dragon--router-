/**
 * T-08 options-schema tests.
 *
 * Covers `parseDragon RouterPluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseDragon RouterPluginOptions } from "../src/index.js";

test("parseDragon RouterPluginOptions: undefined → {}", () => {
  assert.deepEqual(parseDragon RouterPluginOptions(undefined), {});
});

test("parseDragon RouterPluginOptions: null → {}", () => {
  assert.deepEqual(parseDragon RouterPluginOptions(null), {});
});

test("parseDragon RouterPluginOptions: empty object → {}", () => {
  assert.deepEqual(parseDragon RouterPluginOptions({}), {});
});

test("parseDragon RouterPluginOptions: valid providerId → returns it", () => {
  const r = parseDragon RouterPluginOptions({ providerId: "dragonrouter-preprod" });
  assert.equal(r.providerId, "dragonrouter-preprod");
});

test("parseDragon RouterPluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(
    () => parseDragon RouterPluginOptions({ providerId: "dragonrouter prod!" }),
    /providerId.*slug/i
  );
});

test("parseDragon RouterPluginOptions: empty providerId → throws", () => {
  assert.throws(() => parseDragon RouterPluginOptions({ providerId: "" }), /providerId/i);
});

test("parseDragon RouterPluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parseDragon RouterPluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parseDragon RouterPluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parseDragon RouterPluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parseDragon RouterPluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parseDragon RouterPluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parseDragon RouterPluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parseDragon RouterPluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parseDragon RouterPluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parseDragon RouterPluginOptions({
        providerId: "dragonrouter",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parseDragon RouterPluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "dragonrouter-prod",
    displayName: "Dragon Router Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parseDragon RouterPluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parseDragon RouterPluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parseDragon RouterPluginOptions({
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

test("parseDragon RouterPluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parseDragon RouterPluginOptions / Dragon RouterPlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parseDragon RouterPluginOptions, "function");
});
