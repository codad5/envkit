import { parseEnvFile, loadRawEnv, validateEnv } from '@envkit/core'
import { resolve } from 'node:path'
import type { LoadedConfig } from '../config-loader.js'
import type { EnvFieldDef } from '@envkit/core'
import { fmt } from '../utils/format.js'

export async function runDiff(loaded: LoadedConfig): Promise<void> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const source = instance.source

  // For "extra" detection, always read only from the .env file.
  // Using process.env would flood output with system variables.
  const fileRaw: Record<string, string> =
    source.type !== 'process'
      ? parseEnvFile(resolve(process.cwd(), source.path ?? '.env'))
      : {}

  // For missing/invalid checks use the full source (file + process.env overrides)
  // so that vars injected via the environment (CI, containers) are respected.
  const fullRaw = loadRawEnv(source)

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

  console.log()

  if (missing.length === 0 && extra.length === 0 && invalid.length === 0) {
    console.log(fmt.success('No diff — .env matches schema perfectly.'))
    console.log()
    return
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
}
