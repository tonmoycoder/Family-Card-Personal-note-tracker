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
} from 'lucide-react';
import { useRecords } from '@/hooks/useRecords';

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
    distinctAreas,
    filteredRecords,
    setSearchQuery,
    setSelectedArea,
    refreshRecords,
  } = useRecords(isOnline);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyNid = (nid: string, indexStr: string) => {
    if (!nid) return;
    navigator.clipboard.writeText(nid);
    setCopiedId(indexStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 pb-20">
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
          const serial = r.Serial || r.serial || idx + 1;
          const formattedSerial = typeof serial === 'number'
            ? `#${String(serial).padStart(3, '0')}`
            : `#${serial}`;
          const localName = r.Local_Known_Name || r.localKnownName || 'অনির্ধারিত';
          const nidName = r.NID_Name || r.nidName;
          const nidNumber = r.NID_Number || r.nidNumber || '';
          const area = r.Area_Para || r.areaPara;
          const date = r.Date || r.date;
          const time = r.Timestamp || r.timestamp;
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

              {/* Timestamp & Links */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {date} {time ? `• ${time}` : ''}
                </span>

                <div className="flex items-center gap-2">
                  {mapsLink && (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>ম্যাপ</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  {driveLink && (
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>এনআইডি ছবি</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
