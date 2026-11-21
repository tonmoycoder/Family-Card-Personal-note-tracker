'use client';

import type { Worker } from 'tesseract.js';
import { ScanResult, NidScannerEngine } from './nid-scanner.interface';

export type OnDeviceScanResult = ScanResult;

const BANGLA_TO_ENGLISH_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

let workerPromise: Promise<Worker> | null = null;
let currentProgressCb: ((percent: number, message: string) => void) | null = null;

function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => BANGLA_TO_ENGLISH_DIGITS[d] || d);
}

function mapStatusToBangla(status: string): string {
  if (status.includes('loading tesseract core')) return 'ওসিআর ইঞ্জিন লোড হচ্ছে...';
  if (status.includes('loading language traineddata')) return 'বাংলা ও ইংরেজি মডেল ডাউনলোড হচ্ছে (প্রথমবার)...';
  if (status.includes('initializing')) return 'স্ক্যানার প্রস্তুত হচ্ছে...';
  if (status.includes('recognizing text')) return 'এনআইডি কার্ডের লেখা পড়া হচ্ছে...';
  return 'ছবি প্রসেস হচ্ছে...';
}

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['ben', 'eng'], 1, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
        logger: (m) => {
          if (currentProgressCb && typeof m.progress === 'number') {
            currentProgressCb(Math.round(m.progress * 100), mapStatusToBangla(m.status || ''));
          }
        },
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Enhances contrast & suppresses light NID watermarks/holograms
 * WITHOUT harsh binary thresholding (which breaks thin Bengali matra/kar strokes).
 */
async function preprocessImageForOcr(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('ওসিআর-এর জন্য ছবি লোড করা যায়নি।'));
    img.onload = () => {
      const targetWidth = Math.min(Math.max(img.width, 1200), 1800);
      const scale = targetWidth / img.width;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Pass 1: Grayscale & find dynamic range
      const grays = new Uint8ClampedArray(width * height);
      const hist = new Uint32Array(256);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        grays[p] = g;
        hist[g]++;
      }

      const totalPixels = width * height;
      let lowCut = 0;
      let highCut = 255;
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (acc >= totalPixels * 0.03) {
          lowCut = v;
          break;
        }
      }
      acc = 0;
      for (let v = 255; v >= 0; v--) {
        acc += hist[v];
        if (acc >= totalPixels * 0.15) {
          highCut = v;
          break;
        }
      }
      const range = Math.max(highCut - lowCut, 40);

      // Pass 2: Soft contrast stretch so dark text stays crisp and watermarks fade to white
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let norm = (grays[p] - lowCut) / range;
        if (norm < 0) norm = 0;
        if (norm > 1) norm = 1;
        const boosted = norm > 0.72 ? 255 : Math.round(Math.pow(norm, 1.35) * 255);
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
}

