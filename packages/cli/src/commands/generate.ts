import { resolve as pathResolve } from 'node:path'
import type { LoadedConfig } from '../config-loader'
import type { EnvGroupDef, EnvFieldDef, PlainEnvFieldDef, EnvFieldWithValue } from 'envkit-core'
import { isWritableSource, fileSource, toExamplePath } from 'envkit-core'
import { fmt } from '../utils/format'

export async function runGenerate(loaded: LoadedConfig, outputPath?: string): Promise<void> {
  const { instance } = loaded
  const schema = instance.schema as Record<string, EnvFieldDef<string>>
  const groups = instance.groups as EnvGroupDef[]
  const source = instance.source

  // Build envs with example/sample values — secrets get null (commented out in output)
  const envs: Record<string, EnvFieldWithValue> = {}
  for (const [key, field] of Object.entries(schema)) {
    const plain = field as PlainEnvFieldDef<string>
    const value = plain.secret
      ? null
      : plain.example ?? (plain.default !== undefined ? String(plain.default) : null)
    envs[key] = { ...field, value }
  }

  const payload = { envs, groups, mode: 'generate' as const, outputPath }

  // Delegate to source — it knows how to format and where to write its example file.
  // Fall back to fileSource for read-only sources (e.g. processSource).
  const writer = isWritableSource(source) ? source : fileSource()
  await Promise.resolve(writer.write(payload))

  // Resolve the actual output path for the success message
  const writtenPath = outputPath
    ?? pathResolve(process.cwd(), toExamplePath(isWritableSource(writer) ? writer.filePath : '.env'))

  const count = Object.keys(schema).length
  console.log()
  console.log(fmt.success(`Generated ${writtenPath} (${count} variable${count !== 1 ? 's' : ''})`))
  console.log()
}
