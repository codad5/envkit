import { describe, it, expect, expectTypeOf } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { defineEnv } from '../defineEnv'
import { processSource, fileSource } from '../sources'
import type { ZodLike } from '../types'

function makeTmpDir(content: string) {
  const dir = join(tmpdir(), 'envkit-define-' + Date.now())
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.env'), content, 'utf-8')
  return dir
}

function createZodLikeSchema<T>(parse: (value: unknown) => T): ZodLike & { _output: T } {
  const schema: ZodLike & { _output: T } = {
    parse,
    safeParse(value: unknown) {
      try {
        return { success: true, data: parse(value) }
      } catch (error: unknown) {
        return { success: false, error }
      }
    },
  }
  return schema
}

describe('defineEnv', () => {
  it('returns schema, groups, and source', () => {
    const config = defineEnv({
      source: processSource(),
      envGroups: [{ slug: 'server', name: 'Server' }],
      envSchema: {
        PORT: { type: 'number', description: 'Port', required: false, default: 3000, group: 'server' },
      },
    })

    expect(config.schema).toBeDefined()
    expect(config.groups).toHaveLength(1)
    expect(config.source).toBeDefined()
  })

  it('load() returns typed env from process source', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_TEST_PORT: { type: 'number', description: 'Port', required: true },
      },
    })
    process.env['ENVKIT_TEST_PORT'] = '4321'
    const { serverEnv } = config.load()
    expect(serverEnv.ENVKIT_TEST_PORT).toBe(4321)
    delete process.env['ENVKIT_TEST_PORT']
  })

  it('load() throws when required variable is missing', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_MISSING_VAR: { type: 'string', description: 'Missing', required: true },
      },
    })
    delete process.env['ENVKIT_MISSING_VAR']
    expect(() => config.load()).toThrow('[envkit]')
  })

  it('load() uses default for optional missing field', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_OPT_PORT: { type: 'number', description: 'Port', required: false, default: 3000 },
      },
    })
    delete process.env['ENVKIT_OPT_PORT']
    const { serverEnv } = config.load()
    expect(serverEnv.ENVKIT_OPT_PORT).toBe(3000)
  })

  it('proxy throws for unknown key access', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_KNOWN: { type: 'string', description: 'Known', required: false, default: 'x' },
      },
    })
    const { serverEnv } = config.load() as any
    expect(() => serverEnv.UNKNOWN_KEY).toThrow(ReferenceError)
  })

  it('load() infers zod schema output types', () => {
    const databaseUrlSchema = createZodLikeSchema<string>((value) => {
      if (typeof value !== 'string') throw new Error('Expected string')
      new URL(value)
      return value
    })

    const nodeEnvSchema = createZodLikeSchema<'development' | 'production'>((value) => {
      if (value === undefined) return 'development'
      if (value === 'development' || value === 'production') return value
      throw new Error('Expected development or production')
    })

    const portSchema = createZodLikeSchema<number>((value) => {
      if (value === undefined) return 3000
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) return parsed
      }
      throw new Error('Expected number')
    })

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_DATABASE_URL: {
          schema: databaseUrlSchema,
          description: 'Database URL',
        },
        ENVKIT_NODE_ENV: {
          schema: nodeEnvSchema,
          description: 'Node environment',
        },
        ENVKIT_PORT: {
          schema: portSchema,
          description: 'HTTP port',
        },
        ENVKIT_RETRIES: {
          type: 'number',
          description: 'Retry count',
          required: false,
          default: 3,
        },
      },
    })

    process.env['ENVKIT_DATABASE_URL'] = 'https://example.com/db'
    delete process.env['ENVKIT_NODE_ENV']
    delete process.env['ENVKIT_PORT']

    const { serverEnv } = config.load()
    expectTypeOf(serverEnv.ENVKIT_DATABASE_URL).toEqualTypeOf<string>()
    expectTypeOf(serverEnv.ENVKIT_NODE_ENV).toEqualTypeOf<'development' | 'production'>()
    expectTypeOf(serverEnv.ENVKIT_PORT).toEqualTypeOf<number>()
    expectTypeOf(serverEnv.ENVKIT_RETRIES).toEqualTypeOf<number>()

    expect(serverEnv.ENVKIT_DATABASE_URL).toBe('https://example.com/db')
    expect(serverEnv.ENVKIT_NODE_ENV).toBe('development')
    expect(serverEnv.ENVKIT_PORT).toBe(3000)
    expect(serverEnv.ENVKIT_RETRIES).toBe(3)

    delete process.env['ENVKIT_DATABASE_URL']
  })
})

