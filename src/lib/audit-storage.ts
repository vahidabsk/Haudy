import { Audit, AuditRow, Auditor, ParsedCertificate, SignalHandlingStatus, SignalType } from "./types";
import { cityStateFromAddress } from "./certificate-parser";
import { nowIso, uid } from "./utils";

const AUDITOR_KEY = "haudy.auditor";
const AUDITS_KEY = "haudy.audits";

export const documentationElements = [
  "Record Drawings (As Builts)",
  "Battery Calculations",
  "Initial Acceptance Test (IAT)",
  "Reacceptance Test",
  "Record of Completion (ROC)",
  "Periodic Testing Records",
  "Sensitivity Testing",
  "Contracts",
  "Service Records",
  "Owners Manuals",
];

export const installationElements = [
  "Compatible / Listed Equipment",
  "Control & Sub Control(s)",
  "Transmitter / Communicator",
  "Primary Power Requirements",
  "Secondary Power Requirements",
  "Grounding / Supervision",
  "Wiring / Workmanship",
  "EOLR Placement",
  "Transient Protection",
  "Smoke Detectors (SD)",
  "Heat Detectors (HD)",
  "Duct Detectors (DD)",
  "Manual Pull Stations (MP)",
  "Waterflow Devices (WF)",
  "Sprinkler Supervisory (SS)",
  "Notification Appliances (NAC)",
];

export function loadAuditor(): Auditor | null {
  const auditor = readJson<Auditor | null>(AUDITOR_KEY, null);
  return auditor ? normalizeAuditor(auditor) : null;
}

export function saveAuditor(profile: Omit<Auditor, "since" | "updatedAt"> & { since?: string }): Auditor {
  const now = nowIso();
  const auditor = normalizeAuditor({ ...profile, since: profile.since || now, updatedAt: now });
  localStorage.setItem(AUDITOR_KEY, JSON.stringify(auditor));
  return auditor;
}

function normalizeAuditor(auditor: Partial<Auditor> & { name: string }): Auditor {
  return {
    name: auditor.name || "",
    title: auditor.title || "Alarm System Auditor",
    department: auditor.department || "Fire and Security Service Solutions",
    phone: auditor.phone || "+1.510.358.6443",
    email: auditor.email || "Vahid.Abbasikoohenjani@ul.com",
    since: auditor.since || nowIso(),
    updatedAt: auditor.updatedAt || auditor.since || nowIso(),
  };
}

export function loadAudits(): Audit[] {
  return readJson<Audit[]>(AUDITS_KEY, []).map(normalizeAudit);
}

export function saveAudits(audits: Audit[]) {
  localStorage.setItem(AUDITS_KEY, JSON.stringify(audits));
}

export function createAuditFromCertificate(certificate: ParsedCertificate, auditorName: string): Audit {
  const now = nowIso();
  return {
    id: uid("audit"),
    createdAt: now,
    updatedAt: now,
    auditorName,
    auditDate: now.slice(0, 10),
    ascName: certificate.ascName || "",
    ascCity: certificate.ascCity || "",
    ascState: certificate.ascState || "",
    certificateNumber: certificate.certificateNumber || "",
    fileScn: [certificate.fileNo, certificate.ccn].filter(Boolean).join(" / "),
    protectedProperty: certificate.propertyName || "",
    codeEdition: certificate.standardReferenced || "",
    signalProcessingReviewed: true,
    signalReviewStart: "",
    signalReviewEnd: "",
    signalReviewNotes: "",
    signalReviewReportFinding: "",
    signalReviewReportRequiredAction: "",
    signalReviewReportCodeStandard: "",
    signalReviewReportCodeEdition: "",
    signalReviewReportCodeSection: "",
    autoTestsStatus: "",
    documentationReviewed: true,
    documentationReviewNotes: "",
    documentationReviewReportFinding: "",
    documentationReviewReportRequiredAction: "",
    documentationReviewReportCodeStandard: "",
    documentationReviewReportCodeEdition: "",
    documentationReviewReportCodeSection: "",
    installationReviewed: true,
    installationReviewNotes: "",
    installationReviewReportFinding: "",
    installationReviewReportRequiredAction: "",
    installationReviewReportCodeStandard: "",
    installationReviewReportCodeEdition: "",
    installationReviewReportCodeSection: "",
    deviceTestingReviewed: true,
    deviceTestingNotes: "",
    deviceTestingReportFinding: "",
    deviceTestingReportRequiredAction: "",
    deviceTestingReportCodeStandard: "",
    deviceTestingReportCodeEdition: "",
    deviceTestingReportCodeSection: "",
    matchesCertificateStatus: "",
    certificateDisplayedStatus: "",
    certificateMatchReportFinding: "",
    certificateMatchReportRequiredAction: "",
    certificateMatchReportCodeStandard: "",
    certificateMatchReportCodeEdition: "",
    certificateMatchReportCodeSection: "",
    certificateDisplayedReportFinding: "",
    certificateDisplayedReportRequiredAction: "",
    certificateDisplayedReportCodeStandard: "",
    certificateDisplayedReportCodeEdition: "",
    certificateDisplayedReportCodeSection: "",
    deviceSystemLocal: false,
    certificates: [{ ...certificate, uploadedAt: now }],
    primaryCertificateIndex: 0,
    matchesCertificate: false,
    certificateDisplayed: false,
    reportExtraFindings: {},
    signalLog: [signalRow(now)],
    documentation: documentationElements.map((element) => row(element, auditorName, now)),
    installation: installationElements.map((element) => row(element, auditorName, now)),
    deviceTests: [deviceRow(now)],
    comments: certificate.systemDeviations || "",
    editedFields: {},
  };
}

