import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { SourceConfig } from './types.js'

/** Parse a .env file into a key→value map */
export function parseEnvFile(filePath: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!existsSync(filePath)) return map

  const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue }
    if (!line.includes('=')) { i++; continue }

    const eqIdx = line.indexOf('=')
    const key = line.slice(0, eqIdx).trim()
    let val = line.slice(eqIdx + 1)

    // Handle multiline double-quoted values
    if (val.startsWith('"') && !val.slice(1).includes('"')) {
      const parts = [val]
      i++
      while (i < lines.length) {
        parts.push(lines[i]!)
        if (lines[i]!.endsWith('"')) break
        i++
      }
      val = parts.join('\n')
    }

    val = val.trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }

    if (key) map[key] = val
    i++
  }

  return map
}

/** Load raw env vars according to the source config */
export function loadRawEnv(source: SourceConfig, cwd = process.cwd()): Record<string, string> {
  if (source.type === 'process') {
    return filterStringValues(process.env)
  }

  const filePath = resolve(cwd, source.path ?? '.env')

  if (source.type === 'file') {
    return parseEnvFile(filePath)
  }

  // combined: file values first, process.env overrides
  const fileVars = parseEnvFile(filePath)
  return { ...fileVars, ...filterStringValues(process.env) }
}

function filterStringValues(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}
