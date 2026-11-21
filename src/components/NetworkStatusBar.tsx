'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

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
    <div className="sticky top-0 z-40 w-full transition-all duration-200">
      <div
        className={`px-4 py-2 flex items-center justify-between shadow-sm text-sm font-medium ${
          isOnline
            ? 'bg-emerald-700 text-white'
            : 'bg-amber-600 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-100"></span>
              </span>
              <Wifi className="w-4 h-4" />
              <span>অনলাইন</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold">
              <WifiOff className="w-4 h-4 text-amber-200" />
              <span>অফলাইন — ডেটা ডিভাইসে সুরক্ষিত থাকবে</span>
            </span>
          )}

          {queueCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
              কিউ: {queueCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && queueCount > 0 && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই সিঙ্ক করুন'}</span>
            </button>
          )}

          {isSyncing && queueCount === 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-100">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>সিঙ্ক চলছে...</span>
            </span>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="bg-emerald-900 text-emerald-50 text-xs px-4 py-1.5 flex items-center justify-between border-b border-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-1.5">
            {syncMessage.includes('সফল') ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{syncMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
