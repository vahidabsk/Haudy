import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, RadioTower, Save, Wrench, Zap } from "lucide-react";
import { CertificateSummary } from "../components/CertificateSummary";
import { DeviceTestSection } from "../components/DeviceTestSection";
import { DocumentationSection } from "../components/DocumentationSection";
import { InstallationSection } from "../components/InstallationSection";
import { SignalLogSection } from "../components/SignalLogSection";
import { DictationNotes } from "../components/DictationNotes";
import { useAudits } from "../hooks/use-audits";
import { assignmentKeyForAudit } from "../lib/audit-assignments";
import { loadAscDocuments } from "../lib/asc-documents";
import { loadAscProfiles } from "../lib/asc-profile";
import { loadAudits, saveAudits } from "../lib/audit-storage";
import { auditProgram } from "../lib/audit-program";
import { Audit, DisplayStatus, ReviewStatus } from "../lib/types";
import { nowIso } from "../lib/utils";

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
  const savedAudit = store.audits.find((item) => item.id === auditId);
  const [draftAudit, setDraftAudit] = useState<Audit | undefined>(() => cloneAudit(savedAudit));
  const [activeTab, setActiveTab] = useState<AuditTab>("signal");
  const [pendingNavigation, setPendingNavigation] = useState("");
  const audit = draftAudit || savedAudit;
  const hasUnsavedChanges = Boolean(savedAudit && draftAudit && JSON.stringify(savedAudit) !== JSON.stringify(draftAudit));
  const ascKey = audit ? assignmentKeyForAudit(audit) : "";
  const confirmation = ascKey ? loadAscDocuments()[ascKey]?.confirmation : undefined;
  const ascProfile = ascKey ? loadAscProfiles()[ascKey] : undefined;
  const auditDateOptions = auditDateChoices(confirmation?.startDate, confirmation?.endDate);
  const auditDateOptionKey = auditDateOptions.map((option) => option.value).join("|");

  useEffect(() => {
    setDraftAudit(cloneAudit(savedAudit));
    setPendingNavigation("");
  }, [savedAudit?.id]);

  useEffect(() => {
    if (!draftAudit || !auditDateOptions.length) return;
    if (auditDateOptions.some((option) => option.value === draftAudit.auditDate)) return;
    setDraftAudit(cloneAudit({ ...draftAudit, auditDate: auditDateOptions[0].value, updatedAt: nowIso() }));
  }, [draftAudit?.id, draftAudit?.auditDate, auditDateOptionKey]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!draftAudit) return;
    if (auditProgram(draftAudit) === "mercantile" && activeTab === "signal") setActiveTab("documentation");
  }, [draftAudit?.id, draftAudit?.certificates, activeTab]);

  if (!audit) return <main className="p-6">Audit not found.</main>;

  function update(next: Audit) {
    setDraftAudit(cloneAudit({ ...next, updatedAt: nowIso() }));
  }

  const currentAudit = audit;
  const program = auditProgram(currentAudit);
  const visibleAuditTabs = program === "mercantile" ? auditTabs.filter((tab) => tab.id !== "signal") : auditTabs;
  const primary = currentAudit.certificates[currentAudit.primaryCertificateIndex];
  const signalRowsDisabled = audit.deviceSystemLocal || !audit.signalProcessingReviewed;
  const signalControlsDisabled = audit.deviceSystemLocal || !audit.signalProcessingReviewed;
  function commitAudit() {
    const saved = cloneAudit({ ...currentAudit, updatedAt: nowIso() })!;
    const allAudits = loadAudits();
    const nextAudits = allAudits.map((item) => (item.id === saved.id ? saved : item));
    saveAudits(nextAudits.some((item) => item.id === saved.id) ? nextAudits : [saved, ...allAudits]);
    store.setAudits(nextAudits.some((item) => item.id === saved.id) ? nextAudits : [saved, ...allAudits]);
    setDraftAudit(cloneAudit(saved));
    return saved;
  }
  function saveFieldNote() {
    commitAudit();
  }
  function requestNavigation(path: string) {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      return;
    }
    navigate(path);
  }
  function saveAndLeave() {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation("");
    commitAudit();
    navigate(destination);
  }
  function leaveWithoutSaving() {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation("");
    setDraftAudit(cloneAudit(savedAudit));
    navigate(destination);
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Field Notes</p>
          <h1 className="text-2xl font-bold text-navy">{[audit.ascName, audit.ascCity, audit.ascState].filter(Boolean).join(" - ") || "ASC not set"}</h1>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => requestNavigation(`/asc/${encodeURIComponent(ascKey)}`)}>
              <ArrowLeft size={16} /> Back to Properties
            </button>
            <label className="grid gap-1 text-sm font-semibold text-navy">
              Field audit date
              {auditDateOptions.length ? (
                <select className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800" value={audit.auditDate} onChange={(e) => update({ ...audit, auditDate: e.target.value })}>
                  {auditDateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800" type="date" value={audit.auditDate} onChange={(e) => update({ ...audit, auditDate: e.target.value })} />
              )}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasUnsavedChanges ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</span>
            <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100" onClick={saveFieldNote}><Save size={16} />Save Field Note</button>
          </div>
        </div>
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-5">
          <ReadonlyAuditInfo label="ASC" value={[audit.ascName, audit.ascCity, audit.ascState].filter(Boolean).join(" - ")} />
          <ReadonlyAuditInfo label="File / SCN" value={formatFileScn(audit, ascProfile?.scn)} />
          <ReadonlyAuditInfo label="NFPA edition" value={audit.codeEdition} />
          <ReadonlyAuditInfo label="Auditor" value={audit.auditorName} />
          <ReadonlyAuditInfo label="Certificate" value={audit.certificateNumber} />
        </div>
        <CertificateSummary certificate={primary} />
        <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
          {visibleAuditTabs.map(({ Icon, ...tab }) => (
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
      <section className="grid gap-4">
        {program === "fire" && activeTab === "signal" ? (
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
                {program === "fire" ? (
                  <>
                    <ReviewStatusControl label="Matches certificate declarations?" value={audit.installationReviewed ? audit.matchesCertificateStatus : ""} disabled={!audit.installationReviewed} onChange={(matchesCertificateStatus) => update({ ...audit, matchesCertificateStatus, matchesCertificate: matchesCertificateStatus === "OK" })} />
                    <DisplayStatusControl label="Certificate displayed?" value={audit.installationReviewed ? audit.certificateDisplayedStatus : ""} disabled={!audit.installationReviewed} onChange={(certificateDisplayedStatus) => update({ ...audit, certificateDisplayedStatus, certificateDisplayed: certificateDisplayedStatus === "OK" })} />
                  </>
                ) : null}
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
              <YesNoControl label="Were devices tested in the field?" value={audit.deviceTestingReviewed} defaultToYes onChange={(deviceTestingReviewed) => update({ ...audit, deviceTestingReviewed, editedFields: { ...audit.editedFields, deviceTestingReviewed: true } })} />
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
              localSystem={program === "fire" ? audit.deviceSystemLocal : false}
              program={program}
              lineSecurityKind={primary?.lineSecurity || ""}
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
      {pendingNavigation ? (
        <UnsavedChangesDialog
          onSave={saveAndLeave}
          onDiscard={leaveWithoutSaving}
          onCancel={() => setPendingNavigation("")}
        />
      ) : null}
    </main>
  );
}

function cloneAudit(audit?: Audit) {
  if (!audit) return undefined;
  return JSON.parse(JSON.stringify(audit)) as Audit;
}

function UnsavedChangesDialog({ onSave, onDiscard, onCancel }: { onSave: () => void; onDiscard: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <div className="grid w-full max-w-md gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-navy">Unsaved Changes</h2>
          <p className="mt-1 text-sm text-slate-600">Save your changes before leaving this page?</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button type="button" className="min-h-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100" onClick={onDiscard}>Discard Changes</button>
          <button type="button" className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function auditDateChoices(startDate?: string, endDate?: string) {
  const start = dateFromInput(startDate);
  if (!start) return [];
  const requestedEnd = dateFromInput(endDate) || start;
  const maxEnd = addDays(start, 4);
  const end = requestedEnd > maxEnd ? maxEnd : requestedEnd;
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const value = dateToInput(date);
    days.push({ value, label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) });
  }
  return days;
}

function formatFileScn(audit: Audit, profileScn?: string) {
  const certificate = audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
  const file = certificate?.fileNo || audit.fileScn.split("/")[0]?.trim() || "";
  const fallbackScn = audit.fileScn.split("/")[1]?.trim() || "";
  const scn = profileScn?.trim() || fallbackScn;
  return [file, scn ? `SCN ${scn.replace(/^SCN\s*/i, "")}` : ""].filter(Boolean).join(" / ");
}

function dateFromInput(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function dateToInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ReadonlyAuditInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="truncate font-medium text-slate-800">{value || "Not detected"}</div>
    </div>
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
