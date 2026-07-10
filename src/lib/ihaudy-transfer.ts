import { AssignmentGroup } from "./audit-assignments";
import { loadAudits, saveAudits } from "./audit-storage";
import { hasDesktopBridge, saveDesktopTextFile, storedHaudyDatabaseRoot } from "./desktop-bridge";
import { canSaveDocumentsToFolder, chooseStorageRoot } from "./local-document-storage";
import { storePhotoDataUrl } from "./photo-store";
import { Audit, AuditRow, CertificateSummaryItem, CertificateSummarySection, CertificateTransferSummary, DeviceTestRow, ParsedCertificate, ReportFindingEntry, SignalLogRow } from "./types";

const IHAUDY_APP_NAME = "iHaudy Field Notes";
const IHAUDY_VERSION = 1;

interface IHaudyFieldNotesFile {
  app: typeof IHAUDY_APP_NAME;
  version: number;
  source: "Haudy Suite" | "iHaudy";
  exportedAt: string;
  ascKey: string;
  ascName: string;
  ascAddress?: string;
  ascCity: string;
  ascState: string;
  psn: string;
  audits: Audit[];
}

export const IHAUDY_FIELD_NOTES_ACCEPT = ".ihaudy-field-notes.json,.json,application/json";

export async function exportFieldNotesForIHaudy(group: AssignmentGroup) {
  const payload: IHaudyFieldNotesFile = {
    app: IHAUDY_APP_NAME,
    version: IHAUDY_VERSION,
    source: "Haudy Suite",
    exportedAt: new Date().toISOString(),
    ascKey: group.key,
    ascName: group.ascName,
    ascCity: group.ascCity,
    ascState: group.ascState,
    psn: group.psn,
    ascAddress: group.audits[0]?.certificates?.[0]?.ascAddress || "",
    audits: group.audits.map((audit) => withCertificateSummary(audit, group)),
  };
  const fileName = `import it to iHaudy - ${safeName(group.ascName || "ASC")} - ${timestampForFile()}.ihaudy-field-notes.json`;
  const contents = JSON.stringify(payload, null, 2);

  if (canSaveDocumentsToFolder() && hasDesktopBridge()) {
    if (!storedHaudyDatabaseRoot()) await chooseStorageRoot();
    await saveDesktopTextFile(iHaudyStorageFolders(group), fileName, contents);
    return `iHaudy field notes file saved in ${group.ascName || "ASC"} / iHaudy files.`;
  }

  downloadTextFile(fileName, contents);
  return "iHaudy field notes file downloaded.";
}

function withCertificateSummary(audit: Audit, group: AssignmentGroup): Audit {
  return {
    ...audit,
    certificateSummary: buildCertificateSummary(audit, group),
  };
}