function cleanBanglaName(line: string): string {
  return line
    .replace(/^(নাম|ন[াো]ম|Name)\s*[:ঃ\-।.]*\s*/i, '')
    .replace(/[^\u0980-\u09FF\s.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanEnglishName(line: string): string {
  return line
    .replace(/^Name\s*[:\-.\s]*/i, '')
    .replace(/[^A-Za-z\s.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNidNumber(rawText: string): string {
  const normalized = toEnglishDigits(rawText);

  // Priority 1: Explicitly labeled NID No / ID NO
  const labeledMatch = normalized.match(
    /(?:NID\s*N[o0.]*|ID\s*N[o0.]*|আইডি\s*নং|নম্বর)\s*[:\-.\s]*([0-9][0-9\s\-]{8,22}[0-9])/i
  );
  if (labeledMatch) {
    const digits = labeledMatch[1].replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 13 || digits.length === 17) {
      return digits;
    }
  }

  // Priority 2: Smart Card 3-3-4 spaced pattern anywhere in text
  const smartSpaced = normalized.match(/\b(\d{3})\s+(\d{3})\s+(\d{4})\b/);
  if (smartSpaced) {
    return `${smartSpaced[1]}${smartSpaced[2]}${smartSpaced[3]}`;
  }

  // Priority 3: Any standalone 17, 13, or 10 digit sequence
  const candidates = normalized.match(/\d[\d\s\-]{8,20}\d/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 17 || digits.length === 13 || digits.length === 10) {
      return digits;
    }
  }

  return '';
}

export function parseBangladeshNidText(rawText: string): { nidName: string; nidNumber: string } {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let nidName = '';

  // Strategy 1: Look for "নাম" label (old card = same line, smart card = next line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/নাম/.test(line) && !/পিতার|মাতার|স্বামীর/.test(line)) {
      const sameLine = cleanBanglaName(line);
      if (sameLine.length >= 3) {
        nidName = sameLine;
        break;
      }
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
        if (/Name|পিতা|মাতা|Date|Birth/i.test(lines[j])) break;
        const nextClean = cleanBanglaName(lines[j]);
        if (nextClean.length >= 3) {
          nidName = nextClean;
          break;
        }
      }
      if (nidName) break;
    }
  }

  // Strategy 2: If "নাম" label itself was smudged, look right above "Name" for a Bengali line
  if (!nidName) {
    const engNameIdx = lines.findIndex((l) => /\bName\b/i.test(l));
    if (engNameIdx > 0) {
      for (let k = engNameIdx - 1; k >= Math.max(0, engNameIdx - 2); k--) {
        const candidate = cleanBanglaName(lines[k]);
        if (
          candidate.length >= 3 &&
          !/জাতীয়|পরিচয়|গণপ্রজাতন্ত্রী|বাংলাদেশ|সরকার/.test(candidate)
        ) {
          nidName = candidate;
          break;
        }
      }
    }
  }

  // Strategy 3: Fallback to English Name if Bangla text was unreadable
  if (!nidName) {
    for (let i = 0; i < lines.length; i++) {
      if (/\bName\b/i.test(lines[i])) {
        const same = cleanEnglishName(lines[i]);
        if (same.length >= 3) {
          nidName = same;
          break;
        }
        if (i + 1 < lines.length) {
          const next = cleanEnglishName(lines[i + 1]);
          if (next.length >= 3) {
            nidName = next;
            break;
          }
        }
      }
    }
  }

  const nidNumber = extractNidNumber(rawText);
  return { nidName, nidNumber };
}

export async function scanBangladeshNidOnDevice(
  imageDataUrl: string,
  onProgress?: (percent: number, statusText: string) => void
): Promise<ScanResult> {
  currentProgressCb = onProgress || null;
  try {
    onProgress?.(5, 'ছবি পরিষ্কার করা হচ্ছে...');
    const processedUrl = await preprocessImageForOcr(imageDataUrl);

    const worker = await getOcrWorker();
    const { data } = await worker.recognize(processedUrl);

    const rawText = data.text || '';
    const { nidName, nidNumber } = parseBangladeshNidText(rawText);
    const score = typeof data.confidence === 'number' ? data.confidence : 0;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (nidName && nidNumber && score >= 65) confidence = 'high';
    else if (nidName || nidNumber) confidence = 'medium';

    let warning = '';
    if (!nidName && !nidNumber) {
      warning = 'লেখা স্পষ্ট পড়া যায়নি। পর্যাপ্ত আলোতে এনআইডি কার্ডটি সোজা ধরে আবার তুলুন অথবা নিচে ম্যানুয়ালি লিখুন।';
    } else if (!nidName) {
      warning = 'এনআইডি নম্বর পাওয়া গেছে, তবে বাংলা নাম স্পষ্ট হয়নি — অনুগ্রহ করে নিচে নামটি মিলিয়ে নিন।';
    } else if (!nidNumber) {
      warning = 'নাম পাওয়া গেছে, তবে এনআইডি নম্বর স্পষ্ট হয়নি — অনুগ্রহ করে নম্বরটি মিলিয়ে নিন।';
    } else if (confidence !== 'high') {
      warning = 'অন-ডিভাইস স্ক্যান সম্পন্ন। সাবমিট করার আগে বাংলা বানান ও নম্বর একবার মিলিয়ে নিন।';
    }

    onProgress?.(100, 'স্ক্যান সম্পন্ন');
    return { nidName, nidNumber, confidence, warning, rawText };
  } finally {
    currentProgressCb = null;
  }
}

export const tesseractNidScanner: NidScannerEngine = {
  scan: scanBangladeshNidOnDevice,
};
