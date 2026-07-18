import { Audit, AuditRow, Auditor, GuardServiceResult, GuardServiceSignalType, GuardServiceTest, ParsedCertificate, SignalHandlingStatus, SignalType } from "./types";
import { auditProgram, certificateProgram } from "./audit-program";
import { cityStateFromAddress } from "./certificate-parser";
import { formatUsPhone, nowIso, uid } from "./utils";

const AUDITOR_KEY = "haudy.auditor";
const AUDITS_KEY = "haudy.audits";
const PROFILE_DEFAULTS_MIGRATED_KEY = "haudy.profileDefaultsMigrated";
const LEGACY_PROFILE_DEFAULTS = {
  title: "Alarm System Auditor",
  department: "Fire and Security Service Solutions",
  phone: "+1.510.358.6443",
  email: "Vahid.Abbasikoohenjani@ul.com",
};
const AUDITOR_DEPARTMENT_DEFAULT = "Built Environment - Critical Infrastructure Service\nFire and Security Service Solutions";

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

export const mercantileDocumentationElements = [
  "Annual Inspection Records",
  "Service Contracts",
  "Service Records",
  "Signal History",
  "UL 681 Standard Available",
  "Other",
];

export const mercantileInstallationElements = [
  "Compatible / Listed Equipment",
  "Control & Communication",
  "Enclosure",
  "Tamper(s)",
  "Extra Protection",
  "Grounding / Supervision",
  "Power Supplies",
  "MFG Instruction Adherence",
  "Programming",
  "Line Security (LS)",
  "Check In / Polling Rate",
  "Equipment Supervision",
  "MFG Instruction Adherence",
  "Sounding Device",
  "Device Type",
  "Device Wiring",
  "Premise/Stockroom",
  "Detector Coverage",
  "Opening Protection",
  "Intrusion Detector(s)",
  "Contact(s)",
  "Wiring / Workmanship",
  "EOLR Placement",
  "Safe / Vault",
  "Detector Coverage",
  "Contact(s)",
  "Wiring",
  "Hold Up(s)",
  "Other:",
];

export const protectedAreaDocumentationElements = [
  "Authorized User List",
  "Annual Inspection / Service Records",
  "ASD Form",
  "Contracts (Mon., Inv., & Serv.)",
  "UL2050 & UL681 Standards",
  "Training Log (Inv., User. & Mon.)",
  "OTHER",
];

export const protectedAreaInstallationElements = [
  "Control & Communication",
  "Enclosure",
  "Tamper(s)",
  "Grounding",
  "Power Supplies",
  "Batteries",
  "Programming",
  "Line Security (LS)",
  "Encryption",
  "Equipment Supervision",
  "Sounding Device",
  "Device Wire Protection",
  "Physical Boundary",
  "Detector Coverage",
  "Det. Cov. - SCIF/SAP",
  "Intrusion Detector(s) W/Tampers",
  "Contact(s) W/Tampers",
  "Wiring / Workmanship",
  "EOLR Placement",
  "Containers",
  "Detector Coverage",
  "Contact(s)",
  "Wiring",
  "OTHER",
];

function defaultCodeStandard(program: ReturnType<typeof certificateProgram>) {
  if (program === "mercantile") return "UL 681";
  if (program === "protectedArea") return "UL 2050";
  return "NFPA 72";
}

export function loadAuditor(): Auditor | null {
  const auditor = readJson<Auditor | null>(AUDITOR_KEY, null);
  if (!auditor) return null;
  if (!localStorage.getItem(PROFILE_DEFAULTS_MIGRATED_KEY)) {
    const migratedAuditor = normalizeAuditor(clearLegacyProfileDefaults(auditor));
    localStorage.setItem(AUDITOR_KEY, JSON.stringify(migratedAuditor));
    localStorage.setItem(PROFILE_DEFAULTS_MIGRATED_KEY, new Date().toISOString());
    return migratedAuditor;
  }
  return normalizeAuditor(auditor);
}

