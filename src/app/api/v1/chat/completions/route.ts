import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { callCloudWithMachineId } from "@/shared/utils/cloud";
import { handleChat } from "@/sse/handlers/chat";
import { generateRequestId } from "@/shared/utils/requestId";
import { initTranslators } from "@dragon-router/open-sse/translator/index.ts";
import { createInjectionGuard } from "@/middleware/promptInjectionGuard";
import { acceptHeaderForcesStream } from "@dragon-router/open-sse/utils/aiSdkCompat.ts";
import { withEarlyStreamKeepalive } from "@dragon-router/open-sse/utils/earlyStreamKeepalive";
import { resolveKeepaliveThreshold } from "@dragon-router/open-sse/utils/keepaliveThreshold";
import { checkChatAdmission } from "@/shared/middleware/chatBodyAdmission";

let initPromise = null;

// Singleton injection guard instance
const injectionGuard = createInjectionGuard();

/**
 * Initialize translators once (Promise-based singleton — no race condition)
 */
function ensureInitialized() {
  if (!initPromise) {
    initPromise = Promise.resolve(initTranslators()).then(() => {
      console.log("[SSE] Translators initialized");
    });
  }
  return initPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request) {
  await ensureInitialized();

  // Heap-pressure-aware admission: shed a large body with 503 (or 413 if pathological)
  // BEFORE the request is cloned + JSON-parsed below. A large coding-agent compact body
  // amplifies into hundreds of MB of transient JS objects on the combo path; under a
  // burst of concurrent compacts that stacks past the V8 heap ceiling and OOM-crashes the
  // whole process. Shedding the marginal request here turns a pod-wide crash into a single
  // client retry. Healthy heap (the normal case) admits every body untouched. (#5152)
  const admissionRejection = checkChatAdmission(request);
  if (admissionRejection) return admissionRejection;

  // One-line marker for diagnosing 413 / Server-Action interceptions.
  // Logs only when Content-Length is present so debug noise stays low for
  // typical chat payloads. Toggle off via DRAGON_ROUTER_LOG_REQUEST_SHAPE=0.
  if (process.env.DRAGON_ROUTER_LOG_REQUEST_SHAPE !== "0") {
    const ct = request.headers.get("content-type") ?? "";
    const cl = request.headers.get("content-length");
    if (cl && Number(cl) > 256 * 1024) {
      console.error(`[CHAT-ROUTE] large body content-type="${ct}" content-length=${cl}`);
    }
  }

  // Prompt injection guard — inspect body before forwarding. Parse the body ONCE here
  // and thread it to handleChat so the handler does not JSON-parse the (often 270-550 KB)
  // coding-agent payload a second time — the double parse doubled the body's heap
  // residency on the hot path and fed the OOM crash-loop (#4380).
  let parsedBody = null;
  try {
    const cloned = request.clone();
    parsedBody = await cloned.json().catch(() => null);
    if (parsedBody) {
      const { blocked, result } = injectionGuard(parsedBody);
      if (blocked) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Request blocked: potential prompt injection detected",
              type: "injection_detected",
              code: "SECURITY_001",
              detections: result.detections.length,
            },
          }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }
  } catch (error) {
    console.error("[SECURITY] Prompt injection guard failed:", error);
  }

  // Gate the early SSE keepalive wrapper: only wrap when the client explicitly
  // asks for streaming (body `stream: true`) or the Accept header forces SSE.
  // The parsed body is passed through UNTOUCHED — the actual stream/JSON framing
  // stays decided by chatCore/resolveStreamFlag (legacy streaming default and the
  // per-key `streamDefaultMode: "json"` opt-in are preserved).
  const parsedBodyIsRecord = isRecord(parsedBody);
  const acceptHeader = request.headers.get("accept") || "";
  const acceptForcesStream =
    parsedBodyIsRecord && acceptHeaderForcesStream(acceptHeader, parsedBody.stream);
  const wantsStreaming = (parsedBodyIsRecord && parsedBody.stream === true) || acceptForcesStream;

  // ==========================================
  // 🐉 DRAGON ROUTER FEATURES INJECTION
  // ==========================================
  
  if (parsedBodyIsRecord && Array.isArray(parsedBody.messages)) {
    // 🐉 Dragon Personas: Inject hyper-optimized system prompts
    const persona = request.headers.get("dragon-persona");
    if (persona) {
      let systemPrompt = "You are a helpful AI assistant.";
      if (persona === "Code Dragon") {
        systemPrompt = "You are Code Dragon, an elite 10x developer. Always output production-ready, highly optimized code with zero fluff.";
      } else if (persona === "Copywriter Dragon") {
        systemPrompt = "You are Copywriter Dragon, a world-class marketing copywriter. Write persuasive, high-converting copy.";
      }
      parsedBody.messages.unshift({ role: "system", content: systemPrompt });
    }

    // 🐉 Dragon Memory: Inject cross-provider memory context
    const memory = request.headers.get("dragon-memory");
    if (memory) {
      parsedBody.messages.unshift({ 
        role: "system", 
        content: `[DRAGON MEMORY INJECTED]: Use the following past context to inform your answers: ${memory}` 
      });
    }

    // 🐉 Dragon Swarm: Fake multi-agent consensus for simplicity in this implementation
    // True multi-agent routing requires a complex orchestration layer.
    if (parsedBody.model === "dragon-swarm") {
      parsedBody.model = "openai/gpt-4o-mini"; // fallback to a fast model for the swarm coordinator
      parsedBody.messages.push({
        role: "user",
        content: "[SYSTEM]: Please synthesize a consensus answer as if 3 different expert AI models debated this topic."
      });
    }
  }

  // 🐉 Dragon Scales: Auto Model Fallback Engine
  const executeWithScales = async (modelToTry) => {
    if (parsedBodyIsRecord) parsedBody.model = modelToTry;
    let response;
    
    // We must clone the request for retries, because the body can only be read once
    // However, handleChat takes the raw request, but uses parsedBody if passed.
    const reqClone = request.clone();
    
    if (wantsStreaming) {
      const reqId = generateRequestId();
      response = await withEarlyStreamKeepalive(handleChat(reqClone, null, parsedBody, reqId), {
        signal: reqClone.signal,
        thresholdMs: resolveKeepaliveThreshold(parsedBody?.model),
        extraHeaders: { "X-Correlation-Id": reqId },
      });
    } else {
      response = await handleChat(reqClone, null, parsedBody);
    }
    
    return response;
  };

  const primaryModel = parsedBodyIsRecord ? parsedBody.model : null;
  const fallbackModels = ["openai/gpt-4o-mini", "anthropic/claude-3-haiku", "google/gemini-flash"];
  
  let finalResponse = await executeWithScales(primaryModel);

  // If the primary model fails (5xx or 429), trigger Dragon Scales!
  if (finalResponse && [429, 500, 502, 503, 504].includes(finalResponse.status)) {
    console.warn(`[DRAGON SCALES] Primary model ${primaryModel} failed with ${finalResponse.status}. Initiating fallback...`);
    for (const fallbackModel of fallbackModels) {
      if (fallbackModel === primaryModel) continue;
      console.warn(`[DRAGON SCALES] Falling back to ${fallbackModel}...`);
      finalResponse = await executeWithScales(fallbackModel);
      if (finalResponse && ![429, 500, 502, 503, 504].includes(finalResponse.status)) {
        console.warn(`[DRAGON SCALES] Fallback to ${fallbackModel} succeeded!`);
        break;
      }
    }
  }

  return finalResponse;
}
