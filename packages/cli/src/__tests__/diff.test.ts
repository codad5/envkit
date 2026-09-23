import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { defineEnv, fileSource } from 'envkit-core'
import type { LoadedConfig } from '../config-loader'
import { runDiff } from '../commands/diff'

function tmpEnvFile(content: string): string {
  const dir = join(tmpdir(), 'envkit-cli-diff-' + Date.now() + '-' + Math.random().toString(36).slice(2))
  mkdirSync(dir, { recursive: true })
  const path = join(dir, '.env')
  writeFileSync(path, content, 'utf-8')
  return path
}

function loadedConfigFor(envFilePath: string): LoadedConfig {
  const instance = defineEnv({
    source: fileSource({ path: envFilePath }),
    envSchema: {
      DATABASE_URL: {
        type: 'string',
        description: 'Database URL',
        required: true,
        pattern: '^postgresql://',
      },
    },
  })
  return { instance: instance as any, configPath: envFilePath }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runDiff', () => {
  it('returns true and reports no diff for a matching .env', async () => {
    const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\n')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runDiff(loadedConfigFor(path))
    expect(ok).toBe(true)
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('No diff'))).toBe(true)
  })

  it('returns false when a required variable is missing', async () => {
    const path = tmpEnvFile('')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runDiff(loadedConfigFor(path))
    expect(ok).toBe(false)
  })

  it('returns false when a variable fails validation', async () => {
    const path = tmpEnvFile('DATABASE_URL=mysql://localhost/db\n')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runDiff(loadedConfigFor(path))
    expect(ok).toBe(false)
  })

  it('returns true when only extra (undeclared) keys are present', async () => {
    const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nOLD_LEGACY_KEY=x\n')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runDiff(loadedConfigFor(path))
    expect(ok).toBe(true)
  })

  describe('--json', () => {
    it('reports clean: true with empty arrays for a matching .env, and returns true', async () => {
      const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runDiff(loadedConfigFor(path), { json: true })

      expect(logSpy).toHaveBeenCalledTimes(1)
      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed).toEqual({ clean: true, missing: [], extra: [], invalid: [] })
      expect(ok).toBe(true)
    })

    it('reports missing required variables and returns false (so the CLI still exits 1 under --json)', async () => {
      const path = tmpEnvFile('')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runDiff(loadedConfigFor(path), { json: true })

      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.clean).toBe(false)
      expect(printed.missing).toEqual(['DATABASE_URL'])
      expect(printed.extra).toEqual([])
      expect(printed.invalid).toEqual([])
      expect(ok).toBe(false)
    })

    it('reports invalid variables with their message and returns false', async () => {
      const path = tmpEnvFile('DATABASE_URL=mysql://localhost/db\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runDiff(loadedConfigFor(path), { json: true })

      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.clean).toBe(false)
      expect(printed.missing).toEqual([])
      expect(printed.invalid).toHaveLength(1)
      expect(printed.invalid[0].key).toBe('DATABASE_URL')
      expect(typeof printed.invalid[0].message).toBe('string')
      expect(ok).toBe(false)
    })

    it('reports extra (undeclared) keys as clean: true, and returns true — extra alone is a warning, not a failure', async () => {
      const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nOLD_LEGACY_KEY=x\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runDiff(loadedConfigFor(path), { json: true })

      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.missing).toEqual([])
      expect(printed.invalid).toEqual([])
      expect(printed.extra).toEqual(['OLD_LEGACY_KEY'])
      expect(printed.clean).toBe(true)
      expect(ok).toBe(true)
    })
  })
})
