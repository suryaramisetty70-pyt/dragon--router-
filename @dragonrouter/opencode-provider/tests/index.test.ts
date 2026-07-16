import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildDragonRouterOpenCodeConfig,
  createDragonRouterAgentBlock,
  createDragonRouterComboConfig,
  createDragonRouterMCPEntry,
  createDragonRouterModesBlock,
  createDragonRouterProvider,
  fetchLiveModels,
  listCombos,
  mergeIntoExistingConfig,
  normalizeBaseURL,
  DRAGONROUTER_DEFAULT_MODEL_CAPABILITIES,
  DRAGONROUTER_DEFAULT_MODEL_CONTEXT_LENGTHS,
  DRAGONROUTER_DEFAULT_OPENCODE_MODELS,
  DRAGONROUTER_MCP_DEFAULT_SCOPES,
  DRAGONROUTER_PROVIDER_NPM,
  OPENCODE_CONFIG_SCHEMA,
} from "../src/index.ts";

test("normalizeBaseURL preserves a bare host:port", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128"), "http://localhost:20128/v1");
});

test("normalizeBaseURL strips trailing slashes", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128////"), "http://localhost:20128/v1");
});

test("normalizeBaseURL deduplicates an existing /v1 suffix", () => {
  assert.equal(normalizeBaseURL("http://localhost:20128/v1"), "http://localhost:20128/v1");
  assert.equal(normalizeBaseURL("http://localhost:20128/v1/"), "http://localhost:20128/v1");
});

test("normalizeBaseURL rejects empty input", () => {
  assert.throws(() => normalizeBaseURL("   "), /baseURL is required/);
});

test("normalizeBaseURL rejects malformed URLs", () => {
  assert.throws(() => normalizeBaseURL("not a url"), /not a valid URL/);
});

test("createDragonRouterProvider validates required fields", () => {
  assert.throws(
    () => createDragonRouterProvider({ baseURL: "", apiKey: "x" } as never),
    /baseURL is required/
  );
  assert.throws(
    () => createDragonRouterProvider({ baseURL: "http://x", apiKey: "" } as never),
    /apiKey is required/
  );
});

test("createDragonRouterProvider produces the OpenCode-compatible shape", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });

  assert.equal(provider.npm, DRAGONROUTER_PROVIDER_NPM);
  assert.equal(provider.name, "DragonRouter");
  assert.equal(provider.options.baseURL, "http://localhost:20128/v1");
  assert.equal(provider.options.apiKey, "sk_dragonrouter");
  assert.equal(typeof provider.models, "object");
});

test("createDragonRouterProvider seeds the default model catalog", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });

  const modelIds = Object.keys(provider.models).sort();
  const defaultIds = [...DRAGONROUTER_DEFAULT_OPENCODE_MODELS].sort();
  assert.deepEqual(modelIds, defaultIds);
  for (const id of defaultIds) {
    assert.equal(provider.models[id]?.name, id);
    assert.equal(provider.models[id]?.attachment, true);
  }
});

test("createDragonRouterProvider honours a custom models list and labels", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: ["auto", "claude-opus-4-7"],
    modelLabels: { auto: "Auto-Combo", "claude-opus-4-7": "Opus 4.7" },
  });

  assert.deepEqual(Object.keys(provider.models), ["auto", "claude-opus-4-7"]);
  assert.equal(provider.models.auto.name, "Auto-Combo");
  assert.equal(provider.models["claude-opus-4-7"].name, "Opus 4.7");
});

test("createDragonRouterProvider deduplicates and trims model ids", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: ["  auto  ", "auto", "", "claude-opus-4-7"],
  });
  assert.deepEqual(Object.keys(provider.models), ["auto", "claude-opus-4-7"]);
});

test("createDragonRouterProvider honours displayName override", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    displayName: "Local DragonRouter",
  });
  assert.equal(provider.name, "Local DragonRouter");
});

