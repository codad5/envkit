// ── Source config ────────────────────────────────────────────────────────────

export type SourceType = 'file' | 'process' | 'combined'

export interface SourceConfig {
  type: SourceType
  /** Path to .env file. Only used when type is 'file' or 'combined'. Default: '.env' */
  path?: string
}

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

/** Duck-typed to avoid importing ZodType (zod stays a peer dep) */
export type ZodLike = {
  parse: (value: unknown) => unknown
  safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown }
  _def?: {
    defaultValue?: () => unknown
    innerType?: ZodLike
    typeName?: string
  }
}

export interface PlainEnvFieldDef<GroupSlug extends string = string> {
  /** Variable type. Use a string[] for an inline enum literal union. */
  type: PrimitiveType | string[]
  schema?: never
  default?: unknown
  description: string
  /** How to obtain this value (shown in CLI wizard) */
  howToGet?: string
  group?: GroupSlug
  required: boolean
  multiline?: boolean
  secret?: boolean
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
  example?: string
}

export type EnvFieldDef<GroupSlug extends string = string> =
  | PlainEnvFieldDef<GroupSlug>
  | ZodEnvFieldDef<GroupSlug>

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
  F extends { schema: ZodLike }
    ? unknown  // Zod type inferred at load-time; static inference requires z.infer
    : F extends { type: (infer V extends string)[] }
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

export type InferEnvSchema<S extends Record<string, EnvFieldDef<any>>> = {
  readonly [K in keyof S]: InferFieldType<S[K]>
}

// ── Config and instance types ─────────────────────────────────────────────────

export interface EnvKitConfig<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<any>> = Record<never, ComputedFieldDef<any>>
> {
  source?: SourceConfig
  envGroups?: G
  envSchema: S
  /** Derived variables computed from the validated env at load() time. */
  computed?: C
}

export interface EnvKitInstance<
  G extends EnvGroupDef[],
  S extends Record<string, EnvFieldDef<G[number]['slug']>>,
  C extends Record<string, ComputedFieldDef<any>> = Record<never, ComputedFieldDef<any>>
> {
  readonly schema: S
  readonly groups: G
  readonly source: SourceConfig
  readonly computed: C
  /** Validates all variables, runs computed fields, returns the fully typed env. Throws on error. */
  load(): InferEnvSchema<S> & InferComputedSchema<C>
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
