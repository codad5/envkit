# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-06-03

### Added
- `config.load()` return type is now inferred as sync or async based on the source — if the source's `load()` returns a `Promise`, `config.load()` returns `Promise<Env>` and TypeScript requires `await`; sync sources stay sync with no changes needed

### Fixed
- `await config.load()` now works correctly — the env proxy was throwing `ReferenceError: "then" is not defined` when JavaScript checked for a thenable. Proxy now returns `undefined` for `.then`, `.catch`, `.finally`, and symbol keys
- Example project missing `tsconfig.json` caused VS Code to show false "no declaration file" errors for `envkit-core`

## [0.2.0] - 2026-06-03

### Added
- `EnvSource` interface — minimum contract for any env source (`load()`)
- `WritableEnvSource` interface — extends `EnvSource` with `write(payload)` and `filePath`
- `WritePayload` type — carries `envs` (field definitions + collected values) and `groups` for rich formatting
- `EnvFieldWithValue` type — `EnvFieldDef` intersected with `{ value: string | null }`
- `fileSource({ path })` — reads from a `.env` file, writes formatted output with comments and group headers
- `processSource()` — reads from `process.env` only, read-only
- `combinedSource({ path })` — reads file + `process.env` override, writes to file; **recommended default**
- `LocalEnvSource` — alias for `combinedSource`, idiomatic for local development
- `isWritableSource(source)` — type guard narrowing `EnvSource` to `WritableEnvSource`
- `groupHeader()` and `envEntry()` exported from `envkit-core` (moved from CLI internals)
- `formatEnvFile(payload)` exported from `envkit-core` — renders a `WritePayload` to a formatted `.env` string

### Changed
- **Breaking:** `source` in `defineEnv()` now accepts `EnvSource` instead of `{ type, path? }` object literal
- **Breaking:** `EnvKitInstance.source` is now `EnvSource` instead of `SourceConfig`
- `WritableEnvSource.write()` receives a `WritePayload` (full field metadata + values) instead of bare `Record<string, string>` — sources produce formatted output themselves
- Formatting helpers (`groupHeader`, `envEntry`) moved from `envkit-cli` internals to `envkit-core` exports
- `envkit-core` is now a zero-dependency package — removed `dotenv` (`.env` parsing is built-in)
- Removed `.js` extensions from all internal imports (tsup bundler handles resolution)

### Removed
- `SourceConfig` and `SourceType` types (replaced by `EnvSource` / `WritableEnvSource`)
- `loadRawEnv()` function (replaced by `source.load()`)

### Fixed
- `envkit generate` now delegates to `source.write()` instead of always writing a flat `.env.example` — custom sources (e.g. JSON, Vault) receive the sample payload and produce their own example format
- `WritePayload` gains `mode: 'setup' | 'generate'` so sources can distinguish real values from sample/example output
- `WritePayload` gains optional `outputPath` to pass `--output` flag through to the source
- Built-in file sources derive the example path automatically: `.env` → `.env.example`, `env.json` → `env.example.json`
- `toExamplePath()` exported from `envkit-core` for use in custom source implementations

## [0.1.1] - 2025-06-03

### Changed
- Renamed CLI package from `envkit` to `envkit-cli` (binary command remains `envkit`)
- Renamed core package from `@envkit/core` to `envkit-core` (no org scope required)

### Fixed
- CI workflows: removed pnpm version pin — now reads from `packageManager` field automatically

## [0.1.0] - 2025-06-01

### Added
- `envkit-core`: `defineEnv()` with fully inferred TypeScript types — no annotations needed
- Plain field types: `string`, `number`, `boolean`, `url`, `json`, inline enum (`string[]`)
- Optional Zod schema support per field (`schema: z.string().email()`)
- Source config: `file`, `process`, `combined` (file + process.env override)
- `required`, `default`, `min`/`max`, `minLength`/`maxLength`, `pattern`, `secret`, `example`, `howToGet` field options
- Group organisation via `envGroups` — groups validated at the TypeScript level
- Computed / derived fields via `computed` — typed callbacks with full env inference
- Proxy that throws on unknown key access at runtime
- `envkit-cli`: interactive setup wizard (`envkit setup`)
- `envkit-cli`: schema validation command (`envkit validate`) — exits 1 on failure, CI-safe
- `envkit-cli`: `.env.example` generation (`envkit generate`)
- `envkit-cli`: diff command showing missing, extra, and invalid vars (`envkit diff`)
- `--config` flag on all CLI commands for non-default config file paths
- GitHub Actions CI workflow (test on push/PR to main/master)
- GitHub Actions publish workflow (publish on `v*` tags, npm Trusted Publishing ready)

### Fixed
- Computed callback `env` parameter was typed as `any` — now fully inferred from schema
- Inline enum `string[]` fields now support literal union inference with `as const`

[Unreleased]: https://github.com/codad5/envkit/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/codad5/envkit/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/codad5/envkit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/codad5/envkit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/codad5/envkit/releases/tag/v0.1.0
