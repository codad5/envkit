export { defineEnv } from './defineEnv.js'
export { loadRawEnv, parseEnvFile } from './loader.js'
export { validateEnv } from './validator.js'
export { createEnvProxy } from './proxy.js'

export type {
  SourceConfig,
  SourceType,
  EnvGroupDef,
  EnvFieldDef,
  PlainEnvFieldDef,
  ZodEnvFieldDef,
  ZodLike,
  ComputedFieldDef,
  EnvKitConfig,
  EnvKitInstance,
  InferEnvSchema,
  InferComputedSchema,
  ValidationResult,
  ValidationError,
} from './types.js'
