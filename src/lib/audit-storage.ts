import { Audit, AuditRow, Auditor, ParsedCertificate } from "./types";
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
  return readJson<Auditor | null>(AUDITOR_KEY, null);
}

export function saveAuditor(name: string): Auditor {
  const auditor = { name, since: nowIso() };
  localStorage.setItem(AUDITOR_KEY, JSON.stringify(auditor));
  return auditor;
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
    signalProcessingReviewed: false,
    signalReviewStart: "",
    signalReviewEnd: "",
    autoTestsStatus: "",
    documentationReviewed: false,
    installationReviewed: false,
    matchesCertificateStatus: "",
    certificateDisplayedStatus: "",
    deviceSystemLocal: false,
    certificates: [{ ...certificate, uploadedAt: now }],
    primaryCertificateIndex: 0,
    matchesCertificate: false,
    certificateDisplayed: false,
    signalLog: [{ id: uid("signal"), signalType: "", date: "", time: "", description: "", notes: "", updatedAt: now }],
    documentation: documentationElements.map((element) => row(element, auditorName, now)),
    installation: installationElements.map((element) => row(element, auditorName, now)),
    deviceTests: [deviceRow(now)],
    comments: certificate.systemDeviations || "",
    editedFields: {},
  };
}

function row(element: string, auditorName: string, updatedAt: string) {
  return { id: uid("row"), element, status: "" as const, notes: "", photos: [], updatedAt, updatedBy: auditorName };
}

function deviceRow(updatedAt: string) {
  return {
    id: uid("device"),
    deviceType: "",
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
    signalProcessingReviewed: audit.signalProcessingReviewed ?? audit.signalLog.some((row) => row.signalType || row.date || row.time || row.description || row.notes),
    signalReviewStart: audit.signalReviewStart ?? "",
    signalReviewEnd: audit.signalReviewEnd ?? "",
    autoTestsStatus: audit.autoTestsStatus ?? "",
    documentationReviewed: audit.documentationReviewed ?? audit.documentation.some((row) => row.status || row.notes),
    installationReviewed: audit.installationReviewed ?? audit.installation.some((row) => row.status || row.notes),
    matchesCertificateStatus: audit.matchesCertificateStatus ?? (audit.matchesCertificate ? "OK" : ""),
    certificateDisplayedStatus: audit.certificateDisplayedStatus ?? (audit.certificateDisplayed ? "OK" : ""),
    deviceSystemLocal: audit.deviceSystemLocal ?? false,
    documentation: normalizeRows(audit.documentation, documentationElements, audit.auditorName, now),
    installation: normalizeRows(audit.installation, installationElements, audit.auditorName, now),
    deviceTests: normalizeDeviceRows(audit.deviceTests, now),
  };
}

function normalizeRows(rows: AuditRow[], elements: string[], auditorName: string, updatedAt: string) {
  const fixedRows = elements.map((element) => rows.find((item) => item.element === element) || row(element, auditorName, updatedAt));
  const customRows = rows.filter((item) => item.element && !elements.includes(item.element) && !item.element.startsWith("NFPA"));
  return [...fixedRows, ...customRows];
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
