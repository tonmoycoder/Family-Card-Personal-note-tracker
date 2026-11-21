'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SurveyRecord, RecordsApiResponse } from '@/lib/types';

export type RecordSortMode = 'newest' | 'oldest' | 'area';

export interface UseRecordsResult {
  records: SurveyRecord[];
  loading: boolean;
  errorMsg: string;
  searchQuery: string;
  selectedArea: string;
  selectedDate: string;
  sortMode: RecordSortMode;
  distinctAreas: string[];
  distinctDates: string[];
  filteredRecords: SurveyRecord[];
  setSearchQuery: (query: string) => void;
  setSelectedArea: (area: string) => void;
  setSelectedDate: (date: string) => void;
  setSortMode: (mode: RecordSortMode) => void;
  refreshRecords: () => Promise<void>;
  deleteRecord: (recordToDelete: {
    serial?: number | string;
    date?: string;
    nidNumber?: string;
    imageDriveLink?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function formatDisplayTime(rawTime?: string | number): string {
  if (!rawTime) return '';
  const str = String(rawTime).trim();
  if (!str) return '';
  if (str.includes('1899')) {
    const timeMatch = str.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)\b/);
    if (timeMatch) return timeMatch[1];
  }
  return str;
}

export function useRecords(_isOnline?: boolean): UseRecordsResult {
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortMode, setSortMode] = useState<RecordSortMode>('newest');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    // If offline, read straight from localStorage cache
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const cached = localStorage.getItem('family_card_cached_records');
      if (cached) {
        try {
          setRecords(JSON.parse(cached));
        } catch {
          setRecords([]);
        }
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/records', { cache: 'no-store' });
      const json: RecordsApiResponse = await res.json();
      const list = json.data || json.records || [];

      if (json.success && Array.isArray(list)) {
        setRecords(list);
        if (typeof window !== 'undefined') {
          localStorage.setItem('family_card_cached_records', JSON.stringify(list));
        }
      } else {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('family_card_cached_records');
          if (cached) {
            try {
              setRecords(JSON.parse(cached));
            } catch {
              // ignore
            }
          }
        }
        setErrorMsg(json.error || 'রেকর্ড লোড করা যায়নি।');
      }
    } catch {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('family_card_cached_records');
        if (cached) {
          try {
            setRecords(JSON.parse(cached));
          } catch {
            // ignore
          }
        }
      }
      setErrorMsg('সার্ভারে সংযোগ হয়নি। ক্যাশ থেকে দেখানো হচ্ছে।');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch EXACTLY ONCE on mount
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Distinct areas for filter chips
  const distinctAreas = useMemo(() => {
    const areas = new Set<string>();
    records.forEach((r) => {
      const area = (r.Area_Para || r.areaPara || '').trim();
      if (area) areas.add(area);
    });
    return Array.from(areas);
  }, [records]);

  // Distinct dates for date filter dropdown
  const distinctDates = useMemo(() => {
    const dates = new Set<string>();
    records.forEach((r) => {
      const d = (r.Date || r.date || '').trim();
      if (d) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [records]);

  // Filtered & Sorted list
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = records.filter((r) => {
      const nidName = (r.NID_Name || r.nidName || '').toLowerCase();
      const localName = (r.Local_Known_Name || r.localKnownName || '').toLowerCase();
      const nidNumber = (r.NID_Number || r.nidNumber || '').toString();
      const area = (r.Area_Para || r.areaPara || '').trim();
      const date = (r.Date || r.date || '').trim();

      const matchesSearch =
        !query ||
        nidName.includes(query) ||
        localName.includes(query) ||
        nidNumber.includes(query);

      const matchesArea = selectedArea === 'all' || area === selectedArea;
      const matchesDate = selectedDate === 'all' || date === selectedDate;

      return matchesSearch && matchesArea && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'newest') {
        const dateA = a.Date || a.date || '';
        const dateB = b.Date || b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const serialA = Number(a.Serial || a.serial || 0);
        const serialB = Number(b.Serial || b.serial || 0);
        return serialB - serialA;
      }
      if (sortMode === 'oldest') {
        const dateA = a.Date || a.date || '';
        const dateB = b.Date || b.date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const serialA = Number(a.Serial || a.serial || 0);
        const serialB = Number(b.Serial || b.serial || 0);
        return serialA - serialB;
      }
      if (sortMode === 'area') {
        const areaA = a.Area_Para || a.areaPara || '';
        const areaB = b.Area_Para || b.areaPara || '';
        return areaA.localeCompare(areaB, 'bn');
      }
      return 0;
    });
  }, [records, searchQuery, selectedArea, selectedDate, sortMode]);

  // Delete record from remote & local state/cache
  const deleteRecord = useCallback(
    async (recordToDelete: {
      serial?: number | string;
      date?: string;
      nidNumber?: string;
      imageDriveLink?: string;
    }) => {
      try {
        const res = await fetch('/api/records', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordToDelete),
        });
        const json = await res.json();
        if (json.success) {
          setRecords((prev) => {
            const next = prev.filter((r) => {
              const s = r.Serial || r.serial;
              const n = r.NID_Number || r.nidNumber;
              if (recordToDelete.serial !== undefined && s === recordToDelete.serial) return false;
              if (recordToDelete.nidNumber && n === recordToDelete.nidNumber) return false;
              return true;
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('family_card_cached_records', JSON.stringify(next));
            }
            return next;
          });
          return { success: true };
        }
        return { success: false, error: json.error || 'ডিলিট সম্পন্ন করা যায়নি।' };
      } catch {
        return { success: false, error: 'সার্ভার যোগাযোগে ত্রুটি হয়েছে।' };
      }
    },
    []
  );

  return {
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
    refreshRecords: fetchRecords,
    deleteRecord,
  };
}