test("buildDragonRouterOpenCodeConfig wraps the provider with the OpenCode schema", () => {
  const doc = buildDragonRouterOpenCodeConfig({
    baseURL: "http://localhost:20128/v1",
    apiKey: "sk_dragonrouter",
  });

  assert.equal(doc.$schema, OPENCODE_CONFIG_SCHEMA);
  assert.equal(typeof doc.provider.dragonrouter, "object");
  assert.equal(doc.provider.dragonrouter.options.baseURL, "http://localhost:20128/v1");
});

test("config document is JSON-serialisable", () => {
  const doc = buildDragonRouterOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  const round = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(round, doc);
});

test("buildDragonRouterOpenCodeConfig emits model and small_model prefixed with provider key", () => {
  const doc = buildDragonRouterOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    model: "claude-sonnet-4-5-thinking",
    smallModel: "gemini-3-flash",
  });
  assert.equal(doc.model, "dragonrouter/claude-sonnet-4-5-thinking");
  assert.equal(doc.small_model, "dragonrouter/gemini-3-flash");
});

test("buildDragonRouterOpenCodeConfig omits model and small_model when not supplied", () => {
  const doc = buildDragonRouterOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  assert.equal(doc.model, undefined);
  assert.equal(doc.small_model, undefined);
  assert.ok(!("model" in doc));
  assert.ok(!("small_model" in doc));
});

test("buildDragonRouterOpenCodeConfig ignores blank model strings", () => {
  const doc = buildDragonRouterOpenCodeConfig({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    model: "   ",
    smallModel: "",
  });
  assert.ok(!("model" in doc));
  assert.ok(!("small_model" in doc));
});

test("mergeIntoExistingConfig preserves existing provider entries", () => {
  const existing = {
    $schema: OPENCODE_CONFIG_SCHEMA,
    provider: {
      anthropic: { npm: "@ai-sdk/anthropic", name: "Anthropic", options: {}, models: {} },
    },
    keybinds: { submit: "enter" },
  };
  const result = mergeIntoExistingConfig(existing, {
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  assert.ok("anthropic" in (result.provider as Record<string, unknown>));
  assert.ok("dragonrouter" in (result.provider as Record<string, unknown>));
  assert.deepEqual((result as Record<string, unknown>).keybinds, { submit: "enter" });
});

test("mergeIntoExistingConfig overwrites existing dragonrouter entry", () => {
  const existing = {
    provider: {
      dragonrouter: {
        npm: "@ai-sdk/openai-compatible",
        name: "OLD",
        options: { baseURL: "http://old/v1", apiKey: "old" },
        models: {},
      },
    },
  };
  const result = mergeIntoExistingConfig(existing, {
    baseURL: "http://new",
    apiKey: "new-key",
    displayName: "NEW",
  });
  const dragonrouter = (result.provider as Record<string, unknown>).dragonrouter as {
    name: string;
  };
  assert.equal(dragonrouter.name, "NEW");
});

test("mergeIntoExistingConfig writes model and small_model when supplied", () => {
  const result = mergeIntoExistingConfig(
    {},
    {
      baseURL: "http://localhost:20128",
      apiKey: "sk_dragonrouter",
      model: "claude-sonnet-4-5-thinking",
      smallModel: "gemini-3-flash",
    }
  );
  assert.equal(result.model, "dragonrouter/claude-sonnet-4-5-thinking");
  assert.equal(result.small_model, "dragonrouter/gemini-3-flash");
});

test("mergeIntoExistingConfig does not add model keys when not supplied", () => {
  const result = mergeIntoExistingConfig(
    {},
    { baseURL: "http://localhost:20128", apiKey: "sk_dragonrouter" }
  );
  assert.ok(!("model" in result));
  assert.ok(!("small_model" in result));
});

test("DRAGONROUTER_MCP_DEFAULT_SCOPES contains 7 read-only scopes", () => {
  assert.equal(DRAGONROUTER_MCP_DEFAULT_SCOPES.length, 7);
  assert.ok(DRAGONROUTER_MCP_DEFAULT_SCOPES.every((s) => s.startsWith("read:")));
});

test("createDragonRouterMCPEntry defaults to tsx runtime", () => {
  const entry = createDragonRouterMCPEntry({
    serverPath: "/path/to/server.ts",
    apiKey: "sk_dragonrouter",
  });
  assert.equal(entry.command, "npx");
  assert.deepEqual(entry.args, ["tsx", "/path/to/server.ts"]);
  assert.equal(entry.env.DRAGONROUTER_API_KEY, "sk_dragonrouter");
  assert.ok(!("DRAGONROUTER_MCP_ENFORCE_SCOPES" in entry.env));
  assert.ok(!("DRAGONROUTER_MANAGEMENT_API_KEY" in entry.env));
});

test("createDragonRouterMCPEntry uses node runtime when specified", () => {
  const entry = createDragonRouterMCPEntry({
    serverPath: "/path/to/server.js",
    apiKey: "sk_dragonrouter",
    runtime: "node",
  });
  assert.equal(entry.command, "node");
  assert.deepEqual(entry.args, ["/path/to/server.js"]);
});

test("createDragonRouterMCPEntry sets management key and scopes when supplied", () => {
  const entry = createDragonRouterMCPEntry({
    serverPath: "/path/to/server.ts",
    apiKey: "sk_dragonrouter",
    managementApiKey: "sk_manage",
    scopes: ["read:health", "read:combos", "execute:completions"],
  });
  assert.equal(entry.env.DRAGONROUTER_MANAGEMENT_API_KEY, "sk_manage");
  assert.equal(entry.env.DRAGONROUTER_MCP_ENFORCE_SCOPES, "true");
  assert.equal(entry.env.DRAGONROUTER_MCP_SCOPES, "read:health,read:combos,execute:completions");
});

test("createDragonRouterMCPEntry rejects missing required fields", () => {
  assert.throws(
    () => createDragonRouterMCPEntry({ serverPath: "", apiKey: "x" }),
    /serverPath is required/
  );
  assert.throws(
    () => createDragonRouterMCPEntry({ serverPath: "/p", apiKey: "" }),
    /apiKey is required/
  );
});

function startMockServer(
  handler: (path: string) => unknown
): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const body = JSON.stringify(handler(req.url ?? ""));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
  });
}

