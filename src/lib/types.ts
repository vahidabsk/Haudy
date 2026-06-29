export type StatusCode = "OK" | "VAR" | "NA" | "NR";
export type ReviewStatus = "OK" | "VAR";
export type DisplayStatus = "OK" | "VAR" | "NA";
export type SignalType = "Alarm" | "Supervisory" | "Trouble";

export interface ParsedCertificate {
  fileName: string;
  uploadedAt?: string;
  certificateNumber?: string;
  certificateType?: string;
  categoryCode?: string;
  fileNo?: string;
  ccn?: string;
  issuedDate?: string;
  revisedDate?: string;
  propertyName?: string;
  propertyAddress?: string;
  ascName?: string;
  ascAddress?: string;
  ascCity?: string;
  ascState?: string;
  areaCovered?: string;
  ahj?: string;
  respondingFD?: string;
  standardReferenced?: string;
  coverageType?: string;
  systemDeviations?: string;
  controlUnitMfr?: string;
  controlUnitModel?: string;
  signalTransmitterMfr?: string;
  signalTransmitterModel?: string;
  primaryTransmission?: string;
  retransmission?: string;
  centralStation?: string;
  centralStationAddress?: string;
  centralStationFile?: string;
  testingContractDate?: string;
  deviceCounts?: {
    smoke?: number;
    heat?: number;
    duct?: number;
    otherInitiating?: number;
    manualStations?: number;
    waterflowControlValve?: number;
    hornStrobe?: number;
    strobe?: number;
    notificationAppliances?: number;
  };
}

export interface AuditRow {
  id: string;
  element: string;
  status: StatusCode | "";
  notes: string;
  photos: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface SignalLogRow {
  id: string;
  signalType: SignalType | "";
  date: string;
  time: string;
  description: string;
  notes: string;
  updatedAt: string;
}

export interface DeviceTestRow {
  id: string;
  deviceType: string;
  location: string;
  deviceId: string;
  signalType: SignalType | "";
  functional?: boolean;
  alarm?: boolean;
  supervisory?: boolean;
  trouble?: boolean;
  notApplicable?: boolean;
  tripTime: string;
  timeReceived: string;
  signalReceived: boolean;
  restoralReceived: boolean;
  localIndication: boolean;
  result: StatusCode | "";
  notes: string;
  photos: string[];
  updatedAt: string;
}

export interface Audit {
  id: string;
  createdAt: string;
  updatedAt: string;
  auditorName: string;
  auditDate: string;
  ascName: string;
  ascCity: string;
  ascState: string;
  certificateNumber: string;
  fileScn: string;
  protectedProperty: string;
  codeEdition: string;
  signalProcessingReviewed: boolean;
  signalReviewStart: string;
  signalReviewEnd: string;
  autoTestsStatus: ReviewStatus | "";
  documentationReviewed: boolean;
  installationReviewed: boolean;
  matchesCertificateStatus: ReviewStatus | "";
  certificateDisplayedStatus: DisplayStatus | "";
  deviceSystemLocal: boolean;
  certificates: ParsedCertificate[];
  primaryCertificateIndex: number;
  matchesCertificate: boolean;
  certificateDisplayed: boolean;
  signalLog: SignalLogRow[];
  documentation: AuditRow[];
  installation: AuditRow[];
  deviceTests: DeviceTestRow[];
  comments: string;
  editedFields: Record<string, boolean>;
}

export interface Auditor {
  name: string;
  since: string;
}
