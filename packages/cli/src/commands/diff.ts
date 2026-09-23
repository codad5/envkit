import { parseEnvFile, validateEnv, isWritableSource } from 'envkit-core'
import { resolve } from 'node:path'
import type { LoadedConfig } from '../config-loader'
import type { EnvFieldDef } from 'envkit-core'
import { fmt } from '../utils/format'

export interface DiffJsonResult {
  clean: boolean
  missing: string[]
  extra: string[]
  invalid: { key: string; message: string }[]
}

export interface RunDiffOptions {
  /** Print a single JSON object instead of human-readable output. */
  json?: boolean
}

/** Returns false when Missing or Invalid entries are found, so callers can exit non-zero. */
export async function runDiff(loaded: LoadedConfig, opts: RunDiffOptions = {}): Promise<boolean> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const source = instance.source

  // For "extra" detection, always read only from the .env file.
  // Using process.env would flood output with system variables.
  const fileRaw: Record<string, string> = isWritableSource(source)
    ? parseEnvFile(resolve(process.cwd(), source.filePath))
    : {}

  // For missing/invalid checks use the full source (file + process.env overrides)
  // so that vars injected via the environment (CI, containers) are respected.
  const fullRaw = await Promise.resolve(source.load())

  const schemaKeys = new Set(Object.keys(schema))
  const fileKeys = new Set(Object.keys(fileRaw))

  // Missing: required vars absent from both the file AND the full source
  const missing: string[] = []
  for (const [key, field] of Object.entries(schema)) {
    const f = field as any
    if (f.required && fullRaw[key] === undefined && f.default === undefined) {
      missing.push(key)
    }
  }

  // Extra: keys in the .env file that are not declared in the schema
  const extra: string[] = []
  for (const key of fileKeys) {
    if (!schemaKeys.has(key)) extra.push(key)
  }

  // Invalid: schema keys whose value (from full source) fails validation
  const validationResult = validateEnv(schema, fullRaw)
  const invalid = validationResult.errors.filter(
    (e) => fullRaw[e.key] !== undefined,
  )

  // Extra (undeclared) keys are a warning, not a failure — Missing/Invalid
  // alone gate both the exit code and the JSON `clean` field.
  const clean = missing.length === 0 && invalid.length === 0

  if (opts.json) {
    const output: DiffJsonResult = { clean, missing, extra, invalid }
    console.log(JSON.stringify(output, null, 2))
    return clean
  }

  console.log()

  if (missing.length === 0 && extra.length === 0 && invalid.length === 0) {
    console.log(fmt.success('No diff â€” .env matches schema perfectly.'))
    console.log()
    return clean
  }

  if (missing.length > 0) {
    console.log(fmt.bold('  Missing (required):'))
    for (const key of missing) {
      console.log(`    ${fmt.error(key)}`)
    }
    console.log()
  }

  if (extra.length > 0) {
    console.log(fmt.bold('  Extra (not in schema):'))
    for (const key of extra) {
      console.log(`    ${fmt.warn(key)}`)
    }
    console.log()
  }

  if (invalid.length > 0) {
    console.log(fmt.bold('  Invalid:'))
    for (const e of invalid) {
      console.log(`    ${fmt.error(e.key.padEnd(20))} ${e.message}`)
    }
    console.log()
  }

  return clean
}
