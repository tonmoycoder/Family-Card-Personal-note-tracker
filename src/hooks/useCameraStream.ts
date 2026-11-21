'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { compressImageToBase64 } from '@/lib/image-utils';

export interface UseCameraStreamResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  isReady: boolean;
  error: string;
  startStream: () => Promise<void>;
  stopStream: () => void;
  captureFrame: () => Promise<string | null>;
}

export function useCameraStream(): UseCameraStreamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsReady(false);
  }, []);

  const startStream = useCallback(async () => {
    setError('');
    setIsReady(false);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('ব্রাউজারে সরাসরি ক্যামেরা সাপোর্ট নেই। নিচে থাকা ক্যামেরা বাটনটি ব্যবহার করুন।');
      return;
    }

    try {
      // Clean up any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsStreaming(true);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;

        // Wait for metadata loaded before playing
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.onloadedmetadata = () => resolve();
          }
        });

        await video.play();

        // Mark ready only when video dimensions are non-zero and readyState is at least HAVE_CURRENT_DATA
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setIsReady(true);
        } else {
          // Poll briefly for camera sensor to deliver actual frame
          let tries = 0;
          const checkReady = setInterval(() => {
            tries++;
            if (video.videoWidth > 0 && video.readyState >= 2) {
              setIsReady(true);
              clearInterval(checkReady);
            } else if (tries > 20) {
              clearInterval(checkReady);
              setIsReady(true);
            }
          }, 100);
        }
      }
    } catch (err: unknown) {
      console.warn('getUserMedia stream error:', err);
      setError('ক্যামেরা চালু করা যায়নি। দয়া করে ফোনের স্বাভাবিক ক্যামেরা বাটন ব্যবহার করুন।');
      stopStream();
    }
  }, [stopStream]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  /**
   * Black-Frame Detector: Samples 100 pixels across the frame.
   * If >97% of sampled pixels are near pitch-black (r<8 && g<8 && b<8),
   * the frame is rejected to prevent feeding solid black images to OCR/Drive.
   */
  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('ক্যামেরা এখনও প্রস্তুত হয়নি। এক মুহূর্ত অপেক্ষা করে আবার চাপুন।');
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    // Run Black-Frame Detection
    const sampleCols = 10;
    const sampleRows = 10;
    let blackPixelCount = 0;
    const totalSamples = sampleCols * sampleRows;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let r = 0; r < sampleRows; r++) {
      const y = Math.floor(((r + 0.5) * height) / sampleRows);
      for (let c = 0; c < sampleCols; c++) {
        const x = Math.floor(((c + 0.5) * width) / sampleCols);
        const idx = (y * width + x) * 4;
        const red = data[idx];
        const green = data[idx + 1];
        const blue = data[idx + 2];
        if (red < 8 && green < 8 && blue < 8) {
          blackPixelCount++;
        }
      }
    }

    // If >97% is pitch black, reject frame
    if (blackPixelCount / totalSamples > 0.97) {
      setError('ক্যামেরায় কালো ছবি এসেছে — দয়া করে "ক্যামেরা দিয়ে ছবি তুলুন" বাটন ব্যবহার করুন।');
      return null;
    }

    stopStream();

    return new Promise((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          try {
            const compressed = await compressImageToBase64(blob);
            resolve(compressed);
          } catch {
            resolve(null);
          }
        },
        'image/jpeg',
        0.88
      );
    });
  }, [stopStream]);

  return {
    videoRef,
    isStreaming,
    isReady,
    error,
    startStream,
    stopStream,
    captureFrame,
  };
}
