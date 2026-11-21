'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

interface NetworkStatusBarProps {
  isOnline: boolean;
  queueCount: number;
  isSyncing: boolean;
  syncMessage?: string;
  onManualSync: () => void;
}

export default function NetworkStatusBar({
  isOnline,
  queueCount,
  isSyncing,
  syncMessage,
  onManualSync,
}: NetworkStatusBarProps) {
  return (
    <div role="status" className="sticky top-0 z-40 w-full shadow-xs">
      {/* Strict fixed-height (h-11) single-row bar to eliminate CLS entirely */}
      <div
        className={`h-11 px-4 flex items-center justify-between transition-colors duration-200 ${
          isOnline ? 'bg-emerald-800 text-white' : 'bg-amber-700 text-amber-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 shrink-0" />
              <span>অনলাইন</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-amber-100">
              <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-200" />
              <span>অফলাইন — ডেটা ডিভাইসে সুরক্ষিত থাকবে</span>
            </span>
          )}

          {queueCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white whitespace-nowrap">
              কিউ: {queueCount}
            </span>
          )}

          {/* Inline compact sync message if present */}
          {syncMessage && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-200 truncate">
              <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
              <span className="truncate">{syncMessage}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOnline && queueCount > 0 && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 transition-all shadow-xs disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'সিঙ্ক করুন'}</span>
            </button>
          )}

          {/* Only show "সিঙ্ক চলছে..." if isSyncing is true AND queueCount > 0 */}
          {isSyncing && queueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-100 whitespace-nowrap">
              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
              <span>সিঙ্ক চলছে...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
