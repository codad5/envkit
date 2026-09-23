import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { defineEnv, fileSource } from 'envkit-core'
import type { LoadedConfig } from '../config-loader'
import { runValidate } from '../commands/validate'

function tmpEnvFile(content: string): string {
  const dir = join(tmpdir(), 'envkit-cli-validate-' + Date.now() + '-' + Math.random().toString(36).slice(2))
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
      API_KEY: {
        type: 'string',
        description: 'API key',
        required: true,
        secret: true,
      },
      PORT: {
        type: 'number',
        description: 'Port',
        required: false,
        default: 3000,
      },
    },
  })
  return { instance: instance as any, configPath: envFilePath }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runValidate', () => {
  it('returns true for a fully valid .env (human-readable path)', async () => {
    const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nAPI_KEY=secret123\n')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runValidate(loadedConfigFor(path))
    expect(ok).toBe(true)
  })

  it('returns false when a required variable is missing', async () => {
    const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\n')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runValidate(loadedConfigFor(path))
    expect(ok).toBe(false)
  })

  describe('--json', () => {
    it('prints a JSON object with success: true, no errors, and parsed values', async () => {
      const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nAPI_KEY=secret123\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runValidate(loadedConfigFor(path), { json: true })
      expect(ok).toBe(true)

      expect(logSpy).toHaveBeenCalledTimes(1)
      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.success).toBe(true)
      expect(printed.errors).toEqual([])
      expect(printed.values.DATABASE_URL).toBe('postgresql://localhost/db')
      expect(printed.values.PORT).toBe(3000)
    })

    it('masks secret fields as "[secret]" instead of the real value', async () => {
      const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nAPI_KEY=super-secret-value\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await runValidate(loadedConfigFor(path), { json: true })

      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.values.API_KEY).toBe('[secret]')
      expect(JSON.stringify(printed)).not.toContain('super-secret-value')
    })

    it('reports success: false, errors, and null values for failing keys', async () => {
      const path = tmpEnvFile('DATABASE_URL=mysql://localhost/db\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const ok = await runValidate(loadedConfigFor(path), { json: true })
      expect(ok).toBe(false)

      const printed = JSON.parse(logSpy.mock.calls[0]![0] as string)
      expect(printed.success).toBe(false)
      expect(printed.errors.some((e: any) => e.key === 'DATABASE_URL')).toBe(true)
      expect(printed.errors.some((e: any) => e.key === 'API_KEY')).toBe(true)
      expect(printed.values.DATABASE_URL).toBeNull()
      expect(printed.values.API_KEY).toBeNull()
    })

    it('prints exactly one line of output (no human-readable noise mixed in)', async () => {
      const path = tmpEnvFile('DATABASE_URL=postgresql://localhost/db\nAPI_KEY=x\n')
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await runValidate(loadedConfigFor(path), { json: true })

      expect(logSpy).toHaveBeenCalledTimes(1)
    })
  })
})