test("fetchLiveModels handles array envelope", async () => {
  const { url, close } = await startMockServer(() => [
    { id: "claude-sonnet", name: "Claude Sonnet" },
    { id: "gemini-flash", displayName: "Gemini Flash" },
  ]);
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models.length, 2);
    assert.equal(models[0].id, "claude-sonnet");
    assert.equal(models[0].name, "Claude Sonnet");
    assert.equal(models[1].id, "gemini-flash");
    assert.equal(models[1].name, "Gemini Flash");
  } finally {
    close();
  }
});

test("fetchLiveModels handles data-envelope and snake_case fields", async () => {
  const { url, close } = await startMockServer(() => ({
    data: [{ model_id: "gpt-4o", display_name: "GPT-4o" }],
  }));
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models.length, 1);
    assert.equal(models[0].id, "gpt-4o");
    assert.equal(models[0].name, "GPT-4o");
  } finally {
    close();
  }
});

test("fetchLiveModels falls back to id as name when no name field", async () => {
  const { url, close } = await startMockServer(() => [{ id: "auto" }]);
  try {
    const models = await fetchLiveModels(url, "sk_test");
    assert.equal(models[0].name, "auto");
  } finally {
    close();
  }
});

test("listCombos normalises compressionOverride", async () => {
  const { url, close } = await startMockServer(() => ({
    combos: [
      {
        id: "c1",
        name: "Primary",
        strategy: "priority",
        active: true,
        compressionOverride: "standard",
      },
      {
        id: "c2",
        name: "Cheap",
        strategy: "weighted",
        active: false,
        compressionOverride: "unknown-value",
      },
      { id: "c3", name: "Off", strategy: "round-robin", active: true, compressionOverride: "" },
    ],
  }));
  try {
    const combos = await listCombos(url, "sk_manage");
    assert.equal(combos.length, 3);
    assert.equal(combos[0].compressionOverride, "standard");
    assert.equal(combos[1].compressionOverride, "");
    assert.equal(combos[2].compressionOverride, "");
  } finally {
    close();
  }
});

