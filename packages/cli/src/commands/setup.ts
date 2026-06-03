import { existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import type { LoadedConfig } from '../config-loader'
import type { EnvGroupDef, EnvFieldDef, PlainEnvFieldDef, EnvFieldWithValue } from 'envkit-core'
import { parseEnvFile, isWritableSource } from 'envkit-core'
import { promptForField } from '../utils/prompts'
import { fmt } from '../utils/format'

export async function runSetup(loaded: LoadedConfig): Promise<void> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const groups = instance.groups as EnvGroupDef[]
  const source = instance.source

  if (!isWritableSource(source)) {
    console.log()
    console.log(fmt.error('This source does not support the setup wizard.'))
    console.log(fmt.dim('  The configured source is read-only (no write() method).'))
    console.log(fmt.dim('  Implement WritableEnvSource in your custom source, or use fileSource() / combinedSource().'))
    console.log()
    process.exit(1)
  }

  const targetPath = resolve(process.cwd(), source.filePath)
  const existing = parseEnvFile(targetPath)
  const isCompletion = existsSync(targetPath)

  const totalVars = Object.keys(schema).length
  const pendingCount = Object.entries(schema).filter(([key]) => {
    const v = existing[key]
    return v === undefined || v === ''
  }).length

  console.log()
  console.log(chalk.bold.cyan('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—'))
  console.log(chalk.bold.cyan('â•‘        envkit setup                      â•‘'))
  console.log(chalk.bold.cyan('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•'))
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

  // â”€â”€ Prompt for each field in group order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const answers = new Map<string, string | null>()

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
    if (entries.length === 0) continue

    console.log(fmt.sectionHeader(group.name))
    if (group.description) console.log(`  ${fmt.dim(group.description)}`)

    for (const [key, field] of entries) {
      const { value } = await promptForField(key, field, existing[key])
      answers.set(key, value)
    }
  }

  if (ungroupedEntries.length > 0) {
    console.log(fmt.sectionHeader('Other'))
    for (const [key, field] of ungroupedEntries) {
      const { value } = await promptForField(key, field, existing[key])
      answers.set(key, value)
    }
  }

  // â”€â”€ Build WritePayload and delegate to source â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const envs: Record<string, EnvFieldWithValue> = {}
  for (const [key, field] of Object.entries(schema)) {
    const plain = field as PlainEnvFieldDef<string>
    const answered = answers.get(key) ?? existing[key] ?? null
    const value = answered !== '' ? answered : (plain.default !== undefined ? String(plain.default) : null)
    envs[key] = { ...field, value }
  }

  await Promise.resolve(source.write({ envs, groups, mode: 'setup' }))

  console.log()
  console.log(fmt.success(`Written to ${targetPath} (${totalVars} variable${totalVars !== 1 ? 's' : ''})`))

  // Report still-missing required vars
  const stillMissing = Object.entries(schema)
    .filter(([key, field]) => (field as any).required && !envs[key]?.value)
    .map(([key]) => key)

  if (stillMissing.length > 0) {
    console.log()
    console.log(fmt.warn(`${stillMissing.length} required variable${stillMissing.length > 1 ? 's' : ''} still not set:`))
    for (const key of stillMissing) console.log(`  ${fmt.error(key)}`)
    console.log()
    console.log(fmt.dim('  Run again or edit the file directly to fill these in.'))
  }

  console.log()
}
