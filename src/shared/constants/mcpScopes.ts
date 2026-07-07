/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  dragon_router_get_health: ["read:health"],
  dragon_router_list_combos: ["read:combos"],
  dragon_router_get_combo_metrics: ["read:combos"],
  dragon_router_switch_combo: ["write:combos"],
  dragon_router_check_quota: ["read:quota"],
  dragon_router_route_request: ["execute:completions"],
  dragon_router_web_search: ["execute:search"],
  dragon_router_web_fetch: ["execute:search"],
  dragon_router_cost_report: ["read:usage"],
  dragon_router_list_models_catalog: ["read:models"],

  // Phase 2: Advanced Tools
  dragon_router_simulate_route: ["read:health", "read:combos"],
  dragon_router_set_budget_guard: ["write:budget"],
  dragon_router_set_resilience_profile: ["write:resilience"],
  dragon_router_test_combo: ["execute:completions", "read:combos"],
  dragon_router_get_provider_metrics: ["read:health"],
  dragon_router_best_combo_for_task: ["read:combos", "read:health"],
  dragon_router_explain_route: ["read:health", "read:usage"],
  dragon_router_get_session_snapshot: ["read:usage"],
  dragon_router_db_health_check: ["read:health", "write:resilience"],
  dragon_router_sync_pricing: ["pricing:write"],
  dragon_router_cache_stats: ["read:cache"],
  dragon_router_cache_flush: ["write:cache"],
  dragon_router_compression_status: ["read:compression"],
  dragon_router_compression_configure: ["write:compression"],
  dragon_router_set_compression_engine: ["write:compression"],
  dragon_router_list_compression_combos: ["read:compression"],
  dragon_router_compression_combo_stats: ["read:compression"],
  dragon_router_oneproxy_fetch: ["read:proxies"],
  dragon_router_oneproxy_rotate: ["read:proxies"],
  dragon_router_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  dragon_router_pool_status: ["read:health"],
  dragon_router_pool_sessions: ["read:health"],
  dragon_router_pool_health: ["read:health"],
  dragon_router_pool_reset: ["write:resilience"],
  dragon_router_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  dragon_router_browser_pool_status: ["read:health"],
} as const;
