import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck, Download, FilePenLine, FileText, MapPin, Share, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { assignmentCertificateOverrides, assignmentProfileDefaults, groupAssignmentsAndAudits, importTrackerAssignments, loadAuditAssignments, saveAuditAssignments, AssignmentGroup } from "../lib/audit-assignments";
import { clearAscDocuments, deleteAscDocuments, loadAscDocuments, updateAscDocumentDraft } from "../lib/asc-documents";
import type { AscDocumentState } from "../lib/asc-documents";
import { AscProfile, clearAscProfiles, completeAscProfile, deleteAscProfile, loadAscProfiles, saveAscProfiles } from "../lib/asc-profile";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { auditHasProgress, auditIdentity, certificateIdentity } from "../lib/audit-duplicates";
import { openAuditTracker } from "../lib/desktop-bridge";
import { exportHaudyBackup, importHaudyBackupFile } from "../lib/haudy-data-transfer";
import { canSaveDocumentsToFolder, chooseStorageRoot, hasStorageRoot, prepareStorageFolders, storageDetailsFromAudit } from "../lib/local-document-storage";
import { Audit, ParsedCertificate } from "../lib/types";
import { relativeTime } from "../lib/utils";
import { OFFLINE_READY_KEY } from "../register-service-worker";

interface DuplicateUploadReview {
  certificates: ParsedCertificate[];
  duplicates: Array<{ certificate: ParsedCertificate; audit: Audit }>;
  hasProgress: boolean;
  group?: AssignmentGroup;
}

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState(() => loadAuditAssignments());
  const groups = groupAssignmentsAndAudits(assignments, audits.audits);
  const desktopStorageAvailable = canSaveDocumentsToFolder();
  const [offlineReady, setOfflineReady] = useState(() => localStorage.getItem(OFFLINE_READY_KEY) === "true");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showInstallHelp, setShowInstallHelp] = useState(() => shouldShowIosInstallHelp());
  const [confirmationGroup, setConfirmationGroup] = useState<AssignmentGroup | null>(null);
  const [profileGroup, setProfileGroup] = useState<AssignmentGroup | null>(null);
  const [reportSentGroup, setReportSentGroup] = useState<AssignmentGroup | null>(null);
  const [ascProfiles, setAscProfiles] = useState(() => loadAscProfiles());
  const [ascDocuments, setAscDocuments] = useState(() => loadAscDocuments());
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUploadReview | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [deleteAscGroup, setDeleteAscGroup] = useState<AssignmentGroup | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<HomeJobStatus>("pool");
  const [focusAscKey, setFocusAscKey] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const jobCards = groups.map((group) => ({ group, status: homeJobStatus(group, ascDocuments[group.key]) }));
  const jobTabs = homeJobTabs(jobCards);
  const visibleJobCards = jobCards.filter((item) => item.status.id === activeJobTab);

  useEffect(() => {
    function refresh() {
      setOfflineReady(localStorage.getItem(OFFLINE_READY_KEY) === "true");
      setOnline(navigator.onLine);
    }
    function refreshDocuments() {
      setAscDocuments(loadAscDocuments());
    }
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("haudy:offline-ready", refresh);
    window.addEventListener("focus", refreshDocuments);
    window.addEventListener("appinstalled", () => setShowInstallHelp(false));
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("haudy:offline-ready", refresh);
      window.removeEventListener("focus", refreshDocuments);
    };
  }, []);

  useEffect(() => {
    hasStorageRoot().then(setStorageReady);
  }, []);

  useEffect(() => {
    if (audits.audits.length > 0 || assignments.length > 0) return;
    setAscProfiles(clearAscProfiles());
    setAscDocuments(clearAscDocuments());
  }, [audits.audits.length, assignments.length]);

  useEffect(() => {
    if (!groups.length) return;
    const active = jobTabs.find((tab) => tab.id === activeJobTab);
    if (active && active.count > 0) return;
    const next = jobTabs.find((tab) => tab.count > 0);
    if (next) setActiveJobTab(next.id);
  }, [activeJobTab, ascDocuments, assignments.length, audits.audits.length, groups.length]);

  useEffect(() => {
    const key = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!key || !groups.length) return;
    const card = jobCards.find((item) => item.group.key === key);
    if (!card) return;
    setFocusAscKey(key);
    setActiveJobTab(card.status.id);
  }, [ascDocuments, assignments.length, audits.audits.length, groups.length]);

  useEffect(() => {
    if (!focusAscKey) return;
    const element = document.getElementById(ascCardDomId(focusAscKey));
    if (!element) return;
    window.setTimeout(() => element.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  }, [activeJobTab, focusAscKey, visibleJobCards.length]);

  async function importTracker() {
    try {
      setTransferMessage("Reading audit tracker...");
      const rows = await openAuditTracker();
      if (!rows.length) {
        setTransferMessage("");
        return;
      }
      const result = importTrackerAssignments(rows, auditorName);
      setAssignments(result.assignments);
      const nextProfiles = { ...loadAscProfiles() };
      for (const group of groupAssignmentsAndAudits(result.assignments, audits.audits)) {
        const defaults = assignmentProfileDefaults(group);
        if (!defaults.psn && !defaults.scn) continue;
        nextProfiles[group.key] = {
          pocName: nextProfiles[group.key]?.pocName || "",
          scn: nextProfiles[group.key]?.scn || defaults.scn || "",
          psn: nextProfiles[group.key]?.psn || defaults.psn || "",
          updatedAt: nextProfiles[group.key]?.updatedAt || new Date().toISOString(),
        };
      }
      setAscProfiles(nextProfiles);
      saveAscProfiles(nextProfiles);
      setTransferMessage(`${result.imported} tracker row${result.imported === 1 ? "" : "s"} matched ${auditorName}.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : "Could not import the audit tracker.");
    }
  }

  async function addCertificatesToGroup(group: AssignmentGroup, certificates: ParsedCertificate[]) {
    const adjustedCertificates = certificates.map((certificate) => ({ ...certificate, ...assignmentCertificateOverrides(group) }));
    const existingByKey = new Map(audits.audits.map((audit) => [auditIdentity(audit), audit]));
    const duplicates = adjustedCertificates
      .map((item) => ({ certificate: item, audit: existingByKey.get(certificateIdentity(item)) }))
      .filter((item): item is { certificate: ParsedCertificate; audit: Audit } => Boolean(item.audit));
    if (duplicates.length) {
      const hasProgress = duplicates.some(({ audit }) => audit && auditHasProgress(audit));
      setDuplicateUpload({ certificates: adjustedCertificates, duplicates, hasProgress, group });
      return null;
    }
    const created = audits.createManyFromCertificatesWithOverrides(adjustedCertificates, assignmentCertificateOverrides(group));
    if (desktopStorageAvailable) {
      try {
        await prepareStorageFolders(created.map((audit) => storageDetailsFromAudit(audit, "Field Notes", "Field Notes")));
        setStorageReady(true);
        setStorageMessage("Haudy Database folders updated.");
      } catch (error) {
        setStorageMessage(error instanceof Error ? error.message : "Could not update Haudy Database folders.");
      }
    }
    return undefined;
  }

  function profileForGroup(group: AssignmentGroup): AscProfile | undefined {
    const defaults = assignmentProfileDefaults(group);
    const profile = ascProfiles[group.key];
    if (!profile && !defaults.scn && !defaults.psn) return undefined;
    return {
      pocName: profile?.pocName || "",
      scn: profile?.scn || defaults.scn || "",
      psn: profile?.psn || defaults.psn || "",
      updatedAt: profile?.updatedAt || "",
    };
  }

  function setClearanceResponseReceived(group: AssignmentGroup, received: boolean) {
    const existingReport = loadAscDocuments()[group.key]?.report;
    if (!existingReport) return;
    const next = updateAscDocumentDraft(group.key, "report", {
      ...existingReport,
      clearanceResponseReceived: received,
      clearanceResponseAt: received ? new Date().toISOString() : "",
    });
    setAscDocuments(next);
  }

  function markReportSent(group: AssignmentGroup, clearanceStartDate: string) {
    const existingReport = loadAscDocuments()[group.key]?.report;
    if (!existingReport) return;
    const next = updateAscDocumentDraft(group.key, "report", {
      ...existingReport,
      sentToClient: true,
      reportSentAt: new Date().toISOString(),
      clearanceStartDate,
      clearanceResponseReceived: false,
      clearanceResponseAt: "",
    });
    setAscDocuments(next);
    setReportSentGroup(null);
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {desktopStorageAvailable ? (
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
                onClick={importTracker}
              >
                <UploadCloud size={16} /> Import Audit Tracker
              </button>
            ) : null}
            {desktopStorageAvailable ? (
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await chooseStorageRoot();
                    setStorageReady(true);
                    setStorageMessage("Haudy Database location saved.");
                  } catch (error) {
                    setStorageMessage(error instanceof Error ? error.message : "Could not choose storage location.");
                  }
                }}
              >
                Choose Haudy Database
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={async () => {
                setTransferMessage("Preparing data file...");
                await exportHaudyBackup();
                setTransferMessage("Data file created without photos.");
              }}
            >
              <Download size={16} /> Export Data - No Photos
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={async () => {
                setTransferMessage("Preparing data file with photos...");
                await exportHaudyBackup({ includePhotos: true });
                setTransferMessage("Data file with compressed photos created.");
              }}
            >
              <Download size={16} /> Export Data - With Photos
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => importInputRef.current?.click()}
            >
              <UploadCloud size={16} /> Import
            </button>
            <input ref={importInputRef} className="hidden" type="file" accept=".json,.haudy-data.json,application/json" onChange={(event) => chooseHaudyImportFile(event, setPendingImportFile)} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusChip label="ASCs" value={groups.length} />
            <StatusChip label="Certificates" value={audits.audits.length} />
          </div>
        </div>
        {storageMessage || transferMessage ? (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
            {storageMessage ? <span>{storageMessage}</span> : null}
            {transferMessage ? <span>{transferMessage}</span> : null}
          </div>
        ) : null}
        {desktopStorageAvailable && !storageReady ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Choose a Haudy Database location once. Then import the audit tracker, and add certificate PDFs from the correct ASC card.
          </div>
        ) : null}
      </section>
      {showInstallHelp ? (
        <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-sky-800">
                <Share size={20} />
              </div>
              <div>
                <h2 className="font-bold text-navy">Install Haudy on this iPad</h2>
                <p className="mt-1">For best offline use, open Haudy in Safari, tap Share, choose Add to Home Screen, then open Haudy from the new Home Screen icon while online one time.</p>
                <p className="mt-1 font-semibold">{offlineReady ? "Offline files are ready on this device." : "Keep Haudy open online until the offline status says ready."}</p>
              </div>
            </div>
            <button type="button" className="rounded-md border border-sky-300 bg-white px-3 py-1.5 font-semibold text-sky-900 hover:bg-sky-100" onClick={() => setShowInstallHelp(false)}>Hide</button>
          </div>
        </section>
      ) : null}
      <section className="grid gap-4">
        {groups.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">Import the audit tracker to create ASC assignment cards.</div> : null}
        {groups.length ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            {jobTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${activeJobTab === tab.id ? "border-navy bg-white text-navy ring-2 ring-navy/15" : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                onClick={() => setActiveJobTab(tab.id)}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${activeJobTab === tab.id ? "bg-navy text-white" : "bg-white text-slate-600"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        {groups.length && visibleJobCards.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No ASC cards in this status.</div>
        ) : null}
        {visibleJobCards.map(({ group, status }) => {
          const trackerDefaults = assignmentProfileDefaults(group);
          const profile = ascProfiles[group.key] || { pocName: "", scn: trackerDefaults.scn || "", psn: trackerDefaults.psn || "", updatedAt: "" };
          const readyForDocuments = completeAscProfile(profile);
          const documents = ascDocuments[group.key];
          const confirmationSaved = documents?.confirmation?.saved;
          const reportSaved = documents?.report?.saved;
          const trackerFileSummary = group.assignments.map((assignment) => [assignment.ccn, assignment.fileNo].filter(Boolean).join(" ")).filter(Boolean).slice(0, 4).join(" | ");
          return (
          <section id={ascCardDomId(group.key)} key={group.key} className={`grid gap-3 rounded-lg border p-4 shadow-sm transition hover:shadow-md ${status.cardClassName}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-navy">{group.ascName}</h2>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin size={14} />
                    {group.location || "City and state not detected"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold text-navy">PSN:</span> {group.psn || profile.psn || "not detected"}
                    {trackerFileSummary ? <span className="ml-3 text-xs text-slate-500">{trackerFileSummary}{group.assignments.length > 4 ? " ..." : ""}</span> : null}
                  </p>
                  <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                    {status.label}
                    {status.detail ? <span className="ml-2 font-medium opacity-80">{status.detail}</span> : null}
                  </div>
                  {shouldShowClearanceToggle(group, documents) ? (
                    <label className="mt-3 flex w-fit items-center gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-emerald-600"
                        checked={Boolean(documents?.report?.clearanceResponseReceived)}
                        onChange={(event) => setClearanceResponseReceived(group, event.target.checked)}
                      />
                      Response to deficiencies received
                    </label>
                  ) : null}
                  {shouldShowReportSentToggle(documents) ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50"
                      onClick={() => setReportSentGroup(group)}
                    >
                      Report sent to customer
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                  {group.audits.length} certificate{group.audits.length === 1 ? "" : "s"} uploaded
                </span>
                <div className="min-w-[128px]">
                  <UploadDialog compact compactLabel="Add Certificate" onParsed={(certificates) => addCertificatesToGroup(group, certificates)} />
                </div>
                <ShieldCheck className="hidden text-emerald-600 sm:block" size={24} />
              </div>
            </div>
            {readyForDocuments ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold text-navy">POC:</span> {profile.pocName}
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-navy">SCN:</span> {profile.scn}
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-navy">PSN:</span> {profile.psn}
                  <div className="mt-1 text-xs text-slate-500">
                    Confirmation: {confirmationSaved ? `saved ${relativeTime(documents.confirmation?.updatedAt || "")}` : "not saved yet"}
                    <span className="mx-2 text-slate-300">|</span>
                    Report: {reportSaved ? `saved ${relativeTime(documents.report?.updatedAt || "")}` : "not saved yet"}
                    {documents?.report?.reportCreated ? <span className="ml-2 font-semibold text-sky-700">PDF created</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setProfileGroup(group)}>
                    <FilePenLine size={16} /> Edit Info
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/asc/${encodeURIComponent(group.key)}`)}>
                    <Building2 size={16} /> Field Notes
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => {
                    if (confirmationSaved && documents?.confirmation) {
                      const params = new URLSearchParams({
                        poc: profile.pocName,
                        scn: profile.scn,
                        psn: profile.psn,
                        start: documents.confirmation.startDate || "",
                        end: documents.confirmation.endDate || documents.confirmation.startDate || "",
                        time: documents.confirmation.startTime || "",
                        location: documents.confirmation.meetingLocation || "",
                        conversation: documents.confirmation.conversationDate || "",
                        letter: documents.confirmation.letterDate || "",
                      });
                      navigate(`/asc/${encodeURIComponent(group.key)}/confirmation?${params.toString()}`);
                      return;
                    }
                    setConfirmationGroup(group);
                  }}>
                    <CalendarCheck size={16} /> {confirmationSaved ? "View / Edit Confirmation" : "Create Confirmation"}
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => {
                    const params = new URLSearchParams({ poc: profile.pocName, scn: profile.scn, psn: profile.psn });
                    navigate(`/asc/${encodeURIComponent(group.key)}/report?${params.toString()}`);
                  }}>
                    <FileText size={16} /> {reportSaved ? "View / Edit Report" : "Create Report"}
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setDeleteAscGroup(group)}>
                    <Trash2 size={16} /> Delete ASC
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span>To create confirmation letter and report, add POC, SCN, and PSN.</span>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100" onClick={() => setProfileGroup(group)}>
                  <FilePenLine size={16} /> Add Info
                </button>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/asc/${encodeURIComponent(group.key)}`)}>
                  <Building2 size={16} /> Field Notes
                </button>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setDeleteAscGroup(group)}>
                  <Trash2 size={16} /> Delete ASC
                </button>
              </div>
            )}
          </section>
        );
        })}
      </section>
      {profileGroup ? (
        <AscProfileDialog
          group={profileGroup}
          profile={profileForGroup(profileGroup)}
          onClose={() => setProfileGroup(null)}
          onSave={(profile) => {
            const next = { ...ascProfiles, [profileGroup.key]: profile };
            setAscProfiles(next);
            saveAscProfiles(next);
            setProfileGroup(null);
          }}
        />
      ) : null}
      {confirmationGroup ? (
        <ConfirmationDialog
          group={confirmationGroup}
          profile={profileForGroup(confirmationGroup)}
          onClose={() => setConfirmationGroup(null)}
          onCreate={(details) => {
            const profile = ascProfiles[confirmationGroup.key];
            if (!profile) return;
            setAscDocuments(updateAscDocumentDraft(confirmationGroup.key, "confirmation", { pocName: profile.pocName, scn: profile.scn, psn: profile.psn, startDate: details.start, endDate: details.end, startTime: details.time, meetingLocation: details.location, conversationDate: details.conversation, letterDate: details.letter }));
            const params = new URLSearchParams({ ...details, poc: profile.pocName, scn: profile.scn, psn: profile.psn });
            navigate(`/asc/${encodeURIComponent(confirmationGroup.key)}/confirmation?${params.toString()}`);
          }}
        />
      ) : null}
      {reportSentGroup ? (
        <ReportSentDialog
          group={reportSentGroup}
          report={ascDocuments[reportSentGroup.key]?.report}
          onCancel={() => setReportSentGroup(null)}
          onConfirm={(date) => markReportSent(reportSentGroup, date)}
        />
      ) : null}
      {duplicateUpload ? (
        <DuplicateUploadDialog
          review={duplicateUpload}
          onCancel={() => setDuplicateUpload(null)}
          onReplace={() => {
            const created = audits.replaceManyFromCertificates(duplicateUpload.certificates);
            if (desktopStorageAvailable) {
              prepareStorageFolders(created.map((audit) => storageDetailsFromAudit(audit, "Field Notes", "Field Notes")))
                .then(() => {
                  setStorageReady(true);
                  setStorageMessage("Haudy Database folders updated.");
                })
                .catch((error) => setStorageMessage(error instanceof Error ? error.message : "Could not update Haudy Database folders."));
            }
            duplicateUpload.duplicates.forEach(({ audit }) => deleteAscDocuments(auditIdentityAscKey(audit)));
            setAscDocuments(loadAscDocuments());
            setDuplicateUpload(null);
          }}
        />
      ) : null}
      {pendingImportFile ? (
        <ImportDataDialog
          file={pendingImportFile}
          onCancel={() => setPendingImportFile(null)}
          onImport={async () => {
            try {
              const result = await importHaudyBackupFile(pendingImportFile);
              const photoNote = result.skippedPhotos ? ` ${result.skippedPhotos} photo item${result.skippedPhotos === 1 ? "" : "s"} could not fit on this device.` : "";
              setTransferMessage(`Imported ${result.imported} data item${result.imported === 1 ? "" : "s"}.${photoNote} Reloading Haudy...`);
              setPendingImportFile(null);
              window.setTimeout(() => window.location.reload(), 500);
            } catch (error) {
              setTransferMessage(error instanceof Error ? error.message : "Could not import this Haudy data file.");
              setPendingImportFile(null);
            }
          }}
        />
      ) : null}
      {deleteAscGroup ? (
        <DeleteAscDialog
          group={deleteAscGroup}
          onCancel={() => setDeleteAscGroup(null)}
          onDelete={() => {
            const auditIds = deleteAscGroup.audits.map((audit) => audit.id);
            audits.deleteAudits(auditIds);
            deleteAscDocuments(deleteAscGroup.key);
            deleteAscProfile(deleteAscGroup.key);
            const nextAssignments = assignments.filter((assignment) => [assignment.ascName || "ASC not set", assignment.ascCity || "", assignment.ascState || "", assignment.psn || ""].join("|") !== deleteAscGroup.key);
            setAssignments(nextAssignments);
            saveAuditAssignments(nextAssignments);
            setAscDocuments(loadAscDocuments());
            setAscProfiles(loadAscProfiles());
            setDeleteAscGroup(null);
          }}
        />
      ) : null}
    </main>
  );
}

