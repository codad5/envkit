import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateEnv } from '../validator.js'
import type { EnvFieldDef } from '../types.js'

describe('validateEnv — plain fields', () => {
  it('parses a required string', () => {
    const schema: Record<string, EnvFieldDef> = {
      API_KEY: { type: 'string', description: 'Key', required: true },
    }
    const result = validateEnv(schema, { API_KEY: 'abc123' })
    expect(result.success).toBe(true)
    expect(result.data?.['API_KEY']).toBe('abc123')
  })

  it('errors when required string is missing', () => {
    const schema: Record<string, EnvFieldDef> = {
      API_KEY: { type: 'string', description: 'Key', required: true },
    }
    const result = validateEnv(schema, {})
    expect(result.success).toBe(false)
    expect(result.errors[0]?.key).toBe('API_KEY')
  })

  it('uses default when value is absent', () => {
    const schema: Record<string, EnvFieldDef> = {
      PORT: { type: 'number', description: 'Port', required: false, default: 3000 },
    }
    const result = validateEnv(schema, {})
    expect(result.success).toBe(true)
    expect(result.data?.['PORT']).toBe(3000)
  })

  it('parses a number', () => {
    const schema: Record<string, EnvFieldDef> = {
      PORT: { type: 'number', description: 'Port', required: true },
    }
    const result = validateEnv(schema, { PORT: '8080' })
    expect(result.success).toBe(true)
    expect(result.data?.['PORT']).toBe(8080)
  })

  it('errors on non-numeric value for number type', () => {
    const schema: Record<string, EnvFieldDef> = {
      PORT: { type: 'number', description: 'Port', required: true },
    }
    const result = validateEnv(schema, { PORT: 'not-a-port' })
    expect(result.success).toBe(false)
    expect(result.errors[0]?.key).toBe('PORT')
  })

  it('parses boolean true variants', () => {
    const schema: Record<string, EnvFieldDef> = {
      FLAG: { type: 'boolean', description: 'Flag', required: true },
    }
    for (const val of ['true', 'True', 'TRUE', '1']) {
      const result = validateEnv(schema, { FLAG: val })
      expect(result.success).toBe(true)
      expect(result.data?.['FLAG']).toBe(true)
    }
  })

  it('parses boolean false variants', () => {
    const schema: Record<string, EnvFieldDef> = {
      FLAG: { type: 'boolean', description: 'Flag', required: true },
    }
    for (const val of ['false', 'False', 'FALSE', '0']) {
      const result = validateEnv(schema, { FLAG: val })
      expect(result.success).toBe(true)
      expect(result.data?.['FLAG']).toBe(false)
    }
  })

  it('errors on invalid boolean value', () => {
    const schema: Record<string, EnvFieldDef> = {
      FLAG: { type: 'boolean', description: 'Flag', required: true },
    }
    const result = validateEnv(schema, { FLAG: 'yes' })
    expect(result.success).toBe(false)
  })

  it('validates inline enum', () => {
    const schema: Record<string, EnvFieldDef> = {
      NODE_ENV: {
        type: ['development', 'staging', 'production'],
        description: 'Env',
        required: true,
      },
    }
    const good = validateEnv(schema, { NODE_ENV: 'staging' })
    expect(good.success).toBe(true)
    expect(good.data?.['NODE_ENV']).toBe('staging')

    const bad = validateEnv(schema, { NODE_ENV: 'testing' })
    expect(bad.success).toBe(false)
  })

  it('validates URL type', () => {
    const schema: Record<string, EnvFieldDef> = {
      BASE_URL: { type: 'url', description: 'URL', required: true },
    }
    const good = validateEnv(schema, { BASE_URL: 'https://example.com' })
    expect(good.success).toBe(true)

    const bad = validateEnv(schema, { BASE_URL: 'not-a-url' })
    expect(bad.success).toBe(false)
  })

  it('validates json type', () => {
    const schema: Record<string, EnvFieldDef> = {
      CONFIG: { type: 'json', description: 'Config', required: true },
    }
    const result = validateEnv(schema, { CONFIG: '{"key":"value"}' })
    expect(result.success).toBe(true)
    expect(result.data?.['CONFIG']).toEqual({ key: 'value' })
  })

  it('errors on invalid JSON', () => {
    const schema: Record<string, EnvFieldDef> = {
      CONFIG: { type: 'json', description: 'Config', required: true },
    }
    const result = validateEnv(schema, { CONFIG: '{bad json}' })
    expect(result.success).toBe(false)
  })

  it('validates minLength constraint', () => {
    const schema: Record<string, EnvFieldDef> = {
      SECRET: { type: 'string', description: 'Secret', required: true, minLength: 8 },
    }
    expect(validateEnv(schema, { SECRET: 'short' }).success).toBe(false)
    expect(validateEnv(schema, { SECRET: 'longenough' }).success).toBe(true)
  })

  it('validates min/max on number', () => {
    const schema: Record<string, EnvFieldDef> = {
      PORT: { type: 'number', description: 'Port', required: true, min: 1024, max: 65535 },
    }
    expect(validateEnv(schema, { PORT: '80' }).success).toBe(false)
    expect(validateEnv(schema, { PORT: '3000' }).success).toBe(true)
  })

  it('returns undefined for optional missing field with no default', () => {
    const schema: Record<string, EnvFieldDef> = {
      REDIS_URL: { type: 'string', description: 'Redis URL', required: false },
    }
    const result = validateEnv(schema, {})
    expect(result.success).toBe(true)
    expect(result.data?.['REDIS_URL']).toBeUndefined()
  })

  it('collects multiple errors', () => {
    const schema: Record<string, EnvFieldDef> = {
      A: { type: 'string', description: 'A', required: true },
      B: { type: 'number', description: 'B', required: true },
    }
    const result = validateEnv(schema, {})
    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(2)
  })
})

