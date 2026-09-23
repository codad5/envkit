# envkit

Typed, schema-driven environment variable management for Node.js and TypeScript.

## The problem

Managing environment variables across local, staging, and production is tedious and error-prone. Every new team member has to hunt down which variables exist, what format they take, and where to get them. You type them one by one, make a typo, get a cryptic runtime crash, fix it, repeat. Variables go stale in `.env.example`. Production gets a different set than staging. Nobody knows which ones are still used.

envkit started from exactly this frustration — define the schema once, and let the tooling handle the rest: typed access, validation at startup, an interactive setup wizard that walks collaborators through every variable, and a generated `.env.example` that stays in sync automatically.

Define your env schema once in `envkit.config.ts`. Get typed access, validation, CLI setup wizard, and generated `.env.example` — all from a single source of truth.

```
npx envkit setup    # interactive wizard to fill your .env
npx envkit validate # validate .env against your schema (CI-safe)
npx envkit generate # generate .env.example from schema
npx envkit diff     # show missing, extra, and invalid vars
```

---

## Why envkit?

| | envkit | t3-env | envalid | dotenv-safe | raw dotenv |
|---|:---:|:---:|:---:|:---:|:---:|
| TypeScript inference (no annotation needed) | ✅ | ✅ | ⚠️ partial | ❌ | ❌ |
| Zod support | ✅ optional | ✅ required | ❌ | ❌ | ❌ |
| Plain field types (no Zod needed) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Interactive setup wizard | ✅ | ❌ | ❌ | ❌ | ❌ |
| `.env.example` generation | ✅ | ❌ | ❌ | manual | ❌ |
| Diff command (missing / extra / invalid) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Computed / derived fields | ✅ | ❌ | ❌ | ❌ | ❌ |
| Client/server visibility split (`serverEnv`/`publicEnv`) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Group organisation (for CLI & docs) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Proxy (throws on unknown key access) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `howToGet` hints in wizard & example | ✅ | ❌ | ❌ | ❌ | ❌ |
| Runtime only (no build step in library) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Pick envkit if** you want one config file that powers both runtime validation _and_ developer tooling (setup wizard, generated `.env.example`, CI diff) — plus a client/server visibility split for browser frameworks, without giving up the CLI.

**Pick t3-env if** you're already all-in on Zod and want the tightest possible integration with Next.js / tRPC conventions.

**Pick envalid if** you want something minimal with no CLI and no Zod dependency.

**Pick dotenv-safe if** all you need is "fail if a key in `.env.example` is missing" with zero setup.

---

## Packages

| Package | Description |
|---|---|
| [`envkit-core`](./packages/core) | Runtime library — `defineEnv()`, typed validation, source loaders |
| [`envkit-cli`](./packages/cli) | CLI tool — setup wizard, validate, generate, diff |



---

## Quick start

### 1. Install

```bash
npm install envkit-core
npm install --save-dev envkit-cli
```

### 2. Define your schema — `envkit.config.ts`

```typescript
import { defineEnv, LocalEnvSource } from 'envkit-core'

export default defineEnv({
  source: LocalEnvSource({ path: '.env' }),  // file + process.env override
  envGroups: [
    { slug: 'server',   name: 'Server Configuration' },
    { slug: 'database', name: 'Database' },
    { slug: 'auth',     name: 'Authentication' },
  ],
  envSchema: {
    NODE_ENV: {
      type: ['development', 'staging', 'production'],
      default: 'development',
      description: 'Application runtime environment',
      group: 'server',
      required: true,
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: 'HTTP server port',
      howToGet: 'Pick any free port on your machine',
      group: 'server',
      required: false,
      min: 1,
      max: 65535,
    },
    DATABASE_URL: {
      type: 'string',
      description: 'PostgreSQL connection string',
      howToGet: 'Get from your DB provider dashboard',
      group: 'database',
      required: true,
      example: 'postgresql://user:pass@localhost:5432/mydb',
    },
    JWT_SECRET: {
      type: 'string',
      description: 'Secret key for signing JWT tokens',
      howToGet: 'Generate with: openssl rand -hex 64',
      group: 'auth',
      required: true,
      secret: true,
      minLength: 32,
    },
  },
})
```

### 3. Validate at startup — `env.ts`

```typescript
import config from './envkit.config'

// Validates at module load time — throws if anything is missing or invalid.
export const { serverEnv, publicEnv } = config.load()
//                  ^^^^^^^^^  ^^^^^^^^^
//                  Fully inferred, no annotation needed. serverEnv has every
//                  field; publicEnv only fields marked `visibility: 'public'`
//                  (see "Visibility" below) — here, none, so publicEnv is `{}`.
```

### 4. Use it

