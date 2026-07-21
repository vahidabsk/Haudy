import { auditProgram } from "./audit-program";
import type { Audit, AuditRow, DeviceTestRow, SignalLogRow } from "./types";

export const FIELD_NOTE_READY_PERCENT = 90;

export interface FieldNoteProgress {
  completed: number;
  total: number;
  percentage: number;
  notVisited: boolean;
  readyForReport: boolean;
}

function percent(completed: number, total: number) {
  return total ? Math.round((completed / total) * 100) : 0;
}

function rowsCompleted(rows: AuditRow[]) {
  return rows.filter((row) => Boolean(row.status)).length;
}

function hasAuditRowWork(rows: AuditRow[]) {
  return rows.some((row) => Boolean(row.status || row.notes || row.reportFinding || row.reportRequiredAction || row.photos?.length));
}

function signalRowsCompleted(rows: SignalLogRow[]) {
  return rows.filter((row) => Boolean(row.handlingStatus)).length;
}

function hasSignalRowWork(rows: SignalLogRow[]) {
  return rows.some((row) => Boolean(row.handlingStatus || row.signalType || row.date || row.time || row.description || row.notes));
}

function deviceRowsCompleted(rows: DeviceTestRow[]) {
  return rows.filter((row) => Boolean(row.result)).length;
}

function hasDeviceRowWork(rows: DeviceTestRow[]) {
  return rows.some((row) => Boolean(row.result || row.deviceType || row.location || row.deviceId || row.notes || row.photos?.length || row.tripTime || row.timeReceived));
}

/**
 * Measures field-note coverage from actions made by the auditor, rather than
 * default values loaded from the certificate. A "No" review is complete once
 * it has been selected; its disabled detail rows are not required.
 */
export function fieldNoteProgress(audit: Audit): FieldNoteProgress {
  const notVisited = audit.fieldVisitStatus === "notVisited";
  if (notVisited) return { completed: 0, total: 0, percentage: 0, notVisited: true, readyForReport: true };

  const program = auditProgram(audit);
  let completed = 0;
  let total = 0;

  if (program !== "mercantile") {
    total += 1;
    const signalAddressed = Boolean(audit.deviceSystemLocal || audit.editedFields?.signalProcessingReviewed || !audit.signalProcessingReviewed || audit.signalReviewNotes || hasSignalRowWork(audit.signalLog));
    if (signalAddressed) completed += 1;
    if (signalAddressed && audit.signalProcessingReviewed && !audit.deviceSystemLocal) {
      total += audit.signalLog.length;
      completed += signalRowsCompleted(audit.signalLog);
    }
  }

  total += 1;
  const documentationAddressed = Boolean(audit.editedFields?.documentationReviewed || !audit.documentationReviewed || audit.documentationReviewNotes || hasAuditRowWork(audit.documentation));
  if (documentationAddressed) completed += 1;
  if (documentationAddressed && audit.documentationReviewed) {
    total += audit.documentation.length;
    completed += rowsCompleted(audit.documentation);
  }

  total += 1;
  const installationAddressed = Boolean(audit.editedFields?.installationReviewed || !audit.installationReviewed || audit.installationReviewNotes || audit.matchesCertificateStatus || audit.certificateDisplayedStatus || hasAuditRowWork(audit.installation));
  if (installationAddressed) completed += 1;
  if (installationAddressed && audit.installationReviewed) {
    if (program === "fire") {
      total += 2;
      completed += Number(Boolean(audit.matchesCertificateStatus)) + Number(Boolean(audit.certificateDisplayedStatus));
    }
    total += audit.installation.length;
    completed += rowsCompleted(audit.installation);
  }

  if (program === "protectedArea") {
    total += 1;
    const guardAddressed = !audit.guardServiceTest?.reviewed || Boolean(audit.guardServiceTest?.entryMode) || Boolean(audit.guardServiceTest?.result);
    if (guardAddressed) completed += 1;
  }

  total += 1;
  const deviceAddressed = Boolean(audit.editedFields?.deviceTestingReviewed || !audit.deviceTestingReviewed || audit.deviceTestingNotes || hasDeviceRowWork(audit.deviceTests));
  if (deviceAddressed) completed += 1;
  if (deviceAddressed && audit.deviceTestingReviewed) {
    total += audit.deviceTests.length;
    completed += deviceRowsCompleted(audit.deviceTests);
  }

  const percentage = percent(completed, total);
  return { completed, total, percentage, notVisited: false, readyForReport: percentage >= FIELD_NOTE_READY_PERCENT };
}

export function groupFieldNoteProgress(audits: Audit[]) {
  const visited = audits.filter((audit) => audit.fieldVisitStatus !== "notVisited");
  const notVisited = audits.length - visited.length;
  const properties = visited.map(fieldNoteProgress);
  const percentage = properties.length ? Math.round(properties.reduce((sum, item) => sum + item.percentage, 0) / properties.length) : 0;
  return {
    percentage,
    visited: visited.length,
    notVisited,
    total: audits.length,
    readyForReport: visited.length > 0 && properties.every((item) => item.readyForReport),
  };
}
