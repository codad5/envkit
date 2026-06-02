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
npm install -g envkit
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
```

### `envkit generate`

Generates a `.env.example` file from the schema. Secret fields are commented out. Examples and defaults are filled in.

```bash
envkit generate
envkit generate --output .env.staging.example
```

### `envkit diff`

Shows missing required vars, extra vars not in the schema, and vars that fail type validation.

```bash
envkit diff
```

## Options

All commands accept:

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to a non-default config file |

Default config resolution: `envkit.config.ts` → `envkit.config.js` → `envkit.config.mjs`

## Config file

Create `envkit.config.ts` at the root of your project:

```typescript
import { defineEnv } from '@envkit/core'

export default defineEnv({
  source: { type: 'combined', path: '.env' },
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

See [`@envkit/core`](../core/README.md) for the full schema field reference.