function buildCertificateSummary(audit: Audit, group: AssignmentGroup): CertificateTransferSummary {
  const certificate = primaryCertificate(audit);
  const category = certificate?.categoryCode || certificate?.ccn || categoryFromAudit(audit);
  const sections = [
    section("Certificate", [
      item("Certificate number", certificate?.certificateNumber || audit.certificateNumber),
      item("Category", category),
      item("File / SCN", audit.fileScn),
      item("File number", certificate?.fileNo),
      item("CCN", certificate?.ccn),
      item("Type", certificate?.certificateType),
      item("Standard", certificate?.standardReferenced || audit.codeEdition),
      item("Issued", certificate?.issuedDate),
      item("Revised", certificate?.revisedDate),
      item("Coverage", certificate?.coverageType),
      item("Area covered", certificate?.areaCovered),
    ]),
    section("Protected Property", [
      item("Name", certificate?.propertyName || audit.protectedProperty),
      item("Address", certificate?.propertyAddress),
      item("Government manual", certificate?.governmentManual),
      item("Government contract number", certificate?.governmentContractNumber),
      item("Protected area", certificate?.protectedArea),
      item("Protected area type", certificate?.protectedAreaType),
      item("Protected area description", certificate?.protectedAreaDescription),
      item("Physical boundary", certificate?.physicalBoundary),
      item("Closed area", certificate?.closedArea),
      item("Premises extent of protection", certificate?.premisesExtent),
      item("Stockroom extent of protection", certificate?.stockroomExtent),
      item("Safe complete", certificate?.safeComplete),
      item("Hold-up", certificate?.holdUp),
    ]),
    section("Alarm Service Company", [
      item("ASC", certificate?.ascName || audit.ascName),
      item("Address", certificate?.ascAddress),
      item("City", certificate?.ascCity || audit.ascCity),
      item("State", certificate?.ascState || audit.ascState),
      item("PSN", group.psn),
    ]),
    section("Monitoring / Signal Transmission", [
      item("Monitoring station", certificate?.centralStation),
      item("Monitoring file", certificate?.centralStationFile),
      item("Monitoring address", certificate?.centralStationAddress),
      item("Primary transmission", certificate?.primaryTransmission),
      item("Secondary transmission", certificate?.secondaryTransmission),
      item("Retransmission to fire department", certificate?.retransmission),
      item("Party notified", certificate?.partyNotified),
      item("Line security", certificate?.lineSecurity),
      item("Alarm sounding device location", certificate?.alarmSoundingDeviceLocation),
      item("Opening / closing", certificate?.openingClosing),
    ]),
    section("Equipment", [
      item("Control unit manufacturer", certificate?.controlUnitMfr),
      item("Control unit model", certificate?.controlUnitModel),
      item("Transmitter manufacturer", certificate?.signalTransmitterMfr),
      item("Transmitter model", certificate?.signalTransmitterModel),
      item("Control / transmitter combo", certificate?.controlTransmitterCombo),
    ]),
    section("Fire Device Counts", fireDeviceItems(certificate)),
    section("Fire Department / NFPA", [
      item("Authority having jurisdiction", certificate?.ahj),
      item("Responding fire department", certificate?.respondingFD),
      item("System deviations", certificate?.systemDeviations),
      item("Comments and clarifications", certificate?.commentsAndClarifications),
    ]),
    section("CRZH / Security Details", [
      item("Government manual", certificate?.governmentManual),
      item("Alarm response", certificate?.alarmResponse),
      item("Guard response", certificate?.guardResponse),
      item("Independent code", certificate?.independentCode),
      item("ASD form", certificate?.asdForm),
      item("Line security", certificate?.lineSecurity),
      item("Protected area", certificate?.protectedArea),
      item("Protected area type", certificate?.protectedAreaType),
      item("Physical boundary", certificate?.physicalBoundary),
      item("Closed area", certificate?.closedArea),
    ]),
  ].filter((candidate): candidate is CertificateSummarySection => Boolean(candidate));

  return {
    generatedAt: new Date().toISOString(),
    certificateNumber: certificate?.certificateNumber || audit.certificateNumber,
    categoryCode: category,
    sections,
  };
}

function primaryCertificate(audit: Audit): ParsedCertificate | undefined {
  return audit.certificates?.[audit.primaryCertificateIndex] || audit.certificates?.[0];
}

function section(title: string, items: Array<CertificateSummaryItem | null | undefined>): CertificateSummarySection | null {
  const cleanItems = items.filter((entry): entry is CertificateSummaryItem => Boolean(entry));
  return cleanItems.length ? { title, items: cleanItems } : null;
}

function item(label: string, value: unknown): CertificateSummaryItem | null {
  const cleanValue = String(value ?? "").trim();
  if (!cleanValue) return null;
  return { label, value: cleanValue };
}

function fireDeviceItems(certificate?: ParsedCertificate): CertificateSummaryItem[] {
  const counts = certificate?.deviceCounts;
  if (!counts) return [];
  return [
    item("Smoke detectors", counts.smoke),
    item("Heat detectors", counts.heat),
    item("Duct-type smoke detectors", counts.duct),
    item("Other initiating devices", counts.otherInitiating),
    item("Manual pull stations", counts.manualStations),
    item("Waterflow / control valves", counts.waterflowControlValve),
    item("Horn / strobes", counts.hornStrobe),
    item("Strobes", counts.strobe),
    item("Notification appliances", counts.notificationAppliances),
  ].filter((entry): entry is CertificateSummaryItem => Boolean(entry));
}

function categoryFromAudit(audit: Audit) {
  const fileScn = audit.fileScn || "";
  return fileScn.match(/\b(UUFX|UUJS|CVSG|CRZH)\b/i)?.[1]?.toUpperCase() || "";
}

