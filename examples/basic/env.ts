import config from './envkit.config.js'

// Validates all variables at module load time.
// Throws with a clear message if anything is missing or wrong.
export const env = config.load()
