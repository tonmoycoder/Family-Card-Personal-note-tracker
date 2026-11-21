'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';

interface GpsTrackerProps {
  onLocationChange: (mapsLink: string) => void;
  currentMapsLink?: string;
}

export default function GpsTracker({
  onLocationChange,
  currentMapsLink,
}: GpsTrackerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [mapsLink, setMapsLink] = useState<string>(currentMapsLink || '');

  const fetchLocation = useCallback(() => {
    setLoading(true);
    setErrorMsg('');

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMsg('ডিভাইসে জিপিএস সুবিধা নেই।');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const link = `https://www.google.com/maps?q=${lat},${lng}`;
        setMapsLink(link);
        onLocationChange(link);
        setLoading(false);
        setErrorMsg('');
      },
      (err) => {
        let msg = 'লোকেশন পাওয়া যায়নি।';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'লোকেশন পারমিশন দেওয়া হয়নি। ব্রাউজার সেটিংসে অনুমতি দিন।';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'জিপিএস সিগন্যাল পাওয়া যাচ্ছে না। খোলা জায়গায় চেষ্টা করুন।';
        } else if (err.code === err.TIMEOUT) {
          msg = 'লোকেশন পেতে সময় বেশি লেগেছে। রিফ্রেশ বাটনে চাপুন।';
        }
        setErrorMsg(msg);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }, [onLocationChange]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              mapsLink
                ? 'bg-emerald-100 text-emerald-800'
                : loading
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ফিল্ড জিপিএস লোকেশন
            </div>
            <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
              {loading ? (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>লোকেশন খোঁজা হচ্ছে...</span>
                </span>
              ) : mapsLink ? (
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>লোকেশন সংযুক্ত হয়েছে</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-600 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{errorMsg || 'লোকেশন পাওয়া যায়নি'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <span>ম্যাপে চেক করুন</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            type="button"
            onClick={fetchLocation}
            disabled={loading}
            aria-label="লোকেশন রিফ্রেশ করুন"
            title="লোকেশন রিফ্রেশ করুন"
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60 rounded-lg transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
