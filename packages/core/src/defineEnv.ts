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

/**
 * Wraps a resolved `{ serverEnv, publicEnv }` half (i.e. one of those two
 * objects) in a Proxy that calls `ensureResolved()` — and so reads the
 * source and validates — only when a property on *this specific half* is
 * actually touched (get/has/ownKeys all trigger it), not when the half
 * itself is merely obtained as a reference.
 *
 * That distinction is why laziness has to live per-half rather than around
 * the `{ serverEnv, publicEnv }` container as a whole: destructuring
 * (`const { serverEnv, publicEnv } = config.load()`, the pattern this
 * library's own docs recommend) performs a `[[Get]]` for each named
 * property on whatever `load()` returned. If that container itself were the
 * lazy thing, destructuring it would trigger full resolution immediately —
 * exactly the import-time throw `lazy` exists to prevent — while looking to
 * the caller like `lazy` simply doesn't work. Two independent proxies, each
 * only reacting to reads of its own keys, means a bare destructure touches
 * neither.
 */
function createLazyHalf(ensureResolved: () => any, half: 'serverEnv' | 'publicEnv'): any {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
        return ensureResolved()[half][prop]
      },
      has(_target, prop) {
        return prop in ensureResolved()[half]
      },
      ownKeys() {
        return Reflect.ownKeys(ensureResolved()[half])
      },
      getOwnPropertyDescriptor(_target, prop) {
        return Reflect.getOwnPropertyDescriptor(ensureResolved()[half], prop)
      },
    },
  )
}

/**
 * Returns `{ serverEnv, publicEnv }` immediately, each half backed by
 * `createLazyHalf` above. Reading the source and validating is deferred to
 * the first property actually read on *either* half, memoizing the outcome
 * — success or thrown error — after that first resolution; both halves
 * share the same memo, since they come from a single validation pass and
 * touching either one shouldn't re-read the source or re-run computed
 * fields. This is what makes `lazy: true` work: merely importing a module
 * that does `export const { serverEnv, publicEnv } = config.load()` no
 * longer throws just because the environment isn't populated yet (e.g.
 * during a build step or a unit test); only actually reading a variable
 * does.
 *
 * Requires a synchronous source. A `Proxy` trap must return synchronously,
 * so "resolve on first read" is fundamentally incompatible with an async
 * source's `load()` — there's no way to await inside `get`. TypeScript
 * users get this rejected at `defineEnv()` call time (see the `lazy`
 * field's conditional type below); plain-JS callers get a clear throw here,
 * at first access, once the Promise is discovered.
 */
function createLazyEnvProxy<S extends Record<string, EnvFieldDef<string>>, C>(
  schema: S,
  computedDefs: C,
  source: EnvSource,
): any {
  let resolved: any
  let resolvedError: unknown
  let hasError = false
  let isResolved = false

  function ensureResolved(): any {
    if (isResolved) {
      // A dedicated flag, not `resolvedError !== undefined` — a source or
      // computed field is free to `throw undefined`, and treating that as
      // "no cached error" would fall through to `resolved[prop]` on an
      // undefined `resolved`, turning a clear validation error into an
      // opaque TypeError on the *next* access.
      if (hasError) throw resolvedError
      return resolved
    }
    try {
      const raw = source.load()
      if (raw instanceof Promise) {
        throw new Error(
          `[envkit] lazy: true requires a synchronous source, but source.load() returned a Promise. ` +
          `Remove "lazy: true" or use a synchronous source (fileSource/processSource/combinedSource).`
        )
      }
      resolved = resolveEnv(schema, computedDefs, raw)
    } catch (err) {
      resolvedError = err
      hasError = true
      isResolved = true
      throw err
    }
    isResolved = true
    return resolved
  }

  return {
    serverEnv: createLazyHalf(ensureResolved, 'serverEnv'),
    publicEnv: createLazyHalf(ensureResolved, 'publicEnv'),
  }
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
  /**
   * Defer reading the source and validating until the first variable is
   * actually read, instead of at the `load()` call itself. Only valid with a
   * synchronous source — if `Src['load']` returns a Promise, this collapses
   * to `false` at the type level (a `Proxy` trap can't await).
   * @default false
   */
  lazy?: ReturnType<Src['load']> extends Promise<any> ? false : boolean
}): Omit<EnvKitInstance<G, S, C>, 'load' | 'source'> & {
  readonly source: Src
  load(): InferLoad<Src, LoadedEnv<S, C>>
} {
  const source = (config.source ?? DEFAULT_SOURCE) as Src
  const groups = (config.envGroups ?? []) as G
  const schema = config.envSchema as unknown as S
  const computedDefs = (config.computed ?? {}) as C
  const lazy = config.lazy ?? false

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
      // Lazy — return a proxy immediately; it reads the source and validates
      // on first property access, not here.
      if (lazy) {
        return createLazyEnvProxy(schema as Record<string, EnvFieldDef<string>>, computedDefs, source) as any
      }

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
