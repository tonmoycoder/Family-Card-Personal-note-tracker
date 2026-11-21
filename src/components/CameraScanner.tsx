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
  RotateCw,
  Crop,
  Copy,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { compressImageToBase64 } from '@/lib/image-utils';
import {
  scanBangladeshNidOnDevice,
  rotateImageDataUrl,
  isOcrEngineWarm,
  CropRectPercent,
  OnDeviceScanResult,
  toEnglishDigits,
} from '@/lib/nid-ocr';
import { ScanResponseData } from '@/lib/types';
import { useCameraStream } from '@/hooks/useCameraStream';
import NidCropOverlay from './NidCropOverlay';

interface CameraScannerProps {
  isOnline: boolean;
  onScanComplete: (data: {
    imageBase64: string;
    scannedData?: ScanResponseData;
    isOffline?: boolean;
  }) => void;
  onClearImage?: () => void;
  savedImageBase64?: string;
  onApplyField?: (field: 'nidName' | 'localKnownName' | 'nidNumber', value: string) => void;
}

const DEFAULT_CROP: CropRectPercent = {
  x: 0.24,
  y: 0.22,
  w: 0.62,
  h: 0.70,
};

export default function CameraScanner({
  isOnline,
  onScanComplete,
  onClearImage,
  savedImageBase64,
  onApplyField,
}: CameraScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string>(savedImageBase64 || '');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isWarm, setIsWarm] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  // ROI Crop states
  const [cropMode, setCropMode] = useState<boolean>(true);
  const [cropRect, setCropRect] = useState<CropRectPercent>(DEFAULT_CROP);

  // Scan Results
  const [scanResult, setScanResult] = useState<OnDeviceScanResult | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);

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

  useEffect(() => {
    setIsWarm(isOcrEngineWarm());
  }, []);

  const checkOrientation = useCallback((dataUrl: string) => {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      setIsPortrait(img.naturalHeight > img.naturalWidth);
    };
    img.src = dataUrl;
  }, []);

  // Execute on-device OCR without blocking user interaction or form typing
  const runOcrOnImage = useCallback(
    async (base64Image: string, activeCrop: CropRectPercent | null) => {
      setScanWarning('');
      setIsScanning(true);
      setScanProgress({ percent: 5, text: 'ছবি প্রস্তুত হচ্ছে...' });

      try {
        let ocrResult: OnDeviceScanResult;
        // Test hook for deterministic automated testing
        if (
          typeof window !== 'undefined' &&
          (window as unknown as { __MOCK_NID_SCAN__?: (img: string) => Promise<unknown> }).__MOCK_NID_SCAN__
        ) {
          const mockData = (await (
            window as unknown as { __MOCK_NID_SCAN__: (img: string) => Promise<unknown> }
          ).__MOCK_NID_SCAN__(base64Image)) as {
            nidName: string;
            nidNumber: string;
            confidence: 'high' | 'medium' | 'low';
            warning: string;
            rawText: string;
          };

          ocrResult = {
            cleanedText: mockData.rawText || `${mockData.nidName}\n${mockData.nidNumber}`,
            cleanedLines: (mockData.rawText || `${mockData.nidName}\n${mockData.nidNumber}`).split('\n').filter(Boolean),
            suggestedName: mockData.nidName,
            suggestedNid: mockData.nidNumber,
            nidName: mockData.nidName,
            nidNumber: mockData.nidNumber,
            confidence: mockData.confidence,
            warning: mockData.warning,
            rawText: mockData.rawText,
          };
        } else {
          ocrResult = await scanBangladeshNidOnDevice(base64Image, {
            crop: activeCrop,
            onProgress: (percent, text) => {
              setScanProgress({ percent, text });
            },
          });
        }

        setScanResult(ocrResult);
        setIsWarm(true);

        if (ocrResult.warning) {
          setScanWarning(ocrResult.warning);
        }

        onScanComplete({
          imageBase64: base64Image,
          scannedData: {
            nidName: ocrResult.nidName || ocrResult.suggestedName,
            nidNumber: ocrResult.nidNumber || ocrResult.suggestedNid,
            confidence: ocrResult.confidence,
            warning: ocrResult.warning,
            rawText: ocrResult.rawText,
            cleanedText: ocrResult.cleanedText,
            cleanedLines: ocrResult.cleanedLines,
            suggestedName: ocrResult.suggestedName,
            suggestedNid: ocrResult.suggestedNid,
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
      setScanResult(null);
      checkOrientation(rawBase64);

      // Immediately notify parent with the color photo so it's guaranteed to be saved
      onScanComplete({
        imageBase64: rawBase64,
        isOffline: !isOnline,
      });

      // Asynchronously run on-device OCR using default crop
      runOcrOnImage(rawBase64, cropMode ? cropRect : null);
    },
    [checkOrientation, cropMode, cropRect, isOnline, onScanComplete, runOcrOnImage]
  );

  const handleRotate90 = async () => {
    if (!capturedImage || isRotating || isScanning) return;
    setIsRotating(true);
    try {
      const rotated = await rotateImageDataUrl(capturedImage, 90);
      setCapturedImage(rotated);
      checkOrientation(rotated);

      // Parent always receives the rotated photo so Google Drive gets the straightened version
      onScanComplete({
        imageBase64: rotated,
        isOffline: !isOnline,
      });

      // Automatically re-scan the straightened image
      runOcrOnImage(rotated, cropMode ? cropRect : null);
    } catch (err) {
      console.error('Rotation error:', err);
      setScanWarning('ছবি ঘোরাতে সমস্যা হয়েছে।');
    } finally {
      setIsRotating(false);
    }
  };

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
    const res = captureFrame();
    const frame = typeof res === 'string' ? res : res?.dataUrl;
    if (frame && !(typeof res === 'object' && res?.isBlack)) {
      setLiveModeActive(false);
      handleProcessImage(frame);
    } else {
      setScanWarning('ক্যামেরা ফ্রেম কালো এসেছে। পর্যাপ্ত আলোতে আবার ছবি তুলুন।');
    }
  };

  const handleRetake = () => {
    setCapturedImage('');
    setScanResult(null);
    setScanWarning('');
    setIsPortrait(false);
    setScanProgress({ percent: 0, text: '' });
    handleStopLiveCamera();
    if (onClearImage) onClearImage();
  };

  const handleCopyAll = async () => {
    if (!scanResult?.cleanedText) return;
    try {
      await navigator.clipboard.writeText(scanResult.cleanedText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyLine = async (line: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopiedLineIdx(idx);
      setTimeout(() => setCopiedLineIdx(null), 2000);
    } catch {
      // fallback
    }
  };

  // Helper to extract clean value from label: value format
  const getCleanLineValue = (line: string): string => {
    if (line.includes(':')) {
      return line.split(':')[1].trim();
    }
    return line.trim();
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

      {/* Header Label & Status Badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-emerald-700" />
          <span>এনআইডি কার্ডের ছবি (বাধ্যতামূলক)</span>
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isWarm && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              বাংলা ওসিআর প্রস্তুত ✓
            </span>
          )}
          {capturedImage && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>ছবি সংরক্ষিত</span>
            </span>
          )}
        </div>
      </div>

      {/* Fixed Aspect Ratio Viewport (85.6mm x 54mm -> aspect-[1.586/1]) */}
      <div className="relative w-full aspect-[1.586/1] bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center shadow-inner">
        {capturedImage ? (
          // Captured Image Preview (Real Color <img>) with interactive Crop Overlay
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="এনআইডি প্রিভিউ"
              className="w-full h-full object-contain"
            />

            {/* Interactive Crop Box Overlay (when crop mode is on and not scanning) */}
            {cropMode && !isScanning && !isRotating && (
              <NidCropOverlay
                cropRect={cropRect}
                onChange={setCropRect}
              />
            )}

            {/* OCR Inline Progress Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-30">
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

      {/* Portrait Auto-Hint Banner */}
      {capturedImage && isPortrait && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>ছবিটি কাত হয়ে থাকলে &apos;৯০° ঘোরান&apos; চেপে সোজা করুন।</span>
          </div>
          <button
            type="button"
            onClick={handleRotate90}
            disabled={isScanning || isRotating}
            className="shrink-0 px-2 py-1 bg-amber-200/80 hover:bg-amber-300 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            <span>সোজা করুন</span>
          </button>
        </div>
      )}

      {/* Warning or Error Container */}
      {(scanWarning || streamError) && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-snug">{scanWarning || streamError}</span>
        </div>
      )}

      {/* Photo Toolbar & Controls (When Image is Captured) */}
      {capturedImage && (
        <div className="space-y-2 pt-1">
          {/* Sub-bar: Crop Mode Toggle & Rotate 90° */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCropMode((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  cropMode
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
                aria-label="ক্রপ মোড পরিবর্তন"
              >
                <Crop className="w-3.5 h-3.5 text-emerald-700" />
                <span>{cropMode ? 'তথ্যের অংশ ক্রপ: অন' : 'পুরো কার্ড'}</span>
              </button>
              {cropMode && (
                <button
                  type="button"
                  onClick={() => setCropRect(DEFAULT_CROP)}
                  className="px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  রিসেট
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleRotate90}
              disabled={isScanning || isRotating}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 transition-colors"
              aria-label="৯০ ডিগ্রি ঘোরান"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-600 ${isRotating ? 'animate-spin' : ''}`} />
              <span>৯০° ঘোরান</span>
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => runOcrOnImage(capturedImage, cropMode ? cropRect : null)}
              disabled={isScanning || isRotating}
              className="col-span-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>{isScanning ? 'স্ক্যান হচ্ছে...' : 'স্ক্যান করুন'}</span>
            </button>
            <button
              type="button"
              onClick={handleRetake}
              disabled={isScanning || isRotating}
              className="col-span-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-98 transition-all disabled:opacity-50 border border-slate-200"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>নতুন ছবি তুলুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Mode Buttons */}
      {!capturedImage && liveModeActive && isStreaming && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleCaptureLive}
            disabled={!isReady}
            className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-md active:scale-98 transition-all disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>{isReady ? 'ছবি তুলুন' : 'ক্যামেরা প্রস্তুত হচ্ছে...'}</span>
          </button>
        </div>
      )}

      {/* Pre-Capture Buttons (Camera & Gallery) */}
      {!capturedImage && (!liveModeActive || !isStreaming) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Primary Button 1: Hardware Camera */}
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
        </div>
      )}

      {/* "স্ক্যান করা তথ্য" Panel (Multi-line info & one-tap line pills) */}
      {scanResult && scanResult.cleanedText && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5 mt-2">
          {/* Header with Title & Copy All Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>স্ক্যান করা তথ্য</span>
            </div>
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-1 rounded-md transition-colors"
              aria-label="সব কপি করুন"
            >
              {copiedAll ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-emerald-700" />
                  <span>সব কপি করুন</span>
                </>
              )}
            </button>
          </div>

          {/* Multi-line Cleaned Text Display */}
          <textarea
            readOnly
            rows={Math.min(scanResult.cleanedLines.length + 1, 5)}
            value={scanResult.cleanedText}
            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 leading-relaxed shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="স্ক্যান করা পাঠ্য"
          />

          {/* One-Tap Line Action Chips */}
          {scanResult.cleanedLines.length > 0 && onApplyField && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-600 block">
                এক ক্লিকে ফর্ম ফিলাপ করুন:
              </span>
              <div className="space-y-1.5">
                {scanResult.cleanedLines.map((line, idx) => {
                  const cleanVal = getCleanLineValue(line);
                  const engDigits = toEnglishDigits(cleanVal).replace(/\D/g, '');
                  const hasDigits = engDigits.length >= 8;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs"
                    >
                      <span className="truncate text-slate-800 font-medium max-w-[150px] sm:max-w-[200px]" title={line}>
                        {line}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Name Action Chip */}
                        <button
                          type="button"
                          onClick={() => onApplyField('nidName', cleanVal)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors"
                          title="এনআইডি নাম ফিল্ডে বসান"
                        >
                          + নাম
                        </button>

                        {/* Local Name Action Chip */}
                        <button
                          type="button"
                          onClick={() => onApplyField('localKnownName', cleanVal)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded transition-colors"
                          title="স্থানীয় পরিচিত নাম ফিল্ডে বসান"
                        >
                          + ডাকনাম
                        </button>

                        {/* NID Number Action Chip (if line contains digits) */}
                        {hasDigits && (
                          <button
                            type="button"
                            onClick={() => onApplyField('nidNumber', engDigits)}
                            className="px-1.5 py-0.5 text-[10px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded transition-colors"
                            title="এনআইডি নম্বর ফিল্ডে বসান"
                          >
                            + নম্বর
                          </button>
                        )}

                        {/* Line Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyLine(cleanVal, idx)}
                          className="p-1 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
                          title="এই লাইন কপি করুন"
                          aria-label={`লাইন ${idx + 1} কপি করুন`}
                        >
                          {copiedLineIdx === idx ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
