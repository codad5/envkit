import { loadRawEnv, validateEnv } from '@envkit/core'
import type { LoadedConfig } from '../config-loader.js'
import type { EnvFieldDef } from '@envkit/core'
import { fmt } from '../utils/format.js'

export async function runDiff(loaded: LoadedConfig): Promise<void> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const raw = loadRawEnv(instance.source)

  const schemaKeys = new Set(Object.keys(schema))
  const fileKeys = new Set(Object.keys(raw))

  // Missing required vars
  const missing: string[] = []
  for (const [key, field] of Object.entries(schema)) {
    if ((field as any).required && !fileKeys.has(key) && (field as any).default === undefined) {
      missing.push(key)
    }
  }

  // Extra vars in file but not in schema
  const extra: string[] = []
  for (const key of fileKeys) {
    if (!schemaKeys.has(key)) extra.push(key)
  }

  // Invalid vars
  const validationResult = validateEnv(schema, raw)
  const invalid = validationResult.errors.filter((e) => fileKeys.has(e.key))

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
