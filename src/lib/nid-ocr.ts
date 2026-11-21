'use client';

import type { Worker } from 'tesseract.js';

export interface CropRectPercent {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
}

export interface OnDeviceScanResult {
  cleanedText: string; // Multi-line neatly formatted info text (boilerplate stripped)
  cleanedLines: string[]; // Clean individual lines for one-tap pills
  suggestedName: string; // High-confidence Bangla (or fallback English) name, else ''
  suggestedNid: string; // Validated 10 / 13 / 17 digit NID number, else ''
  confidence: 'high' | 'medium' | 'low';
  warning: string;
  errorDetail?: string;
  nidName?: string; // Compatibility alias
  nidNumber?: string; // Compatibility alias
  rawText?: string;
}

const BANGLA_TO_ENGLISH_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

// Standard boilerplate identical on EVERY Bangladesh Smart & Old NID card
const BOILERPLATE_PATTERNS: RegExp[] = [
  /গণপ্রজাতন্ত্রী/i,
  /বাংলাদেশ\s*সরকার/i,
  /government\s+of\s+the/i,
  /people['’]?s?\s+republic/i,
  /republic\s+of\s+bangladesh/i,
  /জাত[ীি][য়য়]\s*পরিচ[য়য়]\s*পত্র/i,
  /national\s+id\s+card/i,
  /^bangladesh$/i,
  /^সরকার$/i,
  /^স্বাক্ষর$/i,
  /^signature$/i,
];

let workerPromise: Promise<Worker> | null = null;
let workerReadyFlag = false;
let progressHandler: ((percent: number, statusText: string) => void) | null = null;

export function isOcrEngineWarm(): boolean {
  return workerReadyFlag;
}

export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => BANGLA_TO_ENGLISH_DIGITS[d] || d);
}

function mapStatusToBangla(status: string): string {
  if (status.includes('loading tesseract core')) return 'ওসিআর ইঞ্জিন চালু হচ্ছে...';
  if (status.includes('loading language')) return 'বাংলা ও ইংরেজি সেরা মডেল লোড হচ্ছে (প্রথমবার ফোনে সেভ হবে)...';
  if (status.includes('initializing')) return 'স্ক্যানার প্রস্তুত হচ্ছে...';
  if (status.includes('recognizing text')) return 'তথ্যের অংশ পড়া হচ্ছে...';
  return 'ছবি পরিষ্কার করা হচ্ছে...';
}

export async function getSameOriginBestWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const worker = await createWorker(['ben', 'eng'], 1, {
        workerPath: `${origin}/tesseract/worker.min.js`,
        corePath: `${origin}/tesseract/core`,
        langPath: `${origin}/tesseract/lang`,
        gzip: true,
        cacheMethod: 'write', // Persist traineddata in browser IndexedDB for instant future visits
        workerBlobURL: false, // Same-origin worker -> never blocked by Brave Shields
        logger: (m) => {
          if (progressHandler && typeof m.progress === 'number') {
            progressHandler(Math.round(m.progress * 100), mapStatusToBangla(m.status || ''));
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Ideal for cropped NID info block
        preserve_interword_spaces: '1',
      });
      workerReadyFlag = true;
      return worker;
    })().catch((err) => {
      workerPromise = null;
      workerReadyFlag = false;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Rotate a photo clockwise by degrees (90, 180, 270) on Canvas.
 */
export async function rotateImageDataUrl(imageDataUrl: string, degrees = 90): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('ছবি ঘোরানো যায়নি।'));
    img.onload = () => {
      const rad = ((degrees % 360) * Math.PI) / 180;
      const swap = degrees % 180 !== 0;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = imageDataUrl;
  });
}

/**
 * Crop ONLY the selected ROI info block and apply CamScanner-style
 * Background-Division Illumination Normalization so the pink circular Bangladesh flag
 * watermark and green tint become pure white while Bengali text & NID numbers turn razor sharp.
 */
