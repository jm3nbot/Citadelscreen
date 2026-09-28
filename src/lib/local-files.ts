"use client";

// Thin IndexedDB wrapper for storing user-uploaded files (PDFs, images, etc.).
// We keep file blobs OUT of localStorage because:
//   1. localStorage has a ~5MB total cap per origin — one PDF can blow it.
//   2. localStorage serializes to UTF-16 strings, ~50% wasted on base64.
// IndexedDB stores Blobs natively and scales to hundreds of MB. The pinned-doc
// record in Zustand only stores the file id; the blob lives here.

const DB_NAME = "citadel-files";
const STORE = "blobs";
const VERSION = 1;

type Record = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function saveLocalFile(file: File): Promise<Record> {
  const id =
    "lf_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36);
  const rec: Record = {
    id,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(rec));
  return rec;
}

export async function getLocalFile(id: string): Promise<Record | undefined> {
  const r = await tx<Record | undefined>("readonly", (s) => s.get(id) as IDBRequest<Record | undefined>);
  return r;
}

export async function deleteLocalFile(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

// Returns an in-browser blob URL the iframe / <embed> can render. Caller must
// call URL.revokeObjectURL() when done (typically on viewer close).
export async function getLocalFileUrl(id: string): Promise<{ url: string; mimeType: string; name: string } | null> {
  const rec = await getLocalFile(id);
  if (!rec) return null;
  return {
    url: URL.createObjectURL(rec.blob),
    mimeType: rec.mimeType,
    name: rec.name,
  };
}
