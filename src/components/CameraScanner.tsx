'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Sparkles, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { compressImageToBase64 } from '@/lib/image-utils';
import { ScanResponseData } from '@/lib/types';

interface CameraScannerProps {
  isOnline: boolean;
  onScanComplete: (data: {
    imageBase64: string;
    scannedData?: ScanResponseData;
    isOffline?: boolean;
  }) => void;
  onClearImage?: () => void;
  savedImageBase64?: string;
}

export default function CameraScanner({
  isOnline,
  onScanComplete,
  onClearImage,
  savedImageBase64,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string>(savedImageBase64 || '');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanWarning, setScanWarning] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  useEffect(() => {
    if (savedImageBase64) {
      setCapturedImage(savedImageBase64);
    }
  }, [savedImageBase64]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraStream = useCallback(async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('ব্রাউজারে সরাসরি ক্যামেরা সাপোর্ট নেই। নিচে থাকা ক্যামেরা বাটন বা ফাইল আপলোড ব্যবহার করুন।');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: unknown) {
      console.warn('Direct camera access error:', err);
      setCameraError('ক্যামেরা চালু করা যায়নি। নিচের "ক্যামেরা দিয়ে ছবি তুলুন" বা ফাইল বাটন ব্যবহার করুন।');
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const handleProcessImage = useCallback(
    async (base64Image: string) => {
      setCapturedImage(base64Image);
      setScanWarning('');

      if (!isOnline) {
        // Offline: preserve image and notify parent to defer OCR until sync
        onScanComplete({
          imageBase64: base64Image,
          isOffline: true,
        });
        return;
      }

      // Online: Call OCR endpoint
      setIsScanning(true);
      try {
        const res = await fetch('/api/scan-nid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.warning) {
            setScanWarning(json.data.warning);
          }
          onScanComplete({
            imageBase64: base64Image,
            scannedData: json.data,
            isOffline: false,
          });
        } else {
          setScanWarning(json.error || 'ছবি থেকে তথ্য পড়া যায়নি, প্রয়োজনে নাম ও নম্বর টাইপ করুন।');
          onScanComplete({
            imageBase64: base64Image,
            isOffline: false,
          });
        }
      } catch (err) {
        console.error('Scan error:', err);
        setScanWarning('স্ক্যান সার্ভারে সমস্যা হয়েছে। এনআইডি হাতে লিখুন।');
        onScanComplete({
          imageBase64: base64Image,
          isOffline: false,
        });
      } finally {
        setIsScanning(false);
      }
    },
    [isOnline, onScanComplete]
  );

  const captureFrameFromVideo = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCameraStream();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const compressed = await compressImageToBase64(blob);
        handleProcessImage(compressed);
      } catch (err) {
        console.error('Image compression error:', err);
      }
    }, 'image/jpeg', 0.9);
  }, [handleProcessImage, stopCameraStream]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await compressImageToBase64(file);
        handleProcessImage(compressed);
      } catch (err) {
        console.error('File compression error:', err);
      } finally {
        if (e.target) e.target.value = '';
      }
    },
    [handleProcessImage]
  );

  const handleRetake = () => {
    setCapturedImage('');
    setScanWarning('');
    if (onClearImage) onClearImage();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-emerald-700" />
          <span>এনআইডি কার্ডের ছবি তুলুন (বাধ্যতামূলক)</span>
        </label>
        {capturedImage && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3" />
            <span>ছবি সংরক্ষিত</span>
          </span>
        )}
      </div>

      {/* Hidden file inputs for hardware compatibility */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Viewport Area */}
      <div className="relative w-full aspect-16/10 bg-slate-950 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center">
        {capturedImage ? (
          // Captured Image Preview
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="ক্যাপচার করা এনআইডি"
              className="max-w-full max-h-full object-contain"
            />

            {/* AI Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                <div className="relative w-14 h-14 flex items-center justify-center mb-3">
                  <div className="absolute inset-0 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
                </div>
                <div className="text-white text-sm font-semibold">এনআইডি কার্ড স্ক্যান হচ্ছে...</div>
                <div className="text-emerald-200 text-xs mt-1">নাম ও নম্বর অটো-ডিটেক্ট করা হচ্ছে</div>
              </div>
            )}
          </div>
        ) : cameraActive ? (
          // Live Video Feed with Card Framing Overlay
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* NID Card Framing Guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="w-[88%] aspect-85/54 border-2 border-dashed border-emerald-400/90 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2">
                <div className="text-[11px] font-medium text-emerald-300 bg-black/60 px-2 py-0.5 rounded self-start">
                  এনআইডি ফ্রেম
                </div>
                <div className="text-[11px] text-center text-white/90 bg-black/50 py-0.5 rounded">
                  কার্ডটি ফ্রেমের সমান্তরালে রাখুন
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Placeholder State
          <div className="text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center mx-auto mb-2">
              <Camera className="w-7 h-7" />
            </div>
            <p className="text-xs text-slate-300 font-medium">
              সরাসরি ক্যামেরা দিয়ে তুলুন অথবা গ্যালারি থেকে ছবি দিন
            </p>
          </div>
        )}
      </div>

      {/* Warnings & Status Notes */}
      {scanWarning && (
        <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{scanWarning}</span>
        </div>
      )}

      {cameraError && (
        <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          {cameraError}
        </div>
      )}

      {!isOnline && capturedImage && (
        <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900 font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            অফলাইন আছেন — ছবি সেভ হয়েছে। ইন্টারনেট পেলেই নাম ও এনআইডি অটোমেটিক স্ক্যান হয়ে আপলোড হবে।
          </span>
        </div>
      )}

      {/* Action Buttons (Min 48px Touch Targets) */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {capturedImage ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="col-span-2 min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-98 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>পুনরায় ছবি তুলুন</span>
            </button>
          </>
        ) : cameraActive ? (
          <>
            <button
              type="button"
              onClick={captureFrameFromVideo}
              className="col-span-1 min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>ছবি তুলুন</span>
            </button>
            <button
              type="button"
              onClick={stopCameraStream}
              className="col-span-1 min-h-[50px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-98 transition-all"
            >
              <span>ক্যামেরা বন্ধ</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                // Try live preview or fallback to camera input
                startCameraStream().catch(() => {
                  fileInputRef.current?.click();
                });
              }}
              className="min-h-[50px] inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>ক্যামেরা চালু</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[50px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-98 transition-all"
            >
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>গ্যালারি / ফাইল</span>
            </button>
          </>
        )}
      </div>

      {!capturedImage && !cameraActive && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-emerald-800 hover:underline font-medium py-1"
          >
            ফোনের ডিফল্ট ক্যামেরা দিয়ে সরাসরি ছবি তুলতে এখানে চাপুন
          </button>
        </div>
      )}
    </div>
  );
}