```typescript
import { serverEnv } from './env'

app.listen(serverEnv.PORT)
console.log(`Running in ${serverEnv.NODE_ENV}`)
```

### 5. Set up your `.env` interactively

```bash
npx envkit setup
```

```
╔══════════════════════════════════════════╗
║        envkit setup                      ║
╚══════════════════════════════════════════╝

  ── Server Configuration ──────────────────

  NODE_ENV [required]
  Application runtime environment
  ❯ development
    staging
    production

  PORT [optional]
  HTTP server port
  ↳ Pick any free port on your machine
  default: 3000
  > 8080
  ✔  PORT: 8080

  ── Database ──────────────────────────────

  DATABASE_URL [required]
  PostgreSQL connection string
  ↳ Get from your DB provider dashboard
  e.g. postgresql://user:pass@localhost:5432/mydb
  > postgresql://localhost/mydb
  ✔  DATABASE_URL: postgresql://localhost/mydb

  ✔  Written to .env (4 variables)
```

---

## Schema field reference

Every field in `envSchema` is either a **plain field** (uses `type`) or a **Zod field** (uses `schema`). These are mutually exclusive.

### Plain fields

| Field | Type | Description |
|---|---|---|
| `type` | `'string' \| 'number' \| 'boolean' \| 'url' \| 'json' \| string[]` | Value type. A `string[]` defines an inline enum — TypeScript infers a literal union. |
| `description` | `string` | **Required.** Human-readable label shown in CLI wizard and `.env.example`. |
| `howToGet` | `string` | Hint shown in setup wizard explaining how to obtain this value. |
| `required` | `boolean` | **Required.** Whether absence is an error. |
| `default` | matches `type` | Default if not set. Eliminates `undefined` from the inferred type. |
| `group` | `GroupSlug` | Must match a slug from `envGroups` — TypeScript error if the slug doesn't exist. |
| `secret` | `boolean` | Masked in CLI output, omitted from `.env.example`. |
| `visibility` | `'server' \| 'public'` | Default `'server'`. See [Visibility](#visibility) below. |
| `example` | `string` | Shown in wizard and `.env.example`. |
| `multiline` | `boolean` | Allow `\n` in value (quoted in output file). |
| `minLength` / `maxLength` | `number` | String length constraints (only on `type: 'string'`). |
| `min` / `max` | `number` | Numeric range (only on `type: 'number'`). |
| `pattern` | `RegExp \| string` | Regex validation (only on `type: 'string' \| 'url'`). |

### Zod fields

Supply a `schema` instead of `type` for advanced validation:

```typescript
import { z } from 'zod'

DATABASE_URL: {
  schema: z.string().url().startsWith('postgresql://'),
  description: 'PostgreSQL connection string',
  group: 'database',
  example: 'postgresql://user:pass@localhost:5432/mydb',
},
```

When `schema` is present, `type`, `required`, `default`, `min`, `max`, `minLength`, `maxLength`, and `pattern` are all forbidden — TypeScript will error. The Zod schema is the single source of truth.

Both Zod 3 and Zod 4 are supported — envkit only relies on `parse`/`safeParse`, not Zod's internal `_def` shape (which changed between majors).

```typescript
// Plain field equivalents → Zod equivalents
{ type: 'string', required: true  }              →  z.string()
{ type: 'string', required: false }              →  z.string().optional()
{ type: 'string', default: 'hello' }             →  z.string().default('hello')
{ type: 'string', minLength: 5, maxLength: 100 } →  z.string().min(5).max(100)
{ type: 'string', pattern: /^[a-z]+$/ }         →  z.string().regex(/^[a-z]+$/)
{ type: 'number', min: 0, max: 100 }             →  z.number().min(0).max(100)
{ type: ['development', 'production'] }          →  z.enum(['development', 'production'])

// Things only Zod can express:
z.string().email()
z.string().uuid()
z.number().int().positive()
z.string().trim().toLowerCase()     // transforms
z.string().refine(v => v !== 'admin', 'Cannot use "admin"')
```

---

## Visibility

By default every field is `visibility: 'server'` — reachable only through
`serverEnv`, which **throws immediately** if read once `typeof window !==
'undefined'`. Mark a field `visibility: 'public'` to also expose it via
`publicEnv`, safe to import into client-bundled code (a Next.js client
component, a Vite app, etc.):

```typescript
envSchema: {
  DATABASE_URL: { type: 'string', description: 'DB conn string', required: true, secret: true },
  APP_URL:      { type: 'url',    description: 'Public base URL', required: true, visibility: 'public' },
}

const { serverEnv, publicEnv } = config.load()
serverEnv.DATABASE_URL   // works on the server; throws if read from a browser context
publicEnv.APP_URL        // works everywhere
publicEnv.DATABASE_URL   // TypeScript error — not a key of publicEnv
```

`secret: true` + `visibility: 'public'` together is rejected at compile time
(and at `defineEnv()` call time for plain-JS users) — a secret exposed to the
browser is always a mistake, never a valid config.

**What the `serverEnv` guard is, and isn't.** It's a fail-fast check against
*importing `serverEnv` into client-reachable code* — it turns a silent leak
into an immediate crash in dev/CI, instead of a secret quietly ending up in a
shipped bundle. It is **not** a confidentiality boundary: if a secret's value
is already present in a browser-executed module, it's already in the bundle
and readable via devtools regardless of any runtime check. The real
protection is upstream — never let `serverEnv` be imported by anything that
ends up in a client bundle.

The check itself is a plain `typeof window !== 'undefined'` — it detects
"browser vs. Node," not a framework's dev/prod distinction. `NODE_ENV` (or
similar) is just an ordinary schema field with no special handling.

