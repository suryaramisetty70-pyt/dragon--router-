import test from "node:test";
import assert from "node:assert/strict";

import {
  attachDragon RouterMetaHeaders,
  buildDragon RouterResponseMetaHeaders,
  buildDragon RouterSseMetadataComment,
  formatDragon RouterCost,
  getDragon RouterTokenCounts,
} from "../../src/domain/dragonrouterResponseMeta.ts";
import { APP_CONFIG } from "../../src/shared/constants/appConfig.ts";
import { DRAGONROUTER_RESPONSE_HEADERS } from "../../src/shared/constants/headers.ts";

test("getDragon RouterTokenCounts normalizes common usage shapes", () => {
  assert.deepEqual(
    getDragon RouterTokenCounts({
      prompt_tokens: 12,
      completion_tokens: 5,
    }),
    { input: 12, output: 5 }
  );
  assert.deepEqual(
    getDragon RouterTokenCounts({
      input_tokens: "9",
      output_tokens: "4",
    }),
    { input: 9, output: 4 }
  );
});

test("buildDragon RouterResponseMetaHeaders formats provider alias, tokens, latency, and cost", () => {
  const headers = buildDragon RouterResponseMetaHeaders({
    provider: "claude",
    model: "claude-sonnet-4-6",
    cacheHit: true,
    latencyMs: 1234.6,
    usage: {
      prompt_tokens: 11,
      completion_tokens: 7,
    },
    costUsd: 0.00123456789,
  });

  assert.equal(headers["X-Dragon Router-Provider"], "cc");
  assert.equal(headers["X-Dragon Router-Model"], "claude-sonnet-4-6");
  assert.equal(headers["X-Dragon Router-Cache-Hit"], "true");
  assert.equal(headers["X-Dragon Router-Latency-Ms"], "1235");
  assert.equal(headers["X-Dragon Router-Tokens-In"], "11");
  assert.equal(headers["X-Dragon Router-Tokens-Out"], "7");
  assert.equal(headers["X-Dragon Router-Response-Cost"], "0.0012345679");
});

test("buildDragon RouterResponseMetaHeaders keeps ASCII model header values unchanged", () => {
  const headers = buildDragon RouterResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o-mini",
  });

  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.model], "gpt-4o-mini");
});

test("buildDragon RouterResponseMetaHeaders percent-encodes non-ASCII model header values", () => {
  const model = "free-mix/[假流式]gemini-3.5-flash";
  const headers = buildDragon RouterResponseMetaHeaders({
    provider: "openai",
    model,
  });

  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.model], encodeURIComponent(model));
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildDragon RouterResponseMetaHeaders strips control characters from string header values", () => {
  const headers = buildDragon RouterResponseMetaHeaders({
    provider: "openai",
    model: "free\r\nX-Injected: yes\u0000-model",
    requestId: "req-1\nreq-2\rreq-3\u0007",
  });

  assert.doesNotMatch(headers[DRAGONROUTER_RESPONSE_HEADERS.model], /[\r\n\u0000-\u001f\u007f]/);
  assert.doesNotMatch(headers[DRAGONROUTER_RESPONSE_HEADERS.requestId], /[\r\n\u0000-\u001f\u007f]/);
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.model], "freeX-Injected: yes-model");
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.requestId], "req-1req-2req-3");
  assert.doesNotThrow(() => new Headers(headers));
});

test("buildDragon RouterResponseMetaHeaders always emits X-Dragon Router-Version", () => {
  const headers = buildDragon RouterResponseMetaHeaders({ provider: "openai", model: "gpt" });
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.version], APP_CONFIG.version);

  // Even with no provider/model at all, the version is still attached.
  const bare = buildDragon RouterResponseMetaHeaders({});
  assert.equal(bare[DRAGONROUTER_RESPONSE_HEADERS.version], APP_CONFIG.version);
});