test("createDragonRouterComboConfig builds minimal payload", () => {
  const payload = createDragonRouterComboConfig({ name: "my-combo", strategy: "priority" });
  assert.equal(payload.name, "my-combo");
  assert.equal(payload.strategy, "priority");
  assert.equal(payload.active, true);
  assert.ok(!("compressionOverride" in payload));
  assert.ok(!("providers" in payload));
});

test("createDragonRouterComboConfig includes optional fields when supplied", () => {
  const payload = createDragonRouterComboConfig({
    name: "full",
    strategy: "weighted",
    compressionOverride: "aggressive",
    active: false,
    providers: ["provider-a", "provider-b"],
  });
  assert.equal(payload.compressionOverride, "aggressive");
  assert.equal(payload.active, false);
  assert.deepEqual(payload.providers, ["provider-a", "provider-b"]);
});

test("DRAGONROUTER_DEFAULT_OPENCODE_MODELS includes cc/ prefixed models", () => {
  const defaults = [...DRAGONROUTER_DEFAULT_OPENCODE_MODELS];
  assert.ok(defaults.includes("cc/claude-opus-4-8"));
  assert.ok(
    defaults.some((m) => m.startsWith("cc/")),
    "should have cc/ prefixed models"
  );
  assert.ok(defaults.length >= 7, "should have at least 7 models");
});

test("DRAGONROUTER_DEFAULT_MODEL_CONTEXT_LENGTHS covers every default model id", () => {
  for (const id of DRAGONROUTER_DEFAULT_OPENCODE_MODELS) {
    const ctx = DRAGONROUTER_DEFAULT_MODEL_CONTEXT_LENGTHS[id];
    assert.ok(
      typeof ctx === "number" && ctx > 0,
      `default context_length for ${id} missing — should be a positive number`
    );
    // Sanity: context should be at least 8K, at most 2M tokens
    assert.ok(ctx >= 8_000, `${id} context_length ${ctx} seems too low`);
    assert.ok(ctx <= 2_000_000, `${id} context_length ${ctx} seems too high`);
  }
});

test("createDragonRouterProvider emits limit.context on default model entries", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  const entry = provider.models["cc/claude-opus-4-8"];
  assert.ok(entry.limit, "model entry should have a limit field");
  assert.equal(entry.limit!.context, 1_000_000);
  assert.equal(provider.models["cc/claude-opus-4-7"].limit!.context, 1_000_000);
});

test("createDragonRouterProvider omits limit.context for unknown model ids", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: ["completely-unknown-model"],
  });
  const entry = provider.models["completely-unknown-model"];
  assert.equal(entry.limit, undefined);
});

test("createDragonRouterProvider reads contextLength from a live model entry for ids absent from the static map", () => {
  // #3298 regression guard: the static DRAGONROUTER_DEFAULT_MODEL_CONTEXT_LENGTHS
  // map only covers the legacy 8 Claude/Gemini ids. Before this change, any
  // other model got `undefined` context (see the test above, string form) and
  // OpenCode silently fell back to its 128K internal default. A live model
  // entry carrying `contextLength` must now surface as `limit.context`.
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: [{ id: "completely-unknown-model", contextLength: 262_144 }],
  });
  const entry = provider.models["completely-unknown-model"];
  assert.ok(
    entry.limit,
    "a live contextLength should produce a limit field even for ids absent from the static map"
  );
  assert.equal(entry.limit!.context, 262_144);
});

test("createDragonRouterProvider: a live model contextLength wins over the static default map", () => {
  // `cc/claude-opus-4-8` has a static default (1_000_000). A live entry carrying
  // a different contextLength must take precedence (live > modelContextLengths >
  // static defaults).
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: [{ id: "cc/claude-opus-4-8", contextLength: 524_288 }],
  });
  assert.equal(provider.models["cc/claude-opus-4-8"].limit!.context, 524_288);
});

test("createDragonRouterProvider serialises limit.context to JSON", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  const round = JSON.parse(JSON.stringify(provider));
  for (const id of DRAGONROUTER_DEFAULT_OPENCODE_MODELS) {
    const expectedContext = DRAGONROUTER_DEFAULT_MODEL_CONTEXT_LENGTHS[id];
    assert.equal(
      round.models[id].limit?.context,
      expectedContext,
      `${id} should serialise limit.context=${expectedContext}`
    );
  }
});

