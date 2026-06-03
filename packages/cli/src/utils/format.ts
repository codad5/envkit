import chalk from 'chalk'

// ── Terminal output helpers ───────────────────────────────────────────────────

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
