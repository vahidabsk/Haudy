import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, FileText, RadioTower, Save, Wrench, Zap } from "lucide-react";
import { CertificateSummary } from "../components/CertificateSummary";
import { DeviceTestSection } from "../components/DeviceTestSection";
import { DocumentationSection } from "../components/DocumentationSection";
import { InstallationSection } from "../components/InstallationSection";
import { SignalLogSection } from "../components/SignalLogSection";
import { useAudits } from "../hooks/use-audits";
import { Audit, DisplayStatus, ReviewStatus } from "../lib/types";
import { nowIso } from "../lib/utils";

const codeEditionOptions = ["NFPA 72-2002", "NFPA 72-2007", "NFPA 72 2010 Edition", "NFPA 72-2013", "NFPA 72-2016", "NFPA 72-2019", "NFPA 72-2022"];
type AuditTab = "signal" | "documentation" | "installation" | "device";
const auditTabs: Array<{ id: AuditTab; label: string; Icon: typeof RadioTower }> = [
  { id: "signal", label: "Signal Processing", Icon: RadioTower },
  { id: "documentation", label: "Documentation", Icon: FileText },
  { id: "installation", label: "Installation", Icon: Wrench },
  { id: "device", label: "Device Test", Icon: Zap },
];

export function AuditPage({ auditorName }: { auditorName: string }) {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const store = useAudits(auditorName);
  const audit = store.audits.find((item) => item.id === auditId);
  const [activeTab, setActiveTab] = useState<AuditTab>("signal");
  if (!audit) return <main className="p-6">Audit not found.</main>;

  function update(next: Audit) {
    store.updateAudit({ ...next, updatedAt: nowIso() });
  }

  const currentAudit = audit;
  const primary = currentAudit.certificates[currentAudit.primaryCertificateIndex];
  function saveAndReturn() {
    update(currentAudit);
    navigate("/");
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="sticky top-0 z-20 grid gap-3 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-6">
          <input className="min-h-11 rounded-md border px-3" type="date" value={audit.auditDate} onChange={(e) => update({ ...audit, auditDate: e.target.value })} />
          <input className="min-h-11 rounded-md border px-3" value={audit.ascName} onChange={(e) => update({ ...audit, ascName: e.target.value })} placeholder="ASC" />
          <input className="min-h-11 rounded-md border px-3" value={audit.fileScn} onChange={(e) => update({ ...audit, fileScn: e.target.value })} placeholder="File / SCN" />
          <input className="min-h-11 rounded-md border px-3" list="code-edition-options" value={audit.codeEdition} onChange={(e) => update({ ...audit, codeEdition: e.target.value })} placeholder="NFPA edition" />
          <datalist id="code-edition-options">{codeEditionOptions.map((option) => <option key={option} value={option} />)}</datalist>
          <input className="min-h-11 rounded-md border bg-slate-100 px-3" value={audit.auditorName} readOnly />
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 py-2 text-center font-semibold text-white shadow-md shadow-red-900/20 hover:bg-red-700" onClick={saveAndReturn}><Save size={17} />Save</button>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
          {auditTabs.map(({ Icon, ...tab }) => (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold transition ${activeTab === tab.id ? "bg-navy text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          ))}
        </div>
      </section>
      <CertificateSummary certificate={primary} />
      <section className="grid gap-2 rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-navy"><ClipboardCheck size={18} className="text-emerald-600" />Certificates</h3>
        {audit.certificates.map((certificate, index) => (
          <label key={certificate.fileName} className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
            <input type="radio" checked={index === audit.primaryCertificateIndex} onChange={() => update({ ...audit, primaryCertificateIndex: index })} />
            <span>{certificate.fileName} — {certificate.certificateNumber || "No SN"}</span>
          </label>
        ))}
      </section>
      <section className="grid gap-4">
        {activeTab === "signal" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Signal Processing Review</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <YesNoControl label="Signal processing reviewed?" value={audit.signalProcessingReviewed} onChange={(signalProcessingReviewed) => update({ ...audit, signalProcessingReviewed })} />
                <input className="min-h-11 rounded-md border px-3" type="date" value={audit.signalReviewStart} onChange={(e) => update({ ...audit, signalReviewStart: e.target.value })} />
                <input className="min-h-11 rounded-md border px-3" type="date" value={audit.signalReviewEnd} onChange={(e) => update({ ...audit, signalReviewEnd: e.target.value })} />
                <ReviewStatusControl label="Auto tests" value={audit.autoTestsStatus} onChange={(autoTestsStatus) => update({ ...audit, autoTestsStatus })} />
              </div>
            </section>
            <SignalLogSection rows={audit.signalLog} onChange={(signalLog) => update({ ...audit, signalLog })} />
          </div>
        ) : null}
        {activeTab === "documentation" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Documentation Reviewed</h2>
              <YesNoControl label="Documentation reviewed?" value={audit.documentationReviewed} onChange={(documentationReviewed) => update({ ...audit, documentationReviewed })} />
            </section>
            <DocumentationSection rows={audit.documentation} auditorName={auditorName} onChange={(documentation) => update({ ...audit, documentation })} />
          </div>
        ) : null}
        {activeTab === "installation" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Installation Review Conditions</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <YesNoControl label="Installation reviewed?" value={audit.installationReviewed} onChange={(installationReviewed) => update({ ...audit, installationReviewed })} />
                <ReviewStatusControl label="Matches certificate declarations?" value={audit.matchesCertificateStatus} onChange={(matchesCertificateStatus) => update({ ...audit, matchesCertificateStatus, matchesCertificate: matchesCertificateStatus === "OK" })} />
                <DisplayStatusControl label="Certificate displayed?" value={audit.certificateDisplayedStatus} onChange={(certificateDisplayedStatus) => update({ ...audit, certificateDisplayedStatus, certificateDisplayed: certificateDisplayedStatus === "OK" })} />
              </div>
            </section>
            <InstallationSection rows={audit.installation} auditorName={auditorName} onChange={(installation) => update({ ...audit, installation })} />
          </div>
        ) : null}
        {activeTab === "device" ? (
          <DeviceTestSection
            rows={audit.deviceTests}
            localSystem={audit.deviceSystemLocal}
            onLocalSystemChange={(deviceSystemLocal) =>
              update({
                ...audit,
                deviceSystemLocal,
                deviceTests: deviceSystemLocal ? audit.deviceTests.map((row) => ({ ...row, timeReceived: "", updatedAt: nowIso() })) : audit.deviceTests,
              })
            }
            onChange={(deviceTests) => update({ ...audit, deviceTests })}
          />
        ) : null}
      </section>
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
