import { input, password, select, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import type { EnvFieldDef, PlainEnvFieldDef } from '@envkit/core'

export interface PromptResult {
  value: string | null
  skipped: boolean
}

/** Build an appropriate prompt for a single env variable */
export async function promptForField(
  key: string,
  field: EnvFieldDef<string>,
  existing: string | undefined,
): Promise<PromptResult> {
  const plain = field as PlainEnvFieldDef<string>
  const hasExisting = existing !== undefined && existing !== ''

  console.log()
  console.log(`  ${chalk.bold(key)}${field.required === false ? chalk.dim(' [optional]') : chalk.red(' [required]')}`)
  console.log(`  ${chalk.dim(field.description)}`)

  if ('howToGet' in plain && plain.howToGet) {
    for (const line of plain.howToGet.split('\n')) {
      console.log(`  ${chalk.dim('↳ ' + line)}`)
    }
  }

  if (hasExisting) {
    const keepIt = await confirm({
      message: `  Keep existing value${plain.secret ? '' : ` (${existing})`}?`,
      default: true,
    })
    if (keepIt) return { value: existing!, skipped: true }
  }

  // Inline enum → select list
  if (Array.isArray(plain.type)) {
    const choices = plain.type.map((v) => ({ name: v, value: v }))
    const val = await select({
      message: `  ${key}`,
      choices,
      default: (plain.default as string | undefined) ?? plain.type[0],
    })
    return { value: val, skipped: false }
  }

  // Boolean → confirm
  if (plain.type === 'boolean') {
    const val = await confirm({
      message: `  ${key}`,
      default: plain.default !== undefined ? Boolean(plain.default) : false,
    })
    return { value: String(val), skipped: false }
  }

  // Secret → masked input
  if (plain.secret) {
    const hints = buildHints(plain)
    if (hints) console.log(`  ${chalk.dim(hints)}`)

    const val = await password({
      message: `  ${key}`,
      mask: '*',
    })

    if (!val && !plain.required) return { value: null, skipped: true }
    return { value: val, skipped: false }
  }

  // Default: text input
  const hints = buildHints(plain)
  if (hints) console.log(`  ${chalk.dim(hints)}`)

  const defaultVal = plain.default !== undefined ? String(plain.default) : undefined
  const exampleHint = plain.example ? ` e.g. ${plain.example}` : ''

  const val = await input({
    message: `  ${key}${exampleHint}`,
    default: defaultVal,
  })

  if (!val && !plain.required) return { value: null, skipped: true }
  return { value: val || null, skipped: !val }
}

function buildHints(field: PlainEnvFieldDef<string>): string {
  const parts: string[] = []
  if (field.minLength !== undefined) parts.push(`min ${field.minLength} chars`)
  if (field.maxLength !== undefined) parts.push(`max ${field.maxLength} chars`)
  if (field.min !== undefined) parts.push(`min ${field.min}`)
  if (field.max !== undefined) parts.push(`max ${field.max}`)
  if (field.example) parts.push(`e.g. ${field.example}`)
  return parts.join(' · ')
}
