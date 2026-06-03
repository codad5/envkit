export { defineEnv } from './defineEnv'
export { parseEnvFile } from './loader'
export { validateEnv } from './validator'
export { createEnvProxy } from './proxy'
export {
  fileSource,
  processSource,
  combinedSource,
  LocalEnvSource,
  isWritableSource,
  toExamplePath,
} from './sources'
export type { EnvSource, WritableEnvSource } from './sources'
export { groupHeader, envEntry, formatEnvFile } from './env-format'
export type { EnvFieldWithValue, WritePayload } from './env-format'

export type {
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
} from './types'