**Bundler inlining.** Next.js/Vite expose public env vars by statically
replacing the literal text `process.env.NEXT_PUBLIC_X` at build time.
`publicEnv.NEXT_PUBLIC_X` (an object property, not literal source text) has
nothing for the bundler to replace, so it's `undefined` in the browser bundle.
This affects every env library, not just envkit — if your bundler needs a
literal reference, keep using `process.env.NEXT_PUBLIC_X` directly for that
specific read, and reserve `publicEnv`/`serverEnv` for validation, defaults,
and non-bundled contexts (Node scripts, server components, tests).

---

## Source types

Sources are pluggable — built-ins cover most cases, and you can implement your own by satisfying the `EnvSource` interface.

```typescript
import { fileSource, processSource, combinedSource, LocalEnvSource } from 'envkit-core'

// Load from a .env file only
source: fileSource({ path: '.env' })

// Use process.env only — no file (ideal for containers / production)
source: processSource()

// File + process.env override — recommended for local dev
// process.env values win, so CI/Docker env vars always take precedence
source: combinedSource({ path: '.env' })

// LocalEnvSource is an alias for combinedSource
source: LocalEnvSource({ path: '.env' })
```

### Custom sources

Implement `EnvSource` (read-only) or `WritableEnvSource` (read + write) to load from any backend:

```typescript
import type { WritableEnvSource, WritePayload } from 'envkit-core'

export function redisSource(options: { url: string; prefix?: string }): WritableEnvSource {
  return {
    filePath: `redis:${options.url}`,   // used by CLI for display
    async load() {
      // fetch key→value pairs from Redis
      return fetchFromRedis(options)
    },
    async write(payload: WritePayload) {
      // payload.envs has each field + its value + all metadata
      // payload.groups has group ordering
      await writeToRedis(options, payload)
    },
  }
}
```

