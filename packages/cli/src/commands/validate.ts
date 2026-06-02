import { loadRawEnv, validateEnv } from '@envkit/core'
import type { LoadedConfig } from '../config-loader.js'
import { fmt, truncate } from '../utils/format.js'

export async function runValidate(loaded: LoadedConfig): Promise<boolean> {
  const { instance, configPath } = loaded

  console.log()
  console.log(fmt.dim(`  Validating .env against ${configPath}...`))
  console.log()

  const raw = loadRawEnv(instance.source)
  const result = validateEnv(
    instance.schema as Record<string, any>,
    raw,
  )

  for (const [key, field] of Object.entries(instance.schema)) {
    const rawValue = raw[key]
    const err = result.errors.find((e) => e.key === key)

    if (err) {
      console.log(`  ${fmt.error(key.padEnd(20))} ${err.message}`)
    } else {
      const displayValue = (field as any).secret
        ? fmt.secret()
        : rawValue !== undefined
        ? truncate(rawValue)
        : fmt.dim('(default)')
      console.log(`  ${fmt.success(key.padEnd(20))} ${displayValue}`)
    }
  }

  console.log()

  if (!result.success) {
    const count = result.errors.length
    console.log(fmt.error(`${count} error${count > 1 ? 's' : ''} found. Run \`envkit setup\` to fix.`))
    console.log()
    return false
  }

  console.log(fmt.success('All environment variables are valid.'))
  console.log()
  return true
}
