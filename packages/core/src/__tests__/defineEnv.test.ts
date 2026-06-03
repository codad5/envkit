import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { defineEnv } from '../defineEnv'
import { processSource, fileSource } from '../sources'

function makeTmpDir(content: string) {
  const dir = join(tmpdir(), 'envkit-define-' + Date.now())
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.env'), content, 'utf-8')
  return dir
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
    const env = config.load()
    expect(env.ENVKIT_TEST_PORT).toBe(4321)
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
    const env = config.load()
    expect(env.ENVKIT_OPT_PORT).toBe(3000)
  })

  it('proxy throws for unknown key access', () => {
    const config = defineEnv({
      source: processSource(),
      envSchema: {
        ENVKIT_KNOWN: { type: 'string', description: 'Known', required: false, default: 'x' },
      },
    })
    const env = config.load() as any
    expect(() => env.UNKNOWN_KEY).toThrow(ReferenceError)
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

    const env = config.load()
    expect(env.APP_URL).toBe('localhost:3000')

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

    const env = config.load()
    expect(env.METRICS_PORT).toBe(8081)

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

    const env = config.load()
    expect(env.BASE_URL).toBe('https://example.com')
    expect(env.API_URL).toBe('https://example.com/api')
    expect(env.HEALTH_URL).toBe('https://example.com/health')

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
    const env = config.load()
    expect(env.ENVKIT_Y).toBe('y')
  })
})
