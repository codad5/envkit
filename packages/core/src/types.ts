// ── Group ────────────────────────────────────────────────────────────────────

export interface EnvGroupDef {
  slug: string
  name: string
  description?: string
}

// ── Field definitions ────────────────────────────────────────────────────────

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'url' | 'json'

export type PrimitiveTypeMap = {
  string: string
  number: number
  boolean: boolean
  url: string
  json: Record<string, unknown>
}

/**
 * Duck-typed to avoid importing ZodType (zod stays a peer dep).
 * Kept to the structural minimum shared by Zod 3 and Zod 4 — their `_def`
 * internals are shaped differently (`typeName` vs `type`), so anything beyond
 * parse/safeParse is read defensively at runtime rather than declared here.
 */
export type ZodLike = {
  parse: (value: unknown) => unknown
  safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown }
}

/**
 * Where this variable may be read from.
 * `'server'` (the default) — only reachable via `serverEnv`, which throws if
 * accessed from a browser context. `'public'` — also exposed via `publicEnv`,
 * which is safe to import into client-bundled code.
 */
export type EnvVisibility = 'server' | 'public'

export interface PlainEnvFieldDef<GroupSlug extends string = string> {
  /** Variable type. Use a readonly string[] for an inline enum literal union. */
  type: PrimitiveType | readonly string[]
  schema?: never
  default?: unknown
  description: string
  /** How to obtain this value (shown in CLI wizard) */
  howToGet?: string
  group?: GroupSlug
  required: boolean
  multiline?: boolean
  secret?: boolean
  /** @default 'server' */
  visibility?: EnvVisibility
  example?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp | string
}

export interface ZodEnvFieldDef<GroupSlug extends string = string> {
  schema: ZodLike
  type?: never
  required?: never
  default?: never
  min?: never
  max?: never
  minLength?: never
  maxLength?: never
  pattern?: never
  description: string
  howToGet?: string
  group?: GroupSlug
  secret?: boolean
  /** @default 'server' */
  visibility?: EnvVisibility
  example?: string
}

export type EnvFieldDef<GroupSlug extends string = string> =
  | PlainEnvFieldDef<GroupSlug>
  | ZodEnvFieldDef<GroupSlug>

/**
 * `secret: true` combined with `visibility: 'public'` is always a mistake — a
 * secret exposed to the browser is a leak, not a config choice — so it is
 * rejected at the type level rather than only at runtime. `defineEnv` applies
 * this to `envSchema`, so passing this combination is a compile error.
 */
export type RejectSecretPublic<F> = F extends { secret: true; visibility: 'public' }
  ? { __envkit_error: 'a field cannot be both `secret: true` and `visibility: "public"`' }
  : F

// ── Computed field definitions ────────────────────────────────────────────────

/**
 * A derived variable computed from the already-validated env at load() time.
 * Not read from .env or process.env — purely a runtime convenience.
 * Not included in generate / validate / diff output.
 */
export interface ComputedFieldDef<TEnv extends Record<string, unknown> = Record<string, unknown>> {
  description?: string
  compute: (ctx: { env: TEnv }) => unknown
}

export type InferComputedSchema<C extends Record<string, ComputedFieldDef<any>>> = {
  readonly [K in keyof C]: ReturnType<C[K]['compute']>
}

// ── Inference helpers ────────────────────────────────────────────────────────

type InferRawType<F extends EnvFieldDef<any>> =
  F extends { schema: { _output: infer O } }
    ? O
    : F extends { schema: ZodLike }
    ? unknown  // Zod type inferred at load-time; static inference requires z.infer
    : F extends { type: readonly (infer V extends string)[] }
    ? V
    : F extends { type: keyof PrimitiveTypeMap }
    ? PrimitiveTypeMap[F['type']]
    : never

type InferFieldType<F extends EnvFieldDef<any>> =
  F extends { default: NonNullable<unknown> }
    ? InferRawType<F>
    : F extends { required: true }
    ? InferRawType<F>
    : InferRawType<F> | undefined

/** Shape of `serverEnv` — every declared field, server or public. */
export type InferEnvSchema<S extends Record<string, EnvFieldDef<any>>> = {
  readonly [K in keyof S]: InferFieldType<S[K]>
}

type PublicKeys<S extends Record<string, EnvFieldDef<any>>> = {
  [K in keyof S]: S[K] extends { visibility: 'public' } ? K : never
}[keyof S]

/** Shape of `publicEnv` — only fields declared with `visibility: 'public'`. */
export type InferPublicEnvSchema<S extends Record<string, EnvFieldDef<any>>> = {
  readonly [K in PublicKeys<S>]: InferFieldType<S[K]>
}

// ── Config and instance types ─────────────────────────────────────────────────

export interface EnvKitConfig<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<any>> = Record<never, ComputedFieldDef<any>>
> {
  source?: import('./sources.js').EnvSource
  envGroups?: G
  envSchema: S
  /** Derived variables computed from the validated env at load() time. */
  computed?: C
}

/** The env, split by where it's safe to read from. See `EnvVisibility`. */
export interface LoadedEnv<
  S extends Record<string, EnvFieldDef<any>>,
  C extends Record<string, ComputedFieldDef<any>>
> {
  /** Every declared field, plus computed values. Throws if read from a browser context. */
  serverEnv: InferEnvSchema<S> & InferComputedSchema<C>
  /** Only fields declared `visibility: 'public'`. Safe to import into client-bundled code. */
  publicEnv: InferPublicEnvSchema<S>
}

export interface EnvKitInstance<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<any>> = Record<never, ComputedFieldDef<any>>
> {
  readonly schema: S
  readonly groups: G
  readonly source: import('./sources.js').EnvSource
  readonly computed: C
  /** Validates all variables, runs computed fields, returns `{ serverEnv, publicEnv }`. Throws on error. */
  load(): LoadedEnv<S, C>
}

// ── Validation result ─────────────────────────────────────────────────────────

export interface ValidationError {
  key: string
  message: string
}

export interface ValidationResult {
  success: boolean
  errors: ValidationError[]
  /** Parsed env values when success is true */
  data?: Record<string, unknown>
}