describe('defineEnv — computed fields', () => {
  it('computes a derived value from validated env', () => {
    process.env['ENVKIT_HOST'] = 'localhost'
    process.env['ENVKIT_PORT'] = '3000'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_HOST: { type: 'string', description: 'Host', required: true },
        ENVKIT_PORT: { type: 'number', description: 'Port', required: true },
      },
      computed: {
        APP_URL: {
          description: 'Full application URL',
          compute: ({ env }) => `${env.ENVKIT_HOST}:${env.ENVKIT_PORT}`,
        },
      },
    })

    const { serverEnv } = config.load()
    expect(serverEnv.APP_URL).toBe('localhost:3000')

    delete process.env['ENVKIT_HOST']
    delete process.env['ENVKIT_PORT']
  })

  it('computed field receives the correctly typed numeric value', () => {
    process.env['ENVKIT_BASE_PORT'] = '8080'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_BASE_PORT: { type: 'number', description: 'Port', required: true },
      },
      computed: {
        METRICS_PORT: {
          compute: ({ env }) => env.ENVKIT_BASE_PORT + 1,
        },
      },
    })

    const { serverEnv } = config.load()
    expect(serverEnv.METRICS_PORT).toBe(8081)

    delete process.env['ENVKIT_BASE_PORT']
  })

  it('multiple computed fields all resolve', () => {
    process.env['ENVKIT_SCHEME'] = 'https'
    process.env['ENVKIT_DOMAIN'] = 'example.com'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_SCHEME: { type: 'string', description: 'Scheme', required: true },
        ENVKIT_DOMAIN: { type: 'string', description: 'Domain', required: true },
      },
      computed: {
        BASE_URL:   { compute: ({ env }) => `${env.ENVKIT_SCHEME}://${env.ENVKIT_DOMAIN}` },
        API_URL:    { compute: ({ env }) => `${env.ENVKIT_SCHEME}://${env.ENVKIT_DOMAIN}/api` },
        HEALTH_URL: { compute: ({ env }) => `${env.ENVKIT_SCHEME}://${env.ENVKIT_DOMAIN}/health` },
      },
    })

    const { serverEnv } = config.load()
    expect(serverEnv.BASE_URL).toBe('https://example.com')
    expect(serverEnv.API_URL).toBe('https://example.com/api')
    expect(serverEnv.HEALTH_URL).toBe('https://example.com/health')

    delete process.env['ENVKIT_SCHEME']
    delete process.env['ENVKIT_DOMAIN']
  })

  it('computed fields are on the instance as metadata', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_X: { type: 'string', description: 'X', required: false, default: 'x' },
      },
      computed: {
        ENVKIT_X_UPPER: { compute: ({ env }) => String(env.ENVKIT_X).toUpperCase() },
      },
    })

    expect(config.computed).toHaveProperty('ENVKIT_X_UPPER')
  })

  it('throws at define time when a computed key conflicts with an envSchema key', () => {
    expect(() =>
      defineEnv({
        source: processSource(),
        envSchema: {
          ENVKIT_PORT: { type: 'number', description: 'Port', required: false, default: 3000 },
        },
        computed: {
          ENVKIT_PORT: { compute: ({ env }) => env.ENVKIT_PORT } as any,
        },
      })
    ).toThrow('[envkit] computed key')
  })

  it('works with no computed field (backward compatible)', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_Y: { type: 'string', description: 'Y', required: false, default: 'y' },
      },
    })
    const { serverEnv } = config.load()
    expect(serverEnv.ENVKIT_Y).toBe('y')
  })
})

describe('defineEnv — visibility split', () => {
  it('serverEnv exposes every field; publicEnv exposes only visibility: "public" ones', () => {
    process.env['ENVKIT_APP_URL'] = 'https://example.com'
    process.env['ENVKIT_DB_URL'] = 'postgresql://localhost/db'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_APP_URL: { type: 'url', description: 'App URL', required: true, visibility: 'public' },
        ENVKIT_DB_URL: { type: 'string', description: 'DB URL', required: true, secret: true },
      },
    })

    const { serverEnv, publicEnv } = config.load()

    expectTypeOf(publicEnv).toHaveProperty('ENVKIT_APP_URL')
    expectTypeOf(publicEnv).not.toHaveProperty('ENVKIT_DB_URL')
    expectTypeOf(serverEnv).toHaveProperty('ENVKIT_DB_URL')

    expect(publicEnv.ENVKIT_APP_URL).toBe('https://example.com')
    expect(serverEnv.ENVKIT_APP_URL).toBe('https://example.com')
    expect(serverEnv.ENVKIT_DB_URL).toBe('postgresql://localhost/db')
    // publicEnv's proxy has the same unknown-key guard as serverEnv — a server-only
    // field is simply absent from its data, so accessing it throws like any typo.
    expect(() => (publicEnv as any).ENVKIT_DB_URL).toThrow(ReferenceError)

    delete process.env['ENVKIT_APP_URL']
    delete process.env['ENVKIT_DB_URL']
  })

  it('defaults to server-only visibility when unspecified', () => {
    process.env['ENVKIT_DEFAULT_VIS'] = 'x'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_DEFAULT_VIS: { type: 'string', description: 'X', required: true },
      },
    })

    const { publicEnv } = config.load() as any
    expect(() => publicEnv.ENVKIT_DEFAULT_VIS).toThrow(ReferenceError)

    delete process.env['ENVKIT_DEFAULT_VIS']
  })

  it('throws at define time when a field is both secret and public', () => {
    expect(() =>
      defineEnv({
        source: processSource(),
        envSchema: {
          ENVKIT_BAD: {
            type: 'string',
            description: 'Bad',
            required: true,
            secret: true,
            visibility: 'public',
          } as any,
        },
      })
    ).toThrow('[envkit] field')
  })

  it('serverEnv throws on any access when accessed from a simulated browser context', () => {
    process.env['ENVKIT_SERVER_ONLY'] = 'secret-value'

    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_SERVER_ONLY: { type: 'string', description: 'Secret', required: true },
      },
    })

    const { serverEnv } = config.load()

    const originalWindow = (globalThis as any).window
    ;(globalThis as any).window = {}
    try {
      expect(() => (serverEnv as any).ENVKIT_SERVER_ONLY).toThrow(ReferenceError)
    } finally {
      if (originalWindow === undefined) delete (globalThis as any).window
      else (globalThis as any).window = originalWindow
      delete process.env['ENVKIT_SERVER_ONLY']
    }
  })
})
