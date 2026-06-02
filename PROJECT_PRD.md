# envkit — Typed Environment Variable Management Library

## Overview

`envkit` is a TypeScript-first library for managing environment variables with a config-file-driven approach (inspired by `vite.config.ts`, `tailwind.config.ts`). It provides:

1. **A runtime library** — typed, validated access to env vars via a user-defined schema
2. **A CLI tool** — interactive `.env` setup wizard, validation, and doc generation

### Differentiation from existing tools

| Tool | Typed | Schema file | CLI setup wizard | Grouping/docs |
|------|-------|-------------|------------------|---------------|
| t3-env | ✅ (Zod inline) | ❌ (inline config) | ❌ | ❌ |
| envalid | ✅ | ❌ | ❌ | ❌ |
| dotenv-safe | ❌ | ❌ | ❌ | ❌ |
| **envkit** | ✅ | ✅ dedicated file | ✅ | ✅ |

The CLI setup wizard is the primary differentiator — no existing library walks a developer through setting up a `.env` interactively using the schema as a guide.

---

## Repository Structure

Use a **pnpm monorepo** with Turborepo for task orchestration.

```
envkit/
├── packages/
│   ├── core/                  # @envkit/core — runtime library
│   │   ├── src/
│   │   │   ├── index.ts       # Public API exports
│   │   │   ├── defineEnv.ts   # defineEnv() factory
│   │   │   ├── loader.ts      # Source loading (.env, process.env, etc.)
│   │   │   ├── validator.ts   # Schema validation logic
│   │   │   ├── proxy.ts       # Proxy-based typed env access
│   │   │   └── types.ts       # All TypeScript types/interfaces
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── cli/                   # envkit — CLI binary (npx envkit)
│   │   ├── src/
│   │   │   ├── index.ts       # CLI entry point (commander)
│   │   │   ├── commands/
│   │   │   │   ├── setup.ts   # Interactive .env setup wizard
│   │   │   │   ├── validate.ts # Validate current .env vs schema
│   │   │   │   ├── generate.ts # Generate .env.example
│   │   │   │   └── diff.ts    # Show missing/extra vars
│   │   │   ├── config-loader.ts  # Load & execute envkit.config.ts
│   │   │   └── utils/
│   │   │       ├── prompts.ts # Prompt builders using @inquirer/prompts
│   │   │       └── format.ts  # Terminal output formatting
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── adapters/              # Future: framework-specific adapters
│       ├── next/              # @envkit/next
│       └── vite/              # @envkit/vite
├── examples/
│   ├── basic/                 # Minimal Node.js example
│   └── express/               # Express app example
├── package.json               # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Build | `tsup` | Zero-config, ESM+CJS dual output |
| Validation | `zod` | Industry standard, excellent TS inference |
| CLI framework | `commander` | Mature, widely used |
| CLI prompts | `@inquirer/prompts` | Modern, composable, better than inquirer v8 |
| .env parsing | `dotenv` | Standard |
| Terminal output | `chalk` + `ora` | Widely known |
| Monorepo | `pnpm` + `turborepo` | Fast installs, efficient task caching |
| Testing | `vitest` | Fast, ESM-native |

---

## Core Library (`@envkit/core`)

### Config file: `envkit.config.ts`

The user creates this file at the root of their project:

```typescript
import { defineEnv } from '@envkit/core'

