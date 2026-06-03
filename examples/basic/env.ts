import config from './envkit.config'
import jsonConfig from './envkit.json.config'
import asyncConfig from './envkit.async.config'

// ── Sync sources — no await needed ───────────────────────────────────────────
export const env     = config.load()
export const jsonEnv = jsonConfig.load()

// ── Async source — await required (TypeScript enforces this) ─────────────────
export const asyncEnv = await asyncConfig.load()

// ── envkit.config.ts (LocalEnvSource — reads .env) ───────────────────────────
console.log('── envkit.config.ts ──────────────────────────────')
console.log('NODE_ENV        :', env.NODE_ENV)
console.log('PORT            :', env.PORT)
console.log('--- computed ---')
console.log('IS_PRODUCTION   :', env.IS_PRODUCTION)
console.log('IS_DEVELOPMENT  :', env.IS_DEVELOPMENT)
console.log('DATABASE_URL_SAFE:', env.DATABASE_URL_SAFE)
console.log('CORS_ORIGIN     :', env.CORS_ORIGIN)
console.log('OAUTH_ENABLED   :', env.OAUTH_ENABLED)

// ── envkit.json.config.ts (custom jsonSource — reads env.json) ────────────────
console.log('\n── envkit.json.config.ts ─────────────────────────')
console.log('NODE_ENV        :', jsonEnv.NODE_ENV)
console.log('PORT            :', jsonEnv.PORT)
console.log('--- computed ---')
console.log('IS_PRODUCTION   :', jsonEnv.IS_PRODUCTION)
console.log('IS_DEVELOPMENT  :', jsonEnv.IS_DEVELOPMENT)
console.log('DB_HOST         :', jsonEnv.DB_HOST)
console.log('SERVER_ADDRESS  :', jsonEnv.SERVER_ADDRESS)

// ── envkit.async.config.ts (async source — reads env.json asynchronously) ────
console.log('\n── envkit.async.config.ts (async source) ─────────')
console.log('NODE_ENV        :', asyncEnv.NODE_ENV)
console.log('PORT            :', asyncEnv.PORT)
console.log('--- computed ---')
console.log('IS_PRODUCTION   :', asyncEnv.IS_PRODUCTION)
console.log('IS_DEVELOPMENT  :', asyncEnv.IS_DEVELOPMENT)
console.log('DB_HOST         :', asyncEnv.DB_HOST)
console.log('SERVER_ADDRESS  :', asyncEnv.SERVER_ADDRESS)
