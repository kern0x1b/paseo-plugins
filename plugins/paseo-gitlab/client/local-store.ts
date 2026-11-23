// localStorage is absent on native platforms, where nothing is kept between sessions.
export function readLocalStore<T>(key: string): T | undefined {
  const raw = globalThis.localStorage?.getItem(key);
  if (raw === null || raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `localStorage "${key}" is not valid JSON (${(error as Error).message}); remove the key to reset it.`,
    );
  }
}

export function writeLocalStore(key: string, value: unknown): void {
  globalThis.localStorage?.setItem(key, JSON.stringify(value));
}
