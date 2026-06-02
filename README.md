# envkit

Typed, schema-driven environment variable management for Node.js and TypeScript.

Define your env schema once in `envkit.config.ts`. Get typed access, validation, CLI setup wizard, and generated `.env.example` — all from a single source of truth.

```
npx envkit setup    # interactive wizard to fill your .env
npx envkit validate # validate .env against your schema (CI-safe)
npx envkit generate # generate .env.example from schema
npx envkit diff     # show missing, extra, and invalid vars
```

---

## Packages

| Package | Description |
|---|---|
| [`@envkit/core`](./packages/core) | Runtime library — `defineEnv()`, typed validation, source loaders |
| [`envkit`](./packages/cli) | CLI tool — setup wizard, validate, generate, diff |

---

## Quick start

### 1. Install

```bash
npm install @envkit/core
npm install --save-dev envkit
```

### 2. Define your schema — `envkit.config.ts`

```typescript
import { defineEnv } from '@envkit/core'

export default defineEnv({
  source: { type: 'combined', path: '.env' },  // file + process.env override
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
export const env = config.load()
//           ^^^
//           Fully inferred type — no annotation needed:
//           {
//             NODE_ENV:     'development' | 'staging' | 'production'
//             PORT:         number
//             DATABASE_URL: string
//             JWT_SECRET:   string
//           }
```

### 4. Use it

```typescript
import { env } from './env'

app.listen(env.PORT)
console.log(`Running in ${env.NODE_ENV}`)
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

## Source types

```typescript
// Load from a .env file only
source: { type: 'file', path: '.env' }

// Use process.env only — no file (ideal for containers/prod)
source: { type: 'process' }

// File + process.env override (recommended — file for local dev, env vars for prod)
source: { type: 'combined', path: '.env' }
```

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
env.NONEXISTENT  // Error: Property 'NONEXISTENT' does not exist
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

```bash
npx envkit diff

  Missing (required):
    ✗  JWT_SECRET

  Extra (not in schema):
    ⚠  OLD_API_KEY
    ⚠  LEGACY_DB_HOST

  Invalid:
    ✗  PORT    expected number, got "not-a-port"
```

---

## Recommended project setup

```
my-app/
├── envkit.config.ts   ← schema definition (committed)
├── .env               ← actual values    (gitignored)
├── .env.example       ← generated        (committed)
├── env.ts             ← calls config.load(), throws on invalid
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
export const env = config.load()

// src/server.ts — always import env from env.ts
import { env } from './env'
app.listen(env.PORT)
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
│   ├── core/    # @envkit/core — runtime library
│   └── cli/     # envkit      — CLI tool
├── examples/
│   └── basic/   # minimal example project
├── turbo.json
└── pnpm-workspace.yaml
```

---

## License

MIT
