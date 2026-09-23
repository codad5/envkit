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

/**
 * Wraps server-visibility env data (serverEnv) in a Proxy that throws on ANY
 * property access once `typeof window !== 'undefined'`.
 *
 * This is a fail-fast guard against the mistake of importing `serverEnv` into
 * client-reachable code, not a confidentiality boundary: if a secret's value
 * is already present in a browser-executed module (i.e. this proxy exists
 * with real data in that scope at all), it is already in the shipped bundle
 * and readable via devtools (heap snapshot, a breakpoint on this trap, etc.)
 * regardless of what the trap does. The actual protection is upstream —
 * `serverEnv` must never be imported by code that ends up in a client bundle
 * in the first place. This proxy only turns that mistake into an immediate,
 * loud crash instead of a silent leak that ships unnoticed.
 */
export function createServerEnvProxy<T extends Record<string, unknown>>(data: T): T {
  return new Proxy(data, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
      // Read via globalThis rather than the bare `window` identifier — this
      // package has no DOM lib (core has no browser dependency), and the check
      // must hold whether or not DOM types happen to be present for a consumer.
      if (typeof (globalThis as { window?: unknown }).window !== 'undefined') {
        throw new ReferenceError(
          `[envkit] "${String(prop)}" is a server-only variable and cannot be read in the browser. ` +
          `Mark it \`visibility: 'public'\` in your schema and read it from \`publicEnv\` instead.`
        )
      }
      if (prop in target) return target[prop]
      throw new ReferenceError(
        `[envkit] Env variable "${String(prop)}" is not defined in your schema. ` +
        `Add it to envkit.config.ts or check for a typo.`
      )
    },
  }) as T
}
