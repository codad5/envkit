# envkit-core

Runtime library for typed, schema-driven environment variable management.

## Install

```bash
npm install envkit-core
# zod is optional — only needed for schema: z.xxx() fields
npm install zod
```

## Usage

### 1. Define schema — `envkit.config.ts`

```typescript
import { defineEnv, LocalEnvSource } from 'envkit-core'

export default defineEnv({
  source: LocalEnvSource({ path: '.env' }),
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
      type: ['development', 'staging', 'production'] as const,
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

> **Inline enum literal types** — add `as const` to the array so TypeScript infers
> `'development' | 'staging' | 'production'` instead of `string`.
> Without it the union is widened to `string` at the type level (runtime validation
> still works either way). Alternatively, use `schema: z.enum([...])` which preserves
> literal types automatically.

### 2. Validate at startup — `env.ts`

```typescript
import config from './envkit.config'

export const { serverEnv, publicEnv } = config.load()
// serverEnv: every declared field (PORT, NODE_ENV, DATABASE_URL, ...)
// publicEnv: only fields marked `visibility: 'public'` in the schema
```

### 3. Use

```typescript
import { serverEnv } from './env'
app.listen(serverEnv.PORT)
```

## Visibility — safe to read in the browser?

By default every field is `visibility: 'server'` — reachable only through
`serverEnv`, which **throws immediately** if accessed once `typeof window !==
'undefined'`. Mark a field `visibility: 'public'` to also expose it via
`publicEnv`, which has no such guard and is safe to import into
client-bundled code (a Next.js client component, etc.):

```typescript
envSchema: {
  DATABASE_URL: { type: 'string', description: '...', required: true, secret: true },
  APP_URL:      { type: 'url', description: '...', required: true, visibility: 'public' },
}
```

`secret: true` combined with `visibility: 'public'` is rejected at compile
time — that combination is always a mistake.

**What this guard is, and isn't.** The `serverEnv` throw is a fail-fast
check against the mistake of importing `serverEnv` into client-reachable
code — it turns a silent leak into an immediate crash in dev/CI. It is
**not** a confidentiality boundary: if a secret's value is already present
in a browser-executed module, it is already in the shipped bundle and
readable via devtools regardless of what any runtime check does. The actual
protection is making sure `serverEnv` is never imported by code that ends up
in a client bundle in the first place.

It's also worth knowing the check itself is a plain
`typeof window !== 'undefined'` — it recognizes "browser vs. Node," not any
particular framework's dev/prod distinction (that's a separate, ordinary
schema field like `NODE_ENV` above, with no special handling from envkit).

**Bundler inlining.** Next.js/Vite expose public env vars by statically
replacing the literal text `process.env.NEXT_PUBLIC_X` at build time.
Reached through an object instead — `publicEnv.NEXT_PUBLIC_X` — there is
nothing for the bundler to statically replace, so it evaluates to `undefined`
in the browser. This is a bundler constraint, not specific to envkit — the
same issue affects any library that hands you public vars as object
properties. If your bundler requires literal `process.env.X` references,
keep using `process.env.NEXT_PUBLIC_X` directly for those specific reads and
use `publicEnv`/`serverEnv` for everything else (validation, defaults,
non-bundled contexts).

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
- `.load()` — validates all variables, runs computed fields, and returns
  `{ serverEnv, publicEnv }` (see Visibility above); throws on failure

### `loadRawEnv(source, cwd?)`

Load raw string env vars according to a `SourceConfig`. Returns `Record<string, string>`.

### `validateEnv(schema, raw)`

Validate a raw string map against a schema. Returns `{ success, errors, data }` — does not throw.

### `parseEnvFile(filePath)`

Parse a `.env` file into a `Record<string, string>`. Returns `{}` if the file doesn't exist.