function shouldShowIosInstallHelp() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const userAgent = navigator.userAgent || "";
  const isiPadOSDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isiOS = /iPad|iPhone|iPod/.test(userAgent) || isiPadOSDesktopMode;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
  return isiOS && !isStandalone;
}

function DeleteAscDialog({ group, onCancel, onDelete }: { group: AscGroup; onCancel: () => void; onDelete: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const ready = confirmation.trim().toUpperCase() === "DELETE";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4">
      <div className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-red-800">Delete ASC?</h2>
          <p className="mt-1 text-sm text-slate-600">{group.ascName}</p>
        </div>
        <div className="grid gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950">
          <p className="font-semibold">This will permanently remove this ASC from Haudy on this device.</p>
          <ul className="list-disc pl-5">
            <li>{group.audits.length} propert{group.audits.length === 1 ? "y" : "ies"} and certificate{group.audits.length === 1 ? "" : "s"}</li>
            <li>All field notes under this ASC</li>
            <li>Report draft and confirmation draft for this ASC</li>
            <li>Captured photos connected to these field notes</li>
            <li>Saved POC, SCN, and PSN information for this ASC</li>
          </ul>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Type DELETE to confirm
          <input
            className="min-h-11 rounded-md border border-slate-300 px-3 text-base"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoFocus
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready} onClick={onDelete}>
            <Trash2 size={16} /> Delete ASC
          </button>
        </div>
      </div>
    </div>
  );
}

