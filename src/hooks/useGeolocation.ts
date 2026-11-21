'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type GeolocationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseGeolocationResult {
  mapsLink: string;
  status: GeolocationStatus;
  errorMessage: string;
  refreshLocation: () => void;
}

export function useGeolocation(initialMapsLink?: string): UseGeolocationResult {
  const [mapsLink, setMapsLink] = useState<string>(initialMapsLink || '');
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cache last valid link in a ref so a refresh attempt never blanks out an already working link
  const lastValidLinkRef = useRef<string>(initialMapsLink || '');

  const fetchPosition = useCallback(() => {
    setStatus('loading');
    setErrorMessage('');

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMessage('ডিভাইসে জিপিএস সুবিধা নেই।');
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const link = `https://www.google.com/maps?q=${lat},${lng}`;
        lastValidLinkRef.current = link;
        setMapsLink(link);
        setStatus('ready');
        setErrorMessage('');
      },
      (err) => {
        let msg = 'লোকেশন পাওয়া যায়নি।';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'লোকেশন পারমিশন দেওয়া হয়নি। ব্রাউজার সেটিংসে অনুমতি দিন।';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'জিপিএস সিগন্যাল দুর্বল। খোলা জায়গায় চেষ্টা করুন।';
        } else if (err.code === err.TIMEOUT) {
          msg = 'লোকেশন পেতে সময় বেশি লেগেছে। আবার চেষ্টা করুন।';
        }
        setErrorMessage(msg);
        setStatus(lastValidLinkRef.current ? 'ready' : 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Request location EXACTLY ONCE on mount
  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return {
    mapsLink,
    status,
    errorMessage,
    refreshLocation: fetchPosition,
  };
}
