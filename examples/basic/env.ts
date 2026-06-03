import config from './envkit.config.js'
import JsonConfig from "./envkit.json.config";
import asyncJsonConfig from "./envkit.async.config";

// Validates all variables at module load time.
// Throws with a clear message if anything is missing or wrong.
export const env = config.load()
export const jsonEnv = JsonConfig.load()
export const asyncJsonEnv = await asyncJsonConfig.load()


console.log('Loaded environment variables from envkit.config.ts:')
console.log(env)
console.log(env.NODE_ENV)  // Computed fields are available on the loaded env object
console.log(env.IS_PRODUCTION)

console.log('\nLoaded environment variables from envkit.json.config.ts:')
console.log(jsonEnv)

console.log('\nLoaded environment variables from envkit.async.config.ts:')
console.log(asyncJsonEnv)

