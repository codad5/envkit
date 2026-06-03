import { createInterface } from 'node:readline'
import { password, select, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import type { EnvFieldDef, PlainEnvFieldDef } from 'envkit-core'

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
      console.log(`  ${chalk.dim('â†³ ' + line)}`)
    }
  }

  if (hasExisting) {
    const keepIt = await confirm({
      message: `  Keep existing value${plain.secret ? '' : ` (${existing})`}?`,
      default: true,
    })
    if (keepIt) return { value: existing!, skipped: true }
  }

  // Inline enum â†’ select list
  if (Array.isArray(plain.type)) {
    const choices = plain.type.map((v) => ({ name: v, value: v }))
    const val = await select({
      message: `  ${key}`,
      choices,
      default: (plain.default as string | undefined) ?? plain.type[0],
    })
    return { value: val, skipped: false }
  }

  // Boolean â†’ confirm
  if (plain.type === 'boolean') {
    const val = await confirm({
      message: `  ${key}`,
      default: plain.default !== undefined ? Boolean(plain.default) : false,
    })
    return { value: String(val), skipped: false }
  }

  // Secret â†’ masked password input (inquirer handles masking)
  if (plain.secret) {
    const hints = buildHints(plain, { omitExample: true })
    if (hints) console.log(`  ${chalk.dim(hints)}`)

    const val = await password({
      message: `  ${chalk.cyan('>')} Enter value`,
      mask: '*',
    })

    console.log(`  ${chalk.green('âœ”')}  ${chalk.bold(key)}: ${chalk.dim('[hidden]')}`)
    if (!val && !plain.required) return { value: null, skipped: true }
    return { value: val, skipped: false }
  }

  // Plain text â€” use readline so the answer lands on its own line
  const hints = buildHints(plain)
  if (hints) console.log(`  ${chalk.dim(hints)}`)

  const defaultVal = plain.default !== undefined ? String(plain.default) : undefined
  if (defaultVal !== undefined) {
    console.log(`  ${chalk.dim(`default: ${defaultVal}`)}`)
  }
  if (plain.example) {
    console.log(`  ${chalk.dim(`e.g. ${plain.example}`)}`)
  }

  const val = await readLine(`  ${chalk.cyan('>')} `, defaultVal)

  const finalVal = val.trim() || defaultVal || null

  if (finalVal) {
    console.log(`  ${chalk.green('âœ”')}  ${chalk.bold(key)}: ${finalVal}`)
  } else {
    console.log(`  ${chalk.green('âœ”')}  ${chalk.bold(key)}: ${chalk.dim('(skipped)')}`)
  }

  if (!finalVal && plain.required) return { value: null, skipped: false }
  if (!finalVal) return { value: null, skipped: true }
  return { value: finalVal, skipped: false }
}

/** Read a single line from stdin with a prompt, resolving to the raw input (or defaultVal on empty) */
function readLine(prompt: string, defaultVal?: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function buildHints(
  field: PlainEnvFieldDef<string>,
  opts: { omitExample?: boolean } = {},
): string {
  const parts: string[] = []
  if (field.minLength !== undefined) parts.push(`min ${field.minLength} chars`)
  if (field.maxLength !== undefined) parts.push(`max ${field.maxLength} chars`)
  if (field.min !== undefined) parts.push(`min ${field.min}`)
  if (field.max !== undefined) parts.push(`max ${field.max}`)
  if (!opts.omitExample && field.example) parts.push(`e.g. ${field.example}`)
  return parts.join(' Â· ')
}
