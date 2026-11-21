export type QueueStatus = 'pending' | 'syncing' | 'duplicate' | 'failed';

export interface QueuedEntry {
  id: string;
  capturedDate: string;      // YYYY-MM-DD (Asia/Dhaka)
  capturedTimestamp: string; // hh:mm:ss AM/PM
  nidName: string;
  nidNumber: string;
  localKnownName: string;
  areaPara: string;
  mapsLink: string;
  imageBase64: string;
  notes: string;
  needsScan: boolean;
  forceDuplicate?: boolean;
  status: QueueStatus;
  errorMessage?: string;
  createdAt: number;
}

const DB_NAME = 'FamilyCardSurveyOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_entries';

let syncInProgress = false;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB খোলা যায়নি।'));
  });
}

export function getBangladeshDateTime(): { capturedDate: string; capturedTimestamp: string } {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return {
    capturedDate: dateFormatter.format(now),
    capturedTimestamp: timeFormatter.format(now),
  };
}

export async function addToOfflineQueue(
  entry: Omit<QueuedEntry, 'id' | 'status' | 'createdAt' | 'capturedDate' | 'capturedTimestamp'> & {
    capturedDate?: string;
    capturedTimestamp?: string;
  }
): Promise<QueuedEntry> {
  const db = await openDB();
  const dt = getBangladeshDateTime();
  const item: QueuedEntry = {
    ...entry,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    capturedDate: entry.capturedDate || dt.capturedDate,
    capturedTimestamp: entry.capturedTimestamp || dt.capturedTimestamp,
    status: 'pending',
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error || new Error('অফলাইন কিউতে সেভ হয়নি।'));
  });
}

export async function getAllQueuedEntries(): Promise<QueuedEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = (req.result as QueuedEntry[]).sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueuedEntry(item: QueuedEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueuedEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function processOfflineQueue(
  onProgress?: (items: QueuedEntry[]) => void
): Promise<{ uploaded: number; failed: number; duplicates: number }> {
  if (syncInProgress || typeof navigator === 'undefined' || !navigator.onLine) {
    return { uploaded: 0, failed: 0, duplicates: 0 };
  }

  syncInProgress = true;
  let uploaded = 0;
  let failed = 0;
  let duplicates = 0;

  try {
    const items = await getAllQueuedEntries();
    const runnable = items.filter((i) => i.status === 'pending' || i.status === 'failed');

    for (const current of runnable) {
      if (!navigator.onLine) break;

      const working: QueuedEntry = { ...current, status: 'syncing', errorMessage: undefined };
      await updateQueuedEntry(working);
      if (onProgress) onProgress(await getAllQueuedEntries());

      try {
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capturedDate: working.capturedDate,
            capturedTimestamp: working.capturedTimestamp,
            nidName: working.nidName,
            nidNumber: working.nidNumber,
            localKnownName: working.localKnownName || working.nidName,
            areaPara: working.areaPara,
            mapsLink: working.mapsLink,
            imageBase64: working.imageBase64,
            notes: working.notes,
            forceDuplicate: Boolean(working.forceDuplicate),
          }),
        });

        const data = await res.json();

        if (data.success) {
          await removeQueuedEntry(working.id);
          uploaded++;
        } else if (data.duplicate) {
          working.status = 'duplicate';
          working.errorMessage = data.message || 'এই এনআইডি ইতিমধ্যে এন্ট্রি করা আছে।';
          await updateQueuedEntry(working);
          duplicates++;
        } else {
          working.status = 'failed';
          working.errorMessage = data.error || 'আপলোড ব্যর্থ হয়েছে।';
          await updateQueuedEntry(working);
          failed++;
        }
      } catch {
        working.status = navigator.onLine ? 'failed' : 'pending';
        working.errorMessage = navigator.onLine
          ? 'সার্ভারের সাথে সংযোগ হয়নি। আবার চেষ্টা করা হবে।'
          : 'ইন্টারনেট বিচ্ছিন্ন। সংযোগ পেলেই আপলোড হবে।';
        await updateQueuedEntry(working);
        failed++;
      }

      if (onProgress) onProgress(await getAllQueuedEntries());
    }
  } finally {
    syncInProgress = false;
  }

  return { uploaded, failed, duplicates };
}
