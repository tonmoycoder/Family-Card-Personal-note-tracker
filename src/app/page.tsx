'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileEdit,
  Database,
  ListOrdered,
  Users,
} from 'lucide-react';
import NetworkStatusBar from '@/components/NetworkStatusBar';
import PermissionBanner from '@/components/PermissionBanner';
import SurveyForm from '@/components/SurveyForm';
import OfflineQueuePanel from '@/components/OfflineQueuePanel';
import RecordsList from '@/components/RecordsList';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { SurveyRecord } from '@/lib/types';

type ActiveTab = 'entry' | 'queue' | 'records';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [cachedRecordsCount, setCachedRecordsCount] = useState<number>(0);

  const {
    isOnline,
    queueItems,
    isSyncing,
    syncMessage,
    manualSync,
    refreshQueue,
    retryItem,
    retryDuplicate,
    deleteQueueItem,
  } = useOfflineSync();

  // Load cached records count for bottom badge
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('family_card_cached_records');
      if (cached) {
        try {
          const list: SurveyRecord[] = JSON.parse(cached);
          setCachedRecordsCount(list.length);
        } catch {
          setCachedRecordsCount(0);
        }
      }
    }
  }, [refreshTrigger]);

  const handleFormSubmitted = useCallback(() => {
    refreshQueue();
    setRefreshTrigger((prev) => prev + 1);
  }, [refreshQueue]);

  // Extract existing areas from cache for fast quick-chips
  const existingAreas = useMemo(() => {
    void refreshTrigger;
    if (typeof window === 'undefined') return [];
    const cached = localStorage.getItem('family_card_cached_records');
    if (!cached) return [];
    try {
      const list: SurveyRecord[] = JSON.parse(cached);
      const areas = new Set<string>();
      list.forEach((r) => {
        const a = (r.Area_Para || r.areaPara || '').trim();
        if (a) areas.add(a);
      });
      return Array.from(areas);
    } catch {
      return [];
    }
  }, [refreshTrigger]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen bg-slate-50 flex flex-col shadow-xl relative border-x border-slate-200">
        {/* Top Sticky Connectivity & Sync Bar */}
        <NetworkStatusBar
          isOnline={isOnline}
          queueCount={queueItems.length}
          isSyncing={isSyncing}
          syncMessage={syncMessage}
          onManualSync={manualSync}
        />

        {/* Civic-Tech Mobile Header */}
        <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">
                ফ্যামিলি কার্ড সার্ভে
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                বাদ পড়া পরিবার মাঠপর্যায় তথ্য সংগ্রহ
              </p>
            </div>
          </div>
        </header>

        {/* PWA Home Screen Installation & Guidance Banner */}
        <PermissionBanner />

        {/* Main Content Body */}
        <main className="flex-1 px-4 pt-2">
          {activeTab === 'entry' && (
            <SurveyForm
              isOnline={isOnline}
              onFormSubmitted={handleFormSubmitted}
              existingAreas={existingAreas}
            />
          )}

          {activeTab === 'queue' && (
            <OfflineQueuePanel
              queueItems={queueItems}
              isOnline={isOnline}
              isSyncing={isSyncing}
              onManualSync={manualSync}
              onRetryItem={retryItem}
              onRetryDuplicate={retryDuplicate}
              onDeleteItem={deleteQueueItem}
            />
          )}

          {activeTab === 'records' && (
            <RecordsList
              isOnline={isOnline}
              onRefreshTrigger={refreshTrigger}
            />
          )}
        </main>

        {/* Bottom Sticky Mobile 3-Tab Navigation Bar (Min 52px height) */}
        <nav className="fixed bottom-0 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1.5 z-40">
          <div className="grid grid-cols-3 gap-1">
            {/* Tab 1: নতুন এন্ট্রি */}
            <button
              type="button"
              onClick={() => setActiveTab('entry')}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all ${
                activeTab === 'entry'
                  ? 'text-emerald-700 bg-emerald-50/80 font-bold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <FileEdit className={`w-5 h-5 ${activeTab === 'entry' ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[11px] mt-0.5">নতুন এন্ট্রি</span>
            </button>

            {/* Tab 2: কিউ */}
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`min-h-[48px] relative flex flex-col items-center justify-center rounded-xl transition-all ${
                activeTab === 'queue'
                  ? 'text-emerald-700 bg-emerald-50/80 font-bold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="relative">
                <Database className={`w-5 h-5 ${activeTab === 'queue' ? 'stroke-[2.5]' : ''}`} />
                {queueItems.length > 0 && (
                  <span className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-xs">
                    {queueItems.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5">কিউ</span>
            </button>

            {/* Tab 3: তালিকা */}
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`min-h-[48px] relative flex flex-col items-center justify-center rounded-xl transition-all ${
                activeTab === 'records'
                  ? 'text-emerald-700 bg-emerald-50/80 font-bold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <div className="relative">
                <ListOrdered className={`w-5 h-5 ${activeTab === 'records' ? 'stroke-[2.5]' : ''}`} />
                {cachedRecordsCount > 0 && (
                  <span className="absolute -top-1 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center">
                    {cachedRecordsCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5">তালিকা</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