test("fetchLiveModels extracts context_length from snake_case field", async () => {
  const { url, close } = await startMockServer(() => ({
    data: [
      { id: "cc/claude-opus-4-7", name: "Claude Opus 4.7", context_length: 200_000 },
      { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro", context_length: 1_000_000 },
      { id: "no-context", name: "No Context" },
    ],
  }));
  try {
    const models = await fetchLiveModels(url, "sk_test");
    const claude = models.find((m) => m.id === "cc/claude-opus-4-7");
    assert.ok(claude, "claude model should be present");
    assert.equal(claude!.contextLength, 200_000);
    const gemini = models.find((m) => m.id === "gemini-3.1-pro-high");
    assert.equal(gemini!.contextLength, 1_000_000);
    const noCtx = models.find((m) => m.id === "no-context");
    assert.equal(noCtx!.contextLength, undefined);
  } finally {
    close();
  }
});

test("DRAGONROUTER_DEFAULT_MODEL_CAPABILITIES covers every default model id", () => {
  for (const id of DRAGONROUTER_DEFAULT_OPENCODE_MODELS) {
    const caps = DRAGONROUTER_DEFAULT_MODEL_CAPABILITIES[id];
    assert.ok(caps, `default capabilities for ${id} missing`);
    assert.equal(caps.attachment, true, `${id} should default to attachment=true`);
    assert.equal(caps.tool_call, true, `${id} should default to tool_call=true`);
  }
});

test("createDragonRouterProvider emits default capability flags inline with the model entry", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
  });
  const entry = provider.models["cc/claude-opus-4-8"];
  assert.equal(entry.name, "cc/claude-opus-4-8");
  assert.equal(entry.attachment, true);
  assert.equal(entry.reasoning, true);
  assert.equal(entry.temperature, true);
  assert.equal(entry.tool_call, true);
});

test("createDragonRouterProvider modelCapabilities overrides defaults and merges per id", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    modelCapabilities: {
      "cc/claude-opus-4-7": { reasoning: false, label: "Opus (no thinking)" },
    },
  });
  const entry = provider.models["cc/claude-opus-4-7"];
  assert.equal(entry.name, "Opus (no thinking)");
  assert.equal(entry.reasoning, false);
  assert.equal(entry.attachment, true);
  assert.equal(entry.tool_call, true);
});

test("createDragonRouterProvider applies capability overrides to non-default model ids", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: ["custom-model"],
    modelCapabilities: {
      "custom-model": { attachment: false, tool_call: true, label: "Custom" },
    },
  });
  const entry = provider.models["custom-model"];
  assert.equal(entry.name, "Custom");
  assert.equal(entry.attachment, false);
  assert.equal(entry.tool_call, true);
  assert.equal(entry.reasoning, undefined);
  assert.equal(entry.temperature, undefined);
});

test("createDragonRouterProvider modelLabels still works when modelCapabilities omits label", () => {
  const provider = createDragonRouterProvider({
    baseURL: "http://localhost:20128",
    apiKey: "sk_dragonrouter",
    models: ["claude-opus-4-5-thinking"],
    modelLabels: { "claude-opus-4-5-thinking": "Opus 4.5 (legacy label)" },
  });
  assert.equal(provider.models["claude-opus-4-5-thinking"].name, "Opus 4.5 (legacy label)");
});

test("createDragonRouterAgentBlock builds provider-prefixed entries per role", () => {
  const block = createDragonRouterAgentBlock({
    roles: {
      build: { modelId: "claude-sonnet-4-5-thinking", temperature: 0.2 },
      plan: { modelId: "claude-opus-4-5-thinking", top_p: 0.95 },
      review: { modelId: "gemini-3-flash", temperature: 0.0 },
    },
  });
  assert.equal(block.build.model, "dragonrouter/claude-sonnet-4-5-thinking");
  assert.equal(block.build.temperature, 0.2);
  assert.equal(block.plan.model, "dragonrouter/claude-opus-4-5-thinking");
  assert.equal(block.plan.top_p, 0.95);
  assert.equal(block.review.model, "dragonrouter/gemini-3-flash");
  assert.equal(block.review.temperature, 0.0);
});

