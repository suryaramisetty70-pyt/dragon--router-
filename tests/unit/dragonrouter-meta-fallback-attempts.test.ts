import test from "node:test";
import assert from "node:assert/strict";
import { DRAGONROUTER_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";
import { buildDragon RouterResponseMetaHeaders } from "../../src/domain/dragonrouterResponseMeta.ts";

test("headers constant exposes the fallback-attempts key", () => {
  assert.equal(
    DRAGONROUTER_RESPONSE_HEADERS.fallbackAttempts,
    "X-Dragon Router-Fallback-Attempts"
  );
});

test("buildDragon RouterResponseMetaHeaders emits the fallback-attempts count when > 0", () => {
  const h = buildDragon RouterResponseMetaHeaders({ model: "gpt", provider: "openai", fallbackAttempts: 2 });
  assert.equal(h["X-Dragon Router-Fallback-Attempts"], "2");
});

test("buildDragon RouterResponseMetaHeaders omits the header when 0 / absent", () => {
  const none = buildDragon RouterResponseMetaHeaders({ model: "gpt" });
  assert.equal(none["X-Dragon Router-Fallback-Attempts"], undefined);
  const zero = buildDragon RouterResponseMetaHeaders({ model: "gpt", fallbackAttempts: 0 });
  assert.equal(zero["X-Dragon Router-Fallback-Attempts"], undefined);
});