export async function importFieldNotesFromIHaudy(file: File, group: AssignmentGroup) {
  const payload = parseIHaudyFile(await file.text());
  const existingAudits = loadAudits();
  const incomingById = new Map(payload.audits.map((audit) => [audit.id, audit]));
  const incomingByCertificate = new Map(payload.audits.map((audit) => [certificateMatchKey(audit), audit]));
  const groupAuditIds = new Set(group.audits.map((audit) => audit.id));
  let imported = 0;
  const now = new Date().toISOString();

  const mergedAudits = existingAudits.map((existing) => {
    if (!groupAuditIds.has(existing.id)) return existing;
    const incoming = incomingById.get(existing.id) || incomingByCertificate.get(certificateMatchKey(existing));
    if (!incoming) return existing;
    imported += 1;
    return preserveReportWork(existing, { ...incoming, updatedAt: now });
  });

  if (!imported) {
    throw new Error("This iHaudy file does not match any property under this ASC.");
  }

  saveAudits(mergedAudits);
  return { imported, audits: mergedAudits };
}

export function iHaudyStorageFolders(group: AssignmentGroup) {
  return [safeName([folderYear(group), group.ascName || "ASC"].filter(Boolean).join(" - ")), "iHaudy files"];
}

function parseIHaudyFile(contents: string): IHaudyFieldNotesFile {
  let parsed: Partial<IHaudyFieldNotesFile>;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("Could not read this iHaudy file. Please select the field notes JSON exported from iHaudy.");
  }
  if (parsed.app !== IHAUDY_APP_NAME || !Array.isArray(parsed.audits)) {
    throw new Error("This is not an iHaudy field notes file.");
  }
  return parsed as IHaudyFieldNotesFile;
}

function preserveReportWork(existing: Audit, incoming: Audit): Audit {
  return {
    ...incoming,
    signalReviewReportFinding: existing.signalReviewReportFinding || incoming.signalReviewReportFinding,
    signalReviewReportRequiredAction: existing.signalReviewReportRequiredAction || incoming.signalReviewReportRequiredAction,
    signalReviewReportCodeStandard: existing.signalReviewReportCodeStandard || incoming.signalReviewReportCodeStandard,
    signalReviewReportCodeEdition: existing.signalReviewReportCodeEdition || incoming.signalReviewReportCodeEdition,
    signalReviewReportCodeSection: existing.signalReviewReportCodeSection || incoming.signalReviewReportCodeSection,
    documentationReviewReportFinding: existing.documentationReviewReportFinding || incoming.documentationReviewReportFinding,
    documentationReviewReportRequiredAction: existing.documentationReviewReportRequiredAction || incoming.documentationReviewReportRequiredAction,
    documentationReviewReportCodeStandard: existing.documentationReviewReportCodeStandard || incoming.documentationReviewReportCodeStandard,
    documentationReviewReportCodeEdition: existing.documentationReviewReportCodeEdition || incoming.documentationReviewReportCodeEdition,
    documentationReviewReportCodeSection: existing.documentationReviewReportCodeSection || incoming.documentationReviewReportCodeSection,
    installationReviewReportFinding: existing.installationReviewReportFinding || incoming.installationReviewReportFinding,
    installationReviewReportRequiredAction: existing.installationReviewReportRequiredAction || incoming.installationReviewReportRequiredAction,
    installationReviewReportCodeStandard: existing.installationReviewReportCodeStandard || incoming.installationReviewReportCodeStandard,
    installationReviewReportCodeEdition: existing.installationReviewReportCodeEdition || incoming.installationReviewReportCodeEdition,
    installationReviewReportCodeSection: existing.installationReviewReportCodeSection || incoming.installationReviewReportCodeSection,
    deviceTestingReportFinding: existing.deviceTestingReportFinding || incoming.deviceTestingReportFinding,
    deviceTestingReportRequiredAction: existing.deviceTestingReportRequiredAction || incoming.deviceTestingReportRequiredAction,
    deviceTestingReportCodeStandard: existing.deviceTestingReportCodeStandard || incoming.deviceTestingReportCodeStandard,
    deviceTestingReportCodeEdition: existing.deviceTestingReportCodeEdition || incoming.deviceTestingReportCodeEdition,
    deviceTestingReportCodeSection: existing.deviceTestingReportCodeSection || incoming.deviceTestingReportCodeSection,
    certificateMatchReportFinding: existing.certificateMatchReportFinding || incoming.certificateMatchReportFinding,
    certificateMatchReportRequiredAction: existing.certificateMatchReportRequiredAction || incoming.certificateMatchReportRequiredAction,
    certificateMatchReportCodeStandard: existing.certificateMatchReportCodeStandard || incoming.certificateMatchReportCodeStandard,
    certificateMatchReportCodeEdition: existing.certificateMatchReportCodeEdition || incoming.certificateMatchReportCodeEdition,
    certificateMatchReportCodeSection: existing.certificateMatchReportCodeSection || incoming.certificateMatchReportCodeSection,
    certificateDisplayedReportFinding: existing.certificateDisplayedReportFinding || incoming.certificateDisplayedReportFinding,
    certificateDisplayedReportRequiredAction: existing.certificateDisplayedReportRequiredAction || incoming.certificateDisplayedReportRequiredAction,
    certificateDisplayedReportCodeStandard: existing.certificateDisplayedReportCodeStandard || incoming.certificateDisplayedReportCodeStandard,
    certificateDisplayedReportCodeEdition: existing.certificateDisplayedReportCodeEdition || incoming.certificateDisplayedReportCodeEdition,
    certificateDisplayedReportCodeSection: existing.certificateDisplayedReportCodeSection || incoming.certificateDisplayedReportCodeSection,
    reportExtraFindings: mergeExtraFindings(existing.reportExtraFindings, incoming.reportExtraFindings),
    reportSectionStatus: existing.reportSectionStatus || incoming.reportSectionStatus,
    signalLog: mergeSignalRows(existing.signalLog, incoming.signalLog),
    documentation: mergeAuditRows(existing.documentation, incoming.documentation),
    installation: mergeAuditRows(existing.installation, incoming.installation),
    deviceTests: mergeDeviceRows(existing.deviceTests, incoming.deviceTests),
  };
}

