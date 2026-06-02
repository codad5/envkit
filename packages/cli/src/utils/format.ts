import chalk from 'chalk'
import type { EnvFieldDef, PlainEnvFieldDef } from '@envkit/core'

const BAR = '='.repeat(77)

export function groupHeader(name: string, description?: string): string {
  const lines = [
    `# ${BAR}`,
    `# ${name}`,
  ]
  if (description) lines.push(`# ${description}`)
  lines.push(`# ${BAR}`)
  return lines.join('\n')
}

/** Format a single .env entry with comments */
export function envEntry(
  key: string,
  field: EnvFieldDef<string>,
  value: string | null | undefined,
  commented = false,
): string {
  const lines: string[] = []

  lines.push(`# ${field.description}`)

  const plain = field as PlainEnvFieldDef<string>

  if (plain.howToGet) {
    for (const line of plain.howToGet.split('\n')) {
      lines.push(`# HOW TO GET: ${line}`)
    }
  }

  if (Array.isArray(plain.type)) {
    lines.push(`# Options: ${plain.type.join(', ')}`)
  } else if (plain.type === 'boolean') {
    lines.push(`# Options: true, false`)
  }

  if ('required' in plain && !plain.required) {
    lines.push(`# OPTIONAL`)
  }

  let assignValue = value ?? ''

  // Wrap multiline values
  if (plain.multiline && assignValue) {
    assignValue = `"${assignValue}"`
  } else if (assignValue && !plain.multiline && /[\s#"'\\]/.test(assignValue) && !assignValue.startsWith('"')) {
    assignValue = `"${assignValue}"`
  }

  const assignment = `${key}=${assignValue}`
  lines.push(commented ? `# ${assignment}` : assignment)

  return lines.join('\n')
}

/** Format the full output file content */
export function buildEnvFileContent(
  groups: Array<{ name: string; description?: string }>,
  groupedEntries: Map<string, Array<{ key: string; field: EnvFieldDef<string>; value: string | null; commented: boolean }>>,
  ungrouped: Array<{ key: string; field: EnvFieldDef<string>; value: string | null; commented: boolean }>,
): string {
  const sections: string[] = []

  for (const group of groups) {
    const entries = groupedEntries.get(group.name) ?? []
    if (entries.length === 0) continue

    const lines = [groupHeader(group.name, group.description)]
    for (const e of entries) {
      lines.push(envEntry(e.key, e.field, e.value, e.commented))
    }
    sections.push(lines.join('\n\n'))
  }

  if (ungrouped.length > 0) {
    const lines = [groupHeader('Other')]
    for (const e of ungrouped) {
      lines.push(envEntry(e.key, e.field, e.value, e.commented))
    }
    sections.push(lines.join('\n\n'))
  }

  return sections.join('\n\n\n') + '\n'
}

// ── Terminal output helpers ────────────────────────────────────────────────────

export const fmt = {
  success: (msg: string) => chalk.green(`✔  ${msg}`),
  error: (msg: string) => chalk.red(`✗  ${msg}`),
  warn: (msg: string) => chalk.yellow(`⚠  ${msg}`),
  info: (msg: string) => chalk.cyan(msg),
  dim: (msg: string) => chalk.dim(msg),
  bold: (msg: string) => chalk.bold(msg),
  secret: () => chalk.dim('[secret]'),
  sectionHeader: (name: string) => chalk.bold.cyan(`\n  ── ${name} ──`),
}

export function truncate(value: string, maxLen = 60): string {
  return value.length > maxLen ? value.slice(0, maxLen) + '...' : value
}