export default defineEnv({
  source: {
    type: 'file',          // 'file' | 'process' | 'combined'
    path: '.env',          // path to .env file (default: '.env')
  },
  envGroups: [
    { slug: 'server',   name: 'Server Configuration' },
    { slug: 'database', name: 'Database' },
    { slug: 'auth',     name: 'Authentication' },
  ],
  envSchema: {
    NODE_ENV: {
      type: ['development', 'staging', 'production'],  // inline enum — infers literal union
      default: 'development',
      description: 'Application runtime environment',
      group: 'server',
      required: true,
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: 'HTTP server port',
      group: 'server',
      required: false,
    },
    DATABASE_URL: {
      type: 'string',
      description: 'PostgreSQL connection string',
      group: 'database',
      required: true,
      multiline: false,
      example: 'postgresql://user:pass@localhost:5432/mydb',
    },
    JWT_SECRET: {
      type: 'string',
      description: 'Secret key for signing JWT tokens',
      group: 'auth',
      required: true,
      secret: true,          // Masked in CLI output, never logged
      minLength: 32,
    },
    ENABLE_FEATURE_X: {
      type: 'boolean',
      default: false,
      description: 'Feature flag for experimental feature X',
      group: 'server',
      required: false,
    },
  },
})
```

### Source types

```typescript
// Single .env file (default)
source: { type: 'file', path: '.env' }

// Only process.env (no file loading, useful in prod/containers)
source: { type: 'process' }

// Load file but allow process.env to override (recommended for prod parity)
source: { type: 'combined', path: '.env' }
```

### Variable field reference

Every field is either a **plain field** (uses `type`) or a **Zod field** (uses `schema`). These are mutually exclusive — you cannot use both on the same variable.

#### Plain fields (no Zod)

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `'string' \| 'number' \| 'boolean' \| 'enum' \| 'url' \| 'json'` | ✅ | Value type |
| `values` | `string[]` | When `type: 'enum'` | Allowed enum values — TS infers a literal union |
| `default` | matches `type` | ❌ | Default if not set — TS error if type doesn't match |
| `description` | `string` | ✅ | Human-readable (used in CLI wizard and docs) |
| `group` | `GroupSlug` | ❌ | Must be a slug from `envGroups` — TS error if slug doesn't exist |
| `required` | `boolean` | ✅ | Whether absence is an error |
| `multiline` | `boolean` | ❌ | Allow `\n` in value |
| `secret` | `boolean` | ❌ | Mask in CLI output, omit value in `.env.example` |
| `example` | `string` | ❌ | Example shown in wizard and `.env.example` |
| `minLength` / `maxLength` | `number` | ❌ | String length constraints (only valid on `type: 'string'`) |
| `min` / `max` | `number` | ❌ | Numeric range (only valid on `type: 'number'`) |
| `pattern` | `RegExp \| string` | ❌ | Regex validation (only valid on `type: 'string' \| 'url'`) |

#### Zod fields (optional Zod integration)

| Field | Type | Required | Description |
|---|---|---|---|
| `schema` | `ZodLike` | ✅ (replaces everything) | Any Zod schema — type, required, default, and all constraints live here |
| `description` | `string` | ✅ | Human-readable (Zod has no concept of this) |
| `group` | `GroupSlug` | ❌ | Group slug (Zod has no concept of this) |
| `secret` | `boolean` | ❌ | Mask in output (Zod has no concept of this) |
| `example` | `string` | ❌ | Example value for CLI wizard and `.env.example` |

When `schema` is provided, **every other field is forbidden** — TS error if you add `type`, `required`, `default`, `min`, `max`, `minLength`, `maxLength`, or `pattern`. The Zod schema is the single source of truth for all of that:

```typescript
// Plain field equivalents → Zod equivalents
{ type: 'string', required: true  }              →  { schema: z.string() }
{ type: 'string', required: false }              →  { schema: z.string().optional() }
{ type: 'string', default: 'hello' }             →  { schema: z.string().default('hello') }
{ type: 'string', minLength: 5, maxLength: 100 } →  { schema: z.string().min(5).max(100) }
{ type: 'string', pattern: /^[a-z]+$/ }         →  { schema: z.string().regex(/^[a-z]+$/) }
{ type: 'number', min: 0, max: 100 }             →  { schema: z.number().min(0).max(100) }
{ type: ['development', 'production'] }          →  { schema: z.enum(['development', 'production']) }
{ type: 'json' }                                 →  { schema: z.object({ darkMode: z.boolean() }) }