function chooseHaudyImportFile(event: ChangeEvent<HTMLInputElement>, setPendingImportFile: (file: File | null) => void) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  setPendingImportFile(file);
}

function ImportDataDialog({ file, onCancel, onImport }: { file: File; onCancel: () => void; onImport: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <div className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-navy">Import Haudy Data?</h2>
          <p className="mt-1 text-sm text-slate-600">{file.name}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
          This will replace the current Haudy data on this device with the data from the selected file.
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100" onClick={onImport}>Import and Reload</button>
        </div>
      </div>
    </div>
  );
}

function ReportSentDialog({ group, report, onCancel, onConfirm }: { group: AssignmentGroup; report?: AscDocumentState["report"]; onCancel: () => void; onConfirm: (clearanceStartDate: string) => void }) {
  const [clearanceStartDate, setClearanceStartDate] = useState(report?.clearanceStartDate || report?.letterDate || todayInputValue());
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (clearanceStartDate) onConfirm(clearanceStartDate);
        }}
      >
        <div>
          <h2 className="text-xl font-bold text-navy">Report Sent to Customer?</h2>
          <p className="mt-1 text-sm text-slate-600">{group.ascName}</p>
        </div>
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          Confirm the date Haudy should use to count the customer clearance window. This does not change the date printed on the report PDF.
        </div>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Clearance counting date
          <input
            className="min-h-11 rounded-md border border-slate-300 px-3 text-base"
            type="date"
            value={clearanceStartDate}
            onChange={(event) => setClearanceStartDate(event.target.value)}
            autoFocus
          />
        </label>
        {report?.letterDate ? (
          <p className="text-xs text-slate-500">Report PDF date: {formatDisplayDate(report.letterDate)}</p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button type="submit" className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100" disabled={!clearanceStartDate}>
            Confirm Sent
          </button>
        </div>
      </form>
    </div>
  );
}

