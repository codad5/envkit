import type {
  EnvFieldDef,
  PlainEnvFieldDef,
  ZodLike,
  ValidationResult,
} from './types'

/** Validate raw string env vars against the schema. Returns typed values on success. */
export function validateEnv(
  schema: Record<string, EnvFieldDef<string>>,
  raw: Record<string, string>,
): ValidationResult {
  const errors: Array<{ key: string; message: string }> = []
  const data: Record<string, unknown> = {}

  for (const [key, field] of Object.entries(schema)) {
    const rawValue = raw[key]

    if ('schema' in field && field.schema !== undefined) {
      const result = validateZodField(key, rawValue, field.schema)
      if (result.error) {
        errors.push({ key, message: result.error })
      } else {
        data[key] = result.value
      }
      continue
    }

    const plainField = field as PlainEnvFieldDef<string>
    const result = validatePlainField(key, rawValue, plainField)
    if (result.error) {
      errors.push({ key, message: result.error })
    } else {
      data[key] = result.value
    }
  }

  return errors.length > 0
    ? { success: false, errors }
    : { success: true, errors: [], data }
}

function validateZodField(
  key: string,
  rawValue: string | undefined,
  zodSchema: ZodLike,
): { value?: unknown; error?: string } {
  const valueToparse = rawValue !== undefined ? coerceForZod(rawValue, zodSchema) : undefined

  const result = zodSchema.safeParse(valueToparse)
  if (!result.success) {
    const err = result.error as any
    const msg = err?.issues?.[0]?.message ?? err?.message ?? 'Validation failed'
    return { error: msg }
  }
  return { value: result.data }
}

/** Attempt to detect the Zod type and pre-coerce the string value */
function coerceForZod(raw: string, schema: ZodLike): unknown {
  const typeName = schema._def?.typeName ?? ''
  const innerTypeName = schema._def?.innerType?._def?.typeName ?? ''
  const name = typeName || innerTypeName

  if (name === 'ZodNumber') return Number(raw)
  if (name === 'ZodBoolean') return raw === 'true' || raw === '1'
  if (name === 'ZodOptional' || name === 'ZodDefault') {
    const inner = schema._def?.innerType
    if (inner) return coerceForZod(raw, inner)
  }
  return raw
}

function validatePlainField(
  key: string,
  rawValue: string | undefined,
  field: PlainEnvFieldDef<string>,
): { value?: unknown; error?: string } {
  const isEmpty = rawValue === undefined || rawValue === ''

  // Use default when value is absent
  if (isEmpty) {
    if (field.default !== undefined) {
      return { value: field.default }
    }
    if (!field.required) {
      return { value: undefined }
    }
    return { error: 'required but not set' }
  }

  // Type coercion + validation
  const { type } = field

  // Inline enum
  if (Array.isArray(type)) {
    if (!type.includes(rawValue)) {
      return { error: `expected one of: ${type.join(', ')}; got "${rawValue}"` }
    }
    return { value: rawValue }
  }

  switch (type) {
    case 'string':
    case 'url': {
      if (type === 'url') {
        try { new URL(rawValue) }
        catch { return { error: `expected a valid URL, got "${rawValue}"` } }
      }
      if (field.minLength !== undefined && rawValue.length < field.minLength) {
        return { error: `must be at least ${field.minLength} characters` }
      }
      if (field.maxLength !== undefined && rawValue.length > field.maxLength) {
        return { error: `must be at most ${field.maxLength} characters` }
      }
      if (field.pattern !== undefined) {
        const re = typeof field.pattern === 'string' ? new RegExp(field.pattern) : field.pattern
        if (!re.test(rawValue)) {
          return { error: `does not match pattern ${re}` }
        }
      }
      return { value: rawValue }
    }

    case 'number': {
      const n = Number(rawValue)
      if (isNaN(n)) return { error: `expected a number, got "${rawValue}"` }
      if (field.min !== undefined && n < field.min) {
        return { error: `must be >= ${field.min}` }
      }
      if (field.max !== undefined && n > field.max) {
        return { error: `must be <= ${field.max}` }
      }
      return { value: n }
    }

    case 'boolean': {
      const lower = rawValue.toLowerCase()
      if (lower === 'true' || lower === '1') return { value: true }
      if (lower === 'false' || lower === '0') return { value: false }
      return { error: `expected "true" or "false", got "${rawValue}"` }
    }

    case 'json': {
      try {
        return { value: JSON.parse(rawValue) }
      } catch {
        return { error: `expected valid JSON, got "${rawValue}"` }
      }
    }

    default:
      return { value: rawValue }
  }
}