export async function cropAndNormalizeRoiForOcr(
  imageDataUrl: string,
  crop?: CropRectPercent | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('ছবি প্রসেস করা যায়নি।'));
    img.onload = () => {
      const sx = crop ? Math.max(0, Math.round(crop.x * img.width)) : 0;
      const sy = crop ? Math.max(0, Math.round(crop.y * img.height)) : 0;
      const sw = crop ? Math.max(40, Math.min(img.width - sx, Math.round(crop.w * img.width))) : img.width;
      const sh = crop ? Math.max(40, Math.min(img.height - sy, Math.round(crop.h * img.height))) : img.height;

      // Upscale cropped info block to ideal OCR resolution (~1200px wide) for crisp Bengali matra
      const targetWidth = Math.min(Math.max(sw * 1.5, 900), 1500);
      const scale = targetWidth / sw;
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);

      const fgCanvas = document.createElement('canvas');
      fgCanvas.width = w;
      fgCanvas.height = h;
      const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true });
      if (!fgCtx) {
        resolve(imageDataUrl);
        return;
      }

      fgCtx.fillStyle = '#FFFFFF';
      fgCtx.fillRect(0, 0, w, h);
      fgCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

      // Estimate local background illumination (captures pink flag circle, green tint, shadows)
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
      if (!bgCtx) {
        resolve(fgCanvas.toDataURL('image/png'));
        return;
      }

      // Fast multi-scale blur fallback that works identically on EVERY mobile browser (even without ctx.filter)
      const smallW = Math.max(16, Math.round(w / 28));
      const smallH = Math.max(16, Math.round(h / 28));
      const tinyCanvas = document.createElement('canvas');
      tinyCanvas.width = smallW;
      tinyCanvas.height = smallH;
      const tinyCtx = tinyCanvas.getContext('2d');
      if (tinyCtx) {
        tinyCtx.imageSmoothingEnabled = true;
        tinyCtx.drawImage(fgCanvas, 0, 0, smallW, smallH);
        bgCtx.imageSmoothingEnabled = true;
        bgCtx.drawImage(tinyCanvas, 0, 0, w, h);
      } else {
        bgCtx.drawImage(fgCanvas, 0, 0, w, h);
      }

      const fgData = fgCtx.getImageData(0, 0, w, h);
      const bgData = bgCtx.getImageData(0, 0, w, h).data;
      const d = fgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const fgLum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const bgLum = Math.max(25, 0.299 * bgData[i] + 0.587 * bgData[i + 1] + 0.114 * bgData[i + 2]);

        // Division normalization: pink/green background -> ~255 (pure white), dark text -> low value
        let ratio = (fgLum / bgLum) * 255;

        // Soft document contrast curve (keeps Bengali curves smooth without jagged binary noise)
        if (ratio > 222) {
          ratio = 255;
        } else {
          ratio = Math.max(0, Math.min(255, ((ratio - 145) * 1.9) + 150));
        }

        const val = Math.round(ratio);
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }

      fgCtx.putImageData(fgData, 0, 0);
      resolve(fgCanvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
}

function isLikelyValidBanglaName(text: string): boolean {
  const cleaned = text.replace(/[^\u0980-\u09FF\s.\-ঃ]/g, '').trim();
  const banglaChars = cleaned.replace(/[\s.\-ঃ]/g, '').length;
  // Must have at least 4 Bengali letters and majority Bengali characters
  return banglaChars >= 4 && cleaned.length >= text.trim().length * 0.65;
}

/**
 * Strips Bangladesh NID boilerplate & formats useful info neatly line-by-line.
 * Performs CONSERVATIVE auto-fill suggestions (never injects garbage).
 */