// Zod also unlocks things plain fields cannot express:
{ schema: z.string().email() }
{ schema: z.string().url() }
{ schema: z.string().uuid() }
{ schema: z.number().int().positive() }
{ schema: z.string().trim().toLowerCase() }      // transforms — applied before storing
{ schema: z.string().refine(val => val !== 'admin', 'Cannot use "admin"') }
```

### Two-file pattern (required)

`defineEnv()` never throws — it only defines the schema. The CLI imports the config file to read schema metadata without crashing. Validation that crashes the app lives in a separate `env.ts` file.

```typescript
// envkit.config.ts — schema definition ONLY, never throws
// CLI imports this file for generate/validate/diff/setup
import { defineEnv } from '@envkit/core'

export default defineEnv({
  source: { type: 'file', path: '.env' },
  envGroups: [
    { slug: 'server',   name: 'Server Configuration' },
    { slug: 'database', name: 'Database' },
  ],
  envSchema: {
    PORT:         { type: 'number',       default: 3000,         description: 'HTTP port',    group: 'server',   required: false },
    NODE_ENV:     { type: ['development', 'staging', 'production'], default: 'development',   description: 'Runtime env', group: 'server', required: true },
    DATABASE_URL: { type: 'string',       description: 'Postgres URL', group: 'database', required: true },
  },
})
```

```typescript
// env.ts — validation happens HERE, crashes app at startup if invalid
// CLI never imports this file
import config from './envkit.config'

export const env = config.load()
//           ^^^
//           Type is fully inferred — no annotation needed:
//           {
//             PORT:         number
//             NODE_ENV:     'development' | 'staging' | 'production'
//             DATABASE_URL: string
//           }
```

```typescript
// src/server.ts — always import from env.ts, never from envkit.config.ts
import { env } from './env'

app.listen(env.PORT)          // number
console.log(env.NODE_ENV)     // 'development' | 'staging' | 'production'
console.log(env.DATABASE_URL) // string
```

`config.load()` validates all variables at module load time. If any required variable is missing or the wrong type, it throws immediately before the app handles any request — fail fast, never silently.

---

### Type inference

The return type of `config.load()` is fully inferred from the schema with no manual annotation. Here are the inference rules:

```typescript
// Plain type rules:
{ type: 'number',  required: true  }              → number
{ type: 'string',  required: false }              → string | undefined
{ type: 'string',  required: false, default: 'x'} → string   // default eliminates undefined
{ type: 'boolean', default: false  }              → boolean  // default eliminates undefined
{ type: ['a', 'b', 'c'], required: true }         → 'a' | 'b' | 'c'  // literal union
{ type: 'json',    required: true  }              → Record<string, unknown>

// Zod schema rules:
{ schema: z.string().email()                }     → string
{ schema: z.enum(['admin', 'user'])         }     → 'admin' | 'user'
{ schema: z.object({ darkMode: z.boolean()})}     → { darkMode: boolean }
{ schema: z.number().int().positive()       }     → number

// required + default interaction:
// has default          → T            (never undefined, regardless of required)
// required: true       → T            (never undefined)
// required: false only → T | undefined
```

#### Full generic signatures (for implementors)

```typescript
// types.ts

type PrimitiveType = 'string' | 'number' | 'boolean' | 'url' | 'json'
type EnumType<V extends string[]> = V  // tuple of string literals

type PrimitiveTypeMap = {
  string:  string
  number:  number
  boolean: boolean
  url:     string
  json:    Record<string, unknown>
}

// Discriminated union: plain field vs. zod field
type PlainEnvFieldDef<GroupSlug extends string> = {
  type: PrimitiveType | string[]            // string[] = inline enum
  schema?: never                            // forbidden when type is set
  values?: never                            // values replaced by inline enum array
  default?: unknown
  description: string
  group?: GroupSlug
  required: boolean
  multiline?: boolean
  secret?: boolean
  example?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp | string
}

