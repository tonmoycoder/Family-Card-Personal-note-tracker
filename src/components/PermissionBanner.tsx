'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, X, ShieldCheck } from 'lucide-react';

export default function PermissionBanner() {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('family_card_pwa_banner_dismissed');
      if (!isDismissed) {
        setVisible(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('family_card_pwa_banner_dismissed', 'true');
    }
  };

  if (!visible) return null;

  return (
    <div className="relative mt-4 mb-2 bg-emerald-900/95 text-white rounded-2xl p-3.5 shadow-md border border-emerald-700/60 transition-all">
      <div className="flex items-start gap-2.5 pr-6">
        <Smartphone className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-xs text-white flex items-center gap-1">
            <span>মাঠপর্যায়ে দ্রুত কাজের পরামর্শ</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="mt-1 text-[11px] text-emerald-100 leading-relaxed">
            ব্রাউজার মেন্যু (⋮) থেকে <strong>&ldquo;Add to Home screen&rdquo;</strong> চাপুন। তাহলে অফলাইনেও সহজে কাজ করবে এবং প্রতিবার অনুমতি চাইতে হবে না।
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="বিজ্ঞপ্তি বন্ধ করুন"
        className="absolute top-2.5 right-2.5 p-1 text-emerald-300 hover:text-white rounded-md hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