function mergeSignalRows(existingRows: SignalLogRow[], incomingRows: SignalLogRow[]) {
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  return incomingRows.map((row) => preserveRowReportFields(existingById.get(row.id), row));
}

function mergeAuditRows(existingRows: AuditRow[], incomingRows: AuditRow[]) {
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const existingByElement = new Map(existingRows.map((row) => [row.element, row]));
  return incomingRows.map((row) => preserveRowReportFields(existingById.get(row.id) || existingByElement.get(row.element), preparePhotoRow(row)));
}

function mergeDeviceRows(existingRows: DeviceTestRow[], incomingRows: DeviceTestRow[]) {
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  return incomingRows.map((row) => preserveRowReportFields(existingById.get(row.id), preparePhotoRow(row)));
}

function preserveRowReportFields<T extends SignalLogRow | AuditRow | DeviceTestRow>(existing: T | undefined, incoming: T): T {
  if (!existing) return incoming;
  return {
    ...incoming,
    reportFinding: existing.reportFinding || incoming.reportFinding,
    reportRequiredAction: existing.reportRequiredAction || incoming.reportRequiredAction,
    reportCodeStandard: existing.reportCodeStandard || incoming.reportCodeStandard,
    reportCodeEdition: existing.reportCodeEdition || incoming.reportCodeEdition,
    reportCodeSection: existing.reportCodeSection || incoming.reportCodeSection,
  };
}

function mergeExtraFindings(existing: Audit["reportExtraFindings"], incoming: Audit["reportExtraFindings"]) {
  if (!existing) return incoming || {};
  if (!incoming) return existing;
  const merged: Record<string, ReportFindingEntry[]> = { ...incoming };
  for (const [key, entries] of Object.entries(existing)) {
    if (entries.length) merged[key] = entries;
  }
  return merged;
}

function preparePhotoRow<T extends AuditRow | DeviceTestRow>(row: T): T {
  return {
    ...row,
    photos: (row.photos || []).map(importPhotoReference).filter(Boolean),
  };
}

function importPhotoReference(photo: string) {
  if (!photo.startsWith("data:")) return photo;
  return storePhotoDataUrl(photo);
}

function certificateMatchKey(audit: Audit) {
  return [audit.ascName, audit.ascCity, audit.ascState, audit.certificateNumber, audit.protectedProperty].map((value) => (value || "").trim().toLowerCase()).join("|");
}

function folderYear(group: AssignmentGroup) {
  const auditDate = group.audits[0]?.auditDate || group.audits[0]?.createdAt;
  return auditDate?.slice(0, 4) || new Date().getFullYear().toString();
}

function timestampForFile() {
  const now = new Date();
  return [
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`,
  ].join(" ");
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Haudy";
}

function downloadTextFile(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