type ZodEnvFieldDef<GroupSlug extends string> = {
  schema: ZodLike                           // any Zod schema (duck-typed, no ZodType import needed)
  type?: never                              // forbidden — TS error if set
  required?: never                          // forbidden — use z.string().optional() instead
  default?: never                           // forbidden — use z.string().default('x') instead
  min?: never                               // forbidden — use z.number().min(x) instead
  max?: never                               // forbidden — use z.number().max(x) instead
  minLength?: never                         // forbidden — use z.string().min(x) instead
  maxLength?: never                         // forbidden — use z.string().max(x) instead
  pattern?: never                           // forbidden — use z.string().regex(x) instead
  description: string                       // envkit-only, Zod has no concept of this
  group?: GroupSlug                         // envkit-only, Zod has no concept of this
  secret?: boolean                          // envkit-only, Zod has no concept of this
  example?: string                          // envkit-only, Zod has no concept of this
}

// Duck-typed to avoid importing ZodType (so zod stays a peer dep)
type ZodLike = { parse: (value: unknown) => unknown }

type EnvFieldDef<GroupSlug extends string = string> =
  | PlainEnvFieldDef<GroupSlug>
  | ZodEnvFieldDef<GroupSlug>

// --- Inference helpers ---

// Infer raw value type (before required/default logic)
type InferRawType<F extends EnvFieldDef<any>> =
  F extends { schema: ZodType }
    ? z.infer<F['schema']>
    : F extends { type: (infer V extends string)[] }
    ? V                                     // inline enum → literal union
    : F extends { type: keyof PrimitiveTypeMap }
    ? PrimitiveTypeMap[F['type']]
    : never

// Apply required/default logic
type InferFieldType<F extends EnvFieldDef<any>> =
  F extends { default: NonNullable<unknown> }
    ? InferRawType<F>                       // has default → always defined
    : F extends { required: true }
    ? InferRawType<F>                       // required → always defined
    : InferRawType<F> | undefined           // optional, no default

// Infer the full env object type from a schema map
type InferEnvSchema<S extends Record<string, EnvFieldDef<any>>> = {
  readonly [K in keyof S]: InferFieldType<S[K]>
}

// --- defineEnv signature ---

type EnvGroupDef = { slug: string; name: string; description?: string }

type EnvKitConfig<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>
  //                                   ^^^^^^^^^^^^^^^^^^
  //                        group field constrained to valid slugs only
> = {
  source?: SourceConfig
  envGroups?: G
  envSchema: S
}

type EnvKitInstance<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>
> = {
  readonly schema: S
  readonly groups: G
  readonly source: SourceConfig
  load(): InferEnvSchema<S>      // validates + returns typed env, throws on error
}

declare function defineEnv<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>
>(config: EnvKitConfig<G, S>): EnvKitInstance<G, S>
```

---

### Type Safety Guarantees

All of the following are caught at **compile time** — no runtime needed:

```typescript
// 1. Invalid group slug → TS error
envGroups: [{ slug: 'server', name: 'Server' }],
envSchema: {
  PORT: { type: 'number', group: 'database', required: true }
  //                             ^^^^^^^^^^ Error: '"database"' not assignable to '"server"'
}

// 2. Enum default must be one of the enum values
NODE_ENV: { type: ['development', 'production'], default: 'staging', required: true }
//                                                        ^^^^^^^^^ Error: not in type union

// 3. type and schema are mutually exclusive
PORT: { type: 'number', schema: z.number(), required: true }
//                      ^^^^^^ Error: 'schema' not allowed when 'type' is set

// 4. Numeric constraints on string type → TS error
NAME: { type: 'string', min: 0, required: true }
//                      ^^^ Error: 'min' not allowed on type 'string'

// 5. default type must match the field type
PORT: { type: 'number', default: 'hello', required: false }
//                               ^^^^^^^ Error: type 'string' not assignable to 'number'

// 6. Accessing a variable that doesn't exist in schema → TS error
env.NONEXISTENT  // Error: Property 'NONEXISTENT' does not exist
```

---

## CLI Tool (`envkit`)

### Install / usage

```bash
# Run without installing
npx envkit setup
npx envkit validate
npx envkit generate
npx envkit diff

