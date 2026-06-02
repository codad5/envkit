import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseEnvFile, loadRawEnv } from '../loader.js'

function tmpFile(content: string): { path: string; cleanup: () => void } {
  const dir = join(tmpdir(), 'envkit-test-' + Date.now())
  mkdirSync(dir, { recursive: true })
  const path = join(dir, '.env')
  writeFileSync(path, content, 'utf-8')
  return { path, cleanup: () => { try { unlinkSync(path) } catch {} } }
}

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', () => {
    const { path, cleanup } = tmpFile('FOO=bar\nBAZ=qux\n')
    const result = parseEnvFile(path)
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' })
    cleanup()
  })

  it('strips surrounding quotes', () => {
    const { path, cleanup } = tmpFile('A="hello world"\nB=\'single\'\n')
    const result = parseEnvFile(path)
    expect(result.A).toBe('hello world')
    expect(result.B).toBe('single')
    cleanup()
  })

  it('ignores comment lines', () => {
    const { path, cleanup } = tmpFile('# comment\nFOO=bar\n')
    const result = parseEnvFile(path)
    expect(result).toEqual({ FOO: 'bar' })
    cleanup()
  })

  it('ignores blank lines', () => {
    const { path, cleanup } = tmpFile('\n\nFOO=bar\n\n')
    const result = parseEnvFile(path)
    expect(result).toEqual({ FOO: 'bar' })
    cleanup()
  })

  it('returns empty object for non-existent file', () => {
    const result = parseEnvFile('/non/existent/.env')
    expect(result).toEqual({})
  })

  it('handles values with equals signs in them', () => {
    const { path, cleanup } = tmpFile('DB_URL=postgresql://user:pass@host/db?ssl=true\n')
    const result = parseEnvFile(path)
    expect(result.DB_URL).toBe('postgresql://user:pass@host/db?ssl=true')
    cleanup()
  })
})

describe('loadRawEnv — process source', () => {
  it('returns process.env values', () => {
    process.env['TEST_ENVKIT_VAR'] = 'test-value'
    const result = loadRawEnv({ type: 'process' })
    expect(result['TEST_ENVKIT_VAR']).toBe('test-value')
    delete process.env['TEST_ENVKIT_VAR']
  })
})

describe('loadRawEnv — file source', () => {
  it('loads from file', () => {
    const { path, cleanup } = tmpFile('HELLO=world\n')
    const dir = path.replace(/[/\\][^/\\]+$/, '')
    const result = loadRawEnv({ type: 'file', path: '.env' }, dir)
    expect(result['HELLO']).toBe('world')
    cleanup()
  })
})

describe('loadRawEnv — combined source', () => {
  it('process.env overrides file', () => {
    const { path, cleanup } = tmpFile('PORT=3000\n')
    const dir = path.replace(/[/\\][^/\\]+$/, '')
    process.env['PORT'] = '9999'
    const result = loadRawEnv({ type: 'combined', path: '.env' }, dir)
    expect(result['PORT']).toBe('9999')
    delete process.env['PORT']
    cleanup()
  })
})
