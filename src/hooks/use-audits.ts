import { useEffect, useMemo, useState } from "react";
import { Audit, ParsedCertificate } from "../lib/types";
import { createAuditFromCertificate, loadAudits, saveAudits } from "../lib/audit-storage";
import { removeAuditPhotos } from "../lib/photo-store";

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
      deleteAudit(id: string) {
        setAudits((current) => {
          const deletedAudit = current.find((audit) => audit.id === id);
          if (deletedAudit) removeAuditPhotos(deletedAudit);
          const next = current.filter((audit) => audit.id !== id);
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