# Or install globally
npm i -g envkit
envkit setup
```

All commands accept `--config <path>` to point at a non-default config file.  
Default config resolution order: `envkit.config.ts` → `envkit.config.js` → `envkit.config.mjs`

---

### `envkit setup`

**The primary differentiator.** Interactive wizard that walks through every variable in the schema.

Behavior:
- Groups variables by `envGroups` (ungrouped last)
- For each variable: shows name, description, type, constraints, and example
- Prompts for value (appropriate input type per `type` field)
- For `secret: true` fields: masks input
- For `enum` type: shows a select list
- For `boolean`: yes/no prompt
- Detects an existing `.env` and offers to update only missing vars (non-destructive by default)
- Writes result to the configured source path

```
$ npx envkit setup

  envkit setup — configuring .env

  ── Server Configuration ──────────────────────────────
  NODE_ENV  Application runtime environment
  Allowed: development | staging | production
  ❯ development
    staging
    production

  PORT  HTTP server port
  Default: 3000
  Enter value (leave blank for default): 8080

  ── Database ──────────────────────────────────────────
  DATABASE_URL  PostgreSQL connection string
  Example: postgresql://user:pass@localhost:5432/mydb
  Enter value: postgresql://...

  ── Authentication ────────────────────────────────────
  JWT_SECRET  Secret key for signing JWT tokens  [secret]
  Minimum length: 32 characters
  Enter value: ****************************

  ✔  Written to .env (5 variables)
```

---

### `envkit validate`

Validates the current `.env` file against the schema. Exits with code 1 on failure (CI-safe).

```
$ npx envkit validate

  Validating .env against envkit.config.ts...

  ✔  NODE_ENV      development
  ✔  PORT          8080
  ✔  DATABASE_URL  postgresql://... (truncated)
  ✔  JWT_SECRET    [secret]
  ✗  REDIS_URL     required but not set

  1 error found. Run `envkit setup` to fix.
```

---

### `envkit generate`

Generates a `.env.example` file from the schema. Values are replaced with examples or empty strings. Secret fields get a placeholder comment.

```
$ npx envkit generate

  Generated .env.example (5 variables)
```

Output `.env.example`:
```dotenv
# Server Configuration
# Application runtime environment
NODE_ENV=development

# HTTP server port
PORT=3000

# Database
# PostgreSQL connection string
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Authentication
# Secret key for signing JWT tokens
JWT_SECRET=  # required, secret — do not commit real values
```

---

### `envkit diff`

Shows the delta between the current `.env` and the schema — what's missing, what's extra (vars in file but not in schema), and what's invalid.

```
$ npx envkit diff

  Missing (required):
    REDIS_URL

  Extra (not in schema):
    OLD_API_KEY
    LEGACY_DB_HOST

  Invalid:
    PORT  expected number, got "not-a-port"