function row(element: string, auditorName: string, updatedAt: string) {
  return {
    id: uid("row"),
    element,
    status: "" as const,
    notes: "",
    reportFinding: "",
    reportRequiredAction: "",
    reportCodeStandard: "",
    reportCodeEdition: "",
    reportCodeSection: "",
    photos: [],
    updatedAt,
    updatedBy: auditorName,
  };
}

function signalRow(updatedAt: string) {
  return {
    id: uid("signal"),
    signalType: "" as const,
    handlingStatus: "" as const,
    date: "",
    time: "",
    description: "",
    notes: "",
    reportFinding: "",
    reportRequiredAction: "",
    reportCodeStandard: "",
    reportCodeEdition: "",
    reportCodeSection: "",
    updatedAt,
  };
}

function deviceRow(updatedAt: string) {
  return {
    id: uid("device"),
    deviceType: "",
    waterflowEntryMode: "" as const,
    waterflowElapsedSeconds: 0,
    location: "",
    deviceId: "",
    signalType: "" as const,
    functional: false,
    alarm: false,
    supervisory: false,
    trouble: false,
    notApplicable: false,
    tripTime: "",
    timeReceived: "",
    signalReceived: false,
    restoralReceived: false,
    localIndication: false,
    result: "" as const,
    notes: "",
    reportFinding: "",
    reportRequiredAction: "",
    reportCodeStandard: "",
    reportCodeEdition: "",
    reportCodeSection: "",
    photos: [],
    updatedAt,
  };
}

function normalizeAudit(audit: Audit): Audit {
  const now = nowIso();
  const primaryCertificate = audit.certificates?.[audit.primaryCertificateIndex || 0] || audit.certificates?.[0];
  const ascLocation = cityStateFromAddress(primaryCertificate?.ascAddress);
  return {
    ...audit,
    ascCity: audit.ascCity ?? primaryCertificate?.ascCity ?? ascLocation.city,
    ascState: audit.ascState ?? primaryCertificate?.ascState ?? ascLocation.state,
    signalProcessingReviewed: audit.editedFields?.signalProcessingReviewed ? Boolean(audit.signalProcessingReviewed) : true,
    signalReviewStart: audit.signalReviewStart ?? "",
    signalReviewEnd: audit.signalReviewEnd ?? "",
    signalReviewNotes: audit.signalReviewNotes ?? "",
    signalReviewReportFinding: audit.signalReviewReportFinding ?? "",
    signalReviewReportRequiredAction: audit.signalReviewReportRequiredAction ?? "",
    signalReviewReportCodeStandard: audit.signalReviewReportCodeStandard ?? "NFPA 72",
    signalReviewReportCodeEdition: audit.signalReviewReportCodeEdition ?? "",
    signalReviewReportCodeSection: audit.signalReviewReportCodeSection ?? "",
    autoTestsStatus: audit.autoTestsStatus ?? "",
    documentationReviewed: audit.editedFields?.documentationReviewed ? Boolean(audit.documentationReviewed) : true,
    documentationReviewNotes: audit.documentationReviewNotes ?? "",
    documentationReviewReportFinding: audit.documentationReviewReportFinding ?? "",
    documentationReviewReportRequiredAction: audit.documentationReviewReportRequiredAction ?? "",
    documentationReviewReportCodeStandard: audit.documentationReviewReportCodeStandard ?? "NFPA 72",
    documentationReviewReportCodeEdition: audit.documentationReviewReportCodeEdition ?? "",
    documentationReviewReportCodeSection: audit.documentationReviewReportCodeSection ?? "",
    installationReviewed: audit.editedFields?.installationReviewed ? Boolean(audit.installationReviewed) : true,
    installationReviewNotes: audit.installationReviewNotes ?? "",
    installationReviewReportFinding: audit.installationReviewReportFinding ?? "",
    installationReviewReportRequiredAction: audit.installationReviewReportRequiredAction ?? "",
    installationReviewReportCodeStandard: audit.installationReviewReportCodeStandard ?? "NFPA 72",
    installationReviewReportCodeEdition: audit.installationReviewReportCodeEdition ?? "",
    installationReviewReportCodeSection: audit.installationReviewReportCodeSection ?? "",
    deviceTestingReviewed: audit.editedFields?.deviceTestingReviewed ? Boolean(audit.deviceTestingReviewed) : true,
    deviceTestingNotes: audit.deviceTestingNotes ?? "",
    deviceTestingReportFinding: audit.deviceTestingReportFinding ?? "",
    deviceTestingReportRequiredAction: audit.deviceTestingReportRequiredAction ?? "",
    deviceTestingReportCodeStandard: audit.deviceTestingReportCodeStandard ?? "NFPA 72",
    deviceTestingReportCodeEdition: audit.deviceTestingReportCodeEdition ?? "",
    deviceTestingReportCodeSection: audit.deviceTestingReportCodeSection ?? "",
    matchesCertificateStatus: audit.matchesCertificateStatus ?? (audit.matchesCertificate ? "OK" : ""),
    certificateDisplayedStatus: audit.certificateDisplayedStatus ?? (audit.certificateDisplayed ? "OK" : ""),
    certificateMatchReportFinding: audit.certificateMatchReportFinding ?? "",
    certificateMatchReportRequiredAction: audit.certificateMatchReportRequiredAction ?? "",
    certificateMatchReportCodeStandard: audit.certificateMatchReportCodeStandard ?? "NFPA 72",
    certificateMatchReportCodeEdition: audit.certificateMatchReportCodeEdition ?? "",
    certificateMatchReportCodeSection: audit.certificateMatchReportCodeSection ?? "",
    certificateDisplayedReportFinding: audit.certificateDisplayedReportFinding ?? "",
    certificateDisplayedReportRequiredAction: audit.certificateDisplayedReportRequiredAction ?? "",
    certificateDisplayedReportCodeStandard: audit.certificateDisplayedReportCodeStandard ?? "NFPA 72",
    certificateDisplayedReportCodeEdition: audit.certificateDisplayedReportCodeEdition ?? "",
    certificateDisplayedReportCodeSection: audit.certificateDisplayedReportCodeSection ?? "",
    deviceSystemLocal: audit.deviceSystemLocal ?? false,
    reportExtraFindings: normalizeReportExtraFindings(audit.reportExtraFindings),
    signalLog: normalizeSignalRows(audit.signalLog, now),
    documentation: normalizeRows(audit.documentation, documentationElements, audit.auditorName, now),
    installation: normalizeRows(audit.installation, installationElements, audit.auditorName, now),
    deviceTests: normalizeDeviceRows(audit.deviceTests, now),
  };
}

