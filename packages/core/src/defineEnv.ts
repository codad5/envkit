import type {
  EnvGroupDef,
  EnvFieldDef,
  ComputedFieldDef,
  EnvKitInstance,
  InferEnvSchema,
  InferComputedSchema,
  LoadedEnv,
  RejectSecretPublic,
} from './types'
import type { EnvSource } from './sources'
import { fileSource } from './sources'
import { validateEnv } from './validator'
import { createEnvProxy, createServerEnvProxy } from './proxy'

/**
 * Infers whether config.load() is sync or async based on the source.
 * If the source's load() returns a Promise, config.load() returns Promise<Env>.
 * If it returns a plain object, config.load() returns Env directly.
 */
type InferLoad<Src extends EnvSource, Env> =
  ReturnType<Src['load']> extends Promise<any> ? Promise<Env> : Env

const DEFAULT_SOURCE = fileSource()

/** Validate raw values, run computed fields, return `{ serverEnv, publicEnv }`. */
function resolveEnv<S extends Record<string, EnvFieldDef<string>>, C>(
  schema: S,
  computedDefs: C,
  raw: Record<string, string>,
): LoadedEnv<S, C extends Record<string, ComputedFieldDef<any>> ? C : Record<never, never>> {
  const result = validateEnv(schema, raw)

  if (!result.success) {
    const lines = result.errors.map((e) => `  ${e.key}: ${e.message}`)
    throw new Error(
      `[envkit] Environment validation failed:\n${lines.join('\n')}\n\n` +
      `Run "npx envkit setup" to configure missing variables.`
    )
  }

  const parsedEnv = result.data as InferEnvSchema<S>
  const computedValues: Record<string, unknown> = {}

  for (const [key, def] of Object.entries(computedDefs as Record<string, ComputedFieldDef<InferEnvSchema<S>>>)) {
    computedValues[key] = def.compute({ env: parsedEnv })
  }

  const publicData: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(schema)) {
    if ((field as { visibility?: string }).visibility === 'public') {
      publicData[key] = (parsedEnv as Record<string, unknown>)[key]
    }
  }

  return {
    serverEnv: createServerEnvProxy({ ...parsedEnv, ...computedValues }),
    publicEnv: createEnvProxy(publicData),
  } as any
}

export function defineEnv<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<InferEnvSchema<S>>> = Record<never, never>,
  Src extends EnvSource = typeof DEFAULT_SOURCE,
>(config: {
  source?: Src
  envGroups?: G
  // Mapped over S's own keys so inference of S is unaffected, but any field
  // combining `secret: true` and `visibility: 'public'` fails to typecheck.
  envSchema: { [K in keyof S]: RejectSecretPublic<S[K]> }
  // Intersection supplies contextual type for `env` in callbacks; C captures specific return types.
  computed?: C & Record<string, ComputedFieldDef<InferEnvSchema<S>>>
}): Omit<EnvKitInstance<G, S, C>, 'load' | 'source'> & {
  readonly source: Src
  load(): InferLoad<Src, LoadedEnv<S, C>>
} {
  const source = (config.source ?? DEFAULT_SOURCE) as Src
  const groups = (config.envGroups ?? []) as G
  const schema = config.envSchema as unknown as S
  const computedDefs = (config.computed ?? {}) as C

  // Runtime guard — catches key conflicts for both JS users and at test time.
  const schemaKeys = new Set(Object.keys(schema))
  const conflicts = Object.keys(computedDefs).filter((k) => schemaKeys.has(k))
  if (conflicts.length > 0) {
    throw new Error(
      `[envkit] computed key${conflicts.length > 1 ? 's' : ''} conflict with envSchema: ` +
      `${conflicts.map((k) => `"${k}"`).join(', ')}. Use a different name.`
    )
  }

  // Runtime guard — the compile-time RejectSecretPublic check above only helps TS users.
  const secretAndPublic = Object.entries(schema)
    .filter(([, field]) => (field as any).secret === true && (field as any).visibility === 'public')
    .map(([key]) => key)
  if (secretAndPublic.length > 0) {
    throw new Error(
      `[envkit] field${secretAndPublic.length > 1 ? 's' : ''} cannot be both secret and public: ` +
      `${secretAndPublic.map((k) => `"${k}"`).join(', ')}.`
    )
  }

  return {
    schema,
    groups,
    source,
    computed: computedDefs,

    load() {
      const raw = source.load()

      // Async source — return a Promise and let the caller await
      if (raw instanceof Promise) {
        return raw.then((resolved) =>
          resolveEnv(schema as Record<string, EnvFieldDef<string>>, computedDefs, resolved)
        ) as any
      }

      // Sync source — return directly
      return resolveEnv(schema as Record<string, EnvFieldDef<string>>, computedDefs, raw) as any
    },
  }
}
