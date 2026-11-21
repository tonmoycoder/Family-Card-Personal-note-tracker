'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  QueuedEntry,
  getAllQueuedEntries,
  processOfflineQueue,
  updateQueuedEntry,
  removeQueuedEntry,
} from '@/lib/offline-queue';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueItems, setQueueItems] = useState<QueuedEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getAllQueuedEntries();
      setQueueItems(items);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    setSyncMessage('সার্ভারের সাথে সিঙ্ক হচ্ছে...');
    try {
      const res = await processOfflineQueue((updated) => {
        setQueueItems(updated);
      });
      await refreshQueue();
      if (res.uploaded > 0) {
        setSyncMessage(`${res.uploaded}টি এন্ট্রি সফলভাবে আপলোড হয়েছে।`);
      } else if (res.duplicates > 0) {
        setSyncMessage('কিছু এন্ট্রি ডুপ্লিকেট হিসেবে চিহ্নিত হয়েছে।');
      } else if (res.failed > 0) {
        setSyncMessage('কিছু এন্ট্রি আপলোড হতে পারেনি। পরে আবার চেষ্টা করা হবে।');
      } else {
        setSyncMessage('');
      }
    } catch (err) {
      console.error('Queue sync error:', err);
      setSyncMessage('সিঙ্কে ত্রুটি ঘটেছে।');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 4000);
    }
  }, [isSyncing, refreshQueue]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    refreshQueue();

    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync attempt if online on mount
    if (navigator.onLine) {
      runSync();
    }

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
      const item = queueItems.find((q) => q.id === id);
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
    [queueItems, refreshQueue, runSync]
  );

  const retryDuplicate = useCallback(
    async (id: string) => {
      const item = queueItems.find((q) => q.id === id);
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
    [queueItems, refreshQueue, runSync]
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
