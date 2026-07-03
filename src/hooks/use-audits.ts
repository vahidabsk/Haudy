import { useEffect, useMemo, useState } from "react";
import { Audit, ParsedCertificate } from "../lib/types";
import { createAuditFromCertificate, loadAudits, saveAudits } from "../lib/audit-storage";
import { removeAuditPhotos } from "../lib/photo-store";
import { auditIdentity, certificateIdentity } from "../lib/audit-duplicates";

export function useAudits(auditorName = "") {
  const [audits, setAudits] = useState<Audit[]>(() => loadAudits());

  useEffect(() => {
    const timeout = window.setTimeout(() => saveAudits(audits), 500);
    return () => window.clearTimeout(timeout);
  }, [audits]);

  return useMemo(
    () => ({
      audits,
      setAudits,
      createFromCertificate(certificate: ParsedCertificate) {
        const audit = createAuditFromCertificate(certificate, auditorName);
        setAudits((current) => {
          const next = [audit, ...current];
          saveAudits(next);
          return next;
        });
        return audit;
      },
      createManyFromCertificates(certificates: ParsedCertificate[]) {
        const newAudits = certificates.map((certificate) => createAuditFromCertificate(certificate, auditorName));
        setAudits((current) => {
          const next = [...newAudits, ...current];
          saveAudits(next);
          return next;
        });
        return newAudits;
      },
      createManyFromCertificatesWithOverrides(certificates: ParsedCertificate[], overrides: Partial<ParsedCertificate>) {
        const newAudits = certificates.map((certificate) => createAuditFromCertificate({ ...certificate, ...overrides }, auditorName));
        setAudits((current) => {
          const next = [...newAudits, ...current];
          saveAudits(next);
          return next;
        });
        return newAudits;
      },
      replaceManyFromCertificates(certificates: ParsedCertificate[]) {
        const replacementKeys = new Set(certificates.map(certificateIdentity));
        const newAudits = certificates.map((certificate) => createAuditFromCertificate(certificate, auditorName));
        setAudits((current) => {
          current.filter((audit) => replacementKeys.has(auditIdentity(audit))).forEach(removeAuditPhotos);
          const keptAudits = current.filter((audit) => !replacementKeys.has(auditIdentity(audit)));
          const next = [...newAudits, ...keptAudits];
          saveAudits(next);
          return next;
        });
        return newAudits;
      },
      deleteAudit(id: string) {
        setAudits((current) => {
          const deletedAudit = current.find((audit) => audit.id === id);
          if (deletedAudit) removeAuditPhotos(deletedAudit);
          const next = current.filter((audit) => audit.id !== id);
          saveAudits(next);
          return next;
        });
      },
      deleteAudits(ids: string[]) {
        const idSet = new Set(ids);
        setAudits((current) => {
          current.filter((audit) => idSet.has(audit.id)).forEach(removeAuditPhotos);
          const next = current.filter((audit) => !idSet.has(audit.id));
          saveAudits(next);
          return next;
        });
      },
      updateAudit(nextAudit: Audit) {
        setAudits((current) => {
          const next = current.map((audit) => (audit.id === nextAudit.id ? nextAudit : audit));
          saveAudits(next);
          return next;
        });
      },
    }),
    [auditorName, audits]
  );
}
