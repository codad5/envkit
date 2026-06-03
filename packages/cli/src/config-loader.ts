import { resolve } from 'path'
import { existsSync } from 'fs'
import type { EnvKitInstance, EnvGroupDef, EnvFieldDef } from 'envkit-core'

const CONFIG_CANDIDATES = [
  'envkit.config.ts',
  'envkit.config.js',
  'envkit.config.mjs',
]

export interface LoadedConfig {
  instance: EnvKitInstance<EnvGroupDef[], Record<string, EnvFieldDef<string>>>
  configPath: string
}

/** Resolve the config file path, searching from cwd */
export function resolveConfigPath(configArg?: string, cwd = process.cwd()): string {
  if (configArg) {
    const abs = resolve(cwd, configArg)
    if (!existsSync(abs)) throw new Error(`Config file not found: ${abs}`)
    return abs
  }

  for (const candidate of CONFIG_CANDIDATES) {
    const abs = resolve(cwd, candidate)
    if (existsSync(abs)) return abs
  }

  throw new Error(
    `No envkit config file found. Create one of: ${CONFIG_CANDIDATES.join(', ')}\n` +
    `See https://github.com/your-org/envkit for an example.`
  )
}

/** Load and execute the config file using jiti (handles TypeScript without pre-compiling) */
export async function loadConfig(configPath: string): Promise<LoadedConfig> {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url, { moduleCache: false })

  let mod: any
  try {
    mod = await jiti.import(configPath)
  } catch (err: any) {
    throw new Error(`Failed to load config file "${configPath}":\n${err.message}`)
  }

  const instance = mod?.default ?? mod
  if (!instance || typeof instance !== 'object' || typeof instance.load !== 'function') {
    throw new Error(
      `Config file "${configPath}" must export a default value from defineEnv(). ` +
      `Example:\n  import { defineEnv } from 'envkit-core'\n  export default defineEnv({ ... })`
    )
  }

  return { instance, configPath }
}