test("createDragonRouterAgentBlock omits optional fields when not supplied", () => {
  const block = createDragonRouterAgentBlock({
    roles: { build: { modelId: "claude-sonnet-4-5-thinking" } },
  });
  assert.equal(block.build.model, "dragonrouter/claude-sonnet-4-5-thinking");
  assert.ok(!("temperature" in block.build));
  assert.ok(!("top_p" in block.build));
  assert.ok(!("tools" in block.build));
  assert.ok(!("prompt" in block.build));
});

test("createDragonRouterAgentBlock skips roles with empty modelId", () => {
  const block = createDragonRouterAgentBlock({
    roles: {
      build: { modelId: "claude-sonnet-4-5-thinking" },
      plan: { modelId: "   " },
      review: { modelId: "" },
    },
  });
  assert.deepEqual(Object.keys(block), ["build"]);
});

test("createDragonRouterAgentBlock emits tools as Record<string, boolean> per OC schema", () => {
  const block = createDragonRouterAgentBlock({
    roles: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        tools: { edit: true, bash: true, web: false },
        prompt: "Edit files carefully.",
      },
    },
  });
  assert.deepEqual(block.build.tools, { edit: true, bash: true, web: false });
  assert.equal(block.build.prompt, "Edit files carefully.");
});

test("createDragonRouterAgentBlock filters invalid tool entries and omits empty maps", () => {
  const block = createDragonRouterAgentBlock({
    roles: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        // @ts-expect-error — exercising runtime guard against bad input
        tools: { edit: true, bash: "yes", "": true, web: null },
      },
      plan: {
        modelId: "claude-opus-4-5-thinking",
        tools: {},
      },
    },
  });
  assert.deepEqual(block.build.tools, { edit: true });
  assert.ok(!("tools" in block.plan));
});

test("createDragonRouterModesBlock builds provider-prefixed mode entries", () => {
  const block = createDragonRouterModesBlock({
    modes: {
      build: { modelId: "claude-sonnet-4-5-thinking", tools: { edit: true, bash: true } },
      plan: { modelId: "claude-opus-4-5-thinking", prompt: "Plan first, code later." },
      review: { modelId: "gemini-3-flash" },
    },
  });
  assert.equal(block.build.model, "dragonrouter/claude-sonnet-4-5-thinking");
  assert.deepEqual(block.build.tools, { edit: true, bash: true });
  assert.equal(block.plan.prompt, "Plan first, code later.");
  assert.equal(block.review.model, "dragonrouter/gemini-3-flash");
});

test("createDragonRouterModesBlock skips modes with empty modelId", () => {
  const block = createDragonRouterModesBlock({
    modes: {
      build: { modelId: "claude-sonnet-4-5-thinking" },
      plan: { modelId: "" },
    },
  });
  assert.deepEqual(Object.keys(block), ["build"]);
});

test("createDragonRouterModesBlock honours numeric overrides limited to OC schema", () => {
  const block = createDragonRouterModesBlock({
    modes: {
      build: {
        modelId: "claude-sonnet-4-5-thinking",
        temperature: 0.7,
        top_p: 0.9,
      },
    },
  });
  assert.equal(block.build.temperature, 0.7);
  assert.equal(block.build.top_p, 0.9);
});

// #3419 — soft-deprecation in favour of @dragonrouter/opencode-plugin. Guard the
// deprecation notice so it can't be silently dropped while the package is kept
// publishing (it still works; it is just no longer the recommended path).
test("package is marked deprecated in favour of @dragonrouter/opencode-plugin (#3419)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
  assert.match(pkg.description, /DEPRECATED/);
  assert.match(pkg.description, /@dragonrouter\/opencode-plugin/);

  const readme = readFileSync(join(here, "..", "README.md"), "utf8");
  assert.match(readme, /Deprecated/i);
  assert.match(readme, /@dragonrouter\/opencode-plugin/);
});