function DuplicateUploadDialog({ review, onCancel, onReplace }: { review: DuplicateUploadReview; onCancel: () => void; onReplace: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <div className="grid w-full max-w-xl gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-navy">Certificate Already Exists</h2>
          <p className="mt-1 text-sm text-slate-600">
            Haudy found {review.duplicates.length} uploaded certificate{review.duplicates.length === 1 ? "" : "s"} for propert{review.duplicates.length === 1 ? "y" : "ies"} already in this workspace.
          </p>
        </div>
        <div className={`rounded-md border p-3 text-sm font-medium ${review.hasProgress ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {review.hasProgress ? "Replacing will delete the existing field note and all audit notes for the listed properties." : "Replacing will reset the existing field note for the listed properties."}
        </div>
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
          {review.duplicates.map(({ certificate, audit }) => (
            <div key={audit.id} className="rounded-md bg-white p-3 text-sm shadow-sm">
              <div className="font-semibold text-navy">{certificate.propertyName || audit.protectedProperty || "Property name not set"}</div>
              <div className="mt-1 text-slate-600">Certificate: {certificate.certificateNumber || audit.certificateNumber || "not set"}</div>
              {auditHasProgress(audit) ? <div className="mt-1 text-xs font-semibold text-red-700">Existing audit notes will be lost.</div> : null}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Keep Existing</button>
          <button type="button" className="min-h-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100" onClick={onReplace}>Replace Certificate</button>
        </div>
      </div>
    </div>
  );
}

function AscProfileDialog({ group, profile, onClose, onSave }: { group: AscGroup; profile?: AscProfile; onClose: () => void; onSave: (profile: AscProfile) => void }) {
  const [pocName, setPocName] = useState(profile?.pocName || "");
  const [scn, setScn] = useState(profile?.scn || "");
  const [psn, setPsn] = useState(profile?.psn || "");
  const ready = pocName.trim() && scn.trim() && psn.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onSave({ pocName: pocName.trim(), scn: scn.trim(), psn: psn.trim(), updatedAt: new Date().toISOString() });
        }}
      >
        <div>
          <h2 className="text-xl font-bold text-navy">ASC Document Information</h2>
          <p className="mt-1 text-sm text-slate-600">{group.ascName} - saved for confirmation letters and reports</p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          POC name
          <input className="min-h-11 rounded-md border px-3" value={pocName} onChange={(event) => setPocName(event.target.value)} placeholder="Contact name" autoFocus />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            SCN number
            <input className="min-h-11 rounded-md border px-3" value={scn} onChange={(event) => setScn(event.target.value)} placeholder="Example: 1" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            PSN number
            <input className="min-h-11 rounded-md border px-3" value={psn} onChange={(event) => setPsn(event.target.value)} placeholder="Example: 634867" />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Cancel</button>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready}>
            <FilePenLine size={16} /> Save Info
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmationDialog({ group, profile, onClose, onCreate }: { group: AscGroup; profile?: AscProfile; onClose: () => void; onCreate: (details: Record<string, string>) => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [conversationDate, setConversationDate] = useState(todayInputValue());
  const [letterDate, setLetterDate] = useState(todayInputValue());
  const maxEndDate = maxAuditEndDate(startDate);
  const ready = startDate && endDate && conversationDate && letterDate && completeAscProfile(profile);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onCreate({ start: startDate, end: endDate, time: startTime, location: meetingLocation.trim(), conversation: conversationDate, letter: letterDate });
        }}
      >
        <div>
          <h2 className="text-xl font-bold text-navy">Audit Confirmation</h2>
          <p className="mt-1 text-sm text-slate-600">{group.ascName} - {group.audits.length} selected site{group.audits.length === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold text-navy">POC:</span> {profile?.pocName || ""}<span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold text-navy">SCN:</span> {profile?.scn || ""}<span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold text-navy">PSN:</span> {profile?.psn || ""}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit start date
            <input className="min-h-11 rounded-md border px-3" type="date" value={startDate} onChange={(event) => {
              const nextStartDate = event.target.value;
              const nextMaxEndDate = maxAuditEndDate(nextStartDate);
              setStartDate(nextStartDate);
              if (!endDate || endDate < nextStartDate || (nextMaxEndDate && endDate > nextMaxEndDate)) setEndDate(nextStartDate);
            }} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit end date
            <input className="min-h-11 rounded-md border px-3" type="date" value={endDate} min={startDate} max={maxEndDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit start time <span className="font-normal text-slate-500">(optional)</span>
            <input className="min-h-11 rounded-md border px-3" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit meeting location <span className="font-normal text-slate-500">(optional)</span>
            <input className="min-h-11 rounded-md border px-3" value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} placeholder="Main lobby, fire command center, or ASC office" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Schedule conversation date
            <input className="min-h-11 rounded-md border px-3" type="date" value={conversationDate} onChange={(event) => setConversationDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Letter date
            <input className="min-h-11 rounded-md border px-3" type="date" value={letterDate} onChange={(event) => setLetterDate(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Cancel</button>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready}>
            <CalendarCheck size={16} /> Create Letter
          </button>
        </div>
      </form>
    </div>
  );
}

function maxAuditEndDate(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 4);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayInputValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function AscPropertiesPage({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const { ascKey = "" } = useParams();
  const [deleteAudit, setDeleteAudit] = useState<Audit | null>(null);
  const assignments = loadAuditAssignments();
  const group = groupAssignmentsAndAudits(assignments, audits.audits).find((item) => item.key === decodeURIComponent(ascKey));

  if (!group) {
    return (
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
        <Link className="inline-flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-navy" to="/"><ArrowLeft size={16} /> Back to ASCs</Link>
        <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">ASC not found.</div>
      </main>
    );
  }

  const propertyCategories = groupPropertiesByCategory(group.audits);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      <Link className="inline-flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-navy" to={`/#${encodeURIComponent(group.key)}`}><ArrowLeft size={16} /> Back to ASCs</Link>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{group.ascName}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} />{group.location || "City and state not detected"}</p>
            <p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-navy">PSN:</span> {group.psn || "not detected"}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
            {group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>
      <section className="grid gap-5">
        {group.audits.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No certificate PDFs have been uploaded for this ASC yet.</div>
        ) : null}
        {propertyCategories.map(({ category, audits: categoryAudits }) => (
          <section key={category} className="grid gap-3">
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-lg font-bold text-navy">{category}</h2>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">{categoryAudits.length} propert{categoryAudits.length === 1 ? "y" : "ies"}</span>
            </div>
            {categoryAudits.map((audit) => (
              <article key={audit.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold text-navy">{audit.protectedProperty || "Property name not set"}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} />
                        {primaryCertificateAddress(audit) || "Property address not detected"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Updated {relativeTime(audit.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                      {audit.certificateNumber || "Certificate not set"}
                    </span>
                    <ShieldCheck className="hidden text-emerald-600 sm:block" size={24} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-navy">File:</span> {audit.fileScn || "not detected"}
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="font-semibold text-navy">Standard:</span> {audit.codeEdition || "not detected"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}`}><FilePenLine size={16} /> Edit</Link>
                    <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}/export`}><Download size={16} /> Export</Link>
                    <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setDeleteAudit(audit)}><Trash2 size={16} /> Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
      </section>
      {deleteAudit ? (
        <DeletePropertyDialog
          audit={deleteAudit}
          onCancel={() => setDeleteAudit(null)}
          onDelete={() => {
            const deletingLastPropertyForAsc = group.audits.length === 1 && group.assignments.length === 0;
            audits.deleteAudit(deleteAudit.id);
            if (deletingLastPropertyForAsc) {
              deleteAscDocuments(group.key);
              deleteAscProfile(group.key);
            }
            setDeleteAudit(null);
          }}
        />
      ) : null}
    </main>
  );
}

function DeletePropertyDialog({ audit, onCancel, onDelete }: { audit: Audit; onCancel: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <div className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-red-800">Delete Field Note?</h2>
          <p className="mt-1 text-sm text-slate-600">{audit.protectedProperty || "Selected property"}</p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950">
          <p className="font-semibold">Are you sure you want to delete this property field note?</p>
          <p className="mt-1">This will remove the certificate, field note entries, report wording for this property, and any captured photos connected to it from Haudy on this device.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700" onClick={onDelete}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function primaryCertificateAddress(audit: { primaryCertificateIndex: number; certificates: Array<{ propertyAddress?: string }> }) {
  return audit.certificates[audit.primaryCertificateIndex]?.propertyAddress || audit.certificates[0]?.propertyAddress || "";
}

function groupPropertiesByCategory(audits: Audit[]) {
  const groups = new Map<string, Audit[]>();
  for (const audit of audits) {
    const certificate = audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
    const category = certificate?.categoryCode?.trim().toUpperCase() || "Uncategorized";
    groups.set(category, [...(groups.get(category) || []), audit]);
  }
  return Array.from(groups, ([category, groupedAudits]) => ({ category, audits: groupedAudits }))
    .sort((first, second) => first.category.localeCompare(second.category));
}

function auditIdentityAscKey(audit: { ascName: string; ascCity: string; ascState: string }) {
  return [audit.ascName || "ASC not set", audit.ascCity || "", audit.ascState || ""].join("|");
}

function ascCardDomId(key: string) {
  return `asc-card-${key.replace(/[^a-z0-9_-]/gi, "-")}`;
}

type HomeJobStatus = "pool" | "scheduled" | "reportDue" | "reportCreated" | "clearance" | "done";

interface HomeJobStatusDetails {
  id: HomeJobStatus;
  label: string;
  detail: string;
  className: string;
  cardClassName: string;
}

function homeJobTabs(cards: Array<{ status: HomeJobStatusDetails }>) {
  const labels: Record<HomeJobStatus, string> = {
    pool: "Pool of Jobs",
    scheduled: "Scheduled",
    reportDue: "Report Due",
    reportCreated: "Report Created",
    clearance: "Waiting for Clearance",
    done: "Done",
  };
  const counts = cards.reduce<Record<HomeJobStatus, number>>((totals, card) => {
    totals[card.status.id] += 1;
    return totals;
  }, { pool: 0, scheduled: 0, reportDue: 0, reportCreated: 0, clearance: 0, done: 0 });
  return (Object.keys(labels) as HomeJobStatus[]).map((id) => ({ id, label: labels[id], count: counts[id] }));
}

function homeJobStatus(group: AssignmentGroup, documents?: AscDocumentState): HomeJobStatusDetails {
  const confirmation = documents?.confirmation;
  const report = documents?.report;
  const deficiencyCount = groupDeficiencyCount(group, documents);
  const today = startOfLocalDay(new Date());
  const auditStart = parseLocalDate(confirmation?.startDate);
  const auditEnd = parseLocalDate(confirmation?.endDate || confirmation?.startDate);
  const clearanceStartDate = parseLocalDate(report?.clearanceStartDate || report?.letterDate || report?.reportSentAt?.slice(0, 10) || "");

  if (report?.sentToClient && clearanceStartDate) {
    if (deficiencyCount === 0) {
      return {
        id: "done",
        label: "Audit done",
        detail: "Report sent, no clearance needed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        cardClassName: "border-emerald-200 bg-emerald-50/45",
      };
    }
    if (report.clearanceResponseReceived) {
      return {
        id: "done",
        label: "Deficiency response received",
        detail: report.clearanceResponseAt ? `Received ${relativeTime(report.clearanceResponseAt)}` : "Ready for closeout",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        cardClassName: "border-emerald-300 bg-emerald-50/70",
      };
    }
    const clearanceDeadline = addDays(clearanceStartDate, 30);
    const remaining = daysBetween(today, clearanceDeadline);
    if (remaining < 0) {
      return {
        id: "clearance",
        label: "Open late clearance project",
        detail: `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} past client response window`,
        className: "border-red-300 bg-red-50 text-red-800",
        cardClassName: "border-red-300 bg-red-50/70",
      };
    }
    const urgencyClass = remaining <= 5
      ? "border-orange-300 bg-orange-50/70"
      : remaining <= 10
        ? "border-amber-300 bg-amber-50/70"
        : "border-violet-200 bg-violet-50/45";
    return {
      id: "clearance",
      label: "Waiting for clearance",
      detail: remaining === 0 ? "Clearance due today" : `${remaining} day${remaining === 1 ? "" : "s"} left for client response`,
      className: remaining <= 5 ? "border-orange-300 bg-orange-50 text-orange-900" : remaining <= 10 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50 text-violet-800",
      cardClassName: urgencyClass,
    };
  }

  if (report?.reportCreated && !report?.sentToClient) {
    return {
      id: "reportCreated",
      label: "Report created",
      detail: "Mark report sent to customer",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      cardClassName: "border-sky-200 bg-sky-50/40",
    };
  }

  if (!auditStart || !auditEnd) {
    return {
      id: "pool",
      label: "Pool of jobs",
      detail: "Schedule audit date",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      cardClassName: "border-slate-200 bg-white hover:border-sky-300",
    };
  }

  if (today <= auditEnd) {
    const remaining = daysBetween(today, auditStart);
    return {
      id: "scheduled",
      label: "Scheduled",
      detail: remaining <= 0 ? "Audit in progress / today" : `${remaining} day${remaining === 1 ? "" : "s"} until audit`,
      className: "border-sky-200 bg-sky-50 text-sky-800",
      cardClassName: "border-sky-200 bg-sky-50/40",
    };
  }

  const reportDeadline = addDays(auditEnd, 14);
  const reportDaysRemaining = daysBetween(today, reportDeadline);
  return {
    id: "reportDue",
    label: reportDaysRemaining < 0 ? "Report overdue" : "Report due",
    detail: reportDaysRemaining < 0
      ? `${Math.abs(reportDaysRemaining)} day${Math.abs(reportDaysRemaining) === 1 ? "" : "s"} overdue`
      : reportDaysRemaining === 0
        ? "Report due today"
        : `${reportDaysRemaining} day${reportDaysRemaining === 1 ? "" : "s"} left to send report`,
    className: reportDaysRemaining < 0 ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900",
    cardClassName: reportDaysRemaining < 0 ? "border-red-300 bg-red-50/70" : reportDaysRemaining <= 3 ? "border-orange-300 bg-orange-50/60" : "border-amber-200 bg-amber-50/40",
  };
}

function shouldShowClearanceToggle(group: AssignmentGroup, documents?: AscDocumentState) {
  return Boolean(documents?.report?.sentToClient && groupDeficiencyCount(group, documents) > 0);
}

function shouldShowReportSentToggle(documents?: AscDocumentState) {
  return Boolean(documents?.report?.reportCreated && !documents.report.sentToClient);
}

function groupDeficiencyCount(group: AssignmentGroup, documents?: AscDocumentState) {
  const serviceCenterComments = documents?.report?.serviceCenterHasComment ? documents.report.serviceCenterComments || [] : [];
  const serviceCenterCount = serviceCenterComments.filter((comment) => comment.finding.trim() || comment.requiredAction.trim()).length;
  return serviceCenterCount + group.audits.reduce((total, audit) => total + auditDeficiencyCount(audit), 0);
}

function auditDeficiencyCount(audit: Audit) {
  let count = 0;
  if (!audit.signalProcessingReviewed) count += 1;
  if (!audit.documentationReviewed) count += 1;
  if (!audit.installationReviewed) count += 1;
  if (!audit.deviceTestingReviewed) count += 1;
  if (audit.matchesCertificateStatus === "VAR") count += 1;
  if (audit.certificateDisplayedStatus === "VAR") count += 1;
  count += audit.signalLog.filter((row) => row.handlingStatus === "VAR").length;
  count += audit.documentation.filter((row) => row.status === "VAR").length;
  count += audit.installation.filter((row) => row.status === "VAR").length;
  count += audit.deviceTests.filter((row) => row.result === "VAR").length;
  count += Object.values(audit.reportExtraFindings || {}).reduce((total, entries) => total + entries.filter((entry) => entry.finding.trim() || entry.requiredAction.trim()).length, 0);
  return count;
}

function parseLocalDate(value: string | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  const date = parseLocalDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.ceil((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86400000);
}

function StatusChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-700">
      <b className="text-navy">{value}</b>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
    </span>
  );
}