export function saveAuditor(profile: Omit<Auditor, "since" | "updatedAt"> & { since?: string }): Auditor {
  const now = nowIso();
  const auditor = normalizeAuditor({ ...profile, since: profile.since || now, updatedAt: now });
  localStorage.setItem(AUDITOR_KEY, JSON.stringify(auditor));
  return auditor;
}

function normalizeAuditor(auditor: Partial<Auditor> & { name: string }): Auditor {
  return {
    name: auditor.name?.trim() || "",
    title: auditor.title?.trim() || "",
    department: normalizeAuditorDepartment(auditor.department),
    phone: normalizePhone(auditor.phone),
    email: auditor.email?.trim() || "",
    since: auditor.since || nowIso(),
    updatedAt: auditor.updatedAt || auditor.since || nowIso(),
  };
}

function clearLegacyProfileDefaults(auditor: Auditor): Auditor {
  return {
    ...auditor,
    title: clearLegacyProfileValue(auditor.title, LEGACY_PROFILE_DEFAULTS.title),
    department: clearLegacyProfileValue(auditor.department, LEGACY_PROFILE_DEFAULTS.department),
    phone: clearLegacyProfileValue(auditor.phone, LEGACY_PROFILE_DEFAULTS.phone),
    email: clearLegacyProfileValue(auditor.email, LEGACY_PROFILE_DEFAULTS.email),
  };
}

function clearLegacyProfileValue(value: string | undefined, legacyDefault: string) {
  const normalizedValue = value?.trim() || "";
  return normalizedValue === legacyDefault ? "" : normalizedValue;
}

function normalizeAuditorDepartment(value: string | undefined) {
  const normalizedValue = value?.trim() || "";
  if (!normalizedValue || normalizedValue === LEGACY_PROFILE_DEFAULTS.department) return AUDITOR_DEPARTMENT_DEFAULT;
  return normalizedValue;
}

function normalizePhone(value: string | undefined) {
  return formatUsPhone(value);
}

export function loadAudits(): Audit[] {
  return readJson<Audit[]>(AUDITS_KEY, []).map(normalizeAudit);
}

export function saveAudits(audits: Audit[]) {
  localStorage.setItem(AUDITS_KEY, JSON.stringify(audits));
}

