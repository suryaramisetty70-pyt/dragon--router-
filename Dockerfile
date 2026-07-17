# ── Common base with runtime deps ──────────────────────────────────────────
FROM node:22-slim AS base
WORKDIR /app

# `apt-get upgrade` pulls the security-patched versions of the Debian base-image
# packages at build time — clears the subset of container-scan CVEs.
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=shared \
  --mount=type=cache,id=apt-lists,target=/var/lib/apt/lists,sharing=shared \
  apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends libsecret-1-0 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Refresh the globally-installed npm
RUN npm install -g npm@latest \
  && npm cache clean --force

# ── Builder ────────────────────────────────────────────────────────────────
FROM node:22 AS builder
WORKDIR /app

COPY package*.json ./
COPY open-sse/package.json ./open-sse/package.json
COPY scripts/build/postinstall.mjs ./scripts/build/postinstall.mjs
COPY scripts/build/postinstallSupport.mjs ./scripts/build/postinstallSupport.mjs
COPY scripts/build/native-binary-compat.mjs ./scripts/build/native-binary-compat.mjs
COPY scripts/build/colocateOptionals.mjs ./scripts/build/colocateOptionals.mjs
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
  npm ci --no-audit --no-fund --legacy-peer-deps \
  && node -e "require('better-sqlite3')(':memory:').close()"

# Build with Turbopack (stable in Next 16, the repo default). The v3.8.27-era
# TurbopackInternalError panic ("entered unreachable code: there must be a path to a
# root" in ImportTracer::get_traces) no longer reproduces on Next 16.2.9 — validated
# 2026-07-05 with clean amd64 (12min14s, image smoke-tested: /api/monitoring/health
# 200) and arm64 (qemu, exit 0, zero panic strings) builds. Turbopack cut the bare
# build from 17min to 9min on the same 32-core box. Webpack stays available as the
# escape hatch: `--build-arg`/-e DRAGONROUTER_USE_TURBOPACK=0.
# See docs/ops/QUALITY_GATE_PLAYBOOK.md Parte 6.
ENV DRAGONROUTER_USE_TURBOPACK=0

# Raise the V8 heap ceiling for the build. The webpack production optimization
# pass needs more than V8's default ceiling (~2 GB) for a codebase this size; a
# memory-constrained Docker build otherwise dies with "FATAL ERROR: ... JavaScript
# heap out of memory" during the builder stage (#4076). Turbopack's compile is
# native (Rust) and less V8-heap-bound, but the prerender/export phase still runs
# on V8, so keep the ceiling. NODE_OPTIONS propagates to the spawned `next build`
# child (build-next-isolated.mjs → resolveNextBuildEnv spreads process.env).
# Build-only; the runtime heap is set separately on the runner stage
# (DRAGONROUTER_MEMORY_MB). Override: `--build-arg DRAGONROUTER_BUILD_MEMORY_MB=6144`.
ARG DRAGONROUTER_BUILD_MEMORY_MB=2048
ENV NODE_OPTIONS="--max-old-space-size=${DRAGONROUTER_BUILD_MEMORY_MB}"

COPY . ./
RUN --mount=type=cache,id=next-cache,target=/app/.build/next/cache \
  mkdir -p /app/data && npm run build

# ── Runner base ────────────────────────────────────────────────────────────
FROM base AS runner-base

LABEL org.opencontainers.image.title="dragonrouter" \
  org.opencontainers.image.description="Unified AI proxy — route any LLM through one endpoint" \
  org.opencontainers.image.url="https://dragonrouter.online" \
  org.opencontainers.image.source="https://github.com/diegosouzapw/Dragon Router" \
  org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV DRAGONROUTER_MEMORY_MB=1024
ENV NODE_OPTIONS="--max-old-space-size=${DRAGONROUTER_MEMORY_MB}"

# Data directory inside Docker — must match the volume mount in docker-compose.yml
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

