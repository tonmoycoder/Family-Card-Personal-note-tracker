'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setIsReady(false);
    setIsActive(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('এই ব্রাউজারে লাইভ ক্যামেরা সাপোর্ট করে না। "ক্যামেরা দিয়ে ছবি তুলুন" বাটন ব্যবহার করুন।');
      setIsActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (video.readyState >= 2 && video.videoWidth > 0) {
          setIsReady(true);
        }
      }
    } catch {
      setError('লাইভ ক্যামেরা চালু করা যায়নি। নিচের "ক্যামেরা দিয়ে ছবি তুলুন" বাটন ব্যবহার করুন।');
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const attachAndCheck = () => {
      const video = videoRef.current;
      const stream = streamRef.current;
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      if (video && video.videoWidth > 0) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    attachAndCheck();
    const video = videoRef.current;
    const onMeta = () => attachAndCheck();
    video?.addEventListener('loadedmetadata', onMeta);
    video?.addEventListener('canplay', onMeta);

    const poll = window.setInterval(() => {
      if (attachAndCheck()) {
        window.clearInterval(poll);
      }
    }, 250);

    return () => {
      video?.removeEventListener('loadedmetadata', onMeta);
      video?.removeEventListener('canplay', onMeta);
      window.clearInterval(poll);
    };
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const captureFrame = useCallback((): { dataUrl: string | null; isBlack: boolean } => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return { dataUrl: null, isBlack: true };
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { dataUrl: null, isBlack: true };

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let blackCount = 0;
    const step = Math.max(4, Math.floor(sample.length / 400) * 4);
    let total = 0;
    for (let i = 0; i < sample.length; i += step) {
      total++;
      if (sample[i] < 8 && sample[i + 1] < 8 && sample[i + 2] < 8) blackCount++;
    }
    if (total > 0 && blackCount / total > 0.96) {
      return { dataUrl: null, isBlack: true };
    }

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.88), isBlack: false };
  }, []);

  return {
    videoRef,
    isActive,
    isStreaming: isActive,
    isReady,
    error,
    startCamera,
    startStream: startCamera,
    stopCamera,
    stopStream: stopCamera,
    captureFrame,
  };
}
