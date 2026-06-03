import type {
  EnvGroupDef,
  EnvFieldDef,
  ComputedFieldDef,
  EnvKitInstance,
  InferEnvSchema,
  InferComputedSchema,
} from './types'
import type { EnvSource } from './sources'
import { fileSource } from './sources'
import { validateEnv } from './validator'
import { createEnvProxy } from './proxy'

const DEFAULT_SOURCE: EnvSource = fileSource()

export function defineEnv<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<InferEnvSchema<S>>> = Record<never, never>,
>(config: {
  source?: EnvSource
  envGroups?: G
  envSchema: S
  // Intersection: Record<string, ComputedFieldDef<InferEnvSchema<S>>> supplies the
  // contextual type for `env` in each callback; C is still inferred as the specific type.
  computed?: C & Record<string, ComputedFieldDef<InferEnvSchema<S>>>
}): EnvKitInstance<G, S, C> {
  const source = config.source ?? DEFAULT_SOURCE
  const groups = (config.envGroups ?? []) as G
  const schema = config.envSchema
  const computedDefs = (config.computed ?? {}) as C

  // Runtime guard â€” catches key conflicts for both JS users and at test time.
  const schemaKeys = new Set(Object.keys(schema))
  const conflicts = Object.keys(computedDefs).filter((k) => schemaKeys.has(k))
  if (conflicts.length > 0) {
    throw new Error(
      `[envkit] computed key${conflicts.length > 1 ? 's' : ''} conflict with envSchema: ` +
      `${conflicts.map((k) => `"${k}"`).join(', ')}. Use a different name.`
    )
  }

  return {
    schema,
    groups,
    source,
    computed: computedDefs,

    load(): InferEnvSchema<S> & InferComputedSchema<C> {
      const raw = source.load()

      // Handle both sync and async load â€” throw a clear error if someone passes an async source
      if (raw instanceof Promise) {
        throw new Error(
          '[envkit] This source returns a Promise. Use an async-compatible wrapper or await source.load() manually.'
        )
      }

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

      const parsedEnv = result.data as InferEnvSchema<S>

      const computedValues: Record<string, unknown> = {}
      for (const [key, def] of Object.entries(computedDefs)) {
        computedValues[key] = (def as ComputedFieldDef<InferEnvSchema<S>>).compute({ env: parsedEnv })
      }

      return createEnvProxy({
        ...parsedEnv,
        ...computedValues,
      } as InferEnvSchema<S> & InferComputedSchema<C>)
    },
  }
}
