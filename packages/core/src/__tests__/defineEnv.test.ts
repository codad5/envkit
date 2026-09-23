import { describe, it, expect, expectTypeOf, vi } from 'vitest'
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

describe('defineEnv — lazy option', () => {
  it('load() does not read the source or validate until a property is read', () => {
    const loadSpy = vi.fn((): Record<string, string> => ({}))
    // Required var deliberately absent — proves nothing was validated yet.
    const config = defineEnv({
      source: { load: loadSpy },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_REQUIRED: { type: 'string', description: 'Required', required: true },
      },
    })

    const { serverEnv } = config.load() // must not throw
    expect(loadSpy).not.toHaveBeenCalled()

    expect(() => (serverEnv as any).ENVKIT_LAZY_REQUIRED).toThrow('[envkit]')
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('destructuring { serverEnv, publicEnv } off load() does not itself trigger resolution', () => {
    // The library's own docs recommend `const { serverEnv, publicEnv } =
    // config.load()`. If laziness lived around that container instead of
    // inside each half, this destructure alone would resolve everything —
    // exactly the import-time throw `lazy` exists to prevent — while
    // looking to the caller like `lazy` simply doesn't work.
    const loadSpy = vi.fn((): Record<string, string> => ({}))
    const config = defineEnv({
      source: { load: loadSpy },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_DESTRUCTURE: { type: 'string', description: 'X', required: true },
      },
    })

    const { serverEnv, publicEnv } = config.load()
    expect(loadSpy).not.toHaveBeenCalled()

    // Only an actual property read triggers it.
    expect(() => (serverEnv as any).ENVKIT_LAZY_DESTRUCTURE).toThrow('[envkit]')
    expect(loadSpy).toHaveBeenCalledTimes(1)
    void publicEnv
  })

  it('resolves and returns the correct value on first access, for both halves', () => {
    const config = defineEnv({
      source: { load: () => ({ ENVKIT_LAZY_PORT: '4000', ENVKIT_LAZY_PUBLIC: 'ok' }) },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_PORT: { type: 'number', description: 'Port', required: true },
        ENVKIT_LAZY_PUBLIC: { type: 'string', description: 'Public', required: true, visibility: 'public' },
      },
    })

    const { serverEnv, publicEnv } = config.load()
    expect(serverEnv.ENVKIT_LAZY_PORT).toBe(4000)
    expect(publicEnv.ENVKIT_LAZY_PUBLIC).toBe('ok')
  })

  it('memoizes a successful resolution — source.load() is called exactly once across both halves', () => {
    const loadSpy = vi.fn(() => ({ ENVKIT_LAZY_HOST: 'localhost', ENVKIT_LAZY_PUB: 'x' }))
    const config = defineEnv({
      source: { load: loadSpy },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_HOST: { type: 'string', description: 'Host', required: true },
        ENVKIT_LAZY_PUB: { type: 'string', description: 'Pub', required: true, visibility: 'public' },
      },
    })

    const { serverEnv, publicEnv } = config.load()
    expect(serverEnv.ENVKIT_LAZY_HOST).toBe('localhost')
    expect(serverEnv.ENVKIT_LAZY_HOST).toBe('localhost')
    expect(Object.keys(serverEnv)).toContain('ENVKIT_LAZY_HOST')
    // Touching publicEnv after serverEnv reuses the same memoized resolution.
    expect(publicEnv.ENVKIT_LAZY_PUB).toBe('x')
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('memoizes a failed resolution — repeated access throws the same error without re-reading the source', () => {
    const loadSpy = vi.fn((): Record<string, string> => ({}))
    const config = defineEnv({
      source: { load: loadSpy },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_MISSING: { type: 'string', description: 'Missing', required: true },
      },
    })

    const { serverEnv } = config.load()
    let firstError: unknown
    try {
      void (serverEnv as any).ENVKIT_LAZY_MISSING
    } catch (err) {
      firstError = err
    }
    expect(firstError).toBeInstanceOf(Error)

    expect(() => (serverEnv as any).ENVKIT_LAZY_MISSING).toThrow(firstError as Error)
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('memoizes a failure even when the thrown value is `undefined` (not just Error instances)', () => {
    // A source is free to throw anything, including `undefined` — the cached
    // error must be tracked with a dedicated flag, not by checking
    // `resolvedError !== undefined`, or this case falls through to reading a
    // property off an unresolved `resolved` on the second access.
    const loadSpy = vi.fn(() => {
      throw undefined
    })
    const config = defineEnv({
      source: { load: loadSpy as unknown as () => Record<string, string> },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_UNDEFINED_THROW: { type: 'string', description: 'X', required: true },
      },
    })

    const { serverEnv } = config.load()
    let firstCaught: unknown = 'not-thrown'
    try {
      void (serverEnv as any).ENVKIT_LAZY_UNDEFINED_THROW
    } catch (err) {
      firstCaught = err
    }
    expect(firstCaught).toBeUndefined()

    // Second access must re-throw `undefined` again, not a TypeError from
    // indexing into an unresolved value.
    let secondCaught: unknown = 'not-thrown'
    try {
      void (serverEnv as any).ENVKIT_LAZY_UNDEFINED_THROW
    } catch (err) {
      secondCaught = err
    }
    expect(secondCaught).toBeUndefined()
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('`has` and `ownKeys` traps also trigger resolution (spread / Object.keys / "in")', () => {
    const loadSpy = vi.fn(() => ({ ENVKIT_LAZY_SPREAD: 'x' }))
    const config = defineEnv({
      source: { load: loadSpy },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_SPREAD: { type: 'string', description: 'X', required: true },
      },
    })

    const { serverEnv } = config.load()
    expect('ENVKIT_LAZY_SPREAD' in (serverEnv as object)).toBe(true)
    expect({ ...serverEnv }).toEqual({ ENVKIT_LAZY_SPREAD: 'x' })
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })

  it('throws at first access (not at load()) when the source is async', () => {
    const config = defineEnv({
      source: { load: () => Promise.resolve({ ENVKIT_LAZY_ASYNC: 'x' }) },
      lazy: true as any, // async + lazy is a compile error by design — bypassed here to test the runtime guard for plain-JS callers
      envSchema: {
        ENVKIT_LAZY_ASYNC: { type: 'string', description: 'X', required: true },
      },
    })

    // `as any`: the static type still says Promise<...> (InferLoad goes purely
    // off the source's load() signature), but lazy:true's runtime bypass means
    // it actually returns synchronously here — this test is deliberately
    // exercising the plain-JS-only path, same as the `lazy: true as any` above.
    const { serverEnv } = config.load() as any // must not throw — laziness means nothing ran yet
    expect(() => serverEnv.ENVKIT_LAZY_ASYNC).toThrow('requires a synchronous source')
  })

  it('unknown-key guard still applies to serverEnv once resolved', () => {
    const config = defineEnv({
      source: { load: () => ({ ENVKIT_LAZY_KNOWN: 'x' }) },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_KNOWN: { type: 'string', description: 'Known', required: true },
      },
    })

    const { serverEnv } = config.load() as any
    expect(() => serverEnv.UNKNOWN_KEY).toThrow(ReferenceError)
  })

  it('window guard still applies to serverEnv once resolved, in a simulated browser context', () => {
    const config = defineEnv({
      source: { load: () => ({ ENVKIT_LAZY_SERVER_ONLY: 'secret-value' }) },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_SERVER_ONLY: { type: 'string', description: 'Secret', required: true },
      },
    })

    const { serverEnv } = config.load()

    const originalWindow = (globalThis as any).window
    ;(globalThis as any).window = {}
    try {
      expect(() => (serverEnv as any).ENVKIT_LAZY_SERVER_ONLY).toThrow(ReferenceError)
    } finally {
      if (originalWindow === undefined) delete (globalThis as any).window
      else (globalThis as any).window = originalWindow
    }
  })

  it('publicEnv does not expose a server-only field even when lazy', () => {
    const config = defineEnv({
      source: { load: () => ({ ENVKIT_LAZY_SRV: 'x', ENVKIT_LAZY_PUB2: 'y' }) },
      lazy: true,
      envSchema: {
        ENVKIT_LAZY_SRV: { type: 'string', description: 'Server', required: true },
        ENVKIT_LAZY_PUB2: { type: 'string', description: 'Public', required: true, visibility: 'public' },
      },
    })

    const { publicEnv } = config.load() as any
    expect(publicEnv.ENVKIT_LAZY_PUB2).toBe('y')
    expect(() => publicEnv.ENVKIT_LAZY_SRV).toThrow(ReferenceError)
  })

  it('defaults to eager (non-lazy) when `lazy` is omitted', () => {
    const loadSpy = vi.fn((): Record<string, string> => ({}))
    expect(() =>
      defineEnv({
        source: { load: loadSpy },
        envSchema: {
          ENVKIT_EAGER_REQUIRED: { type: 'string', description: 'Required', required: true },
        },
      }).load()
    ).toThrow('[envkit]')
    expect(loadSpy).toHaveBeenCalledTimes(1)
  })
})
