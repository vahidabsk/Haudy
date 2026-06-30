import { Audit, ParsedCertificate } from "./types";

export function certificateIdentity(certificate: ParsedCertificate) {
  return [
    certificate.ascName,
    certificate.ascCity,
    certificate.ascState,
    certificate.propertyName,
    certificate.certificateNumber,
  ].map(normalize).join("|");
}

export function auditIdentity(audit: Audit) {
  return [
    audit.ascName,
    audit.ascCity,
    audit.ascState,
    audit.protectedProperty,
    audit.certificateNumber,
  ].map(normalize).join("|");
}

export function auditHasProgress(audit: Audit) {
  return Boolean(
    audit.signalProcessingReviewed ||
    audit.documentationReviewed ||
    audit.installationReviewed ||
    audit.signalReviewStart ||
    audit.signalReviewEnd ||
    audit.signalReviewNotes ||
    audit.signalReviewReportFinding ||
    audit.signalReviewReportRequiredAction ||
    audit.signalReviewReportCodeSection ||
    audit.autoTestsStatus ||
    audit.matchesCertificateStatus ||
    audit.certificateDisplayedStatus ||
    audit.documentationReviewNotes ||
    audit.documentationReviewReportFinding ||
    audit.documentationReviewReportRequiredAction ||
    audit.documentationReviewReportCodeSection ||
    audit.installationReviewNotes ||
    audit.installationReviewReportFinding ||
    audit.installationReviewReportRequiredAction ||
    audit.installationReviewReportCodeSection ||
    audit.certificateMatchReportFinding ||
    audit.certificateMatchReportRequiredAction ||
    audit.certificateDisplayedReportFinding ||
    audit.certificateDisplayedReportRequiredAction ||
    audit.comments ||
    audit.signalLog.some((row) => row.signalType || row.handlingStatus || row.date || row.time || row.description || row.notes || row.reportFinding || row.reportRequiredAction || row.reportCodeSection) ||
    audit.documentation.some((row) => row.status || row.notes || row.reportFinding || row.reportRequiredAction || row.reportCodeSection || row.photos.length) ||
    audit.installation.some((row) => row.status || row.notes || row.reportFinding || row.reportRequiredAction || row.reportCodeSection || row.photos.length) ||
    audit.deviceTests.some((row) => row.deviceType || row.location || row.deviceId || row.functional || row.alarm || row.supervisory || row.trouble || row.tripTime || row.timeReceived || row.result || row.notes || row.reportFinding || row.reportRequiredAction || row.reportCodeSection || row.photos.length)
  );
}

function normalize(value?: string) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}
