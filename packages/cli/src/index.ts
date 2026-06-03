// Ensure UTF-8 output on Windows so Unicode symbols render correctly
if (process.platform === 'win32') {
  process.stdout.setDefaultEncoding('utf8')
  process.stderr.setDefaultEncoding('utf8')
}

import { Command } from 'commander'
import { resolveConfigPath, loadConfig } from './config-loader'
import { runValidate } from './commands/validate'
import { runGenerate } from './commands/generate'
import { runDiff } from './commands/diff'
import { runSetup } from './commands/setup'

const program = new Command()

program
  .name('envkit')
  .description('Typed environment variable management')
  .version('0.1.0')

// Shared --config option helper
function withConfig(cmd: Command): Command {
  return cmd.option('-c, --config <path>', 'Path to envkit config file')
}

// â”€â”€ setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

withConfig(program.command('setup'))
  .description('Interactive wizard to create or complete your .env file')
  .action(async (opts: { config?: string }) => {
    try {
      const configPath = resolveConfigPath(opts.config)
      const loaded = await loadConfig(configPath)
      await runSetup(loaded)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }
  })

// â”€â”€ validate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

withConfig(program.command('validate'))
  .description('Validate the current .env file against the schema')
  .action(async (opts: { config?: string }) => {
    try {
      const configPath = resolveConfigPath(opts.config)
      const loaded = await loadConfig(configPath)
      const ok = await runValidate(loaded)
      if (!ok) process.exit(1)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }
  })

// â”€â”€ generate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

withConfig(program.command('generate'))
  .description('Generate a .env.example file from the schema')
  .option('-o, --output <path>', 'Output file path', '.env.example')
  .action(async (opts: { config?: string; output?: string }) => {
    try {
      const configPath = resolveConfigPath(opts.config)
      const loaded = await loadConfig(configPath)
      await runGenerate(loaded, opts.output)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }
  })

// â”€â”€ diff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

withConfig(program.command('diff'))
  .description('Show missing, extra, and invalid variables compared to the schema')
  .action(async (opts: { config?: string }) => {
    try {
      const configPath = resolveConfigPath(opts.config)
      const loaded = await loadConfig(configPath)
      await runDiff(loaded)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }
  })

program.parse()
