export type StatusCode = "OK" | "VAR" | "NA" | "NR";
export type ReviewStatus = "OK" | "VAR";
export type DisplayStatus = "OK" | "VAR" | "NA";
export type SignalType = "Alarm" | "Supervisory" | "Trouble" | "Opening/Closing" | "Comm Fail";
export type SignalHandlingStatus = "OK" | "VAR";
export type ReportSectionStatus = Partial<Record<"signal" | "documentation" | "installation", boolean>>;
export type GuardServiceSignalType = "24 hour contact alarm" | "Comm. Fail" | "Other";
export type GuardServiceResult = "PASS" | "FAIL";

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
  commentsAndClarifications?: string;
  governmentManual?: string;
  responseTime?: string;
  governmentContractNumber?: string;
  protectedArea?: string;
  protectedAreaType?: string;
  protectedAreaDescription?: string;
  physicalBoundary?: string;
  closedArea?: string;
  alarmResponse?: string;
  guardResponse?: string;
  openingClosing?: string;
  independentCode?: string;
  asdForm?: string;
  premisesExtent?: string;
  stockroomExtent?: string;
  safeComplete?: string;
  holdUp?: string;
  partyNotified?: string;
  lineSecurity?: string;
  alarmSoundingDeviceLocation?: string;
  secondaryTransmission?: string;
  controlTransmitterCombo?: string;
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
  sprinklerSystemType?: string;
  fireDeviceSections?: CertificateDeviceSection[];
  deviceCounts?: {
    smoke?: number;
    photoelectricSmoke?: number;
    ionizationSmoke?: number;
    heat?: number;
    duct?: number;
    tamperSwitches?: number;
    sprinklerWaterflow?: number;
    waterflowSwitches?: number;
    controlValves?: number;
    valveSupervisory?: number;
    osy?: number;
    piv?: number;
    pressureSwitches?: number;
    lowAirSwitches?: number;
    otherInitiating?: number;
    manualStations?: number;
    waterflowControlValve?: number;
    hornStrobe?: number;
    strobe?: number;
    notificationAppliances?: number;
  };
}

export interface CertificateDeviceRow {
  category?: string;
  count?: number;
  description: string;
  total?: number;
}

export interface CertificateDeviceSection {
  title: string;
  metadata?: Array<{ label: string; value: string }>;
  rows: CertificateDeviceRow[];
}

export interface CertificateSummaryItem {
  label: string;
  value: string;
}

export interface CertificateSummarySection {
  title: string;
  items: CertificateSummaryItem[];
}

export interface CertificateTransferSummary {
  generatedAt: string;
  certificateNumber?: string;
  categoryCode?: string;
  sections: CertificateSummarySection[];
}

export interface AuditAssignment {
  id: string;
  createdAt: string;
  updatedAt: string;
  auditorName: string;
  ascName: string;
  ascCity: string;
  ascState: string;
  psn: string;
  scn: string;
  ccn: string;
  fileNo: string;
  certCount: string;
  auditDays: string;
  auditorNotes: string;
  ascStatus: string;
}

export interface AuditRow {
  id: string;
  element: string;
  status: StatusCode | "";
  notes: string;
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
  photos: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface ReportFindingEntry {
  finding: string;
  requiredAction: string;
  codeStandard: string;
  codeEdition: string;
  codeSection: string;
}

export interface SignalLogRow {
  id: string;
  signalType: SignalType | "";
  handlingStatus?: SignalHandlingStatus | "";
  date: string;
  time: string;
  description: string;
  notes: string;
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
  updatedAt: string;
}

export interface DeviceTestRow {
  id: string;
  deviceType: string;
  waterflowEntryMode?: "manual" | "automatic" | "";
  waterflowElapsedSeconds?: number;
  lineSecurityExpectedSeconds?: number;
  location: string;
  deviceId: string;
  signalType: SignalType | "";
  functional?: boolean;
  alarm?: boolean;
  supervisory?: boolean;
  trouble?: boolean;
  lineSecurity?: boolean;
  notApplicable?: boolean;
  tripTime: string;
  timeReceived: string;
  signalReceived: boolean;
  restoralReceived: boolean;
  localIndication: boolean;
  result: StatusCode | "";
  notes: string;
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
  photos: string[];
  updatedAt: string;
}

export interface GuardServiceTest {
  reviewed: boolean;
  signalType: GuardServiceSignalType | "";
  otherSignalType: string;
  entryMode: "manual" | "automatic" | "";
  expectedMinutes: number;
  testSignalInitiationTime: string;
  verificationCallTime: string;
  investigatorArrivalTime: string;
  elapsedSeconds: number;
  result: GuardServiceResult | "";
  notes: string;
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
  signalReviewNotes: string;
  signalReviewReportFinding: string;
  signalReviewReportRequiredAction: string;
  signalReviewReportCodeStandard: string;
  signalReviewReportCodeEdition: string;
  signalReviewReportCodeSection: string;
  autoTestsStatus: ReviewStatus | "";
  documentationReviewed: boolean;
  documentationReviewNotes: string;
  documentationReviewReportFinding: string;
  documentationReviewReportRequiredAction: string;
  documentationReviewReportCodeStandard: string;
  documentationReviewReportCodeEdition: string;
  documentationReviewReportCodeSection: string;
  installationReviewed: boolean;
  installationReviewNotes: string;
  installationReviewReportFinding: string;
  installationReviewReportRequiredAction: string;
  installationReviewReportCodeStandard: string;
  installationReviewReportCodeEdition: string;
  installationReviewReportCodeSection: string;
  deviceTestingReviewed: boolean;
  deviceTestingNotes: string;
  deviceTestingReportFinding: string;
  deviceTestingReportRequiredAction: string;
  deviceTestingReportCodeStandard: string;
  deviceTestingReportCodeEdition: string;
  deviceTestingReportCodeSection: string;
  matchesCertificateStatus: ReviewStatus | "";
  certificateDisplayedStatus: DisplayStatus | "";
  certificateMatchReportFinding: string;
  certificateMatchReportRequiredAction: string;
  certificateMatchReportCodeStandard: string;
  certificateMatchReportCodeEdition: string;
  certificateMatchReportCodeSection: string;
  certificateDisplayedReportFinding: string;
  certificateDisplayedReportRequiredAction: string;
  certificateDisplayedReportCodeStandard: string;
  certificateDisplayedReportCodeEdition: string;
  certificateDisplayedReportCodeSection: string;
  deviceSystemLocal: boolean;
  certificates: ParsedCertificate[];
  certificateSummary?: CertificateTransferSummary;
  primaryCertificateIndex: number;
  matchesCertificate: boolean;
  certificateDisplayed: boolean;
  reportExtraFindings?: Record<string, ReportFindingEntry[]>;
  reportSectionStatus?: ReportSectionStatus;
  guardServiceTest?: GuardServiceTest;
  signalLog: SignalLogRow[];
  documentation: AuditRow[];
  installation: AuditRow[];
  deviceTests: DeviceTestRow[];
  comments: string;
  editedFields: Record<string, boolean>;
}

export interface Auditor {
  name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  since: string;
  updatedAt?: string;
}
