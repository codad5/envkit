import { describe, it, expect } from 'vitest'
import { groupHeader, envEntry } from '../utils/format.js'
import type { EnvFieldDef } from '@envkit/core'

describe('groupHeader', () => {
  it('renders the group name between bars', () => {
    const out = groupHeader('Server Configuration')
    expect(out).toContain('# Server Configuration')
    expect(out).toContain('# ===')
  })

  it('includes optional description', () => {
    const out = groupHeader('Database', 'DB settings')
    expect(out).toContain('# DB settings')
  })
})

describe('envEntry', () => {
  const field: EnvFieldDef<string> = {
    type: 'string',
    description: 'PostgreSQL connection string',
    required: true,
  }

  it('renders key=value', () => {
    const out = envEntry('DATABASE_URL', field, 'postgres://localhost/db')
    expect(out).toContain('DATABASE_URL=postgres://localhost/db')
  })

  it('renders description as comment', () => {
    const out = envEntry('DATABASE_URL', field, 'x')
    expect(out).toContain('# PostgreSQL connection string')
  })

  it('comments out the assignment when commented=true', () => {
    const out = envEntry('DATABASE_URL', field, 'x', true)
    expect(out).toContain('# DATABASE_URL=x')
  })

  it('renders OPTIONAL comment for non-required field', () => {
    const optField: EnvFieldDef<string> = {
      type: 'string',
      description: 'Optional value',
      required: false,
    }
    const out = envEntry('OPT', optField, '')
    expect(out).toContain('# OPTIONAL')
  })

  it('renders enum options as comment', () => {
    const enumField: EnvFieldDef<string> = {
      type: ['dev', 'prod'],
      description: 'Env',
      required: true,
    }
    const out = envEntry('NODE_ENV', enumField, 'dev')
    expect(out).toContain('# Options: dev, prod')
  })

  it('wraps values with spaces in quotes', () => {
    const out = envEntry('DESC', field, 'hello world')
    expect(out).toContain('DESC="hello world"')
  })

  it('renders howToGet hint when present', () => {
    const fieldWithHint: EnvFieldDef<string> = {
      type: 'string',
      description: 'API key',
      required: true,
      howToGet: 'Get from dashboard → API Keys',
    }
    const out = envEntry('API_KEY', fieldWithHint, 'abc')
    expect(out).toContain('# HOW TO GET: Get from dashboard → API Keys')
  })
})