describe('validateEnv — pattern validation', () => {
  it('validates string pattern as RegExp', () => {
    const schema: Record<string, EnvFieldDef> = {
      SLUG: { type: 'string', description: 'Slug', required: true, pattern: /^[a-z-]+$/ },
    }
    expect(validateEnv(schema, { SLUG: 'hello-world' }).success).toBe(true)
    expect(validateEnv(schema, { SLUG: 'Hello World' }).success).toBe(false)
  })

  it('validates string pattern as string', () => {
    const schema: Record<string, EnvFieldDef> = {
      SLUG: { type: 'string', description: 'Slug', required: true, pattern: '^[a-z]+$' },
    }
    expect(validateEnv(schema, { SLUG: 'hello' }).success).toBe(true)
    expect(validateEnv(schema, { SLUG: 'HELLO' }).success).toBe(false)
  })
})

describe('validateEnv — Zod 4 fields', () => {
  it('assigns a real Zod 4 schema to `schema` (typechecks, per Finding 2b)', () => {
    // Zod 4's `_def` shape (`{ type, checks }`) differs from Zod 3's
    // (`{ typeName, innerType }`); this must compile without reaching into `_def`.
    const schema: Record<string, EnvFieldDef> = {
      DATABASE_URL: {
        schema: z.string().startsWith('postgresql://'),
        description: 'Database URL',
      },
    }
    const good = validateEnv(schema, { DATABASE_URL: 'postgresql://localhost/db' })
    expect(good.success).toBe(true)

    const bad = validateEnv(schema, { DATABASE_URL: 'mysql://localhost/db' })
    expect(bad.success).toBe(false)
  })

  it('coerces a Zod 4 number field from a raw string', () => {
    const schema: Record<string, EnvFieldDef> = {
      PORT: { schema: z.number().min(1024), description: 'Port' },
    }
    const result = validateEnv(schema, { PORT: '3000' })
    expect(result.success).toBe(true)
    expect(result.data?.['PORT']).toBe(3000)
  })

  it('coerces a Zod 4 boolean field from a raw string', () => {
    const schema: Record<string, EnvFieldDef> = {
      FLAG: { schema: z.boolean(), description: 'Flag' },
    }
    const result = validateEnv(schema, { FLAG: 'true' })
    expect(result.success).toBe(true)
    expect(result.data?.['FLAG']).toBe(true)
  })

  it('coerces through Zod 4 optional/default wrappers', () => {
    const schema: Record<string, EnvFieldDef> = {
      TIMEOUT: { schema: z.number().default(30), description: 'Timeout' },
    }
    const result = validateEnv(schema, { TIMEOUT: '60' })
    expect(result.success).toBe(true)
    expect(result.data?.['TIMEOUT']).toBe(60)
  })
})
