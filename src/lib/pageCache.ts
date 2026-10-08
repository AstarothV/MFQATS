// Last-loaded data for a page, so returning to it paints instantly while it refetches
// (stale-while-revalidate: the page always fetches fresh data on mount).
// Scoped to one signed-in user: switching users or signing out empties it.
const cache = new Map<string, unknown>();
let owner: string | null = null;

export function readPageCache<T>(userId: string | undefined, key: string): T | undefined {
  if (!userId || userId !== owner) return undefined;
  return cache.get(key) as T | undefined;
}

export function writePageCache(userId: string | undefined, key: string, value: unknown) {
  if (!userId) return;
  if (userId !== owner) {
    cache.clear();
    owner = userId;
  }
  cache.set(key, value);
}

export function clearPageCache() {
  cache.clear();
  owner = null;
}
