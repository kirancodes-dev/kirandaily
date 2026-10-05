/**
 * Tiny promise wrapper around IndexedDB for files that stay on THIS device
 * only (the official semester calendar PDF). Nothing here is synced or sent
 * anywhere. Every call is guarded, so the app keeps working where IndexedDB is
 * missing or blocked (some private windows, very old browsers).
 *
 * Files are stored as ArrayBuffers (the most widely supported form, including
 * older iOS Safari) together with their name, type and size.
 */

const DB_NAME = 'kiran-planner-files';
const DB_VERSION = 1;
const STORE = 'files';

/** Key of the official semester calendar PDF. */
export const SEMESTER_PDF_KEY = 'semester-calendar-pdf';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const PDF_TYPE = 'application/pdf';

export interface StoredFileMeta {
  name: string;
  type: string;
  size: number;
  /** ISO timestamp. */
  savedAt: string;
}

interface StoredRecord extends StoredFileMeta {
  data: ArrayBuffer;
}

export class FileStoreError extends Error {}

const UNAVAILABLE = 'This browser can’t keep files on the device (private browsing or storage blocked).';

export function fileStoreAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Checks a picked file before storing it. Returns an error message or null. */
export function checkPdf(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'Choose a PDF file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) return `The PDF is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`;
  return null;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/**
 * True when the file really is a PDF: "%PDF-" within its first 1024 bytes.
 * Needed because a file picked by its ".pdf" name alone may be something else.
 */
export async function hasPdfSignature(file: Blob): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    for (let i = 0; i + PDF_SIGNATURE.length <= head.length; i++) {
      if (PDF_SIGNATURE.every((b, j) => head[i + j] === b)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * The picked file typed as application/pdf. Some pickers report an empty type
 * for downloaded or renamed files, and a blob without the PDF type is
 * downloaded instead of shown by "View PDF".
 */
export function asPdf(file: Blob & { name?: string }): File {
  return new File([file], file.name || 'calendar.pdf', { type: PDF_TYPE });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!fileStoreAvailable()) return Promise.reject(new FileStoreError(UNAVAILABLE));
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        reject(new FileStoreError(UNAVAILABLE));
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(new FileStoreError(UNAVAILABLE));
      req.onblocked = () => reject(new FileStoreError('Close the app in other tabs and try again.'));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Runs one request in a transaction and resolves when the transaction completes. */
async function run<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = make(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(new FileStoreError(tx.error?.name === 'QuotaExceededError' ? 'Not enough storage space on this device.' : 'The file could not be saved.'));
      tx.onabort = () => reject(new FileStoreError(tx.error?.name === 'QuotaExceededError' ? 'Not enough storage space on this device.' : 'The file could not be saved.'));
    } catch {
      reject(new FileStoreError(UNAVAILABLE));
    }
  });
}

export async function putFile(key: string, file: Blob & { name?: string }): Promise<StoredFileMeta> {
  await openDb(); // fail fast before reading a big file into memory
  const meta: StoredFileMeta = {
    name: file.name || 'file',
    type: file.type || 'application/octet-stream',
    size: file.size,
    savedAt: new Date().toISOString(),
  };
  const data = await file.arrayBuffer();
  await run('readwrite', (s) => s.put({ ...meta, data } satisfies StoredRecord, key));
  return meta;
}

/**
 * The stored file as a Blob plus its details, or null when there is none.
 * `type` overrides the stored type (a PDF saved untyped by an older version).
 */
export async function getFile(key: string, type?: string): Promise<{ meta: StoredFileMeta; blob: Blob } | null> {
  const rec = (await run('readonly', (s) => s.get(key))) as StoredRecord | undefined;
  if (!rec || !rec.data) return null;
  const { data, ...stored } = rec;
  const meta = type ? { ...stored, type } : stored;
  return { meta, blob: new Blob([data], { type: meta.type }) };
}

export async function deleteFile(key: string): Promise<void> {
  await run('readwrite', (s) => s.delete(key));
}

/** "1.4 MB", "820 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
