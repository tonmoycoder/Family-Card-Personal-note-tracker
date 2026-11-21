'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X, ShieldCheck } from 'lucide-react';

export default function PermissionBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('family_card_pwa_banner_dismissed');
      if (!isDismissed) {
        setDismissed(false);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('family_card_pwa_banner_dismissed', 'true');
    }
  };

  if (dismissed) return null;

  return (
    <div className="mx-4 mt-3 mb-2 bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 shadow-xs relative">
      <div className="flex items-start gap-2.5 pr-6">
        <Smartphone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-emerald-950 flex items-center gap-1">
            <span>মাঠপর্যায়ে দ্রুত কাজের পরামর্শ</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <p className="mt-0.5 text-emerald-800 leading-relaxed">
            ব্রাউজার মেন্যু (⋮) থেকে <strong>&ldquo;Add to Home screen&rdquo;</strong> (হোম স্ক্রিনে যোগ করুন) চাপুন। তাহলে প্রতিবার ক্যামেরা ও জিপিএস অনুমতি চাইতে হবে না এবং সম্পূর্ণ অফলাইনেও কাজ করবে।
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="বিজ্ঞপ্তি বন্ধ করুন"
        className="absolute top-2.5 right-2.5 p-1 text-emerald-600 hover:text-emerald-900 rounded-md hover:bg-emerald-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
