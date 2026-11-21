'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QueuedEntry,
  getAllQueuedEntries,
  processOfflineQueue,
  updateQueuedEntry,
  removeQueuedEntry,
} from '@/lib/offline-queue';

export interface UseOfflineSyncOptions {
  onSyncSuccess?: () => void;
}

export function useOfflineSync(options?: UseOfflineSyncOptions) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueItems, setQueueItems] = useState<QueuedEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Store options in a ref so changes NEVER trigger re-renders or effect loops
  const onSyncSuccessRef = useRef(options?.onSyncSuccess);
  useEffect(() => {
    onSyncSuccessRef.current = options?.onSyncSuccess;
  }, [options?.onSyncSuccess]);

  const isSyncingRef = useRef<boolean>(false);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getAllQueuedEntries();
      setQueueItems(items);
      return items;
    } catch (err) {
      console.error('Failed to load queue:', err);
      return [];
    }
  }, []);

  /**
   * Strict Sync Guard:
   * Inspects queue first. If there are NO items with status 'pending' or 'failed',
   * it returns immediately WITHOUT setting isSyncing=true or showing "সিঙ্ক চলছে...".
   */
  const runSync = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.onLine || isSyncingRef.current) {
      return { uploaded: 0, failed: 0, duplicates: 0 };
    }

    try {
      const currentQueue = await getAllQueuedEntries();
      setQueueItems(currentQueue);

      const runnable = currentQueue.filter(
        (i) => i.status === 'pending' || i.status === 'failed'
      );

      // GUARD: If no items to sync, do nothing and keep isSyncing = false
      if (runnable.length === 0) {
        return { uploaded: 0, failed: 0, duplicates: 0 };
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncMessage('সার্ভারের সাথে সিঙ্ক হচ্ছে...');

      const res = await processOfflineQueue((updated) => {
        setQueueItems(updated);
      });

      await refreshQueue();

      if (res.uploaded > 0) {
        setSyncMessage(`${res.uploaded}টি এন্ট্রি সফলভাবে আপলোড হয়েছে।`);
        onSyncSuccessRef.current?.();
      } else if (res.duplicates > 0) {
        setSyncMessage('কিছু এন্ট্রি ডুপ্লিকেট হিসেবে চিহ্নিত হয়েছে।');
      } else if (res.failed > 0) {
        setSyncMessage('কিছু এন্ট্রি আপলোড হতে পারেনি। পরে আবার চেষ্টা করা হবে।');
      } else {
        setSyncMessage('');
      }

      return res;
    } catch (err) {
      console.error('Queue sync error:', err);
      setSyncMessage('সিঙ্কে ত্রুটি ঘটেছে।');
      return { uploaded: 0, failed: 0, duplicates: 0 };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 3500);
    }
  }, [refreshQueue]);

  // Initial load and network listeners attached EXACTLY ONCE on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    refreshQueue().then((items) => {
      // Only auto-sync on mount if there are actually pending items
      const hasPending = items.some((i) => i.status === 'pending' || i.status === 'failed');
      if (navigator.onLine && hasPending) {
        runSync();
      }
    });

    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueue, runSync]);

  const manualSync = useCallback(async () => {
    await runSync();
  }, [runSync]);

  const retryItem = useCallback(
    async (id: string) => {
      const items = await getAllQueuedEntries();
      const item = items.find((q) => q.id === id);
      if (!item) return;
      const updated: QueuedEntry = {
        ...item,
        status: 'pending',
        errorMessage: undefined,
      };
      await updateQueuedEntry(updated);
      await refreshQueue();
      if (navigator.onLine) {
        runSync();
      }
    },
    [refreshQueue, runSync]
  );

  const retryDuplicate = useCallback(
    async (id: string) => {
      const items = await getAllQueuedEntries();
      const item = items.find((q) => q.id === id);
      if (!item) return;
      const updated: QueuedEntry = {
        ...item,
        forceDuplicate: true,
        status: 'pending',
        errorMessage: undefined,
      };
      await updateQueuedEntry(updated);
      await refreshQueue();
      if (navigator.onLine) {
        runSync();
      }
    },
    [refreshQueue, runSync]
  );

  const deleteQueueItem = useCallback(
    async (id: string) => {
      await removeQueuedEntry(id);
      await refreshQueue();
    },
    [refreshQueue]
  );

  return {
    isOnline,
    queueItems,
    isSyncing,
    syncMessage,
    refreshQueue,
    manualSync,
    retryItem,
    retryDuplicate,
    deleteQueueItem,
  };
}
