'use client';

import React, { useEffect } from 'react';
import { MapPin, RefreshCw, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface GpsTrackerProps {
  onLocationChange?: (mapsLink: string) => void;
  currentMapsLink?: string;
}

export default function GpsTracker({
  onLocationChange,
  currentMapsLink,
}: GpsTrackerProps) {
  const { mapsLink, status, errorMessage, refreshLocation } = useGeolocation(currentMapsLink);

  // Notify parent only when mapsLink is updated and valid
  useEffect(() => {
    if (mapsLink && onLocationChange) {
      onLocationChange(mapsLink);
    }
  }, [mapsLink, onLocationChange]);

  const isLoading = status === 'loading';
  const isReady = status === 'ready' || Boolean(mapsLink);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs min-h-[68px] flex items-center justify-between gap-2">
      {/* Left side: Icon + 2 crisp lines */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isReady
              ? 'bg-emerald-100 text-emerald-800'
              : isLoading
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          <MapPin className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
            ফিল্ড জিপিএস লোকেশন
          </div>
          <div className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5 truncate">
            {isLoading && !mapsLink ? (
              <span className="flex items-center gap-1 text-amber-700 truncate">
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                <span className="truncate">লোকেশন খোঁজা হচ্ছে...</span>
              </span>
            ) : isReady ? (
              <span className="flex items-center gap-1 text-emerald-700 truncate font-semibold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">লোকেশন সংযুক্ত হয়েছে</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-600 truncate text-[11px]">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">{errorMessage || 'লোকেশন পাওয়া যায়নি'}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Action Buttons (No awkward text wrapping) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors whitespace-nowrap"
          >
            <span>ম্যাপে দেখুন</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )}

        <button
          type="button"
          onClick={refreshLocation}
          disabled={isLoading}
          aria-label="লোকেশন রিফ্রেশ করুন"
          title="লোকেশন রিফ্রেশ করুন"
          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
