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
