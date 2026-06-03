import { writeFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import type { LoadedConfig } from '../config-loader'
import type { EnvGroupDef, EnvFieldDef, PlainEnvFieldDef } from 'envkit-core'
import { groupHeader, envEntry } from 'envkit-core'
import { fmt } from '../utils/format'

export async function runGenerate(loaded: LoadedConfig, outputPath?: string): Promise<void> {
  const { instance } = loaded
  const outFile = pathResolve(process.cwd(), outputPath ?? '.env.example')

  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const groups: EnvGroupDef[] = instance.groups as EnvGroupDef[]

  // Group entries
  const byGroup = new Map<string, Array<[string, EnvFieldDef<string>]>>()
  const ungrouped: Array<[string, EnvFieldDef<string>]> = []

  for (const [key, field] of Object.entries(schema)) {
    const groupSlug = (field as PlainEnvFieldDef<string>).group
    if (groupSlug) {
      const groupDef = groups.find((g) => g.slug === groupSlug)
      const groupName = groupDef?.name ?? groupSlug
      if (!byGroup.has(groupName)) byGroup.set(groupName, [])
      byGroup.get(groupName)!.push([key, field])
    } else {
      ungrouped.push([key, field])
    }
  }

  const sections: string[] = []

  for (const group of groups) {
    const entries = byGroup.get(group.name) ?? []
    if (entries.length === 0) continue

    const lines = [groupHeader(group.name, group.description)]
    for (const [key, field] of entries) {
      const plain = field as PlainEnvFieldDef<string>
      // Secrets: empty value with comment
      const value = plain.secret
        ? ''
        : plain.example ?? (plain.default !== undefined ? String(plain.default) : '')
      const commented = plain.secret
      lines.push(envEntry(key, field, value, commented))
    }
    sections.push(lines.join('\n\n'))
  }

  if (ungrouped.length > 0) {
    const lines = [groupHeader('Other')]
    for (const [key, field] of ungrouped) {
      const plain = field as PlainEnvFieldDef<string>
      const value = plain.secret
        ? ''
        : plain.example ?? (plain.default !== undefined ? String(plain.default) : '')
      const commented = plain.secret
      lines.push(envEntry(key, field, value, commented))
    }
    sections.push(lines.join('\n\n'))
  }

  const content = sections.join('\n\n\n') + '\n'
  writeFileSync(outFile, content, 'utf-8')

  const count = Object.keys(schema).length
  console.log()
  console.log(fmt.success(`Generated ${outFile} (${count} variable${count !== 1 ? 's' : ''})`))
  console.log()
}
