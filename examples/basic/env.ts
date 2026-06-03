import config from './envkit.config.js'

// Validates all variables at module load time.
// Throws with a clear message if anything is missing or wrong.
export const env = config.load()


console.log('Loaded environment variables:')
console.log(env)
console.log(env.NODE_ENV)  // Computed fields are available on the loaded env object