export function createAuditFromCertificate(certificate: ParsedCertificate, auditorName: string): Audit {
  const now = nowIso();
  const program = certificateProgram(certificate);
  const defaultCode = defaultCodeStandard(program);
  const standard = program === "fire" ? certificate.standardReferenced || "" : certificate.standardReferenced || defaultCode;
  const rowSets = auditRowElementsForProgram(program);
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
    codeEdition: standard,
    signalProcessingReviewed: true,
    signalReviewStart: "",
    signalReviewEnd: "",
    signalReviewNotes: "",
    signalReviewReportFinding: "",
    signalReviewReportRequiredAction: "",
    signalReviewReportCodeStandard: program === "fire" ? "" : defaultCode,
    signalReviewReportCodeEdition: "",
    signalReviewReportCodeSection: "",
    autoTestsStatus: "",
    documentationReviewed: true,
    documentationReviewNotes: "",
    documentationReviewReportFinding: "",
    documentationReviewReportRequiredAction: "",
    documentationReviewReportCodeStandard: program === "fire" ? "" : defaultCode,
    documentationReviewReportCodeEdition: "",
    documentationReviewReportCodeSection: "",
    installationReviewed: true,
    installationReviewNotes: "",
    installationReviewReportFinding: "",
    installationReviewReportRequiredAction: "",
    installationReviewReportCodeStandard: program === "fire" ? "" : defaultCode,
    installationReviewReportCodeEdition: "",
    installationReviewReportCodeSection: "",
    deviceTestingReviewed: true,
    deviceTestingNotes: "",
    deviceTestingReportFinding: "",
    deviceTestingReportRequiredAction: "",
    deviceTestingReportCodeStandard: program === "fire" ? "" : defaultCode,
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
    reportSectionStatus: {},
    guardServiceTest: guardServiceTest(now),
    signalLog: [signalRow(now)],
    documentation: rowSets.documentation.map((element) => row(element, auditorName, now)),
    installation: rowSets.installation.map((element) => row(element, auditorName, now)),
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
    lineSecurityExpectedSeconds: 200,
    location: "",
    deviceId: "",
    signalType: "" as const,
    functional: false,
    alarm: false,
    supervisory: false,
    trouble: false,
    lineSecurity: false,
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

function guardServiceTest(updatedAt: string) {
  return {
    reviewed: true,
    signalType: "" as const,
    otherSignalType: "",
    entryMode: "" as const,
    expectedMinutes: 20,
    testSignalInitiationTime: "",
    verificationCallTime: "",
    investigatorArrivalTime: "",
    elapsedSeconds: 0,
    result: "" as const,
    notes: "",
    updatedAt,
  };
}

function normalizeAudit(audit: Audit): Audit {
  const now = nowIso();
  const primaryCertificate = audit.certificates?.[audit.primaryCertificateIndex || 0] || audit.certificates?.[0];
  const ascLocation = cityStateFromAddress(primaryCertificate?.ascAddress);
  const program = auditProgram(audit);
  const rowSets = auditRowElementsForProgram(program);
  const defaultCode = defaultCodeStandard(program);
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
    signalReviewReportCodeStandard: audit.signalReviewReportCodeStandard ?? defaultCode,
    signalReviewReportCodeEdition: audit.signalReviewReportCodeEdition ?? "",
    signalReviewReportCodeSection: audit.signalReviewReportCodeSection ?? "",
    autoTestsStatus: audit.autoTestsStatus ?? "",
    documentationReviewed: audit.editedFields?.documentationReviewed ? Boolean(audit.documentationReviewed) : true,
    documentationReviewNotes: audit.documentationReviewNotes ?? "",
    documentationReviewReportFinding: audit.documentationReviewReportFinding ?? "",
    documentationReviewReportRequiredAction: audit.documentationReviewReportRequiredAction ?? "",
    documentationReviewReportCodeStandard: audit.documentationReviewReportCodeStandard ?? defaultCode,
    documentationReviewReportCodeEdition: audit.documentationReviewReportCodeEdition ?? "",
    documentationReviewReportCodeSection: audit.documentationReviewReportCodeSection ?? "",
    installationReviewed: audit.editedFields?.installationReviewed ? Boolean(audit.installationReviewed) : true,
    installationReviewNotes: audit.installationReviewNotes ?? "",
    installationReviewReportFinding: audit.installationReviewReportFinding ?? "",
    installationReviewReportRequiredAction: audit.installationReviewReportRequiredAction ?? "",
    installationReviewReportCodeStandard: audit.installationReviewReportCodeStandard ?? defaultCode,
    installationReviewReportCodeEdition: audit.installationReviewReportCodeEdition ?? "",
    installationReviewReportCodeSection: audit.installationReviewReportCodeSection ?? "",
    deviceTestingReviewed: audit.editedFields?.deviceTestingReviewed ? Boolean(audit.deviceTestingReviewed) : true,
    deviceTestingNotes: audit.deviceTestingNotes ?? "",
    deviceTestingReportFinding: audit.deviceTestingReportFinding ?? "",
    deviceTestingReportRequiredAction: audit.deviceTestingReportRequiredAction ?? "",
    deviceTestingReportCodeStandard: audit.deviceTestingReportCodeStandard ?? defaultCode,
    deviceTestingReportCodeEdition: audit.deviceTestingReportCodeEdition ?? "",
    deviceTestingReportCodeSection: audit.deviceTestingReportCodeSection ?? "",
    matchesCertificateStatus: audit.matchesCertificateStatus ?? (audit.matchesCertificate ? "OK" : ""),
    certificateDisplayedStatus: audit.certificateDisplayedStatus ?? (audit.certificateDisplayed ? "OK" : ""),
    certificateMatchReportFinding: audit.certificateMatchReportFinding ?? "",
    certificateMatchReportRequiredAction: audit.certificateMatchReportRequiredAction ?? "",
    certificateMatchReportCodeStandard: audit.certificateMatchReportCodeStandard ?? defaultCode,
    certificateMatchReportCodeEdition: audit.certificateMatchReportCodeEdition ?? "",
    certificateMatchReportCodeSection: audit.certificateMatchReportCodeSection ?? "",
    certificateDisplayedReportFinding: audit.certificateDisplayedReportFinding ?? "",
    certificateDisplayedReportRequiredAction: audit.certificateDisplayedReportRequiredAction ?? "",
    certificateDisplayedReportCodeStandard: audit.certificateDisplayedReportCodeStandard ?? defaultCode,
    certificateDisplayedReportCodeEdition: audit.certificateDisplayedReportCodeEdition ?? "",
    certificateDisplayedReportCodeSection: audit.certificateDisplayedReportCodeSection ?? "",
    deviceSystemLocal: audit.deviceSystemLocal ?? false,
    reportExtraFindings: normalizeReportExtraFindings(audit.reportExtraFindings),
    reportSectionStatus: {
      signal: Boolean(audit.reportSectionStatus?.signal),
      documentation: Boolean(audit.reportSectionStatus?.documentation),
      installation: Boolean(audit.reportSectionStatus?.installation),
    },
    guardServiceTest: normalizeGuardServiceTest(audit.guardServiceTest, now),
    signalLog: normalizeSignalRows(audit.signalLog, now),
    documentation: normalizeRows(audit.documentation, rowSets.documentation, audit.auditorName, now, defaultCode),
    installation: normalizeRows(audit.installation, rowSets.installation, audit.auditorName, now, defaultCode),
    deviceTests: normalizeDeviceRows(audit.deviceTests, now),
  };
}

