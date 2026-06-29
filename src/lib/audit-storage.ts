import { Audit, Auditor, ParsedCertificate } from "./types";
import { nowIso, uid } from "./utils";

const AUDITOR_KEY = "haudy.auditor";
const AUDITS_KEY = "haudy.audits";

export const documentationElements = [
  "As-built drawings",
  "Riser diagram",
  "Battery calculations",
  "Voltage drop calculations",
  "Sequence of operation",
  "Service records",
  "Inspection/test records",
  "AIT records",
  "Monitoring records",
  "Previous deficiencies",
  "Correction documentation",
];

export const installationElements = [
  "Compatible/Listed Equipment",
  "Control & Sub Control(s)",
  "Transmitter/Communicator",
  "Primary Power Requirements",
  "Secondary Power (battery condition, date code)",
  "Enclosure",
  "Wiring workmanship",
  "Conduit/cable protection",
  "Grounding/bonding",
  "Circuit identification",
  "Panel labeling",
  "Device labeling",
  "Notification appliance condition",
  "Initiating device condition",
  "Waterflow + Tamper",
  "Smoke/Heat/Duct detectors",
  "Manual stations",
  "Remote annunciator",
  "Communication equipment",
  "Central station connection",
  "Code compliance",
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
  return readJson<Audit[]>(AUDITS_KEY, []);
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
    certificateNumber: certificate.certificateNumber || "",
    fileScn: [certificate.fileNo, certificate.ccn].filter(Boolean).join(" / "),
    protectedProperty: certificate.propertyName || "",
    codeEdition: certificate.standardReferenced || "",
    certificates: [{ ...certificate, uploadedAt: now }],
    primaryCertificateIndex: 0,
    matchesCertificate: false,
    certificateDisplayed: false,
    signalLog: [{ id: uid("signal"), signalType: "", date: "", time: "", description: "", notes: "", updatedAt: now }],
    documentation: documentationElements.map((element) => row(element, auditorName, now)),
    installation: installationElements.map((element) => row(element, auditorName, now)),
    deviceTests: [
      {
        id: uid("device"),
        deviceType: "",
        location: "",
        deviceId: "",
        signalType: "",
        tripTime: "",
        timeReceived: "",
        signalReceived: false,
        restoralReceived: false,
        localIndication: false,
        result: "",
        notes: "",
        photos: [],
        updatedAt: now,
      },
    ],
    comments: certificate.systemDeviations || "",
    editedFields: {},
  };
}

function row(element: string, auditorName: string, updatedAt: string) {
  return { id: uid("row"), element, status: "" as const, notes: "", photos: [], updatedAt, updatedBy: auditorName };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
