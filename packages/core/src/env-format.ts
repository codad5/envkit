import type { EnvFieldDef, PlainEnvFieldDef, EnvGroupDef } from './types'

export type EnvFieldWithValue = EnvFieldDef<string> & { value: string | null }

export interface WritePayload {
  envs: Record<string, EnvFieldWithValue>
  groups: EnvGroupDef[]
}

const BAR = '='.repeat(77)

export function groupHeader(name: string, description?: string): string {
  const lines = [`# ${BAR}`, `# ${name}`]
  if (description) lines.push(`# ${description}`)
  lines.push(`# ${BAR}`)
  return lines.join('\n')
}

export function envEntry(
  key: string,
  field: EnvFieldDef<string>,
  value: string | null | undefined,
  commented = false,
): string {
  const lines: string[] = []
  const plain = field as PlainEnvFieldDef<string>

  lines.push(`# ${field.description}`)

  if (plain.howToGet) {
    for (const line of plain.howToGet.split('\n')) {
      lines.push(`# HOW TO GET: ${line}`)
    }
  }

  if (Array.isArray(plain.type)) {
    lines.push(`# Options: ${(plain.type as readonly string[]).join(', ')}`)
  } else if (plain.type === 'boolean') {
    lines.push(`# Options: true, false`)
  }

  if ('required' in plain && !plain.required) {
    lines.push(`# OPTIONAL`)
  }

  let assignValue = value ?? ''

  if (plain.multiline && assignValue) {
    assignValue = `"${assignValue}"`
  } else if (assignValue && !plain.multiline && /[\s#"'\\]/.test(assignValue) && !assignValue.startsWith('"')) {
    assignValue = `"${assignValue}"`
  }

  const assignment = `${key}=${assignValue}`
  lines.push(commented ? `# ${assignment}` : assignment)

  return lines.join('\n')
}

/** Render a full formatted .env file from a WritePayload. */
export function formatEnvFile(payload: WritePayload): string {
  const { envs, groups } = payload

  const byGroupSlug = new Map<string, Array<[string, EnvFieldWithValue]>>()
  const ungrouped: Array<[string, EnvFieldWithValue]> = []

  for (const [key, field] of Object.entries(envs)) {
    const slug = (field as PlainEnvFieldDef<string>).group
    if (slug) {
      if (!byGroupSlug.has(slug)) byGroupSlug.set(slug, [])
      byGroupSlug.get(slug)!.push([key, field])
    } else {
      ungrouped.push([key, field])
    }
  }

  const sections: string[] = []

  for (const group of groups) {
    const entries = byGroupSlug.get(group.slug) ?? []
    if (entries.length === 0) continue

    const lines = [groupHeader(group.name, group.description)]
    for (const [key, field] of entries) {
      const plain = field as PlainEnvFieldDef<string>
      const hasValue = field.value !== null && field.value !== ''
      const commented = !hasValue && !plain.required

      const displayValue = hasValue
        ? field.value!
        : plain.example ?? (plain.default !== undefined ? String(plain.default) : '')

      lines.push(envEntry(key, field, displayValue, commented))
    }
    sections.push(lines.join('\n\n'))
  }

  if (ungrouped.length > 0) {
    const lines = [groupHeader('Other')]
    for (const [key, field] of ungrouped) {
      const plain = field as PlainEnvFieldDef<string>
      const hasValue = field.value !== null && field.value !== ''
      const commented = !hasValue && !plain.required

      const displayValue = hasValue
        ? field.value!
        : plain.example ?? (plain.default !== undefined ? String(plain.default) : '')

      lines.push(envEntry(key, field, displayValue, commented))
    }
    sections.push(lines.join('\n\n'))
  }

  return sections.join('\n\n\n') + '\n'
}