function normalizeReportExtraFindings(findings: Audit["reportExtraFindings"]): Audit["reportExtraFindings"] {
  if (!findings) return {};
  return Object.fromEntries(Object.entries(findings).map(([key, entries]) => [
    key,
    entries.map((entry) => ({
      finding: entry.finding || "",
      requiredAction: entry.requiredAction || "",
      codeStandard: entry.codeStandard || "NFPA 72",
      codeEdition: entry.codeEdition || "",
      codeSection: entry.codeSection || "",
    })),
  ]));
}

function normalizeSignalRows(rows: Audit["signalLog"], updatedAt: string): Audit["signalLog"] {
  const normalized = rows.map((item) => ({
    id: item.id || uid("signal"),
    signalType: (item.signalType || "") as SignalType | "",
    handlingStatus: (item.handlingStatus || "") as SignalHandlingStatus | "",
    date: item.date || "",
    time: item.time || "",
    description: item.description || "",
    notes: item.notes || "",
    reportFinding: item.reportFinding || "",
    reportRequiredAction: item.reportRequiredAction || "",
    reportCodeStandard: item.reportCodeStandard || "NFPA 72",
    reportCodeEdition: item.reportCodeEdition || "",
    reportCodeSection: item.reportCodeSection || "",
    updatedAt: item.updatedAt || updatedAt,
  }));
  return normalized.length ? normalized : [signalRow(updatedAt)];
}

function normalizeRows(rows: AuditRow[], elements: string[], auditorName: string, updatedAt: string) {
  const fixedRows = elements.map((element) => normalizeAuditRow(rows.find((item) => item.element === element) || row(element, auditorName, updatedAt), auditorName, updatedAt));
  const customRows = rows
    .filter((item) => item.element && !elements.includes(item.element) && !item.element.startsWith("NFPA"))
    .map((item) => normalizeAuditRow(item, auditorName, updatedAt));
  return [...fixedRows, ...customRows];
}

function normalizeAuditRow(item: AuditRow, auditorName: string, updatedAt: string): AuditRow {
  return {
    ...row(item.element, auditorName, updatedAt),
    ...item,
    reportFinding: item.reportFinding || "",
    reportRequiredAction: item.reportRequiredAction || "",
    reportCodeStandard: item.reportCodeStandard || "NFPA 72",
    reportCodeEdition: item.reportCodeEdition || "",
    reportCodeSection: item.reportCodeSection || "",
  };
}

function normalizeDeviceRows(rows: Audit["deviceTests"], updatedAt: string) {
  const normalized = rows.map((item) => ({
    ...deviceRow(updatedAt),
    ...item,
    functional: item.functional ?? false,
    alarm: item.alarm ?? item.signalType === "Alarm",
    supervisory: item.supervisory ?? item.signalType === "Supervisory",
    trouble: item.trouble ?? item.signalType === "Trouble",
    notApplicable: item.notApplicable ?? false,
  }));
  return normalized.length ? normalized : [deviceRow(updatedAt)];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
