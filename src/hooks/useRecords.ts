'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SurveyRecord, RecordsApiResponse } from '@/lib/types';

export interface UseRecordsResult {
  records: SurveyRecord[];
  loading: boolean;
  errorMsg: string;
  searchQuery: string;
  selectedArea: string;
  distinctAreas: string[];
  filteredRecords: SurveyRecord[];
  setSearchQuery: (query: string) => void;
  setSelectedArea: (area: string) => void;
  refreshRecords: () => Promise<void>;
}

export function useRecords(_isOnline?: boolean): UseRecordsResult {
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('all');

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

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const nidName = (r.NID_Name || r.nidName || '').toLowerCase();
      const localName = (r.Local_Known_Name || r.localKnownName || '').toLowerCase();
      const nidNumber = (r.NID_Number || r.nidNumber || '').toString();
      const area = (r.Area_Para || r.areaPara || '').trim();

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        nidName.includes(query) ||
        localName.includes(query) ||
        nidNumber.includes(query);

      const matchesArea = selectedArea === 'all' || area === selectedArea;

      return matchesSearch && matchesArea;
    });
  }, [records, searchQuery, selectedArea]);

  return {
    records,
    loading,
    errorMsg,
    searchQuery,
    selectedArea,
    distinctAreas,
    filteredRecords,
    setSearchQuery,
    setSelectedArea,
    refreshRecords: fetchRecords,
  };
}
