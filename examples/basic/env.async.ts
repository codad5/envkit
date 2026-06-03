import config from './envkit.async.config'

// TypeScript infers that config.load() returns Promise<Env> because the source
// has an async load(). The await here is required — TS will error without it.
//
// Top-level await works in ESM ("type": "module" in package.json).
// CJS users need an async init wrapper instead.
export const env = await config.load()

// env is fully typed — same inference as the sync case:
//   env.NODE_ENV  →  'development' | 'staging' | 'production'
//   env.PORT      →  number
//   env.DATABASE_URL → string
//   env.IS_PRODUCTION → boolean  (computed)

console.log('Loaded async environment:')
console.log('NODE_ENV:', env.NODE_ENV)
console.log('IS_PRODUCTION:', env.IS_PRODUCTION)
