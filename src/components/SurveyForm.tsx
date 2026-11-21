'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  CloudUpload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  CreditCard,
  Building,
  RefreshCw,
  X,
} from 'lucide-react';
import CameraScanner from './CameraScanner';
import GpsTracker from './GpsTracker';
import { addToOfflineQueue, getBangladeshDateTime } from '@/lib/offline-queue';
import { ScanResponseData, SubmitRecordPayload } from '@/lib/types';

interface SurveyFormProps {
  isOnline: boolean;
  onFormSubmitted: () => void;
  existingAreas?: string[];
}

export default function SurveyForm({
  isOnline,
  onFormSubmitted,
  existingAreas = [],
}: SurveyFormProps) {
  // Form fields
  const [localKnownName, setLocalKnownName] = useState<string>('');
  const [nidName, setNidName] = useState<string>('');
  const [nidNumber, setNidNumber] = useState<string>('');
  const [areaPara, setAreaPara] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [mapsLink, setMapsLink] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [needsScan, setNeedsScan] = useState<boolean>(false);

  // Suggested areas from scan or history
  const [scannedAreaHint, setScannedAreaHint] = useState<string>('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Duplicate Modal State
  const [duplicateModal, setDuplicateModal] = useState<{
    open: boolean;
    message: string;
    existingSerial?: string | number;
    existingArea?: string;
  }>({ open: false, message: '' });

  // Remember last used area from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedArea = localStorage.getItem('family_card_last_area');
      if (savedArea) {
        setAreaPara(savedArea);
      }
    }
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleScanComplete = useCallback(
    (data: { imageBase64: string; scannedData?: ScanResponseData; isOffline?: boolean }) => {
      setImageBase64(data.imageBase64);

      if (data.isOffline) {
        setNeedsScan(true);
        showToast('ছবি সংরক্ষিত হয়েছে। ইন্টারনেট পেলে নাম ও নম্বর স্বয়ংক্রিয়ভাবে স্ক্যান হবে।', 'info');
        return;
      }

      if (data.scannedData) {
        setNeedsScan(false);
        if (data.scannedData.nidName) {
          setNidName(data.scannedData.nidName);
          // If local name is currently empty, show gentle suggestion or allow default
          if (!localKnownName) {
            setLocalKnownName(data.scannedData.nidName);
          }
        }
        if (data.scannedData.nidNumber) {
          setNidNumber(data.scannedData.nidNumber);
        }
        if (data.scannedData.detectedAddressArea) {
          setScannedAreaHint(data.scannedData.detectedAddressArea);
        }
        showToast('এনআইডি তথ্য সফলভাবে পড়া হয়েছে!', 'success');
      }
    },
    [localKnownName]
  );

  const handleClearImage = () => {
    setImageBase64('');
    setNeedsScan(false);
    setScannedAreaHint('');
  };

  const resetFormPreservingArea = () => {
    setLocalKnownName('');
    setNidName('');
    setNidNumber('');
    setNotes('');
    setImageBase64('');
    setNeedsScan(false);
    setScannedAreaHint('');
  };

  const handleSubmit = async (forceDuplicate = false) => {
    if (!imageBase64) {
      showToast('দয়া করে এনআইডি কার্ডের ছবি তুলুন বা নির্বাচন করুন।', 'error');
      return;
    }

    if (!areaPara.trim()) {
      showToast('দয়া করে এলাকা বা পাড়ার নাম লিখুন।', 'error');
      return;
    }

    // Persist selected area in localStorage for subsequent entries
    if (typeof window !== 'undefined') {
      localStorage.setItem('family_card_last_area', areaPara.trim());
    }

    const { capturedDate, capturedTimestamp } = getBangladeshDateTime();
    // Default local name to NID name if empty
    const resolvedLocalName = localKnownName.trim() || nidName.trim() || 'অটো-স্ক্যান অপেক্ষমাণ';

    setIsSubmitting(true);

    // If Offline: Direct to IndexedDB
    if (!isOnline) {
      try {
        await addToOfflineQueue({
          capturedDate,
          capturedTimestamp,
          nidName: nidName.trim(),
          nidNumber: nidNumber.trim(),
          localKnownName: resolvedLocalName,
          areaPara: areaPara.trim(),
          mapsLink: mapsLink.trim(),
          imageBase64,
          notes: notes.trim(),
          needsScan: needsScan || !nidName.trim() || !nidNumber.trim(),
          forceDuplicate,
        });

        showToast('অফলাইনে সংরক্ষিত হয়েছে! ইন্টারনেট পেলেই অটো-সিঙ্ক হবে।', 'success');
        resetFormPreservingArea();
        onFormSubmitted();
      } catch (err) {
        console.error('Offline save error:', err);
        showToast('অফলাইন স্টোরেজে সংরক্ষণে সমস্যা হয়েছে।', 'error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Online: Submit to server Route Handler
    const payload: SubmitRecordPayload = {
      capturedDate,
      capturedTimestamp,
      nidName: nidName.trim(),
      nidNumber: nidNumber.trim(),
      localKnownName: resolvedLocalName,
      areaPara: areaPara.trim(),
      mapsLink: mapsLink.trim(),
      imageBase64,
      notes: notes.trim(),
      forceDuplicate,
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        showToast('সফলভাবে ডাটাবেজ ও গুগল ড্রাইভে আপলোড হয়েছে!', 'success');
        resetFormPreservingArea();
        setDuplicateModal({ open: false, message: '' });
        onFormSubmitted();
      } else if (data.duplicate && !forceDuplicate) {
        setDuplicateModal({
          open: true,
          message: data.message || 'এই এনআইডি নম্বরটি ডাটাবেজে ইতিমধ্যে বিদ্যমান।',
          existingSerial: data.existingSerial,
          existingArea: data.existingArea,
        });
      } else {
        // API level error: fallback save to offline queue so data is never lost
        await addToOfflineQueue({
          ...payload,
          needsScan: false,
        });
        showToast(
          'সার্ভার রেসপন্স দেয়নি, তবে ডেটা ডিভাইসে অফলাইনে সংরক্ষিত রাখা হয়েছে।',
          'info'
        );
        resetFormPreservingArea();
        onFormSubmitted();
      }
    } catch (err) {
      console.warn('Network request failed, saving to IndexedDB queue:', err);
      try {
        await addToOfflineQueue({
          ...payload,
          needsScan: false,
        });
        showToast('ইন্টারনেট সংযোগে ত্রুটি। ডেটা অফলাইনে সুরক্ষিতভাবে জমা হয়েছে।', 'info');
        resetFormPreservingArea();
        onFormSubmitted();
      } catch (idbErr) {
        console.error('IndexedDB fallback failed:', idbErr);
        showToast('সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-14 left-4 right-4 z-50 p-3.5 rounded-xl shadow-lg border text-sm font-semibold flex items-center justify-between transition-all transform animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-800 text-white border-rose-700'
              : 'bg-amber-800 text-white border-amber-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0" />}
            {toastMessage.type === 'info' && <RefreshCw className="w-5 h-5 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/20 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Camera / NID Capture Component */}
      <CameraScanner
        isOnline={isOnline}
        onScanComplete={handleScanComplete}
        onClearImage={handleClearImage}
        savedImageBase64={imageBase64}
      />

      {/* 2. Field GPS Location Tracker */}
      <GpsTracker
        onLocationChange={(link) => setMapsLink(link)}
        currentMapsLink={mapsLink}
      />

      {/* 3. Survey Input Fields */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Field 1 (Top highlighted): স্থানীয় পরিচিত নাম */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
          <label
            htmlFor="localKnownName"
            className="block text-sm font-bold text-emerald-950 flex items-center gap-1.5"
          >
            <User className="w-4 h-4 text-emerald-700" />
            <span>স্থানীয় পরিচিত নাম (ডাকনাম / পরিবারের প্রধান)</span>
          </label>
          <input
            id="localKnownName"
            type="text"
            value={localKnownName}
            onChange={(e) => setLocalKnownName(e.target.value)}
            placeholder="যেমন: রহিম মেম্বার / করিমের মা"
            className="mt-1.5 w-full px-3.5 py-3 rounded-lg border border-emerald-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-base"
          />
          <p className="mt-1 text-xs text-emerald-800 font-medium">
            * খালি রাখলে অটোমেটিক এনআইডি কার্ডের নাম সেভ হবে।
          </p>
        </div>

        {/* Field 2: এনআইডি নাম */}
        <div>
          <label
            htmlFor="nidName"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>এনআইডি নাম (বাংলায়)</span>
          </label>
          <input
            id="nidName"
            type="text"
            value={nidName}
            onChange={(e) => setNidName(e.target.value)}
            placeholder="এনআইডি অনুযায়ী নাম"
            className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
          />
        </div>

        {/* Field 3: এনআইডি নম্বর */}
        <div>
          <label
            htmlFor="nidNumber"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
            <span>এনআইডি নম্বর (১০, ১৩ বা ১৭ ডিজিট)</span>
          </label>
          <input
            id="nidNumber"
            type="text"
            inputMode="numeric"
            value={nidNumber}
            onChange={(e) => setNidNumber(e.target.value)}
            placeholder="যেমন: 19851234567890123"
            className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm tracking-wider"
          />
        </div>

        {/* Field 4: এলাকা / পাড়া */}
        <div>
          <label
            htmlFor="areaPara"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5"
          >
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span>এলাকা / পাড়া / গ্রাম (বাধ্যতামূলক)</span>
          </label>
          <input
            id="areaPara"
            type="text"
            value={areaPara}
            onChange={(e) => setAreaPara(e.target.value)}
            placeholder="যেমন: দক্ষিণ পাড়া, ৩নং ওয়ার্ড"
            className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
          />

          {/* Quick Area Chips */}
          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
            {scannedAreaHint && scannedAreaHint !== areaPara && (
              <button
                type="button"
                onClick={() => setAreaPara(scannedAreaHint)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-colors"
              >
                <span>কার্ড থেকে প্রাপ্ত:</span>
                <span className="font-bold">{scannedAreaHint}</span>
              </button>
            )}

            {existingAreas.slice(0, 4).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setAreaPara(area)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  areaPara === area
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Field 5: নোট (ঐচ্ছিক) */}
        <div>
          <label
            htmlFor="notes"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
          >
            নোট / বাদ পড়ার বিবরণ (ঐচ্ছিক)
          </label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="যেমন: কোনো সরকারি ভাতা পান না, নদীভাঙন পরিবার"
            className="mt-1 w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* 4. Large Outdoor-Friendly Submit Button (Min 52px height) */}
      <button
        type="button"
        onClick={() => handleSubmit(false)}
        disabled={isSubmitting}
        className={`w-full min-h-[52px] rounded-2xl flex items-center justify-center gap-2.5 text-base font-bold text-white shadow-lg active:scale-98 transition-all ${
          isOnline
            ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-900/20'
            : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20'
        } disabled:opacity-50`}
      >
        {isSubmitting ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>সংরক্ষণ করা হচ্ছে...</span>
          </>
        ) : isOnline ? (
          <>
            <CloudUpload className="w-5 h-5" />
            <span>সেভ ও ড্রাইভে আপলোড করুন</span>
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>অফলাইন কিউতে সেভ করুন</span>
          </>
        )}
      </button>

      {/* Duplicate Confirmation Modal */}
      {duplicateModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              ডুপ্লিকেট এনআইডি সতর্কতা
            </h3>

            <p className="mt-2 text-xs text-slate-600 text-center leading-relaxed">
              {duplicateModal.message}
            </p>

            {(duplicateModal.existingSerial || duplicateModal.existingArea) && (
              <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                {duplicateModal.existingSerial && (
                  <div>
                    আগের সিরিয়াল: <strong>#{duplicateModal.existingSerial}</strong>
                  </div>
                )}
                {duplicateModal.existingArea && (
                  <div>
                    আগের এলাকা: <strong>{duplicateModal.existingArea}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDuplicateModal({ open: false, message: '' })}
                className="min-h-[46px] rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="min-h-[46px] rounded-xl px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700"
              >
                তবুও নতুন এন্ট্রি করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
