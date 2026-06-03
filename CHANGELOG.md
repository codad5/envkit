# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/codad5/envkit/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/codad5/envkit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/codad5/envkit/releases/tag/v0.1.0
