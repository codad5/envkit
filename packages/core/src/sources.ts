import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { WritePayload } from './env-format'
import { formatEnvFile } from './env-format'

// â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Minimum contract every source must fulfil: load raw keyâ†’value pairs. */
export interface EnvSource {
  load(cwd?: string): Record<string, string> | Promise<Record<string, string>>
}

/**
 * A source that can also persist values back to its backing store.
 * Implement this when the source has a writable destination (e.g. a .env file).
 * Read-only sources (e.g. processSource) intentionally omit this.
 */
export interface WritableEnvSource extends EnvSource {
  /**
   * Persist a set of collected env values with their full field metadata.
   * The payload includes schema info (description, howToGet, secret, etc.)
   * and group ordering so the source can produce a rich, formatted output.
   */
  write(payload: WritePayload, cwd?: string): void | Promise<void>
  /** cwd-relative path that will be written â€” used by CLI for display. */
  readonly filePath: string
}

/** Type guard â€” narrows an EnvSource to WritableEnvSource at runtime. */
export function isWritableSource(source: EnvSource): source is WritableEnvSource {
  return typeof (source as WritableEnvSource).write === 'function'
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Parse a .env file into a keyâ†’value map. */
export function parseEnvFile(filePath: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!existsSync(filePath)) return map

  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue }
    if (!line.includes('=')) { i++; continue }

    const eqIdx = line.indexOf('=')
    const key = line.slice(0, eqIdx).trim()
    let val = line.slice(eqIdx + 1)

    if (val.startsWith('"') && !val.slice(1).includes('"')) {
      const parts = [val]
      i++
      while (i < lines.length) {
        parts.push(lines[i]!)
        if (lines[i]!.endsWith('"')) break
        i++
      }
      val = parts.join('\n')
    }

    val = val.trim()
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }

    if (key) map[key] = val
    i++
  }

  return map
}

/** Derive the example output path from a source file path.
 *  .env → .env.example  |  env.json → env.example.json */
export function toExamplePath(p: string): string {
  const name = p.split(/[/\\]/).pop() ?? p
  if (name.startsWith('.')) return p + '.example'
  const dot = p.lastIndexOf('.')
  return dot === -1 ? p + '.example' : p.slice(0, dot) + '.example' + p.slice(dot)
}

function filterStringValues(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

// â”€â”€ Built-in sources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Reads from a .env file only. Does not merge process.env.
 * Supports write â€” produces a fully formatted .env with comments and group headers.
 */
export function fileSource(options: { path?: string } = {}): WritableEnvSource {
  const filePath = options.path ?? '.env'
  return {
    filePath,
    load(cwd = process.cwd()) {
      return parseEnvFile(resolve(cwd, filePath))
    },
    write(payload, cwd = process.cwd()) {
      const target = payload.outputPath ?? (payload.mode === 'generate' ? toExamplePath(filePath) : filePath)
      writeFileSync(resolve(cwd, target), formatEnvFile(payload), 'utf-8')
    },
  }
}

/**
 * Reads from process.env only. Suitable for containers and production.
 * Read-only â€” does not implement write.
 */
export function processSource(): EnvSource {
  return {
    load() {
      return filterStringValues(process.env)
    },
  }
}

/**
 * Reads from a .env file with process.env values taking precedence.
 * This is the recommended default for local development.
 * Supports write â€” produces a fully formatted .env with comments and group headers.
 *
 * Alias: LocalEnvSource
 */
export function combinedSource(options: { path?: string } = {}): WritableEnvSource {
  const filePath = options.path ?? '.env'
  return {
    filePath,
    load(cwd = process.cwd()) {
      const fileVars = parseEnvFile(resolve(cwd, filePath))
      return { ...fileVars, ...filterStringValues(process.env) }
    },
    write(payload, cwd = process.cwd()) {
      const target = payload.outputPath ?? (payload.mode === 'generate' ? toExamplePath(filePath) : filePath)
      writeFileSync(resolve(cwd, target), formatEnvFile(payload), 'utf-8')
    },
  }
}

/**
 * Alias for combinedSource â€” reads .env file + process.env override.
 * The idiomatic choice for local development setups.
 */
export const LocalEnvSource = combinedSource
