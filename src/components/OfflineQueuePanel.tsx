'use client';

import React from 'react';
import {
  Clock,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Database,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';
import { QueuedEntry } from '@/lib/offline-queue';

interface OfflineQueuePanelProps {
  queueItems: QueuedEntry[];
  isOnline: boolean;
  isSyncing: boolean;
  onManualSync: () => void;
  onRetryItem: (id: string) => void;
  onRetryDuplicate: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

export default function OfflineQueuePanel({
  queueItems,
  isOnline,
  isSyncing,
  onManualSync,
  onRetryItem,
  onRetryDuplicate,
  onDeleteItem,
}: OfflineQueuePanelProps) {
  const getStatusBadge = (status: QueuedEntry['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>ইন্টারনেটের জন্য কিউ হয়ে আছে</span>
          </span>
        );
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            <span>আপলোড হচ্ছে...</span>
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>ডুপ্লিকেট এনআইডি</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span>আপলোড ব্যর্থ</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Queue Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-700" />
            <span>অফলাইন কিউ তালিকা</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            মোট অপেক্ষমাণ এন্ট্রি: <strong>{queueItems.length}</strong>টি
          </p>
        </div>

        {queueItems.length > 0 && isOnline && (
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="min-h-[44px] px-3.5 py-2 bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'সব আপলোড করুন'}</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {queueItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">কোনো কিউ করা এন্ট্রি নেই</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            সব সার্ভে ডাটা সফলভাবে গুগল শিট ও ড্রাইভে সিঙ্ক হয়েছে। অফলাইনে কাজ করলে তা এখানে সংরক্ষিত হবে।
          </p>
        </div>
      ) : (
        /* Queue Item Cards */
        <div className="space-y-3">
          {queueItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3"
            >
              <div className="flex gap-3">
                {/* Thumbnail Preview */}
                <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.imageBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageBase64}
                      alt="ছবি"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400">ছবি নেই</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {item.localKnownName || item.nidName || 'অটো-স্ক্যানের অপেক্ষায়'}
                    </h4>
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    এলাকা: <span className="font-semibold text-slate-800">{item.areaPara}</span>
                  </div>

                  {item.nidNumber && (
                    <div className="text-xs text-slate-600 font-mono">
                      এনআইডি: {item.nidNumber}
                    </div>
                  )}

                  <div className="mt-1 text-[11px] text-slate-400">
                    রেকর্ড সময়: {item.capturedDate} ({item.capturedTimestamp})
                  </div>
                </div>
              </div>

              {/* Status Badge & Error Note */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>{getStatusBadge(item.status)}</div>

                {item.mapsLink && (
                  <a
                    href={item.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:underline"
                  >
                    <span>ম্যাপ লোকেশন</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {item.errorMessage && (
                <div className="p-2 bg-slate-50 rounded-lg text-xs text-rose-700 border border-slate-200">
                  {item.errorMessage}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                {item.status === 'duplicate' && (
                  <button
                    onClick={() => onRetryDuplicate(item.id)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg active:scale-95 transition-all"
                  >
                    তবুও আপলোড করুন
                  </button>
                )}

                {(item.status === 'failed' || item.status === 'pending') && (
                  <button
                    onClick={() => onRetryItem(item.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg active:scale-95 transition-all inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>আবার চেষ্টা করুন</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (window.confirm('আপনি কি নিশ্চিতভাবে এই কিউ আইটেমটি মুছতে চান?')) {
                      onDeleteItem(item.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="মুছুন"
                  aria-label="মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
