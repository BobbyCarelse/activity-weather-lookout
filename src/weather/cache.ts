interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CachedFunction<Args extends unknown[], T> {
  (...args: Args): Promise<T>;
  /** Test-only escape hatch — the cache is otherwise module-level state with no natural reset point. */
  clearCache(): void;
}

/**
 * Wraps an async function with a per-key TTL cache. A rejection is never
 * cached — only successful results are worth reusing, so a transient
 * failure can always be retried on the next call.
 */
export function withTtlCache<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  ttlMs: number,
  keyFn: (...args: Args) => string,
): CachedFunction<Args, T> {
  const store = new Map<string, CacheEntry<T>>();

  const cached = (async (...args: Args): Promise<T> => {
    const key = keyFn(...args);
    const entry = store.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      return entry.value;
    }

    const value = await fn(...args);
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }) as CachedFunction<Args, T>;

  cached.clearCache = () => store.clear();

  return cached;
}