# `npm run build` (build-next-isolated → assembleStandalone) bundles ALL runtime
# files into .build/next/standalone/ — .next, node_modules, migrations, scripts,
# docs, and the previously hand-COPY'd modules below (@swc/helpers, pino-*, split2,
# migrations). assembleStandalone copies them straight from the builder's
# node_modules, so they are present regardless of NFT/Turbopack trace behaviour.
# The old per-module overrides were therefore pure duplication and were removed
# (build-output-isolation cleanup). See scripts/build/assembleStandalone.mjs
# (EXTRA_MODULE_ENTRIES) for the single source of truth.
COPY --from=builder /app/.build/next/standalone ./
# better-sqlite3 is the one exception still copied explicitly: assembleStandalone
# only syncs its native build/ dir; the JS wrapper (lib/, package.json) is left to
# Next.js tracing. bootstrap-env requires SQLite BEFORE the standalone server
# starts, so guarantee the complete package independent of trace behaviour.
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# migrations land at <standalone>/migrations via assembleStandalone; point the runtime at them.
ENV DRAGONROUTER_MIGRATIONS_DIR=/app/migrations

# Docker healthcheck script — not traced by Next.js standalone output, so copy
# it explicitly. The HEALTHCHECK CMD references it as `node healthcheck.mjs`.
COPY --from=builder /app/scripts/dev/healthcheck.mjs ./healthcheck.mjs

# Hand /app over to the baked-in `node` non-root user (UID/GID 1000) so the
# runtime process never holds root privileges. The chown happens after all
# COPYs so it covers files originally owned by root in the builder stage.
RUN chown -R node:node /app

EXPOSE 20128

# Drop to non-root before ENTRYPOINT/CMD so every derived stage (runner-cli,
# runner-web) also runs as a non-root user unless they explicitly switch back.
USER node

# Warns if the mounted data volume has wrong ownership
COPY --chmod=755 scripts/check-permissions.sh /tmp/check-permissions.sh
ENTRYPOINT ["/tmp/check-permissions.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "healthcheck.mjs"]

CMD ["node", "dev/run-standalone.mjs"]

# ── Runner Web (web-cookie providers: Gemini Web, Claude Turnstile) ───────────
#
#  Two image flavors:
#    runner-base  →  dragonrouter:VERSION        Lean base (~500 MB). No browsers.
#    runner-web   →  dragonrouter:VERSION-web    +Chromium/Playwright (~800 MB).
#
#  Use runner-web when you need web-cookie providers (gemini-web, claude-web,
#  claude-turnstile). For all other providers runner-base is sufficient.
#
#  Build:
#    docker build --target runner-web -t dragonrouter:web .
#  Compose:
#    build:
#      context: .
#      target: runner-web
FROM runner-base AS runner-web

USER root

# Copy playwright and playwright-core from the builder stage.
# The slim runtime image does not have playwright in node_modules, so npx falls
# back to a registry download — unreliable on CI runners (exits 127 on failure).
# Copying from the builder avoids any network access at image-build time and also
# ensures the same playwright version is available at runtime for web-session providers.
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core
COPY --from=builder /app/node_modules/playwright ./node_modules/playwright

# Install Playwright browser binaries + OS dependencies under root, then hand
# ownership of the browsers cache to the node user.
# PLAYWRIGHT_BROWSERS_PATH overrides the default ~/.cache/ms-playwright so the
# browsers land under /home/node which persists across image layers and is
# accessible to the non-root runtime user.
ENV PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,id=apt-lists,target=/var/lib/apt/lists,sharing=locked \
  apt-get update \
  && node node_modules/playwright/cli.js install chromium --with-deps \
  && chown -R node:node /home/node/.cache \
  && rm -rf /var/lib/apt/lists/*

USER node

FROM runner-base AS runner-cli

# Drop back to root briefly so we can install system + global npm packages,
# then return to the `node` non-root user before the CMD inherited from
# runner-base runs.
USER root

# Install system dependencies required by openclaw (git+ssh references).
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,id=apt-lists,target=/var/lib/apt/lists,sharing=locked \
  apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates docker.io docker-compose \
  && rm -rf /var/lib/apt/lists/* \
  && git config --system url."https://github.com/".insteadOf "ssh://git@github.com/"

# Install CLI tools globally. Separate layer from apt for better cache reuse.
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
  npm install -g --no-audit --no-fund @openai/codex @anthropic-ai/claude-code droid openclaw@latest

USER node
