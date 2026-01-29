export function memoize<T>(factory: (key: string) => T) {
  const cache = new Map<string, T>();

  return (key: string) => {
    let value = cache.get(key);
    if (!value) {
      value = factory(key);
      cache.set(key, value);
    }
    return value;
  };
}

export function weakMemoize<K extends WeakKey, T>(factory: (key: K) => T) {
  const cache = new WeakMap<K, T>();

  return (key: K) => {
    let value = cache.get(key);
    if (!value) {
      value = factory(key);
      cache.set(key, value);
    }
    return value;
  };
}
