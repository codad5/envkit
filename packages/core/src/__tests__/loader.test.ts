import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseEnvFile } from '../loader'
import { fileSource, processSource, combinedSource } from '../sources'

function tmpFile(content: string): { path: string; dir: string } {
  const dir = join(tmpdir(), 'envkit-test-' + Date.now())
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.env'), content, 'utf-8')
  return { path: join(dir, '.env'), dir }
}

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', () => {
    const { path } = tmpFile('FOO=bar\nBAZ=qux\n')
    expect(parseEnvFile(path)).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('strips surrounding quotes', () => {
    const { path } = tmpFile('A="hello world"\nB=\'single\'\n')
    const result = parseEnvFile(path)
    expect(result.A).toBe('hello world')
    expect(result.B).toBe('single')
  })

  it('ignores comment lines', () => {
    const { path } = tmpFile('# comment\nFOO=bar\n')
    expect(parseEnvFile(path)).toEqual({ FOO: 'bar' })
  })

  it('ignores blank lines', () => {
    const { path } = tmpFile('\n\nFOO=bar\n\n')
    expect(parseEnvFile(path)).toEqual({ FOO: 'bar' })
  })

  it('returns empty object for non-existent file', () => {
    expect(parseEnvFile('/non/existent/.env')).toEqual({})
  })

  it('handles values with equals signs in them', () => {
    const { path } = tmpFile('DB_URL=postgresql://user:pass@host/db?ssl=true\n')
    expect(parseEnvFile(path).DB_URL).toBe('postgresql://user:pass@host/db?ssl=true')
  })
})

describe('processSource', () => {
  it('returns process.env values', () => {
    process.env['TEST_ENVKIT_VAR'] = 'test-value'
    const result = processSource().load()
    expect((result as Record<string, string>)['TEST_ENVKIT_VAR']).toBe('test-value')
    delete process.env['TEST_ENVKIT_VAR']
  })
})

describe('fileSource', () => {
  it('loads from file', () => {
    const { dir } = tmpFile('HELLO=world\n')
    const result = fileSource({ path: '.env' }).load(dir)
    expect((result as Record<string, string>)['HELLO']).toBe('world')
  })
})

describe('combinedSource', () => {
  it('process.env overrides file', () => {
    const { dir } = tmpFile('PORT=3000\n')
    process.env['PORT'] = '9999'
    const result = combinedSource({ path: '.env' }).load(dir)
    expect((result as Record<string, string>)['PORT']).toBe('9999')
    delete process.env['PORT']
  })
})
