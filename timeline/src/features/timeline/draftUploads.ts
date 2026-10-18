export interface DraftFile {
  id: string;
  draftKey: string;
  file: File;
  createdAt: number;
  generation: number;
  mediaId?: string;
  mediaIds?: string[];
}

let database: Promise<IDBDatabase> | undefined;
function open() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("timeline-draft-files", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("files", { keyPath: "id" });
      store.createIndex("draftKey", "draftKey");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(Error("Draft file storage is blocked")); };
  });
  return database;
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const request = work(tx.objectStore("files"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || request.error || Error("Draft file transaction failed"));
  });
}

export async function saveDraftFile(record: DraftFile) {
  await transaction("readwrite", store => store.put(record));
}
export async function loadDraftFiles(key: string): Promise<DraftFile[]> {
  const files = await transaction("readonly", store => store.index("draftKey").getAll(key));
  return (files as DraftFile[]).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
export async function removeDraftFile(id: string) {
  await transaction("readwrite", store => store.delete(id));
}
export async function clearDraftFiles(key: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite"), store = tx.objectStore("files");
    const cursor = store.index("draftKey").openKeyCursor(IDBKeyRange.only(key));
    cursor.onsuccess = () => {
      if (cursor.result) { store.delete(cursor.result.primaryKey); cursor.result.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
