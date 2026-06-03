import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveConfigPath } from '../config-loader'

function tmpDir() {
  const dir = join(tmpdir(), 'envkit-cli-test-' + Date.now())
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('resolveConfigPath', () => {
  it('finds envkit.config.ts by default', () => {
    const dir = tmpDir()
    writeFileSync(join(dir, 'envkit.config.ts'), '', 'utf-8')
    const found = resolveConfigPath(undefined, dir)
    expect(found).toContain('envkit.config.ts')
  })

  it('finds envkit.config.js as fallback', () => {
    const dir = tmpDir()
    writeFileSync(join(dir, 'envkit.config.js'), '', 'utf-8')
    const found = resolveConfigPath(undefined, dir)
    expect(found).toContain('envkit.config.js')
  })

  it('uses explicit --config path', () => {
    const dir = tmpDir()
    const custom = join(dir, 'my-config.ts')
    writeFileSync(custom, '', 'utf-8')
    const found = resolveConfigPath(custom, dir)
    expect(found).toBe(custom)
  })

  it('throws when config file not found', () => {
    const dir = tmpDir()
    expect(() => resolveConfigPath(undefined, dir)).toThrow()
  })

  it('throws when explicit config path does not exist', () => {
    expect(() => resolveConfigPath('/non/existent/config.ts')).toThrow()
  })
})
