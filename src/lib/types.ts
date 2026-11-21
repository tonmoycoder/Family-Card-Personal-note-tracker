export interface SurveyRecord {
  Serial?: number | string;
  Date?: string;
  Timestamp?: string;
  NID_Name?: string;
  NID_Number?: string;
  Local_Known_Name?: string;
  Area_Para?: string;
  Maps_Link?: string;
  Image_Drive_Link?: string;
  Notes?: string;
  // Also support camelCase variants returned by Apps Script if any
  serial?: number | string;
  date?: string;
  timestamp?: string;
  nidName?: string;
  nidNumber?: string;
  localKnownName?: string;
  areaPara?: string;
  mapsLink?: string;
  imageDriveLink?: string;
  notes?: string;
}

export interface ScanResponseData {
  nidName: string;
  nidNumber: string;
  detectedAddressArea: string;
  confidence: 'high' | 'medium' | 'low';
  warning: string;
}

export interface ScanApiResponse {
  success: boolean;
  data?: ScanResponseData;
  error?: string;
  details?: string;
}

export interface RecordsApiResponse {
  success: boolean;
  data?: SurveyRecord[];
  error?: string;
  message?: string;
  duplicate?: boolean;
  existingSerial?: string | number;
  existingArea?: string;
  existingRecord?: Partial<SurveyRecord>;
}

export interface SubmitRecordPayload {
  capturedDate: string;
  capturedTimestamp: string;
  nidName: string;
  nidNumber: string;
  localKnownName: string;
  areaPara: string;
  mapsLink: string;
  imageBase64: string;
  notes: string;
  forceDuplicate?: boolean;
}
