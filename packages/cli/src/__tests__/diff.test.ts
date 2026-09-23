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
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const ok = await runDiff(loadedConfigFor(path))
    expect(ok).toBe(true)
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
})
