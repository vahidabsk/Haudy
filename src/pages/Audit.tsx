import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, FileText, RadioTower, Save, Wrench, Zap } from "lucide-react";
import { CertificateSummary } from "../components/CertificateSummary";
import { DeviceTestSection } from "../components/DeviceTestSection";
import { DocumentationSection } from "../components/DocumentationSection";
import { InstallationSection } from "../components/InstallationSection";
import { SignalLogSection } from "../components/SignalLogSection";
import { DictationNotes } from "../components/DictationNotes";
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
  const signalRowsDisabled = audit.deviceSystemLocal || !audit.signalProcessingReviewed;
  const signalControlsDisabled = audit.deviceSystemLocal || !audit.signalProcessingReviewed;
  const ascKey = [audit.ascName || "ASC not set", audit.ascCity || "", audit.ascState || ""].join("|");
  function saveAndReturn() {
    update(currentAudit);
    navigate("/");
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="sticky top-0 z-20 grid gap-3 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
        <Link className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/asc/${encodeURIComponent(ascKey)}`}>
          <ArrowLeft size={16} /> Back to Properties
        </Link>
        <div className="grid gap-3 md:grid-cols-8">
          <input className="min-h-11 rounded-md border px-3" type="date" value={audit.auditDate} onChange={(e) => update({ ...audit, auditDate: e.target.value })} />
          <input className="min-h-11 rounded-md border px-3" value={audit.ascName} onChange={(e) => update({ ...audit, ascName: e.target.value })} placeholder="ASC" />
          <input className="min-h-11 rounded-md border px-3" value={audit.ascCity} onChange={(e) => update({ ...audit, ascCity: e.target.value })} placeholder="ASC city" />
          <input className="min-h-11 rounded-md border px-3" value={audit.ascState} onChange={(e) => update({ ...audit, ascState: e.target.value.toUpperCase().slice(0, 2) })} placeholder="State" />
          <input className="min-h-11 rounded-md border px-3" value={audit.fileScn} onChange={(e) => update({ ...audit, fileScn: e.target.value })} placeholder="File / SCN" />
          <input className="min-h-11 rounded-md border px-3" list="code-edition-options" value={audit.codeEdition} onChange={(e) => update({ ...audit, codeEdition: e.target.value })} placeholder="NFPA edition" />
          <datalist id="code-edition-options">{codeEditionOptions.map((option) => <option key={option} value={option} />)}</datalist>
          <input className="min-h-11 rounded-md border bg-slate-100 px-3" value={audit.auditorName} readOnly />
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-800 hover:bg-red-100" onClick={saveAndReturn}><Save size={16} />Save</button>
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
        <h3 className="flex items-center gap-2 font-semibold text-navy"><ClipboardCheck size={18} className="text-emerald-600" />Certificate</h3>
        {audit.certificates.map((certificate, index) => (
          <label key={certificate.fileName} className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
            <input type="radio" checked={index === audit.primaryCertificateIndex} onChange={() => update({ ...audit, primaryCertificateIndex: index })} />
            <span>{certificate.certificateNumber || "Certificate number not detected"}</span>
          </label>
        ))}
      </section>
      <section className="grid gap-4">
        {activeTab === "signal" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Signal Processing Review</h2>
              <div className="grid gap-3 md:grid-cols-5">
                <YesNoControl
                  label="Is this system local?"
                  value={audit.deviceSystemLocal}
                  onChange={(deviceSystemLocal) =>
                    update({
                      ...audit,
                      deviceSystemLocal,
                      signalProcessingReviewed: deviceSystemLocal ? false : audit.signalProcessingReviewed,
                      signalReviewStart: deviceSystemLocal ? "" : audit.signalReviewStart,
                      signalReviewEnd: deviceSystemLocal ? "" : audit.signalReviewEnd,
                      autoTestsStatus: deviceSystemLocal ? "" : audit.autoTestsStatus,
                      signalLog: deviceSystemLocal ? audit.signalLog.map((row) => ({ ...row, signalType: "", handlingStatus: "", date: "", time: "", description: "", notes: "", updatedAt: nowIso() })) : audit.signalLog,
                      deviceTests: deviceSystemLocal ? audit.deviceTests.map((row) => ({ ...row, timeReceived: "", updatedAt: nowIso() })) : audit.deviceTests,
                    })
                  }
                />
                <YesNoControl label="Signal processing reviewed?" value={audit.signalProcessingReviewed} defaultToYes disabled={audit.deviceSystemLocal} onChange={(signalProcessingReviewed) => update({ ...audit, signalProcessingReviewed, editedFields: { ...audit.editedFields, signalProcessingReviewed: true } })} />
                <input className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" type="date" value={signalControlsDisabled ? "" : audit.signalReviewStart} disabled={signalControlsDisabled} onChange={(e) => update({ ...audit, signalReviewStart: e.target.value })} />
                <input className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" type="date" value={signalControlsDisabled ? "" : audit.signalReviewEnd} disabled={signalControlsDisabled} onChange={(e) => update({ ...audit, signalReviewEnd: e.target.value })} />
                <ReviewStatusControl label="Auto tests" value={signalControlsDisabled ? "" : audit.autoTestsStatus} disabled={signalControlsDisabled} onChange={(autoTestsStatus) => update({ ...audit, autoTestsStatus })} />
              </div>
              {!audit.deviceSystemLocal && !audit.signalProcessingReviewed ? (
                <SectionReviewNote
                  title="Signal processing review variation"
                  value={audit.signalReviewNotes}
                  onChange={(signalReviewNotes) => update({ ...audit, signalReviewNotes, editedFields: { ...audit.editedFields, signalProcessingReviewed: true } })}
                />
              ) : null}
            </section>
            <SignalLogSection rows={audit.signalLog} disabled={signalRowsDisabled} disabledMessage={audit.deviceSystemLocal ? "Local system selected. Signal processing review is not applicable." : "Signal processing review marked No. Use the general variation note above to explain why the signal history was not reviewed."} onChange={(signalLog) => update({ ...audit, signalLog })} />
          </div>
        ) : null}
        {activeTab === "documentation" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Documentation Reviewed</h2>
              <YesNoControl label="Documentation reviewed?" value={audit.documentationReviewed} defaultToYes onChange={(documentationReviewed) => update({ ...audit, documentationReviewed, editedFields: { ...audit.editedFields, documentationReviewed: true } })} />
              {!audit.documentationReviewed ? (
                <SectionReviewNote
                  title="Documentation review variation"
                  value={audit.documentationReviewNotes}
                  onChange={(documentationReviewNotes) => update({ ...audit, documentationReviewNotes, editedFields: { ...audit.editedFields, documentationReviewed: true } })}
                />
              ) : null}
            </section>
            <DocumentationSection rows={audit.documentation} auditorName={auditorName} disabled={!audit.documentationReviewed} onChange={(documentation) => update({ ...audit, documentation })} />
          </div>
        ) : null}
        {activeTab === "installation" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Installation Review Conditions</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <YesNoControl label="Installation reviewed?" value={audit.installationReviewed} defaultToYes onChange={(installationReviewed) => update({ ...audit, installationReviewed, editedFields: { ...audit.editedFields, installationReviewed: true } })} />
                <ReviewStatusControl label="Matches certificate declarations?" value={audit.installationReviewed ? audit.matchesCertificateStatus : ""} disabled={!audit.installationReviewed} onChange={(matchesCertificateStatus) => update({ ...audit, matchesCertificateStatus, matchesCertificate: matchesCertificateStatus === "OK" })} />
                <DisplayStatusControl label="Certificate displayed?" value={audit.installationReviewed ? audit.certificateDisplayedStatus : ""} disabled={!audit.installationReviewed} onChange={(certificateDisplayedStatus) => update({ ...audit, certificateDisplayedStatus, certificateDisplayed: certificateDisplayedStatus === "OK" })} />
              </div>
              {!audit.installationReviewed ? (
                <SectionReviewNote
                  title="Installation review variation"
                  value={audit.installationReviewNotes}
                  onChange={(installationReviewNotes) => update({ ...audit, installationReviewNotes, editedFields: { ...audit.editedFields, installationReviewed: true } })}
                />
              ) : null}
            </section>
            <InstallationSection rows={audit.installation} auditorName={auditorName} disabled={!audit.installationReviewed} onChange={(installation) => update({ ...audit, installation })} />
          </div>
        ) : null}
        {activeTab === "device" ? (
          <div className="grid gap-6">
            <section className="grid gap-3 rounded-lg border bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">Device Testing Review</h2>
              <YesNoControl label="Device testing reviewed?" value={audit.deviceTestingReviewed} defaultToYes onChange={(deviceTestingReviewed) => update({ ...audit, deviceTestingReviewed, editedFields: { ...audit.editedFields, deviceTestingReviewed: true } })} />
              {!audit.deviceTestingReviewed ? (
                <SectionReviewNote
                  title="Device testing review variation"
                  value={audit.deviceTestingNotes}
                  onChange={(deviceTestingNotes) => update({ ...audit, deviceTestingNotes, editedFields: { ...audit.editedFields, deviceTestingReviewed: true } })}
                />
              ) : null}
            </section>
            <DeviceTestSection
              rows={audit.deviceTests}
              localSystem={audit.deviceSystemLocal}
              disabled={!audit.deviceTestingReviewed}
              disabledMessage="Device testing review marked No. Use the general variation note above to explain why device testing was not completed."
              onLocalSystemChange={(deviceSystemLocal) =>
                update({
                  ...audit,
                  deviceSystemLocal,
                  deviceTests: deviceSystemLocal ? audit.deviceTests.map((row) => ({ ...row, timeReceived: "", updatedAt: nowIso() })) : audit.deviceTests,
                })
              }
              onChange={(deviceTests) => update({ ...audit, deviceTests })}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function YesNoControl({ label, value, defaultToYes, disabled, onChange }: { label: string; value?: boolean; defaultToYes?: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  const selectedValue = value === undefined ? Boolean(defaultToYes) : value;
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" value={selectedValue ? "YES" : "NO"} disabled={disabled} onChange={(event) => onChange(event.target.value === "YES")}>
        <option value="YES">Yes</option>
        <option value="NO">No</option>
      </select>
    </label>
  );
}

function SectionReviewNote({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-950">{title}</div>
      <p className="text-sm text-amber-900">Use this note to explain why the review was not completed.</p>
      <DictationNotes rows={3} value={value} onChange={onChange} />
    </div>
  );
}

function ReviewStatusControl({ label, value, disabled, onChange }: { label: string; value: ReviewStatus | ""; disabled?: boolean; onChange: (value: ReviewStatus | "") => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as ReviewStatus | "")}>
        <option value="">Not selected</option>
        <option value="OK">OK</option>
        <option value="VAR">VAR</option>
      </select>
    </label>
  );
}

function DisplayStatusControl({ label, value, disabled, onChange }: { label: string; value: DisplayStatus | ""; disabled?: boolean; onChange: (value: DisplayStatus | "") => void }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as DisplayStatus | "")}>
        <option value="">Not selected</option>
        <option value="OK">OK</option>
        <option value="VAR">VAR</option>
        <option value="NA">N/A</option>
      </select>
    </label>
  );
}
