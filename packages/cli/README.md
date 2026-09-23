# envkit (CLI)

Interactive CLI for typed environment variable management. Reads your `envkit.config.ts` schema and provides setup wizard, validation, generation, and diff commands.

## Usage (no install needed)

```bash
npx envkit setup
npx envkit validate
npx envkit generate
npx envkit diff
```

## Install globally

```bash
npm install -g envkit-cli
envkit setup
```

## Commands

### `envkit setup`

Interactive wizard that walks through every variable in your schema. Detects an existing `.env` and offers to keep valid values (non-destructive by default).

```bash
envkit setup
envkit setup --config path/to/envkit.config.ts
```

### `envkit validate`

Validates your `.env` against the schema. Exits with code `1` on failure — use in CI and Docker `ENTRYPOINT`.

```bash
envkit validate
envkit validate --json   # { success, errors, values } — secrets masked as "[secret]"
```

### `envkit generate`

Generates a `.env.example` file from the schema. Secret fields are commented out. Examples and defaults are filled in.

```bash
envkit generate
envkit generate --output .env.staging.example
```

### `envkit diff`

Shows missing required vars, extra vars not in the schema, and vars that fail type validation.
Exits with code 1 if anything is missing or invalid (CI-safe, like `validate`). Extra/undeclared
vars alone are a warning and don't affect the exit code.

```bash
envkit diff
envkit diff --json   # { clean, missing, extra, invalid }
```

## Options

All commands accept:

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to a non-default config file |

`validate` and `diff` also accept `--json` to print a single JSON object instead of human-readable text — useful for a custom CI reporter.

Default config resolution: `envkit.config.ts` → `envkit.config.js` → `envkit.config.mjs`

### Monorepos

Config resolution and `generate --output` are relative to `process.cwd()`, not the repo root. If `envkit.config.ts` lives at the workspace root but the CLI runs from a package directory (the usual pnpm/Turborepo setup), pass `--config` (and `--output`, for `generate`) with a relative path back to the root — see the [main README](../../README.md#monorepos-pnpm-workspaces-turborepo) for a full example.

## Config file

Create `envkit.config.ts` at the root of your project:

```typescript
import { defineEnv, LocalEnvSource } from 'envkit-core'

export default defineEnv({
  source: LocalEnvSource({ path: '.env' }),
  envGroups: [
    { slug: 'server', name: 'Server Configuration' },
  ],
  envSchema: {
    PORT: {
      type: 'number',
      default: 3000,
      description: 'HTTP server port',
      group: 'server',
      required: false,
    },
  },
})
```

See [`envkit-core`](../core/README.md) for the full schema field reference.