The `write()` method receives a [`WritePayload`](#writepayload) with full field metadata (description, `howToGet`, `secret`, groups) so your source can produce rich, structured output.

### Async sources

If your source's `load()` returns a `Promise`, `config.load()` is automatically inferred as async — TypeScript requires `await` and errors if you forget it:

```typescript
// Async source (e.g. AWS Secrets Manager, Vault, encrypted file)
export function vaultSource(): EnvSource {
  return {
    async load(): Promise<Record<string, string>> {
      return await fetchFromVault()
    },
  }
}

// env.ts — TypeScript infers Promise<{ serverEnv, publicEnv }>, await is required
export const { serverEnv } = await config.load()

// Sync source (file, process.env) — no await needed
export const { serverEnv } = config.load()
```

Top-level `await` requires `"type": "module"` in `package.json` (ESM). CJS users need an async init wrapper.

---

## Type inference

Return type of `config.load()` is fully inferred — no annotation needed:

```typescript
// required: true                → T           (never undefined)
// required: false, no default  → T | undefined
// has default                  → T           (default eliminates undefined)
// type: ['a', 'b']             → 'a' | 'b'  (literal union)

envSchema: {
  NODE_ENV: { type: ['development', 'production'], required: true }
  //  → 'development' | 'production'

  PORT:     { type: 'number', required: false, default: 3000 }
  //  → number  (default eliminates undefined)

  API_KEY:  { type: 'string', required: false }
  //  → string | undefined

  CONFIG:   { type: 'json',   required: true }
  //  → Record<string, unknown>
}
```

TypeScript catches misuse at compile time — no runtime needed:

```typescript
// ✗  Invalid group slug
PORT: { type: 'number', group: 'typo', required: true }
//                              ^^^^^^^ Error: not assignable to '"server" | "database"'

// ✗  Enum default not in the enum
NODE_ENV: { type: ['development', 'production'], default: 'staging' }
//                                                        ^^^^^^^^^ Error

// ✗  Numeric constraint on string type
NAME: { type: 'string', min: 0, required: true }
//                      ^^^ Error: 'min' not allowed on 'string'

// ✗  Access a variable not in the schema
serverEnv.NONEXISTENT  // Error: Property 'NONEXISTENT' does not exist

// ✗  A secret exposed to the browser
API_KEY: { type: 'string', required: true, secret: true, visibility: 'public' }
//                                                        ^^^^^^^^^^^^^^^^^^^ Error

// ✗  Reading a server-only field from publicEnv
publicEnv.DATABASE_URL  // Error: Property 'DATABASE_URL' does not exist on publicEnv
```

---

## CLI commands

All commands accept `--config <path>` to point at a non-default config file.  
Default resolution order: `envkit.config.ts` → `envkit.config.js` → `envkit.config.mjs`

### `envkit setup`

Interactive wizard. Walks through every variable in the schema group by group.
- Detects an existing `.env` and offers to keep or update each value
- Enum fields → arrow-key select list
- Boolean fields → yes/no prompt
- Secret fields → masked input
- Shows `howToGet` hints inline

```bash
npx envkit setup
npx envkit setup --config path/to/envkit.config.ts
```

### `envkit validate`

Validates the current `.env` against the schema. Exits with code 1 on failure — safe for CI and Docker `ENTRYPOINT`.

```bash
npx envkit validate

  ✔  NODE_ENV      development
  ✔  PORT          8080
  ✔  DATABASE_URL  postgresql://... (truncated)
  ✗  JWT_SECRET    required but not set

  1 error found. Run `envkit setup` to fix.
```

### `envkit generate`

Generates a `.env.example` file from the schema. Real values are replaced with examples or placeholders. Secret fields get a comment instead of a value.

```bash
npx envkit generate
npx envkit generate --output .env.example.staging
```

Output format:
```dotenv
# =============================================================================
# Server Configuration
# =============================================================================

# Application runtime environment
# Options: development, staging, production
NODE_ENV=development

# HTTP server port
# HOW TO GET: Pick any free port on your machine
# OPTIONAL
PORT=3000

# =============================================================================
# Authentication
# Auth secrets and settings
# =============================================================================

# Secret key for signing JWT tokens
# HOW TO GET: Generate with: openssl rand -hex 64
# JWT_SECRET=  ← commented out, secret field
```

### `envkit diff`

Shows what's missing, what's extra, and what's invalid compared to the schema.
Exits with code 1 if anything is **Missing** or **Invalid** — safe for CI.
**Extra** (undeclared) keys alone are a warning and don't fail the exit code.

```bash
npx envkit diff

  Missing (required):
    ✗  JWT_SECRET

  Extra (not in schema):
    ⚠  OLD_API_KEY
    ⚠  LEGACY_DB_HOST

  Invalid:
    ✗  PORT    expected number, got "not-a-port"

$ echo $?
1
```

---

## Recommended project setup

```
my-app/
├── envkit.config.ts   ← schema definition (committed)
├── .env               ← actual values    (gitignored)
├── .env.example       ← generated        (committed)
├── env.ts             ← calls config.load() → { serverEnv, publicEnv }, throws on invalid
└── src/
    └── server.ts      ← imports from env.ts
```

```json
{
  "scripts": {
    "env:setup":    "envkit setup",
    "env:validate": "envkit validate",
    "env:generate": "envkit generate",
    "env:diff":     "envkit diff",
    "predev":       "envkit validate",
    "prebuild":     "envkit validate"
  }
}
```

`predev` and `prebuild` run `envkit validate` automatically before every `dev` and `build` — the server won't start with a broken env.

### CI / GitHub Actions

```yaml
- name: Validate environment
  run: npx envkit validate
  env:
    NODE_ENV: production
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Docker

```dockerfile
ENTRYPOINT ["sh", "-c", "npx envkit validate && node dist/server.js"]
```

---

## Two-file pattern

`defineEnv()` never throws — it only defines the schema. This lets the CLI import your config file to read metadata without crashing the app.

```typescript
// envkit.config.ts — safe to import anywhere, never throws
export default defineEnv({ ... })

// env.ts — throws at startup if validation fails
import config from './envkit.config'
export const { serverEnv, publicEnv } = config.load()

// src/server.ts — always import serverEnv from env.ts, never envkit.config directly
import { serverEnv } from './env'
app.listen(serverEnv.PORT)
```

---

## Development

This is a pnpm monorepo with Turborepo.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Build + watch (for development)
pnpm dev
```

### Repository structure

```
envkit/
├── packages/
│   ├── core/    # envkit-core — runtime library
│   └── cli/     # envkit      — CLI tool
├── examples/
│   └── basic/   # minimal example project
├── turbo.json
└── pnpm-workspace.yaml
```

---

## License

MIT