export function cleanAndFormatNidText(rawText: string): {
  cleanedText: string;
  cleanedLines: string[];
  suggestedName: string;
  suggestedNid: string;
} {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[|_=~`^<>[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const cleanedLines: string[] = [];

  for (const line of rawLines) {
    const meaningful = line.replace(/[^A-Za-z0-9\u0980-\u09FF]/g, '');
    if (meaningful.length < 2) continue;
    if (BOILERPLATE_PATTERNS.some((re) => re.test(line))) continue;
    if (cleanedLines[cleanedLines.length - 1] !== line) {
      cleanedLines.push(line);
    }
  }

  // Merge standalone short labels ("নাম", "Name", "পিতা", "মাতা", "NID No") with their next value line for crisp readability
  const formattedLines: string[] = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    const cur = cleanedLines[i];
    const isStandaloneLabel = /^(নাম|Name|পিতা|মাতা|স্বামী|Date of Birth|NID No\.?|ID NO\.?)\s*[:ঃ.\-]*$/i.test(cur);
    if (isStandaloneLabel && i + 1 < cleanedLines.length) {
      const cleanLabel = cur.replace(/[:ঃ.\-\s]+$/, '');
      formattedLines.push(`${cleanLabel}: ${cleanedLines[i + 1]}`);
      i++;
    } else {
      formattedLines.push(cur);
    }
  }

  const cleanedText = formattedLines.join('\n');
  const normalizedAll = toEnglishDigits(cleanedText);

  // Conservative NID extraction (ONLY valid 10, 13, or 17 digit sequences)
  let suggestedNid = '';
  const labeledNid = normalizedAll.match(
    /(?:NID\s*N[o0.]*|ID\s*N[o0.]*|আইডি\s*নং)\s*[:\-.\s]*([0-9][0-9\s\-]{8,22}[0-9])/i
  );
  const smartSpaced = normalizedAll.match(/\b(\d{3})\s+(\d{3})\s+(\d{4})\b/);
  const standaloneNid = normalizedAll.match(/\b(\d{17}|\d{13}|\d{10})\b/);

  const rawNidCandidate =
    (labeledNid && labeledNid[1]) ||
    (smartSpaced && `${smartSpaced[1]}${smartSpaced[2]}${smartSpaced[3]}`) ||
    (standaloneNid && standaloneNid[1]) ||
    '';

  const pureDigits = rawNidCandidate.replace(/\D/g, '');
  if (pureDigits.length === 10 || pureDigits.length === 13 || pureDigits.length === 17) {
    suggestedNid = pureDigits;
  }

  // Conservative Name extraction (looks strictly for "নাম:" line or Bengali line right above "Name:")
  let suggestedName = '';
  for (let i = 0; i < formattedLines.length; i++) {
    const l = formattedLines[i];
    if (/^নাম\s*[:ঃ\-]/.test(l)) {
      const val = l.replace(/^নাম\s*[:ঃ\-]\s*/, '').trim();
      if (isLikelyValidBanglaName(val)) {
        suggestedName = val;
        break;
      }
    }
  }

  if (!suggestedName) {
    const engIdx = formattedLines.findIndex((l) => /^Name\s*[:\-]/i.test(l));
    if (engIdx > 0 && isLikelyValidBanglaName(formattedLines[engIdx - 1])) {
      suggestedName = formattedLines[engIdx - 1];
    }
  }

  // Fallback if no Bengali name was recognized, look for English Name: line
  if (!suggestedName) {
    for (let i = 0; i < formattedLines.length; i++) {
      const l = formattedLines[i];
      if (/^Name\s*[:\-]/i.test(l)) {
        const val = l.replace(/^Name\s*[:\-]\s*/i, '').trim();
        if (val.length >= 3) {
          suggestedName = val;
          break;
        }
      }
    }
  }

  return {
    cleanedText,
    cleanedLines: formattedLines,
    suggestedName,
    suggestedNid,
  };
}

export async function scanBangladeshNidOnDevice(
  imageDataUrl: string,
  optionsOrProgress?:
    | {
        crop?: CropRectPercent | null;
        onProgress?: (percent: number, statusText: string) => void;
      }
    | ((percent: number, statusText: string) => void)
): Promise<OnDeviceScanResult> {
  const options =
    typeof optionsOrProgress === 'function'
      ? { onProgress: optionsOrProgress }
      : optionsOrProgress;

  progressHandler = options?.onProgress || null;
  try {
    options?.onProgress?.(8, 'তথ্যের অংশ পরিষ্কার ও জলছাপ দূর করা হচ্ছে...');
    const processedUrl = await cropAndNormalizeRoiForOcr(imageDataUrl, options?.crop || null);

    const worker = await getSameOriginBestWorker();
    const { data } = await worker.recognize(processedUrl);

    const rawText = data.text || '';
    const { cleanedText, cleanedLines, suggestedName, suggestedNid } = cleanAndFormatNidText(rawText);
    const score = typeof data.confidence === 'number' ? data.confidence : 0;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (suggestedName && suggestedNid && score >= 60) confidence = 'high';
    else if (cleanedLines.length >= 2) confidence = 'medium';

    let warning = '';
    if (cleanedLines.length === 0) {
      warning = 'লেখা পড়া যায়নি। ছবি কাত বা উল্টো থাকলে "৯০° ঘোরান" চেপে সোজা করুন এবং সবুজ বক্সটি শুধু তথ্যের অংশের ওপর রেখে "স্ক্যান করুন" চাপুন।';
    } else if (!suggestedName || !suggestedNid) {
      warning = 'স্ক্যান সম্পন্ন — নিচের "স্ক্যান করা তথ্য" বক্স থেকে এক ট্যাপে বা কপি করে নাম ও এনআইডি মিলিয়ে নিন।';
    }

    options?.onProgress?.(100, 'স্ক্যান সম্পন্ন');
    return {
      cleanedText,
      cleanedLines,
      suggestedName,
      suggestedNid,
      nidName: suggestedName,
      nidNumber: suggestedNid,
      confidence,
      warning,
      rawText,
    };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[NID OCR Error]', err);
    return {
      cleanedText: '',
      cleanedLines: [],
      suggestedName: '',
      suggestedNid: '',
      nidName: '',
      nidNumber: '',
      confidence: 'low',
      warning: 'ওসিআর চালু হতে সমস্যা হয়েছে। ছবিটি সুরক্ষিত আছে — নিচে হাতে নাম ও এনআইডি লিখুন।',
      errorDetail: detail,
    };
  } finally {
    progressHandler = null;
  }
}
