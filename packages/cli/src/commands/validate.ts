import { parseEnvFile, validateEnv, isWritableSource } from 'envkit-core'
import { resolve } from 'node:path'
import type { LoadedConfig } from '../config-loader'
import { fmt, truncate } from '../utils/format'

export async function runValidate(loaded: LoadedConfig): Promise<boolean> {
  const { instance, configPath } = loaded
  const source = instance.source

  console.log()
  console.log(fmt.dim(`  Validating .env against ${configPath}...`))
  console.log()

  const fullRaw = await Promise.resolve(source.load())

  // File-only values â€” used to annotate which values came from file vs process.env
  const fileRaw: Record<string, string> = isWritableSource(source)
    ? parseEnvFile(resolve(process.cwd(), source.filePath))
    : fullRaw

  const result = validateEnv(instance.schema as Record<string, any>, fullRaw)

  for (const [key, field] of Object.entries(instance.schema)) {
    const rawValue = fullRaw[key]
    const fromEnv = rawValue !== undefined && fileRaw[key] === undefined
    const err = result.errors.find((e) => e.key === key)

    if (err) {
      console.log(`  ${fmt.error(key.padEnd(20))} ${err.message}`)
    } else {
      const displayValue = (field as any).secret
        ? fmt.secret()
        : rawValue !== undefined
        ? truncate(rawValue) + (fromEnv ? fmt.dim(' (env)') : '')
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
