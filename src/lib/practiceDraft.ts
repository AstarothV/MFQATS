// A practice scan in Quality Scan (no order chosen) is kept in this browser (IndexedDB: it can hold photos and the 3D
// model file) so it is still there after visiting other pages. It goes when the staff member presses Clear or signs out.
// Nothing here is sent to the server.

const DB = 'mfqats-practice';
const STORE = 'draft';

export interface PracticeDraft {
  step: number;
  photos: (File | null)[];
  closeUps: (File | null)[];
  parts: { label: string; file: File | null }[];
  partCloseUps: Record<string, File>;
  model: Blob | null;
  sideScans: unknown[];
  partScans: Record<string, unknown>;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = act(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const loadPractice = (userId: string) =>
  run<PracticeDraft>('readonly', (s) => s.get(userId)).catch(() => undefined); // private mode or blocked: start empty

export const savePractice = (userId: string, d: PracticeDraft) =>
  run('readwrite', (s) => s.put(d, userId)).catch(() => undefined);

export const clearPractice = (userId: string) =>
  run('readwrite', (s) => s.delete(userId)).catch(() => undefined);

/** Sign-out: every practice scan kept in this browser goes. */
export function clearAllPractice(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}
