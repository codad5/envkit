import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import type { LoadedConfig } from '../config-loader.js'
import type { EnvGroupDef, EnvFieldDef, PlainEnvFieldDef } from '@envkit/core'
import { parseEnvFile } from '@envkit/core'
import { promptForField } from '../utils/prompts.js'
import { fmt, groupHeader, envEntry } from '../utils/format.js'

export async function runSetup(loaded: LoadedConfig): Promise<void> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const groups = instance.groups as EnvGroupDef[]

  const source = instance.source
  const targetPath = resolve(process.cwd(), source.path ?? '.env')
  const existing = source.type !== 'process' ? parseEnvFile(targetPath) : {}
  const isCompletion = existsSync(targetPath)

  const totalVars = Object.keys(schema).length
  const pendingCount = Object.entries(schema).filter(([key]) => {
    const v = existing[key]
    return v === undefined || v === ''
  }).length

  console.log()
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════╗'))
  console.log(chalk.bold.cyan('║        envkit setup                      ║'))
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════╝'))
  console.log()
  console.log(`  ${fmt.bold('Target:')}  ${targetPath}`)
  console.log(`  ${fmt.bold('Mode:')}    ${isCompletion ? chalk.cyan('completion (filling missing vars)') : chalk.green('fresh setup')}`)
  console.log(`  ${fmt.bold('Total:')}   ${totalVars} variable${totalVars !== 1 ? 's' : ''}`)
  console.log(`  ${fmt.bold('To fill:')} ${pendingCount} variable${pendingCount !== 1 ? 's' : ''} need input`)
  console.log()

  if (pendingCount === 0) {
    console.log(fmt.success('All variables are already set. Use --force to re-ask.'))
    console.log()
    return
  }

  // Collect answers per key
  const answers = new Map<string, { value: string | null; skipped: boolean }>()

  // Group entries for ordered prompting
  const promptOrder: Array<[string, EnvFieldDef<string>]> = []

  // First pass: collect by group order
  const byGroupSlug = new Map<string, Array<[string, EnvFieldDef<string>]>>()
  const ungroupedEntries: Array<[string, EnvFieldDef<string>]> = []

  for (const [key, field] of Object.entries(schema)) {
    const slug = (field as PlainEnvFieldDef<string>).group
    if (slug) {
      if (!byGroupSlug.has(slug)) byGroupSlug.set(slug, [])
      byGroupSlug.get(slug)!.push([key, field])
    } else {
      ungroupedEntries.push([key, field])
    }
  }

  for (const group of groups) {
    const entries = byGroupSlug.get(group.slug) ?? []
    if (entries.length > 0) {
      console.log(fmt.sectionHeader(group.name))
      if (group.description) console.log(`  ${fmt.dim(group.description)}`)

      for (const [key, field] of entries) {
        const result = await promptForField(key, field, existing[key])
        answers.set(key, result)
      }
    }
  }

  if (ungroupedEntries.length > 0) {
    console.log(fmt.sectionHeader('Other'))
    for (const [key, field] of ungroupedEntries) {
      const result = await promptForField(key, field, existing[key])
      answers.set(key, result)
    }
  }

  // Build the output file
  const sections: string[] = []

  for (const group of groups) {
    const entries = byGroupSlug.get(group.slug) ?? []
    if (entries.length === 0) continue

    const lines = [groupHeader(group.name, group.description)]

    for (const [key, field] of entries) {
      const answer = answers.get(key)
      const plain = field as PlainEnvFieldDef<string>

      let value: string | null
      let commented: boolean

      if (answer) {
        value = answer.value
        commented = answer.skipped && !plain.required
      } else {
        value = existing[key] ?? (plain.default !== undefined ? String(plain.default) : null)
        commented = false
      }

      if ((value === null || value === '') && !plain.required) {
        commented = true
        value = plain.example ?? (plain.default !== undefined ? String(plain.default) : '')
      }

      lines.push(envEntry(key, field, value ?? '', commented))
    }

    sections.push(lines.join('\n\n'))
  }

  if (ungroupedEntries.length > 0) {
    const lines = [groupHeader('Other')]

    for (const [key, field] of ungroupedEntries) {
      const answer = answers.get(key)
      const plain = field as PlainEnvFieldDef<string>

      const value = answer?.value ?? existing[key] ?? (plain.default !== undefined ? String(plain.default) : null)
      const commented = (answer?.skipped ?? false) && !plain.required

      lines.push(envEntry(key, field, value ?? '', commented))
    }

    sections.push(lines.join('\n\n'))
  }

  const content = sections.join('\n\n\n') + '\n'
  writeFileSync(targetPath, content, 'utf-8')

  console.log()
  console.log(fmt.success(`Written to ${targetPath} (${totalVars} variable${totalVars !== 1 ? 's' : ''})`))

  // Report still-missing required vars
  const stillMissing: string[] = []
  for (const [key, field] of Object.entries(schema)) {
    if (!(field as any).required) continue
    const answer = answers.get(key)
    const val = answer ? answer.value : existing[key]
    if (!val) stillMissing.push(key)
  }

  if (stillMissing.length > 0) {
    console.log()
    console.log(fmt.warn(`${stillMissing.length} required variable${stillMissing.length > 1 ? 's' : ''} still not set:`))
    for (const key of stillMissing) {
      console.log(`  ${fmt.error(key)}`)
    }
    console.log()
    console.log(fmt.dim('  Run again or edit the file directly to fill these in.'))
  }

  console.log()
}
