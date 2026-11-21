export interface ScanResult {
  nidName: string;
  nidNumber: string;
  confidence: 'high' | 'medium' | 'low';
  warning: string;
  rawText: string;
}

export interface NidScannerEngine {
  scan(
    imageDataUrl: string,
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<ScanResult>;
}
