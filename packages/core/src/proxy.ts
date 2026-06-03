/**
 * Wraps validated env data in a Proxy so that accesses to unknown keys
 * throw a descriptive error rather than returning undefined silently.
 */
export function createEnvProxy<T extends Record<string, unknown>>(data: T): T {
  return new Proxy(data, {
    get(target, prop: string | symbol) {
      // Allow symbol probes (e.g. Symbol.toPrimitive) and Promise thenable
      // detection (.then / .catch / .finally) to return undefined rather than
      // throwing — otherwise `await env` or Promise.resolve(env) breaks.
      if (typeof prop === 'symbol') return undefined
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
      if (prop in target) return target[prop]
      throw new ReferenceError(
        `[envkit] Env variable "${prop}" is not defined in your schema. ` +
        `Add it to envkit.config.ts or check for a typo.`
      )
    },
  }) as T
}
