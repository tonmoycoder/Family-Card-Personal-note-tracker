'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type GpsStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useGeolocation(initialMapsLink?: string) {
  const [mapsLink, setMapsLink] = useState<string>(initialMapsLink || '');
  const [status, setStatus] = useState<GpsStatus>(initialMapsLink ? 'ready' : 'loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const activeReqRef = useRef<number>(0);

  const fetchLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('error');
      setErrorMessage('এই ব্রাউজারে জিপিএস সাপোর্ট নেই।');
      return;
    }

    const reqId = ++activeReqRef.current;
    setStatus('loading');
    setErrorMessage('');

    const onSuccess = (pos: GeolocationPosition) => {
      if (reqId !== activeReqRef.current) return;
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      setMapsLink(`https://www.google.com/maps?q=${lat},${lng}`);
      setStatus('ready');
      setErrorMessage('');
    };

    const onFinalError = (err: GeolocationPositionError) => {
      if (reqId !== activeReqRef.current) return;
      setStatus('error');
      if (err.code === err.PERMISSION_DENIED) {
        setErrorMessage('লোকেশন পারমিশন বন্ধ আছে। ব্রাউজার সেটিংস থেকে Allow করুন।');
      } else {
        setErrorMessage('লোকেশন পাওয়া যায়নি। ফোনের GPS চালু করে আবার চেষ্টা করুন।');
      }
    };

    // Stage 1: High-accuracy GPS (accept 60s cached fix for instant lock)
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (reqId !== activeReqRef.current) return;
        if (err.code === err.PERMISSION_DENIED) {
          onFinalError(err);
          return;
        }
        // Stage 2: Automatic fast network/cell fallback (works indoors & on Brave)
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onFinalError,
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    fetchLocation();
    const reqRef = activeReqRef;
    return () => {
      reqRef.current++;
    };
  }, [fetchLocation]);

  return { mapsLink, status, errorMessage, refreshLocation: fetchLocation };
}
