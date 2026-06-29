import { Link, useParams } from "react-router-dom";
import { CertificateSummary } from "../components/CertificateSummary";
import { DeviceTestSection } from "../components/DeviceTestSection";
import { DocumentationSection } from "../components/DocumentationSection";
import { InstallationSection } from "../components/InstallationSection";
import { SignalLogSection } from "../components/SignalLogSection";
import { useAudits } from "../hooks/use-audits";
import { Audit, DisplayStatus, ReviewStatus } from "../lib/types";
import { nowIso } from "../lib/utils";

const codeEditionOptions = ["NFPA 72-2002", "NFPA 72-2007", "NFPA 72 2010 Edition", "NFPA 72-2013", "NFPA 72-2016", "NFPA 72-2019", "NFPA 72-2022"];

export function AuditPage({ auditorName }: { auditorName: string }) {
  const { auditId } = useParams();
  const store = useAudits(auditorName);
  const audit = store.audits.find((item) => item.id === auditId);
  if (!audit) return <main className="p-6">Audit not found.</main>;

  function update(next: Audit) {
    store.updateAudit({ ...next, updatedAt: nowIso() });
  }

  const primary = audit.certificates[audit.primaryCertificateIndex];
  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="sticky top-0 z-10 grid gap-3 rounded-lg border bg-white/95 p-4 shadow-sm backdrop-blur md:grid-cols-6">
        <input className="min-h-11 rounded-md border px-3" type="date" value={audit.auditDate} onChange={(e) => update({ ...audit, auditDate: e.target.value })} />
        <input className="min-h-11 rounded-md border px-3" value={audit.ascName} onChange={(e) => update({ ...audit, ascName: e.target.value })} placeholder="ASC" />
        <input className="min-h-11 rounded-md border px-3" value={audit.fileScn} onChange={(e) => update({ ...audit, fileScn: e.target.value })} placeholder="File / SCN" />
        <input className="min-h-11 rounded-md border px-3" list="code-edition-options" value={audit.codeEdition} onChange={(e) => update({ ...audit, codeEdition: e.target.value })} placeholder="NFPA edition" />
        <datalist id="code-edition-options">{codeEditionOptions.map((option) => <option key={option} value={option} />)}</datalist>
        <input className="min-h-11 rounded-md border px-3 bg-slate-100" value={audit.auditorName} readOnly />
        <Link className="min-h-11 rounded-md bg-signal px-4 py-2 text-center font-semibold text-white" to={`/audit/${audit.id}/export`}>Export</Link>
      </section>
      <CertificateSummary certificate={primary} />
      <section className="grid gap-2 rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-navy">Certificates</h3>
        {audit.certificates.map((certificate, index) => (
          <label key={certificate.fileName} className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
            <input type="radio" checked={index === audit.primaryCertificateIndex} onChange={() => update({ ...audit, primaryCertificateIndex: index })} />
            <span>{certificate.fileName} — {certificate.certificateNumber || "No SN"}</span>
          </label>
        ))}
      </section>
      <div className="grid gap-6">
        <section className="grid gap-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-navy">Signal Processing Review</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <YesNoControl label="Signal processing reviewed?" value={audit.signalProcessingReviewed} onChange={(signalProcessingReviewed) => update({ ...audit, signalProcessingReviewed })} />
            <input className="min-h-11 rounded-md border px-3" value={audit.signalReviewStart} onChange={(e) => update({ ...audit, signalReviewStart: e.target.value })} placeholder="Review period from" />
            <input className="min-h-11 rounded-md border px-3" value={audit.signalReviewEnd} onChange={(e) => update({ ...audit, signalReviewEnd: e.target.value })} placeholder="Review period to" />
            <ReviewStatusControl label="Auto tests" value={audit.autoTestsStatus} onChange={(autoTestsStatus) => update({ ...audit, autoTestsStatus })} />
          </div>
        </section>
        <SignalLogSection rows={audit.signalLog} onChange={(signalLog) => update({ ...audit, signalLog })} />
        <section className="grid gap-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-navy">Documentation Reviewed</h2>
          <YesNoControl label="Documentation reviewed?" value={audit.documentationReviewed} onChange={(documentationReviewed) => update({ ...audit, documentationReviewed })} />
          <p className="text-sm text-slate-600">KEY: OK = In Conformance, VAR = Variations Noted, N/A = Not Applicable, N/R = Not Reviewed</p>
        </section>
        <DocumentationSection rows={audit.documentation} auditorName={auditorName} onChange={(documentation) => update({ ...audit, documentation })} />
        <section className="grid gap-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-navy">Installation Review Conditions</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <YesNoControl label="Installation reviewed?" value={audit.installationReviewed} onChange={(installationReviewed) => update({ ...audit, installationReviewed })} />
            <ReviewStatusControl label="Matches certificate declarations?" value={audit.matchesCertificateStatus} onChange={(matchesCertificateStatus) => update({ ...audit, matchesCertificateStatus, matchesCertificate: matchesCertificateStatus === "OK" })} />
            <DisplayStatusControl label="Certificate displayed?" value={audit.certificateDisplayedStatus} onChange={(certificateDisplayedStatus) => update({ ...audit, certificateDisplayedStatus, certificateDisplayed: certificateDisplayedStatus === "OK" })} />
          </div>
        </section>
        <InstallationSection rows={audit.installation} auditorName={auditorName} onChange={(installation) => update({ ...audit, installation })} />
        <DeviceTestSection rows={audit.deviceTests} onChange={(deviceTests) => update({ ...audit, deviceTests })} />
      </div>
    </main>
  );
}

function YesNoControl({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3" value={value ? "YES" : "NO"} onChange={(event) => onChange(event.target.value === "YES")}>
        <option value="NO">No</option>
        <option value="YES">Yes</option>
      </select>
    </label>
  );
}

function ReviewStatusControl({ label, value, onChange }: { label: string; value: ReviewStatus | ""; onChange: (value: ReviewStatus | "") => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3" value={value} onChange={(event) => onChange(event.target.value as ReviewStatus | "")}>
        <option value="">Not selected</option>
        <option value="OK">OK</option>
        <option value="VAR">VAR</option>
      </select>
    </label>
  );
}

function DisplayStatusControl({ label, value, onChange }: { label: string; value: DisplayStatus | ""; onChange: (value: DisplayStatus | "") => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3" value={value} onChange={(event) => onChange(event.target.value as DisplayStatus | "")}>
        <option value="">Not selected</option>
        <option value="OK">OK</option>
        <option value="VAR">VAR</option>
        <option value="NA">N/A</option>
      </select>
    </label>
  );
}
