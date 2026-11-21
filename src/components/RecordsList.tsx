'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Building,
  Trash2,
  Calendar,
  ArrowUpDown,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useRecords, formatDisplayTime } from '@/hooks/useRecords';
import { SurveyRecord } from '@/lib/types';

interface RecordsListProps {
  isOnline: boolean;
}

export default function RecordsList({ isOnline }: RecordsListProps) {
  const {
    records,
    loading,
    errorMsg,
    searchQuery,
    selectedArea,
    selectedDate,
    sortMode,
    distinctAreas,
    distinctDates,
    filteredRecords,
    setSearchQuery,
    setSelectedArea,
    setSelectedDate,
    setSortMode,
    refreshRecords,
    deleteRecord,
  } = useRecords(isOnline);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    record: SurveyRecord | null;
    isDeleting: boolean;
  }>({
    open: false,
    record: null,
    isDeleting: false,
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyNid = (nid: string, indexStr: string) => {
    if (!nid) return;
    navigator.clipboard.writeText(nid);
    setCopiedId(indexStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (record: SurveyRecord) => {
    if (!isOnline) {
      showToast('ডিলিট করতে ইন্টারনেট সংযোগ প্রয়োজন।', 'error');
      return;
    }
    setDeleteModal({
      open: true,
      record,
      isDeleting: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.record) return;
    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    const r = deleteModal.record;
    const serial = r.Serial !== undefined ? r.Serial : r.serial;
    const date = r.Date || r.date;
    const nidNumber = r.NID_Number || r.nidNumber;
    const imageDriveLink = r.Image_Drive_Link || r.imageDriveLink;

    const res = await deleteRecord({ serial, date, nidNumber, imageDriveLink });

    if (res.success) {
      setDeleteModal({ open: false, record: null, isDeleting: false });
      showToast('এন্ট্রি ও ড্রাইভের ছবি সফলভাবে মুছে ফেলা হয়েছে।', 'success');
    } else {
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
      showToast(res.error || 'ডিলিট করতে সমস্যা হয়েছে।', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className={`fixed top-14 left-4 right-4 z-50 p-3.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center justify-between transition-all transform animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-800 text-white border-rose-700'
              : 'bg-amber-800 text-white border-amber-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/20 rounded-md"
            aria-label="বিজ্ঞপ্তি বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Counter & Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
              মোট অন্তর্ভুক্ত পরিবার
            </div>
            <div className="text-xl font-black text-slate-900 tracking-tight mt-1">
              {records.length} <span className="text-xs font-semibold text-slate-500">টি</span>
            </div>
          </div>
        </div>

        <button
          onClick={refreshRecords}
          disabled={loading}
          aria-label="তালিকা রিফ্রেশ করুন"
          title="তালিকা রিফ্রেশ করুন"
          className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="নাম বা এনআইডি নম্বর দিয়ে খুঁজুন..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-xs"
        />
      </div>

      {/* Sorting Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1 shrink-0">
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <span>সর্ট:</span>
        </span>
        <button
          onClick={() => setSortMode('newest')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
            sortMode === 'newest'
              ? 'bg-emerald-700 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          নতুন তারিখ আগে
        </button>
        <button
          onClick={() => setSortMode('oldest')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
            sortMode === 'oldest'
              ? 'bg-emerald-700 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          পুরোনো তারিখ আগে
        </button>
        <button
          onClick={() => setSortMode('area')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
            sortMode === 'area'
              ? 'bg-emerald-700 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          এলাকা অনুযায়ী
        </button>
      </div>

      {/* Filter Row: Date Filter Dropdown + Area Chips */}
      <div className="space-y-2">
        {/* Date Filter Dropdown */}
        {distinctDates.length > 0 && (
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="তারিখ ফিল্টার"
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            >
              <option value="all">সব তারিখ ({records.length})</option>
              {distinctDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Area Filter Chips */}
        {distinctAreas.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedArea('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                selectedArea === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              সব এলাকা ({records.length})
            </button>
            {distinctAreas.map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  selectedArea === area
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          {errorMsg}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && records.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              <div className="h-3 bg-slate-100 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Records Count Note */}
      {!loading && (
        <div className="text-xs font-medium text-slate-500 px-1">
          প্রদর্শিত হচ্ছে: {filteredRecords.length}টি এন্ট্রি
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRecords.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-700">কোনো রেকর্ড পাওয়া যায়নি</p>
          <p className="text-xs text-slate-500 mt-1">
            অনুসন্ধান ফিল্টার পরিবর্তন করুন অথবা নতুন পরিবার অন্তর্ভুক্ত করুন।
          </p>
        </div>
      )}

      {/* Cards List */}
      <div className="space-y-3">
        {filteredRecords.map((r, idx) => {
          const serial = r.Serial !== undefined ? r.Serial : r.serial !== undefined ? r.serial : idx + 1;
          const formattedSerial =
            typeof serial === 'number' ? `#${String(serial).padStart(3, '0')}` : `#${serial}`;
          const localName = r.Local_Known_Name || r.localKnownName || 'অনির্ধারিত';
          const nidName = r.NID_Name || r.nidName;
          const nidNumber = r.NID_Number || r.nidNumber || '';
          const area = r.Area_Para || r.areaPara;
          const date = r.Date || r.date;
          const rawTime = r.Timestamp || r.timestamp;
          const cleanTime = formatDisplayTime(rawTime);
          const mapsLink = r.Maps_Link || r.mapsLink;
          const driveLink = r.Image_Drive_Link || r.imageDriveLink;
          const notes = r.Notes || r.notes;
          const cardId = `rec_${idx}_${serial}`;

          return (
            <div
              key={cardId}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 transition-colors space-y-3"
            >
              {/* Header: Serial & Area */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-700 text-white font-mono">
                  {formattedSerial}
                </span>

                {area && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Building className="w-3 h-3 text-slate-500" />
                    <span>{area}</span>
                  </span>
                )}
              </div>

              {/* Names */}
              <div>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {localName}
                </h4>
                {nidName && nidName !== localName && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    এনআইডি নাম: <span className="font-medium text-slate-700">{nidName}</span>
                  </p>
                )}
              </div>

              {/* NID Number with Copy */}
              {nidNumber && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-xs font-mono font-bold text-slate-800 tracking-wider">
                    {nidNumber}
                  </div>
                  <button
                    onClick={() => handleCopyNid(String(nidNumber), cardId)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 rounded-md transition-colors"
                  >
                    {copiedId === cardId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-emerald-700" />
                        <span>কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <p className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                  <strong>নোট:</strong> {notes}
                </p>
              )}

              {/* Timestamp Details */}
              <div className="text-xs text-slate-400">
                <span>
                  {date} {cleanTime ? `• ${cleanTime}` : ''}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Maps Link or Subtle Badge */}
                  {mapsLink ? (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      <span>ম্যাপে দেখুন</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 bg-slate-50 border border-slate-200">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>লোকেশন নেই</span>
                    </span>
                  )}

                  {/* Drive Image Link or Subtle Badge */}
                  {driveLink ? (
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <ImageIcon className="w-3 h-3 text-blue-700" />
                      <span>এনআইডি ছবি</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 bg-slate-50 border border-slate-200">
                      <ImageIcon className="w-3 h-3 text-slate-400" />
                      <span>ছবি নেই</span>
                    </span>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteClick(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shrink-0"
                  aria-label="মুছুন"
                >
                  <Trash2 className="w-3 h-3 text-rose-600" />
                  <span>মুছুন</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.record && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                এন্ট্রি স্থায়ীভাবে মুছবেন?
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                আপনি কি নিশ্চিতভাবে সিরিয়াল{' '}
                <strong className="text-slate-900">
                  {(() => {
                    const s =
                      deleteModal.record.Serial !== undefined
                        ? deleteModal.record.Serial
                        : deleteModal.record.serial;
                    return typeof s === 'number' ? `#${String(s).padStart(3, '0')}` : `#${s}`;
                  })()}
                </strong>{' '}
                মুছে ফেলতে চান? এটি গুগল শিট এবং গুগল ড্রাইভের ছবি—দুটোই স্থায়ীভাবে মুছে ফেলবে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, record: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
                className="min-h-[44px] rounded-xl px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {deleteModal.isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <span>হ্যাঁ, মুছুন</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