test("buildDragon RouterResponseMetaHeaders emits X-Dragon Router-Request-Id only when provided", () => {
  const withId = buildDragon RouterResponseMetaHeaders({ model: "gpt", requestId: "req-123" });
  assert.equal(withId[DRAGONROUTER_RESPONSE_HEADERS.requestId], "req-123");

  const noId = buildDragon RouterResponseMetaHeaders({ model: "gpt" });
  assert.equal(noId[DRAGONROUTER_RESPONSE_HEADERS.requestId], undefined);

  const nullId = buildDragon RouterResponseMetaHeaders({ model: "gpt", requestId: null });
  assert.equal(nullId[DRAGONROUTER_RESPONSE_HEADERS.requestId], undefined);

  const blankId = buildDragon RouterResponseMetaHeaders({ model: "gpt", requestId: "   " });
  assert.equal(blankId[DRAGONROUTER_RESPONSE_HEADERS.requestId], undefined);
});

test("attachDragon RouterMetaHeaders mutates a Headers instance in place, preserving existing entries", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachDragon RouterMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
    requestId: "req-abc",
  });

  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get(DRAGONROUTER_RESPONSE_HEADERS.version), APP_CONFIG.version);
  assert.equal(headers.get(DRAGONROUTER_RESPONSE_HEADERS.requestId), "req-abc");
  assert.equal(headers.get(DRAGONROUTER_RESPONSE_HEADERS.model), "gpt");
});

test("attachDragon RouterMetaHeaders mutates a plain record in place, preserving existing entries", () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  attachDragon RouterMetaHeaders(headers, {
    provider: "openai",
    model: "gpt",
  });

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.version], APP_CONFIG.version);
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.model], "gpt");
  // No requestId provided → header omitted.
  assert.equal(headers[DRAGONROUTER_RESPONSE_HEADERS.requestId], undefined);
});

test("buildDragon RouterSseMetadataComment emits comment lines compatible with SSE", () => {
  const comment = buildDragon RouterSseMetadataComment({
    provider: "openai",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 4,
      completion_tokens: 2,
    },
    latencyMs: 50,
    costUsd: formatDragon RouterCost(0),
  });

  assert.match(comment, /^: x-dragonrouter-cache-hit=false/m);
  assert.match(comment, /^: x-dragonrouter-provider=openai/m);
  assert.match(comment, /^: x-dragonrouter-model=gpt-4o-mini/m);
  assert.match(comment, /^: x-dragonrouter-tokens-in=4/m);
  assert.match(comment, /^: x-dragonrouter-tokens-out=2/m);
  assert.match(comment, /^: x-dragonrouter-response-cost=0\.0000000000/m);
});

test("buildDragon RouterResponseMetaHeaders emits X-Dragon Router-Cost-Saved only when costSavedUsd is provided", () => {
  // Cache HIT: the incremental cost of serving the hit is 0, but the cache saved the
  // original (would-have-been) cost — surfaced via the Cost-Saved header for analytics.
  const hit = buildDragon RouterResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(hit[DRAGONROUTER_RESPONSE_HEADERS.responseCost], "0.0000000000");
  assert.equal(hit[DRAGONROUTER_RESPONSE_HEADERS.costSaved], "0.0125000000");

  // A normal response (no costSavedUsd) omits the Cost-Saved header entirely.
  const miss = buildDragon RouterResponseMetaHeaders({
    provider: "openai",
    model: "gpt-4o",
    costUsd: 0.0125,
  });
  assert.equal(miss[DRAGONROUTER_RESPONSE_HEADERS.costSaved], undefined);

  // A free-model HIT still emits Cost-Saved (= 0) — it explicitly passed costSavedUsd.
  const freeHit = buildDragon RouterResponseMetaHeaders({
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0,
  });
  assert.equal(freeHit[DRAGONROUTER_RESPONSE_HEADERS.costSaved], "0.0000000000");
});

test("attachDragon RouterMetaHeaders forwards costSavedUsd onto a Headers bag", () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  attachDragon RouterMetaHeaders(headers, {
    provider: "openai",
    model: "gpt-4o",
    cacheHit: true,
    costUsd: 0,
    costSavedUsd: 0.0125,
  });
  assert.equal(headers.get(DRAGONROUTER_RESPONSE_HEADERS.responseCost), "0.0000000000");
  assert.equal(headers.get(DRAGONROUTER_RESPONSE_HEADERS.costSaved), "0.0125000000");
});
