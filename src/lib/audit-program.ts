import { Audit, ParsedCertificate } from "./types";

export type AuditProgram = "fire" | "mercantile" | "protectedArea";

export function certificateProgram(certificate?: ParsedCertificate): AuditProgram {
  const code = (certificate?.categoryCode || certificate?.ccn || "").trim().toUpperCase();
  if (code === "CVSG") return "mercantile";
  if (code === "CRZH") return "protectedArea";
  return "fire";
}

export function primaryCertificateForAudit(audit: Audit) {
  return audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
}

export function auditProgram(audit: Audit): AuditProgram {
  return certificateProgram(primaryCertificateForAudit(audit));
}

export function isMercantileAudit(audit: Audit) {
  return auditProgram(audit) === "mercantile";
}

export function isProtectedAreaAudit(audit: Audit) {
  return auditProgram(audit) === "protectedArea";
}