function auditRowElementsForProgram(program: ReturnType<typeof certificateProgram>) {
  if (program === "mercantile") return { documentation: mercantileDocumentationElements, installation: mercantileInstallationElements };
  if (program === "protectedArea") return { documentation: protectedAreaDocumentationElements, installation: protectedAreaInstallationElements };
  return { documentation: documentationElements, installation: installationElements };
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

function normalizeRows(rows: AuditRow[], elements: string[], auditorName: string, updatedAt: string, defaultCode = "NFPA 72") {
  const fixedRows = elements.map((element) => normalizeAuditRow(rows.find((item) => item.element === element) || row(element, auditorName, updatedAt), auditorName, updatedAt, defaultCode));
  const customRows = rows
    .filter((item) => item.element && !elements.includes(item.element) && !item.element.startsWith("NFPA"))
    .map((item) => normalizeAuditRow(item, auditorName, updatedAt, defaultCode));
  return [...fixedRows, ...customRows];
}

function normalizeAuditRow(item: AuditRow, auditorName: string, updatedAt: string, defaultCode = "NFPA 72"): AuditRow {
  return {
    ...row(item.element, auditorName, updatedAt),
    ...item,
    reportFinding: item.reportFinding || "",
    reportRequiredAction: item.reportRequiredAction || "",
    reportCodeStandard: item.reportCodeStandard || defaultCode,
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
    lineSecurity: item.lineSecurity ?? false,
    lineSecurityExpectedSeconds: item.lineSecurityExpectedSeconds || 200,
    notApplicable: item.notApplicable ?? false,
  }));
  return normalized.length ? normalized : [deviceRow(updatedAt)];
}

function normalizeGuardServiceTest(test: Audit["guardServiceTest"], updatedAt: string) {
  return {
    ...guardServiceTest(updatedAt),
    ...test,
    reviewed: test?.reviewed ?? true,
    signalType: (test?.signalType || "") as GuardServiceSignalType | "",
    otherSignalType: test?.otherSignalType || "",
    entryMode: (test?.entryMode || "") as GuardServiceTest["entryMode"],
    expectedMinutes: test?.expectedMinutes || 20,
    testSignalInitiationTime: test?.testSignalInitiationTime || "",
    verificationCallTime: test?.verificationCallTime || "",
    investigatorArrivalTime: test?.investigatorArrivalTime || "",
    elapsedSeconds: test?.elapsedSeconds || 0,
    result: (test?.result || "") as GuardServiceResult | "",
    notes: test?.notes || "",
    updatedAt: test?.updatedAt || updatedAt,
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
