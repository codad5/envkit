# @envkit/core

Runtime library for typed, schema-driven environment variable management.

## Install

```bash
npm install @envkit/core
# zod is optional — only needed for schema: z.xxx() fields
npm install zod
```

## Usage

### 1. Define schema — `envkit.config.ts`

```typescript
import { defineEnv } from '@envkit/core'

export default defineEnv({
  source: { type: 'combined', path: '.env' },
  envGroups: [
    { slug: 'server', name: 'Server' },
    { slug: 'db',     name: 'Database' },
  ],
  envSchema: {
    PORT: {
      type: 'number',
      default: 3000,
      description: 'HTTP port',
      group: 'server',
      required: false,
    },
    NODE_ENV: {
      type: ['development', 'staging', 'production'],
      default: 'development',
      description: 'Runtime environment',
      group: 'server',
      required: true,
    },
    DATABASE_URL: {
      type: 'string',
      description: 'Postgres connection string',
      group: 'db',
      required: true,
      example: 'postgresql://user:pass@localhost:5432/mydb',
    },
  },
})
```

### 2. Validate at startup — `env.ts`

```typescript
import config from './envkit.config'

export const env = config.load()
// Type inferred as:
// {
//   PORT:         number
//   NODE_ENV:     'development' | 'staging' | 'production'
//   DATABASE_URL: string
// }
```

### 3. Use

```typescript
import { env } from './env'
app.listen(env.PORT)
```

## Source types

| Type | Behaviour |
|---|---|
| `file` | Load from `.env` file only |
| `process` | Use `process.env` only (no file) |
| `combined` | File + `process.env` override (recommended) |

## API

### `defineEnv(config)`

Returns an `EnvKitInstance` with:
- `.schema` — the raw schema object
- `.groups` — the group definitions
- `.source` — the resolved source config
- `.load()` — validates all variables and returns the fully typed env object; throws on failure

### `loadRawEnv(source, cwd?)`

Load raw string env vars according to a `SourceConfig`. Returns `Record<string, string>`.

### `validateEnv(schema, raw)`

Validate a raw string map against a schema. Returns `{ success, errors, data }` — does not throw.

### `parseEnvFile(filePath)`

Parse a `.env` file into a `Record<string, string>`. Returns `{}` if the file doesn't exist.
