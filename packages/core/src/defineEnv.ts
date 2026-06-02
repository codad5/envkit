import type {
  EnvGroupDef,
  EnvFieldDef,
  EnvKitConfig,
  EnvKitInstance,
  InferEnvSchema,
  SourceConfig,
} from './types.js'
import { loadRawEnv } from './loader.js'
import { validateEnv } from './validator.js'
import { createEnvProxy } from './proxy.js'

const DEFAULT_SOURCE: SourceConfig = { type: 'file', path: '.env' }

export function defineEnv<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
>(config: EnvKitConfig<G, S>): EnvKitInstance<G, S> {
  const source = config.source ?? DEFAULT_SOURCE
  const groups = (config.envGroups ?? []) as G
  const schema = config.envSchema

  return {
    schema,
    groups,
    source,

    load(): InferEnvSchema<S> {
      const raw = loadRawEnv(source)
      const result = validateEnv(
        schema as Record<string, EnvFieldDef<string>>,
        raw,
      )

      if (!result.success) {
        const lines = result.errors.map((e) => `  ${e.key}: ${e.message}`)
        throw new Error(
          `[envkit] Environment validation failed:\n${lines.join('\n')}\n\n` +
          `Run "npx envkit setup" to configure missing variables.`
        )
      }

      return createEnvProxy(result.data as InferEnvSchema<S>)
    },
  }
}