```

---

## Implementation Phases

### Phase 1 — Core library MVP
- [ ] `defineEnv()` with full TypeScript type inference from schema
- [ ] Source loaders: `file`, `process`, `combined`
- [ ] Zod-based validation at load time
- [ ] Proxy-based typed access (`env.VAR_NAME`)
- [ ] `loadEnv()` eager validator for server startup
- [ ] Unit tests for type inference and validation

### Phase 2 — CLI MVP
- [ ] Config file loader (executes `envkit.config.ts` in-process via tsx/jiti)
- [ ] `envkit validate` command
- [ ] `envkit generate` command (`.env.example`)
- [ ] `envkit diff` command

### Phase 3 — Setup wizard
- [ ] `envkit setup` interactive wizard
- [ ] Group-based organization in prompts
- [ ] Non-destructive update (keep existing valid values)
- [ ] `secret` field masking

### Phase 4 — Polish & adapters
- [ ] `@envkit/next` adapter (handles `NEXT_PUBLIC_` prefix, server vs client split)
- [ ] `@envkit/vite` adapter (handles `VITE_` prefix)
- [ ] `envkit docs` command — generate markdown documentation from schema
- [ ] Watch mode: warn on `.env` changes at runtime

---

## Key Engineering Constraints

1. **Zero runtime overhead in production** — validation runs once at startup, thereafter env access is a plain object lookup via Proxy.

2. **Zod is optional, not required** — users can define schemas with plain objects and never touch Zod. Internally, envkit converts plain fields to Zod schemas for validation. Users who want advanced validation (custom refinements, transforms, nested objects) can opt in by providing a `schema: z.xxx()` field. `zod` is a peer dependency — installed only if the user wants it.

3. **ESM + CJS dual output** — tsup builds both. Config files are always ESM (`.ts`/`.mjs`).

4. **CLI config loading must handle TypeScript** — use `jiti` (or `tsx`) to execute `envkit.config.ts` without requiring the user to pre-compile it.

5. **Never log secret values** — fields with `secret: true` are masked in all CLI output and should emit a warning if found in logs.

6. **`envkit validate` must exit non-zero on failure** — enables use in CI pre-flight checks and Docker `ENTRYPOINT` scripts.

7. **Config file is the single source of truth** — `.env.example` and documentation are derived from it, never maintained manually.

---

## Package naming

| Package | npm name | Binary |
|---|---|---|
| Core library | `@envkit/core` | — |
| CLI | `envkit` | `envkit` |
| Next.js adapter | `@envkit/next` | — |
| Vite adapter | `@envkit/vite` | — |

> The `envkit` package on npm doubles as the CLI binary entry point.  
> Users who only need the runtime add `@envkit/core`; users who want the CLI run `npx envkit`.

---

## Example: Full project integration

```
my-app/
├── envkit.config.ts   ← defines schema
├── .env               ← actual values (gitignored)
├── .env.example       ← generated by `envkit generate` (committed)
└── src/
    └── server.ts
```

```typescript
// src/server.ts
import env from '../envkit.config'  // or loadEnv() for eager validation

const app = express()
app.listen(env.PORT, () => {
  console.log(`Running in ${env.NODE_ENV} on port ${env.PORT}`)
})
```

```json
{
  "scripts": {
    "dev":          "node src/server.js",
    "build":        "tsc",
    "start":        "node dist/server.js",

    "env:setup":    "envkit setup",
    "env:validate": "envkit validate",
    "env:generate": "envkit generate",
    "env:diff":     "envkit diff",

    "predev":       "envkit validate",
    "prebuild":     "envkit validate",
    "prestart":     "envkit validate"
  }
}
```

#### How the npm lifecycle scripts work

npm automatically runs `pre<script>` before `<script>`. So:

- `predev` runs `envkit validate` before every `npm run dev` — catches missing vars before the server starts
- `prebuild` runs `envkit validate` before every `npm run build` — prevents building with a broken env
- `prestart` runs `envkit validate` before every `npm start` — last line of defense in production

`envkit validate` exits with code 1 on failure, which stops the lifecycle chain — `dev`/`build`/`start` will not run if validation fails.

#### Recommended onboarding flow for a new developer

```bash
# 1. Clone the repo
git clone https://github.com/org/my-app

# 2. Install dependencies
npm install

# 3. Set up .env interactively (guided by the schema)
npm run env:setup

# 4. Confirm everything looks right
npm run env:validate

# 5. Start dev server (predev will validate again automatically)
npm run dev
```

#### CI/CD usage

Add a validation step before build in your pipeline:

```yaml
# GitHub Actions example
- name: Validate environment
  run: npx envkit validate --config envkit.config.ts
  env:
    NODE_ENV: production
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    PORT: 3000
```

#### Docker usage

In a `Dockerfile`, validate at container startup rather than build time (so secrets don't need to be present at build time):

```dockerfile
# In docker-compose or K8s, inject env vars at runtime
ENTRYPOINT ["sh", "-c", "npx envkit validate && node dist/server.js"]
```
