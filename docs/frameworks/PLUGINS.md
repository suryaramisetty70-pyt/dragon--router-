---
title: "Dragon Router CLI Plugin System"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Dragon Router CLI Plugin System

Extend the `dragonrouter` CLI without modifying its core. Plugins follow the `dragonrouter-cmd-*` naming convention, similar to `gh extension` or `kubectl plugin`.

## Quick start

```bash
# Install a plugin from npm
dragonrouter plugin install stripe

# Install a local plugin in development
dragonrouter plugin install ./my-plugin

# List installed plugins
dragonrouter plugin list

# Scaffold a new plugin
dragonrouter plugin scaffold myplugin
cd dragonrouter-cmd-myplugin
dragonrouter plugin install .
```

## Plugin anatomy

A plugin is an npm package named `dragonrouter-cmd-<name>` (or `@scope/dragonrouter-cmd-<name>`).

```
dragonrouter-cmd-myplugin/
├── package.json     # must have "type": "module" and "main": "index.mjs"
├── index.mjs        # exports register(program, ctx) + optional meta
└── README.md
```

### `package.json`

```json
{
  "name": "dragonrouter-cmd-myplugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.mjs",
  "engines": { "dragonrouter": ">=4.0.0" },
  "keywords": ["dragonrouter-plugin", "dragonrouter-cmd"]
}
```

### `index.mjs`

```js
export const meta = {
  name: "myplugin",
  version: "0.1.0",
  description: "My plugin for Dragon Router",
  dragonrouterApi: ">=4.0.0",
};

export function register(program, ctx) {
  program
    .command("myplugin")
    .description(meta.description)
    .option("-n, --name <name>")
    .action(async (opts, cmd) => {
      const gOpts = cmd.optsWithGlobals();
      const res = await ctx.apiFetch("/api/combos", {
        baseUrl: gOpts.baseUrl,
        apiKey: gOpts.apiKey,
      });
      const data = await res.json();
      ctx.emit(data, gOpts);
    });
}
```

## Plugin context API

The `ctx` object passed to `register(program, ctx)`:

| Property                     | Type             | Description                                        |
| ---------------------------- | ---------------- | -------------------------------------------------- |
| `ctx.apiFetch(path, opts)`   | `async function` | Authenticated fetch to the Dragon Router server    |
| `ctx.emit(data, opts)`       | `function`       | Output in table/json/jsonl/csv per `--output` flag |
| `ctx.t(key)`                 | `async function` | i18n translation lookup                            |
| `ctx.withSpinner(label, fn)` | `async function` | Wraps async fn with ora spinner                    |
| `ctx.baseUrl`                | `string`         | Resolved base URL                                  |
| `ctx.apiKey`                 | `string \| null` | API key if provided                                |

## Discovery

Plugins are discovered from:

1. `~/.dragonrouter/plugins/<name>/` — user-local installs
2. `DRAGONROUTER_PLUGIN_PATH` env var — custom directory

Loading errors are caught and printed as warnings — a broken plugin never crashes the CLI.

## Security

Plugins run with the same Node.js process privileges as `dragonrouter`. Only install plugins from sources you trust. `dragonrouter plugin install` shows an explicit warning and requires `--yes` or interactive confirmation.

## Publishing

1. Ensure `package.json` has `"keywords": ["dragonrouter-plugin"]`
2. `npm publish` as normal
3. Users discover via `dragonrouter plugin search <query>` (searches npm registry)

## Example plugin

See [`examples/dragonrouter-cmd-hello/`](../../examples/dragonrouter-cmd-hello/index.mjs) for a minimal working example with `meta` + `register()`.
