'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Sparkles,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react';
import { compressImageToBase64 } from '@/lib/image-utils';
import { scanBangladeshNidOnDevice } from '@/lib/nid-ocr';
import { ScanResponseData } from '@/lib/types';
import { useCameraStream } from '@/hooks/useCameraStream';

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
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string>(savedImageBase64 || '');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ percent: number; text: string }>({
    percent: 0,
    text: '',
  });
  const [scanWarning, setScanWarning] = useState<string>('');
  const [liveModeActive, setLiveModeActive] = useState<boolean>(false);

  const {
    videoRef,
    isStreaming,
    isReady,
    error: streamError,
    startStream,
    stopStream,
    captureFrame,
  } = useCameraStream();

  useEffect(() => {
    if (savedImageBase64) {
      setCapturedImage(savedImageBase64);
    }
  }, [savedImageBase64]);

  // Execute on-device OCR without blocking user interaction or form typing
  const runOcrOnImage = useCallback(
    async (base64Image: string) => {
      setScanWarning('');
      setIsScanning(true);
      setScanProgress({ percent: 5, text: 'ছবি প্রস্তুত হচ্ছে...' });

      try {
        let ocrResult;
        // Test hook for deterministic automated testing
        if (
          typeof window !== 'undefined' &&
          (window as unknown as { __MOCK_NID_SCAN__?: (img: string) => Promise<unknown> }).__MOCK_NID_SCAN__
        ) {
          ocrResult = (await (
            window as unknown as { __MOCK_NID_SCAN__: (img: string) => Promise<unknown> }
          ).__MOCK_NID_SCAN__(base64Image)) as {
            nidName: string;
            nidNumber: string;
            confidence: 'high' | 'medium' | 'low';
            warning: string;
            rawText: string;
          };
        } else {
          ocrResult = await scanBangladeshNidOnDevice(base64Image, (percent, text) => {
            setScanProgress({ percent, text });
          });
        }

        if (ocrResult.warning) {
          setScanWarning(ocrResult.warning);
        }

        onScanComplete({
          imageBase64: base64Image,
          scannedData: {
            nidName: ocrResult.nidName,
            nidNumber: ocrResult.nidNumber,
            confidence: ocrResult.confidence,
            warning: ocrResult.warning,
            rawText: ocrResult.rawText,
          },
          isOffline: !isOnline,
        });
      } catch (err: unknown) {
        console.warn('On-device OCR error:', err);
        setScanWarning('স্ক্যানে সমস্যা হয়েছে। অনুগ্রহ করে নিচে নাম ও নম্বর হাতে লিখুন।');
        onScanComplete({
          imageBase64: base64Image,
          isOffline: !isOnline,
        });
      } finally {
        setIsScanning(false);
        setScanProgress({ percent: 0, text: '' });
      }
    },
    [isOnline, onScanComplete]
  );

  const handleProcessImage = useCallback(
    async (rawBase64: string) => {
      setCapturedImage(rawBase64);
      // Immediately notify parent with the color photo so it's guaranteed to be saved
      onScanComplete({
        imageBase64: rawBase64,
        isOffline: !isOnline,
      });

      // Asynchronously run on-device OCR
      runOcrOnImage(rawBase64);
    },
    [isOnline, onScanComplete, runOcrOnImage]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const compressed = await compressImageToBase64(file);
        handleProcessImage(compressed);
      } catch (err) {
        console.error('File compression error:', err);
        setScanWarning('ছবি প্রসেস করা যায়নি। আবার চেষ্টা করুন।');
      } finally {
        if (e.target) e.target.value = '';
      }
    },
    [handleProcessImage]
  );

  const handleStartLiveCamera = async () => {
    setLiveModeActive(true);
    await startStream();
  };

  const handleStopLiveCamera = () => {
    stopStream();
    setLiveModeActive(false);
  };

  const handleCaptureLive = async () => {
    const frame = await captureFrame();
    if (frame) {
      setLiveModeActive(false);
      handleProcessImage(frame);
    }
  };

  const handleRetake = () => {
    setCapturedImage('');
    setScanWarning('');
    setScanProgress({ percent: 0, text: '' });
    handleStopLiveCamera();
    if (onClearImage) onClearImage();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
      {/* Hidden Hardware Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Header Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-emerald-700" />
          <span>এনআইডি কার্ডের ছবি (বাধ্যতামূলক)</span>
        </label>
        {capturedImage && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>ছবি সংরক্ষিত</span>
          </span>
        )}
      </div>

      {/* Fixed Aspect Ratio Viewport (85.6mm x 54mm -> aspect-[1.586/1]) */}
      <div className="relative w-full aspect-[1.586/1] bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center shadow-inner">
        {capturedImage ? (
          // Captured Image Preview (Real Color <img>)
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="এনআইডি প্রিভিউ"
              className="w-full h-full object-contain"
            />

            {/* OCR Inline Progress Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                <div className="relative w-12 h-12 flex items-center justify-center mb-2.5">
                  <div className="absolute inset-0 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
                </div>
                <div className="text-white text-xs font-semibold">
                  {scanProgress.text || 'এনআইডি কার্ড অন-ডিভাইস স্ক্যান হচ্ছে...'}
                </div>
                <div className="w-44 bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-200"
                    style={{ width: `${Math.max(scanProgress.percent, 10)}%` }}
                  ></div>
                </div>
                <div className="text-emerald-300 text-[11px] mt-1 font-mono font-bold">
                  {scanProgress.percent}%
                </div>
              </div>
            )}
          </div>
        ) : liveModeActive && isStreaming ? (
          // WebRTC Live Stream Viewport
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Framing Guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
              <div className="w-[90%] aspect-[1.586/1] border-2 border-dashed border-emerald-400 rounded-xl flex flex-col justify-between p-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <span className="text-[10px] font-semibold text-emerald-300 bg-black/60 px-2 py-0.5 rounded self-start">
                  এনআইডি কার্ড ফ্রেম
                </span>
                <span className="text-[10px] text-center text-white/90 bg-black/50 py-0.5 rounded">
                  কার্ডটি ফ্রেমের ভেতরে সোজা রাখুন
                </span>
              </div>
            </div>
            {/* Live Camera Cancel Button */}
            <button
              type="button"
              onClick={handleStopLiveCamera}
              className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black"
              aria-label="ক্যামেরা বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Clean Placeholder UI
          <div className="text-center p-4 text-slate-400 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center mb-2">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-200 font-semibold">
              পরিষ্কার আলোতে এনআইডি কার্ডের ছবি তুলুন
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              স্মার্ট কার্ড বা পুরোনো ল্যামিনেটেড কার্ড
            </p>
          </div>
        )}
      </div>

      {/* Warning or Error Container (Compact, non-shifting) */}
      {(scanWarning || streamError) && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-snug">{scanWarning || streamError}</span>
        </div>
      )}

      {/* Field Volunteer Tip */}
      <div className="text-center">
        <p className="text-[11px] text-slate-500 font-medium leading-tight">
          💡 কার্ডটি ফ্রেমের ভেতর সোজা ধরুন। প্রয়োজনে নিচে ম্যানুয়ালি নাম ও নম্বর লিখুন।
        </p>
      </div>

      {/* Primary Touch-Friendly Action Buttons (Min 48px height) */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {capturedImage ? (
          <>
            <button
              type="button"
              onClick={() => runOcrOnImage(capturedImage)}
              disabled={isScanning}
              className="col-span-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 active:scale-98 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>আবার স্ক্যান করুন</span>
            </button>
            <button
              type="button"
              onClick={handleRetake}
              disabled={isScanning}
              className="col-span-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-98 transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>নতুন ছবি তুলুন</span>
            </button>
          </>
        ) : liveModeActive && isStreaming ? (
          <>
            <button
              type="button"
              onClick={handleCaptureLive}
              disabled={!isReady}
              className="col-span-2 min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>{isReady ? 'ছবি তুলুন' : 'ক্যামেরা প্রস্তুত হচ্ছে...'}</span>
            </button>
          </>
        ) : (
          <>
            {/* Primary Button 1: Hardware Camera (Direct & 100% reliable) */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="col-span-1 min-h-[50px] inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>ক্যামেরা দিয়ে ছবি তুলুন</span>
            </button>

            {/* Primary Button 2: Gallery Picker */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="col-span-1 min-h-[50px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-98 transition-all border border-slate-200"
            >
              <ImageIcon className="w-4 h-4 text-slate-600" />
              <span>গ্যালারি / ফাইল</span>
            </button>

            {/* Secondary Option: In-Browser Live Preview */}
            <button
              type="button"
              onClick={handleStartLiveCamera}
              className="col-span-2 py-1 text-[11px] text-emerald-800 font-medium hover:underline inline-flex items-center justify-center gap-1"
            >
              <Video className="w-3.5 h-3.5 text-emerald-700" />
              <span>লাইভ ক্যামেরা প্রিভিউ ব্যবহার করতে চান? এখানে চাপুন</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
