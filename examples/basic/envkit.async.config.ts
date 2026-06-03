/**
 * Example: Async source
 *
 * Demonstrates a source whose load() returns Promise<Record<string, string>>.
 * TypeScript automatically infers that config.load() returns a Promise,
 * so callers must await it — the type system enforces this.
 *
 * Typical real-world async sources:
 *   - AWS Secrets Manager  (network call)
 *   - HashiCorp Vault       (network call)
 *   - GCP Secret Manager   (network call)
 *   - Encrypted local file (async crypto)
 *
 * This example uses fs.promises to read env.json asynchronously —
 * same pattern, no external services needed.
 */

import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { defineEnv } from 'envkit-core'
import type { EnvSource } from 'envkit-core'

// ── Custom async source ───────────────────────────────────────────────────────

function asyncJsonSource(options: { path?: string } = {}): EnvSource {
  const filePath = options.path ?? 'env.json'

  return {
    // load() returns Promise — this is what makes config.load() async
    async load(cwd = process.cwd()): Promise<Record<string, string>> {
      const abs = resolve(cwd, filePath)

      let raw: Record<string, { value: string | null }> = {}
      try {
        const content = await readFile(abs, 'utf-8')
        raw = JSON.parse(content).vars ?? {}
      } catch {
        // File doesn't exist yet — return empty (setup wizard will create it)
        return {}
      }

      const out: Record<string, string> = {}
      for (const [key, entry] of Object.entries(raw)) {
        if (entry.value !== null && entry.value !== undefined) {
          out[key] = String(entry.value)
        }
      }
      return out
    },
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export default defineEnv({
  source: asyncJsonSource({ path: 'env.json' }),

  envGroups: [
    { slug: 'server',   name: 'Server',        description: 'HTTP server settings' },
    { slug: 'database', name: 'Database',       description: 'Database connection' },
    { slug: 'auth',     name: 'Authentication', description: 'Auth secrets' },
  ],

  envSchema: {
    NODE_ENV: {
      type: ['development', 'staging', 'production'] as const,
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
      type: 'url',
      description: 'PostgreSQL connection string',
      howToGet: 'Get from your DB provider or run: docker compose up db',
      group: 'database',
      required: true,
      example: 'postgresql://user:pass@localhost:5432/myapp',
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

  computed: {
    IS_PRODUCTION: {
      description: 'True when running in production mode',
      compute: ({ env }) => env.NODE_ENV === 'production',
    },
  },
})
