'use client';

import React, { useRef, useCallback } from 'react';
import { CropRectPercent } from '@/lib/nid-ocr';

interface NidCropOverlayProps {
  cropRect: CropRectPercent;
  onChange: (rect: CropRectPercent) => void;
  disabled?: boolean;
}

type DragType = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const MIN_SIZE = 0.15; // Minimum 15% width and height

export default function NidCropOverlay({
  cropRect,
  onChange,
  disabled = false,
}: NidCropOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<{
    type: DragType;
    startX: number;
    startY: number;
    initialRect: CropRectPercent;
  } | null>(null);

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  const handlePointerDown = useCallback(
    (type: DragType, e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();
      e.preventDefault();

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      dragRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        initialRect: { ...cropRect },
      };
    },
    [cropRect, disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !containerRef.current) return;
      e.stopPropagation();
      e.preventDefault();

      const container = containerRef.current.getBoundingClientRect();
      if (container.width <= 0 || container.height <= 0) return;

      const { type, startX, startY, initialRect } = dragRef.current;
      const dx = (e.clientX - startX) / container.width;
      const dy = (e.clientY - startY) / container.height;

      let nextX = initialRect.x;
      let nextY = initialRect.y;
      let nextW = initialRect.w;
      let nextH = initialRect.h;

      if (type === 'move') {
        nextX = clamp(initialRect.x + dx, 0, 1 - initialRect.w);
        nextY = clamp(initialRect.y + dy, 0, 1 - initialRect.h);
      } else if (type === 'nw') {
        const right = initialRect.x + initialRect.w;
        const bottom = initialRect.y + initialRect.h;
        nextX = clamp(initialRect.x + dx, 0, right - MIN_SIZE);
        nextY = clamp(initialRect.y + dy, 0, bottom - MIN_SIZE);
        nextW = right - nextX;
        nextH = bottom - nextY;
      } else if (type === 'ne') {
        const bottom = initialRect.y + initialRect.h;
        nextY = clamp(initialRect.y + dy, 0, bottom - MIN_SIZE);
        nextW = clamp(initialRect.w + dx, MIN_SIZE, 1 - initialRect.x);
        nextH = bottom - nextY;
      } else if (type === 'sw') {
        const right = initialRect.x + initialRect.w;
        nextX = clamp(initialRect.x + dx, 0, right - MIN_SIZE);
        nextW = right - nextX;
        nextH = clamp(initialRect.h + dy, MIN_SIZE, 1 - initialRect.y);
      } else if (type === 'se') {
        nextW = clamp(initialRect.w + dx, MIN_SIZE, 1 - initialRect.x);
        nextH = clamp(initialRect.h + dy, MIN_SIZE, 1 - initialRect.y);
      }

      onChange({
        x: Math.round(nextX * 1000) / 1000,
        y: Math.round(nextY * 1000) / 1000,
        w: Math.round(nextW * 1000) / 1000,
        h: Math.round(nextH * 1000) / 1000,
      });
    },
    [onChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragRef.current = null;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none overflow-hidden touch-none pointer-events-auto"
      style={{ touchAction: 'none' }}
    >
      {/* Interactive Crop Box with Dim Backdrop via Box-Shadow */}
      <div
        className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/10 cursor-move"
        style={{
          left: `${cropRect.x * 100}%`,
          top: `${cropRect.y * 100}%`,
          width: `${cropRect.w * 100}%`,
          height: `${cropRect.h * 100}%`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
        }}
        onPointerDown={(e) => handlePointerDown('move', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="এনআইডি ক্রপ বক্স"
        role="region"
      >
        {/* Subtle Helper Badges */}
        <div className="absolute top-1 left-2 pointer-events-none flex items-center gap-1">
          <span className="text-[10px] font-bold text-emerald-300 bg-slate-950/85 px-2 py-0.5 rounded shadow">
            তথ্যের এলাকা (নাম ও এনআইডি)
          </span>
        </div>
        <div className="absolute bottom-1 right-2 pointer-events-none">
          <span className="text-[9px] text-white/80 bg-slate-950/75 px-1.5 py-0.5 rounded shadow">
            টেনে ছোট-বড় করুন
          </span>
        </div>

        {/* 4 Corner Touch Handles (Min 36x36px Touch Target) */}
        {/* Top-Left (NW) */}
        <div
          className="absolute -top-4 -left-4 w-9 h-9 flex items-center justify-center cursor-nwse-resize touch-none z-20"
          onPointerDown={(e) => handlePointerDown('nw', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="উপরের বাম কোণা"
        >
          <span className="w-3.5 h-3.5 bg-white border-2 border-emerald-500 rounded-full shadow-md" />
        </div>

        {/* Top-Right (NE) */}
        <div
          className="absolute -top-4 -right-4 w-9 h-9 flex items-center justify-center cursor-nesw-resize touch-none z-20"
          onPointerDown={(e) => handlePointerDown('ne', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="উপরের ডান কোণা"
        >
          <span className="w-3.5 h-3.5 bg-white border-2 border-emerald-500 rounded-full shadow-md" />
        </div>

        {/* Bottom-Left (SW) */}
        <div
          className="absolute -bottom-4 -left-4 w-9 h-9 flex items-center justify-center cursor-nesw-resize touch-none z-20"
          onPointerDown={(e) => handlePointerDown('sw', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="নিচের বাম কোণা"
        >
          <span className="w-3.5 h-3.5 bg-white border-2 border-emerald-500 rounded-full shadow-md" />
        </div>

        {/* Bottom-Right (SE) */}
        <div
          className="absolute -bottom-4 -right-4 w-9 h-9 flex items-center justify-center cursor-nwse-resize touch-none z-20"
          onPointerDown={(e) => handlePointerDown('se', e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="নিচের ডান কোণা"
        >
          <span className="w-3.5 h-3.5 bg-white border-2 border-emerald-500 rounded-full shadow-md" />
        </div>
      </div>
    </div>
  );
}
