import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { groupAssignmentsAndAudits, loadAuditAssignments } from "../lib/audit-assignments";
import { loadAscDocuments, saveAscDocument, ServiceCenterComment } from "../lib/asc-documents";
import { loadAscProfiles } from "../lib/asc-profile";
import { loadAudits, saveAudits } from "../lib/audit-storage";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { canSaveDocumentsToFolder, saveCurrentDocumentSnapshot, storageDetailsFromAsc, storageFoldersForDetails } from "../lib/local-document-storage";
import { canSavePdfDirectly, savePrintablePagesAsPdfWithResult } from "../lib/pdf-saver";
import { loadPhoto } from "../lib/photo-store";
import { isReferenceComplete, printableReferenceValue, UNUSED_REFERENCE_VALUE } from "../lib/report-reference";
import { Audit, AuditRow, Auditor, DeviceTestRow, ParsedCertificate, ReportFindingEntry, SignalLogRow } from "../lib/types";
import { ReportFindingFields, ReportFindingValue } from "../components/ReportFindingFields";
import { isProtectedAreaAudit } from "../lib/audit-program";
import { FIELD_NOTE_READY_PERCENT, groupFieldNoteProgress } from "../lib/field-note-progress";
import { addReportFindingsToPastReports, AuditorReportFinding } from "../lib/auditor-report-findings";
import { AuditEmailDialog } from "../components/AuditEmailDialog";

type ReportReview = "Signal Processing Review" | "Documentation Review" | "Installation Review";
type ReportSource = "signalLog" | "documentation" | "installation" | "deviceTests" | "sectionReview";
type ReportEditorSection = "service" | "signal" | "documentation" | "installation";
type ReportPropertySection = Exclude<ReportEditorSection, "service">;

interface ReportItem {
  id: string;
  baseId: string;
  extraIndex?: number;
  source: ReportSource;
  rowId: string;
  reviewType: ReportReview;
  category: string;
  note: string;
  finding: string;
  requiredAction: string;
  codeStandard: string;
  codeEdition: string;
  codeSection: string;
  simpleExplanation?: boolean;
}

interface ReportPhotoItem {
  id: string;
  photoId: string;
  dataUrl: string;
  deficiencyNumber: number;
  propertyName: string;
  reviewType: ReportReview;
  category: string;
}

export function ReportPage({ auditor }: { auditor: Auditor | null }) {
  const { ascKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const reportKind = searchParams.get("kind") === "crzh" ? "crzh" : "standard";
  const auditorName = auditor?.name || "";
  const store = useAudits(auditorName);
  const assignmentGroups = groupAssignmentsAndAudits(loadAuditAssignments(), store.audits);
  const group = assignmentGroups.find((item) => item.key === decodeURIComponent(ascKey)) || groupByAsc(store.audits).find((item) => item.key === decodeURIComponent(ascKey));
  if (!group) return <main className="p-6">ASC not found.</main>;
  const reportAudits = group.audits.filter((audit) => reportKind === "crzh" ? isProtectedAreaAudit(audit) : !isProtectedAreaAudit(audit));
  const filteredGroup = { ...group, audits: reportAudits };
  const reportDocumentKey = reportKind === "crzh" ? "crzhReport" : "report";
  const existingReport = loadAscDocuments()[decodeURIComponent(ascKey)]?.[reportDocumentKey];
  const readiness = groupFieldNoteProgress(reportAudits);

  if (!existingReport?.saved && !readiness.readyForReport) {
    return (
      <main className="mx-auto grid max-w-3xl gap-5 px-4 py-6">
        <section className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Field Notes Required</p>
            <h1 className="mt-1 text-2xl font-bold text-navy">Report not ready yet</h1>
            <p className="mt-2 text-slate-700">Each visited property must reach {FIELD_NOTE_READY_PERCENT}% field-note completion before a new report can be created. Properties marked Not Visited are excluded.</p>
          </div>
          <button type="button" className="inline-flex w-fit min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => window.history.back()}>
            <ArrowLeft size={16} /> Back to ASC
          </button>
        </section>
      </main>
    );
  }

  return (
    <ReportDocument
      group={filteredGroup}
      ascKey={decodeURIComponent(ascKey)}
      auditor={auditor}
      pocName={searchParams.get("poc") || ""}
      scn={searchParams.get("scn") || ""}
      psn={searchParams.get("psn") || ""}
      reportKind={reportKind}
    />
  );
}

function ReportDocument({ group, ascKey, auditor, pocName, scn, psn, reportKind }: { group: AscGroup; ascKey: string; auditor: Auditor | null; pocName: string; scn: string; psn: string; reportKind: "standard" | "crzh" }) {
  const navigate = useNavigate();
  const [savedAt, setSavedAt] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const reportDocumentKey = reportKind === "crzh" ? "crzhReport" : "report";
  const savedReportDraft = loadAscDocuments()[ascKey]?.[reportDocumentKey];
  const [draftAudits, setDraftAudits] = useState<Audit[]>(() => cloneAudits(group.audits));
  const [serviceCenterHasComment, setServiceCenterHasComment] = useState(savedReportDraft?.serviceCenterHasComment ?? false);
  const [serviceCenterDone, setServiceCenterDone] = useState(savedReportDraft?.serviceCenterDone ?? false);
  const [serviceCenterMinimized, setServiceCenterMinimized] = useState(false);
  const [serviceCenterComments, setServiceCenterComments] = useState<ServiceCenterComment[]>(() => serviceCenterCommentsFromDraft(savedReportDraft));
  const [reportLetterDate, setReportLetterDate] = useState(savedReportDraft?.letterDate || todayInputValue());
  const [lateResponseProjectAmount, setLateResponseProjectAmount] = useState(savedReportDraft?.lateResponseProjectAmount || "1436");
  const [savedSnapshot, setSavedSnapshot] = useState(() => reportSnapshot({ audits: group.audits, letterDate: savedReportDraft?.letterDate || todayInputValue(), lateResponseProjectAmount: savedReportDraft?.lateResponseProjectAmount || "1436", serviceCenterHasComment: savedReportDraft?.serviceCenterHasComment ?? false, serviceCenterDone: savedReportDraft?.serviceCenterDone ?? false, serviceCenterComments: serviceCenterCommentsFromDraft(savedReportDraft) }));
  const [pendingNavigation, setPendingNavigation] = useState("");
  const [showReportEmail, setShowReportEmail] = useState(false);
  const [showCompletionRequired, setShowCompletionRequired] = useState(false);
  const reportGroup = useMemo(() => ({ ...group, audits: draftAudits }), [group, draftAudits]);
  const reportAudits = useMemo(() => reportAuditsByCategory(draftAudits), [draftAudits]);
  const [activeAuditId, setActiveAuditId] = useState(reportAudits[0]?.id || "");
  const [activeReportSection, setActiveReportSection] = useState<ReportEditorSection>("signal");
  const reportItems = useMemo(() => draftAudits.flatMap((audit) => collectReportItems(audit).map((item) => ({ audit, item }))), [draftAudits]);
  const incomplete = reportItems.filter(({ item }) => reportItemNeedsAttention(item));
  const serviceCenterIncomplete = serviceCenterHasComment && serviceCenterComments.some(serviceCenterCommentNeedsAttention);
  const completion = useMemo(() => reportCompletionStatus(draftAudits, serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete), [draftAudits, serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete]);
  const reportDate = dateFromInput(reportLetterDate);
  const fileReferences = referenceFiles(group.audits);
  const reportName = reportFileName(group, reportDate, fileReferences, scn, reportKind);
  const activeAudit = reportAudits.find((audit) => audit.id === activeAuditId) || reportAudits[0];
  const activeItems = activeAudit ? reportItems.filter(({ audit }) => audit.id === activeAudit.id) : [];
  const activeSignalItems = activeItems.filter(({ item }) => item.reviewType === "Signal Processing Review");
  const activeDocumentationItems = activeItems.filter(({ item }) => item.reviewType === "Documentation Review");
  const activeInstallationItems = activeItems.filter(({ item }) => item.reviewType === "Installation Review");
  const currentSnapshot = reportSnapshot({ audits: draftAudits, letterDate: reportLetterDate, lateResponseProjectAmount, serviceCenterHasComment, serviceCenterDone, serviceCenterComments });
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot;
  const reportForEmail = loadAscDocuments()[ascKey]?.[reportDocumentKey];
  const emailProfile = loadAscProfiles()[ascKey];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [ascKey, reportKind]);

  useEffect(() => {
    if (reportAudits.length && !reportAudits.some((audit) => audit.id === activeAuditId)) setActiveAuditId(reportAudits[0].id);
  }, [activeAuditId, reportAudits]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = reportName;
    return () => {
      document.title = previousTitle;
    };
  }, [reportName]);

  function updateDraftAudit(nextAudit: Audit) {
    setDraftAudits((current) => current.map((audit) => (audit.id === nextAudit.id ? cloneAudit(nextAudit) : audit)));
  }

  async function saveReport() {
    if (!completion.ready) {
      setShowCompletionRequired(true);
      return false;
    }
    const allAudits = loadAudits();
    const draftById = new Map(draftAudits.map((audit) => [audit.id, audit]));
    const nextAudits = allAudits.map((audit) => draftById.get(audit.id) || audit);
    saveAudits(nextAudits);
    const next = saveAscDocument(ascKey, reportDocumentKey, { pocName, scn, psn, letterDate: reportLetterDate, lateResponseProjectAmount, serviceCenterHasComment, serviceCenterDone, serviceCenterComments });
    setSavedAt(next[ascKey]?.[reportDocumentKey]?.updatedAt || "");
    setSavedSnapshot(currentSnapshot);
    if (canSaveDocumentsToFolder()) {
      try {
        const ascAddress = draftAudits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
        await saveCurrentDocumentSnapshot(storageDetailsFromAsc({ year: reportDate.getFullYear().toString(), ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Report", fileName: reportName }));
        setFolderMessage("Saved to Haudy Database.");
      } catch (error) {
        setFolderMessage(error instanceof Error ? error.message : "Could not save to folder.");
      }
    }
    return true;
  }

  function markReportCreated(reportPdfPath = "") {
    const next = saveAscDocument(ascKey, reportDocumentKey, {
      pocName,
      scn,
      psn,
      letterDate: reportLetterDate,
      lateResponseProjectAmount,
      serviceCenterHasComment,
      serviceCenterDone,
      serviceCenterComments,
      reportCreated: true,
      reportCreatedAt: new Date().toISOString(),
      reportPdfPath: reportPdfPath || savedReportDraft?.reportPdfPath,
      sentToClient: savedReportDraft?.sentToClient,
      reportSentAt: savedReportDraft?.reportSentAt,
      clearanceStartDate: savedReportDraft?.clearanceStartDate,
      clearanceResponseReceived: savedReportDraft?.clearanceResponseReceived,
      clearanceResponseAt: savedReportDraft?.clearanceResponseAt,
    });
    setSavedAt(next[ascKey]?.[reportDocumentKey]?.updatedAt || "");
    setSavedSnapshot(currentSnapshot);
    const added = addReportFindingsToPastReports(pastReportRowsFromCompletedReport(draftAudits, serviceCenterHasComment ? serviceCenterComments : [], reportName));
    if (added) setFolderMessage(`${added} completed report item${added === 1 ? "" : "s"} added to Past Reports.`);
  }

  function requestNavigation(path: string) {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      return;
    }
    navigate(path);
  }

  async function saveAndNavigate() {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation("");
    const saved = await saveReport();
    if (saved) navigate(destination);
  }

  function discardAndNavigate() {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation("");
    navigate(destination);
  }

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 grid gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => requestNavigation(`/?asc=${encodeURIComponent(group.key)}`)}>
              <ArrowLeft size={16} /> Back to ASCs
            </button>
            <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => requestNavigation(`/asc/${encodeURIComponent(group.key)}`)}>
              Back to Properties
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1 text-xs font-semibold ${hasUnsavedChanges ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</span>
            <button
              type="button"
              className="min-h-10 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
              onClick={async () => {
                if (!completion.ready) {
                  setShowCompletionRequired(true);
                  return;
                }
                if (!canSavePdfDirectly()) {
                  window.print();
                  return;
                }
                try {
                  const saved = await saveReport();
                  if (!saved) return;
                  const ascAddress = draftAudits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
                  const result = await savePrintablePagesAsPdfWithResult(reportName, storageFoldersForDetails(storageDetailsFromAsc({ year: reportDate.getFullYear().toString(), ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Report", fileName: reportName })));
                  setFolderMessage(result.message);
                  if (result.message !== "PDF save canceled.") markReportCreated(result.path);
                } catch (error) {
                  setFolderMessage(error instanceof Error ? error.message : "Could not save PDF.");
                }
              }}
            >
              {canSavePdfDirectly() ? "Save as PDF" : "Print PDF"}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              onClick={saveReport}
            >
              Save Report Draft
            </button>
            <button
              type="button"
              disabled={!completion.ready || !reportForEmail?.reportCreated}
              title={!completion.ready ? "Complete every report section before preparing the report email." : !reportForEmail?.reportCreated ? "Save the completed report as a PDF before preparing the report email." : "Prepare the report email."}
              className="min-h-10 rounded-md border border-navy bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
              onClick={() => setShowReportEmail(true)}
            >
              Report Email
            </button>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy">Report Content Review</h2>
          <p className="mt-1 text-sm text-slate-600">
            {reportKind === "crzh" ? "CRZH report only. " : ""}
            {reportItems.length} deficienc{reportItems.length === 1 ? "y" : "ies"} noted from completed field notes. Complete the report language before printing.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-navy">POC:</span> {pocName || ""}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-semibold text-navy">SCN:</span> {scn || ""}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-semibold text-navy">PSN:</span> {psn || ""}
              {savedAt ? <div className="mt-1 text-xs text-emerald-700">Saved.</div> : null}
              {folderMessage ? <div className="mt-1 text-xs text-slate-600">{folderMessage}</div> : null}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Report date
              <input
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3"
                type="date"
                value={reportLetterDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setReportLetterDate(nextDate);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Opening project amount
              <span className="flex min-h-10 items-center rounded-md border border-slate-300 bg-white pl-3">
                <span className="text-slate-500">$</span>
                <input
                  className="min-h-10 w-24 rounded-md bg-transparent px-2 outline-none"
                  inputMode="decimal"
                  value={lateResponseProjectAmount}
                  onChange={(event) => setLateResponseProjectAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  aria-label="Opening project amount"
                />
              </span>
            </label>
          </div>
        </div>
        <div className="grid gap-4">
          <div className={`grid gap-3 rounded-lg border-2 p-3 shadow-sm ${serviceCenterTabStatus(serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete) === "needs" ? "border-amber-200 bg-amber-50" : serviceCenterTabStatus(serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete) === "done" ? "border-emerald-200 bg-emerald-50" : "border-sky-100 bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/70 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">ASC Level</div>
                <div className="text-base font-bold text-navy">Service Center Comments</div>
                <div className="text-xs font-medium text-slate-600">{group.ascName}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${reportSectionTabTextClass(serviceCenterTabStatus(serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete))}`}>{reportSectionTabLabel(serviceCenterTabStatus(serviceCenterHasComment, serviceCenterDone, serviceCenterIncomplete))}</div>
                {(serviceCenterHasComment || serviceCenterComments.some((comment) => comment.finding || comment.requiredAction || comment.codeSection)) ? (
                  <button
                    type="button"
                    className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setServiceCenterMinimized(!serviceCenterMinimized)}
                  >
                    {serviceCenterMinimized ? "Edit Comments" : "Minimize"}
                  </button>
                ) : null}
              </div>
            </div>
            {serviceCenterMinimized ? (
              <div className="rounded-md border border-white/70 bg-white/60 p-3 text-sm font-medium text-slate-700">
                {serviceCenterHasComment ? `${serviceCenterComments.length} service center comment${serviceCenterComments.length === 1 ? "" : "s"} hidden.` : "No service center comments will print."}
              </div>
            ) : (
              <ServiceCenterReportEditor
                hasComment={serviceCenterHasComment}
                done={serviceCenterDone}
                comments={serviceCenterComments}
                incomplete={serviceCenterIncomplete}
                onHasCommentChange={(nextHasComment) => {
                  setServiceCenterHasComment(nextHasComment);
                  const nextComments = nextHasComment && !serviceCenterComments.length ? [blankServiceCenterComment()] : serviceCenterComments;
                  if (nextComments !== serviceCenterComments) setServiceCenterComments(nextComments);
                }}
                onDoneChange={(nextDone) => {
                  setServiceCenterDone(nextDone);
                }}
                onUpdateComments={updateServiceCenterComments}
                onUpdateComment={updateServiceCenterComment}
              />
            )}
          </div>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Step 1</div>
                <div className="text-sm font-bold text-navy">Choose Property</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{reportAudits.length} propert{reportAudits.length === 1 ? "y" : "ies"}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
            {reportAudits.map((audit) => {
              const stats = reportPropertyStats(audit);
              const selected = activeAudit?.id === audit.id;
              return (
                <button
                  key={audit.id}
                  type="button"
                  className={`min-h-24 rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${stats.needsAttention ? "border-amber-200 bg-amber-50 text-slate-800 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-slate-800 hover:bg-emerald-100"} ${selected ? "border-l-4 border-navy shadow-sm ring-2 ring-navy/25" : ""}`}
                  onClick={() => setActiveAuditId(audit.id)}
                >
                  <span className="block max-w-[18rem] truncate">{audit.protectedProperty || "Property"}</span>
                  <span className="block text-xs text-slate-500">{primaryCertificate(audit)?.categoryCode || "CCN"} | {audit.certificateNumber || "SN"}</span>
                  <span className="mt-2 grid grid-cols-2 gap-1 text-center text-xs">
                    <span className="rounded bg-white px-2 py-1 text-slate-700"><b>{stats.total}</b><br />deficiencies noted</span>
                    <span className={`rounded px-2 py-1 ${stats.missing ? "bg-red-50 text-red-700" : "bg-white text-emerald-700"}`}><b>{stats.missing}</b><br />need attention</span>
                  </span>
                </button>
              );
            })}
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border-2 border-sky-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700">Step 2</div>
                <div className="text-base font-bold text-navy">{activeAudit ? `Edit: ${activeAudit.protectedProperty || "Selected Property"}` : "Edit Selected Property"}</div>
                {activeAudit ? <div className="text-xs font-medium text-slate-500">{primaryCertificate(activeAudit)?.categoryCode || "CCN"} | {activeAudit.certificateNumber || "SN"}</div> : null}
              </div>
              <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">Sections below apply to this workspace</div>
            </div>
            <div className="flex gap-2 overflow-x-auto rounded-md bg-sky-50 p-2">
              {[
                { id: "signal" as const, label: "Signal Processing", count: activeSignalItems.length, status: sectionTabStatus(activeAudit, "signal", activeSignalItems.map(({ item }) => item)) },
                { id: "documentation" as const, label: "Documentation", count: activeDocumentationItems.length, status: sectionTabStatus(activeAudit, "documentation", activeDocumentationItems.map(({ item }) => item)) },
                { id: "installation" as const, label: "Installation", count: activeInstallationItems.length, status: sectionTabStatus(activeAudit, "installation", activeInstallationItems.map(({ item }) => item)) },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`min-h-12 shrink-0 rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${reportSectionTabClass(tab.status)} ${activeReportSection === tab.id ? "border-l-4 border-navy shadow-sm ring-2 ring-navy/25" : ""}`}
                  onClick={() => setActiveReportSection(tab.id)}
                >
                  <span>{tab.label} <span className="ml-1 text-xs opacity-70">({tab.count})</span></span>
                  <span className={`block text-xs ${reportSectionTabTextClass(tab.status)}`}>{reportSectionTabLabel(tab.status)}</span>
                </button>
            ))}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              {activeAudit ? (
                <ReportEditorSectionPanel
                  audit={activeAudit}
                  section={activeReportSection as ReportPropertySection}
                  items={activeReportSection === "signal" ? activeSignalItems : activeReportSection === "documentation" ? activeDocumentationItems : activeInstallationItems}
                  emptyText={activeReportSection === "signal" ? "No signal processing variations for this property." : activeReportSection === "documentation" ? "No documentation variations for this property." : "No installation or device test variations for this property."}
                  onUpdateAudit={updateDraftAudit}
                />
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No properties found for this ASC.</div>
              )}
            </div>
          </div>
          {reportItems.length ? (
            incomplete.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{incomplete.length} variation{incomplete.length === 1 ? "" : "s"} will print with blank report fields until completed.</div> : null
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No variations found for this ASC.</div>
          )}
        </div>
      </div>

      <ReportLetterPage group={reportGroup} pocName={pocName} date={reportDate} files={fileReferences} scn={scn} psn={psn} />
      <LateResponsePage auditor={auditor} projectAmount={lateResponseProjectAmount} />
      <AuditCommentsPage group={reportGroup} serviceCenterHasComment={serviceCenterHasComment} serviceCenterComments={serviceCenterComments} />
      {showReportEmail && reportForEmail ? (
        <AuditEmailDialog
          type="report"
          group={{ ...group, address: draftAudits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || group.location }}
          profile={emailProfile}
          report={reportForEmail}
          reportDocumentKey={reportDocumentKey}
          onClose={() => setShowReportEmail(false)}
          onDocumentsChanged={() => setSavedAt(loadAscDocuments()[ascKey]?.[reportDocumentKey]?.updatedAt || "")}
        />
      ) : null}
      {showCompletionRequired ? <ReportCompletionRequiredDialog completion={completion} onClose={() => setShowCompletionRequired(false)} /> : null}
      {pendingNavigation ? <UnsavedChangesDialog onSave={saveAndNavigate} onDiscard={discardAndNavigate} onCancel={() => setPendingNavigation("")} /> : null}
    </main>
  );

  function updateServiceCenterComments(nextComments: ServiceCenterComment[]) {
    setServiceCenterComments(nextComments);
  }

  function updateServiceCenterComment(id: string, patch: Partial<ServiceCenterComment>) {
    updateServiceCenterComments(serviceCenterComments.map((comment) => (comment.id === id ? { ...comment, ...patch } : comment)));
  }
}

function cloneAudit(audit: Audit) {
  return JSON.parse(JSON.stringify(audit)) as Audit;
}

function cloneAudits(audits: Audit[]) {
  return audits.map(cloneAudit);
}

function reportSnapshot(details: { audits: Audit[]; letterDate: string; lateResponseProjectAmount: string; serviceCenterHasComment: boolean; serviceCenterDone: boolean; serviceCenterComments: ServiceCenterComment[] }) {
  return JSON.stringify({
    audits: details.audits,
    letterDate: details.letterDate || "",
    lateResponseProjectAmount: details.lateResponseProjectAmount || "",
    serviceCenterHasComment: details.serviceCenterHasComment,
    serviceCenterDone: details.serviceCenterDone,
    serviceCenterComments: details.serviceCenterComments,
  });
}

function UnsavedChangesDialog({ onSave, onDiscard, onCancel }: { onSave: () => void | Promise<void>; onDiscard: () => void; onCancel: () => void }) {
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

function ReportLetterPage({ group, pocName, date, files, scn, psn }: { group: AscGroup; pocName: string; date: Date; files: string; scn: string; psn: string }) {
  const ascCertificate = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress);
  const ascAddressLines = ascReportAddressLines(ascCertificate, group.location);
  return (
    <section className="report-page report-fixed-page print-page bg-white text-black shadow-sm print:shadow-none">
      <ReportHeader />
      <div className="report-letter">
        <p>{formatLongDate(date)}</p>
        <p>{pocName}<br />{group.ascName}<br />{ascAddressLines.map((line) => <span key={line}>{formatAscAddress(line)}<br /></span>)}</p>
        <p>Our Reference: FILE(s): {files || "Not listed"}<span className="confirmation-reference-gap">SCN: {scn}</span><span className="confirmation-reference-gap">PSN: {psn}</span></p>
        <p>Subject: Annual Audit Report</p>
        <p>Dear {pocName || "Customer"},</p>
        <p>Enclosed is the report of our annual audit of the UL listing(s) for the File(s) referenced above. This report confirms the results of the audit that were reviewed with a member of your staff on the day of the audit.</p>
        <p>The actions required of you were also reviewed on the day of the audit. Please keep the following in mind as you review the detailed audit results.</p>
        <p><b>NONCOMPLIANT FINDINGS</b></p>
        <p>Issues of noncompliance with the applicable codes, standards and/or program requirements are detailed in the following pages. We believe that the remarks are self-explanatory, but please contact us if you have any questions.</p>
        <p><b>YOUR RESPONSE TO THIS REPORT</b></p>
        <p>Your written response to the items noted in this report is required to be received by us within 30 days of the date of this letter. The response shall include a short, specific description of the action taken for each item noted in the report. It should also provide any additional information described in this report, including a cause analysis and corrective action plan, if requested.</p>
        <p>The Service Agreement your organization executed with UL states that your organization agreed that it would, through proper inspection or otherwise, assure that the service covered by your UL Listing(s) would be delivered in compliance with the applicable requirements. Your organization was granted a Listing(s) based on a favorable assessment of its ability to fulfill this contractual obligation. It is therefore important that the issues identified in this report be resolved expeditiously.</p>
      </div>
      <ReportFooter />
    </section>
  );
}

function serviceCenterCommentsFromDraft(draft?: { serviceCenterComments?: Partial<ServiceCenterComment>[]; serviceCenterReportFinding?: string; serviceCenterReportRequiredAction?: string }) {
  if (draft?.serviceCenterComments?.length) return draft.serviceCenterComments.map(normalizeServiceCenterComment);
  return [normalizeServiceCenterComment({
    id: "service-center-1",
    finding: draft?.serviceCenterReportFinding || "",
    requiredAction: draft?.serviceCenterReportRequiredAction || "",
  })];
}

function normalizeServiceCenterComment(comment: Partial<ServiceCenterComment>, index = 0): ServiceCenterComment {
  return {
    id: comment.id || `service-center-${index + 1}`,
    finding: comment.finding || "",
    requiredAction: comment.requiredAction || "",
    codeStandard: comment.codeStandard || "NFPA 72",
    codeEdition: comment.codeEdition || "",
    codeSection: comment.codeSection || "",
  };
}

function blankServiceCenterComment(): ServiceCenterComment {
  return {
    id: `service-center-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    finding: "",
    requiredAction: "",
    codeStandard: "NFPA 72",
    codeEdition: "",
    codeSection: "",
  };
}

function serviceCenterReportValue(comment: ServiceCenterComment): ReportFindingValue {
  return {
    reportFinding: comment.finding,
    reportRequiredAction: comment.requiredAction,
    reportCodeStandard: comment.codeStandard || "NFPA 72",
    reportCodeEdition: comment.codeEdition,
    reportCodeSection: comment.codeSection,
  };
}

function serviceCenterPatch(reportFields: Partial<ReportFindingValue>): Partial<ServiceCenterComment> {
  return {
    ...("reportFinding" in reportFields ? { finding: reportFields.reportFinding || "" } : {}),
    ...("reportRequiredAction" in reportFields ? { requiredAction: reportFields.reportRequiredAction || "" } : {}),
    ...("reportCodeStandard" in reportFields ? { codeStandard: reportFields.reportCodeStandard || (reportFields.reportCodeStandard === UNUSED_REFERENCE_VALUE ? UNUSED_REFERENCE_VALUE : "NFPA 72") } : {}),
    ...("reportCodeEdition" in reportFields ? { codeEdition: reportFields.reportCodeEdition || "" } : {}),
    ...("reportCodeSection" in reportFields ? { codeSection: reportFields.reportCodeSection || "" } : {}),
  };
}

function ServiceCenterReportEditor({
  hasComment,
  done,
  comments,
  incomplete,
  onHasCommentChange,
  onDoneChange,
  onUpdateComments,
  onUpdateComment,
}: {
  hasComment: boolean;
  done: boolean;
  comments: ServiceCenterComment[];
  incomplete: boolean;
  onHasCommentChange: (hasComment: boolean) => void;
  onDoneChange: (done: boolean) => void;
  onUpdateComments: (comments: ServiceCenterComment[]) => void;
  onUpdateComment: (id: string, patch: Partial<ServiceCenterComment>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Does the service center have any comments?
        <select
          className="min-h-11 rounded-md border bg-white px-3"
          value={hasComment ? "YES" : "NO"}
          onChange={(event) => onHasCommentChange(event.target.value === "YES")}
        >
          <option value="NO">No</option>
          <option value="YES">Yes</option>
        </select>
      </label>
      {hasComment ? (
        <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-amber-950">Service Center Comments</div>
            <div className="flex flex-wrap gap-2">
              <SectionDoneToggle done={done} disabled={incomplete} onChange={onDoneChange} />
              <button
                type="button"
                className="min-h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                onClick={() => onUpdateComments([...comments, blankServiceCenterComment()])}
              >
                Add Finding
              </button>
            </div>
          </div>
          {comments.map((comment, index) => (
            <div key={comment.id} className="grid gap-2 rounded-md border border-amber-200 bg-white/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-amber-950">
                <span>Service Center Comment {index + 1}</span>
                {comments.length > 1 ? (
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => onUpdateComments(comments.filter((item) => item.id !== comment.id))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <ReportFindingFields
                value={serviceCenterReportValue(comment)}
                showReportHelp
                onChange={(reportFields) => onUpdateComment(comment.id, serviceCenterPatch(reportFields))}
              />
            </div>
          ))}
          {incomplete ? <div className="text-sm font-medium text-amber-800">Service center comment needs attention before it can be marked done.</div> : <div className="text-sm font-medium text-emerald-700">{done ? "Service center comment marked done." : "Service center comment ready for final review."}</div>}
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No service center comments will print.</div>
      )}
    </div>
  );
}

function ReportEditorSectionPanel({ audit, section, items, emptyText, onUpdateAudit }: { audit: Audit; section: ReportPropertySection; items: Array<{ audit: Audit; item: ReportItem }>; emptyText: string; onUpdateAudit: (audit: Audit) => void }) {
  const sectionItems = items.map(({ item }) => item);
  const missing = sectionItems.filter(reportItemNeedsAttention).length;
  const done = Boolean(audit.reportSectionStatus?.[section]);
  if (!items.length) {
    return (
      <div className="grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
        <div>{emptyText}</div>
        <div className="text-sm font-semibold text-emerald-700">Section complete by default.</div>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${missing ? "border-amber-200 bg-amber-50" : done ? "border-emerald-200 bg-emerald-50" : "border-sky-200 bg-sky-50"}`}>
        <div className="text-sm font-semibold text-navy">
          {items.length} deficienc{items.length === 1 ? "y" : "ies"} in this section
          <span className={`ml-2 text-xs ${missing ? "text-amber-800" : "text-emerald-700"}`}>{missing ? `${missing} need attention` : "ready for final review"}</span>
        </div>
        <SectionDoneToggle done={done} disabled={missing > 0} onChange={(nextDone) => onUpdateAudit(updateReportSectionStatus(audit, section, nextDone))} />
      </div>
      {items.map(({ item }) => <ReportEditorItemCard key={`${audit.id}-${item.id}`} audit={audit} item={item} onUpdateAudit={onUpdateAudit} />)}
    </div>
  );
}

function SectionDoneToggle({ done, disabled, onChange }: { done: boolean; disabled: boolean; onChange: (done: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${done ? "border-emerald-300 bg-emerald-600 text-white" : disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
      onClick={() => onChange(!done)}
      title={disabled ? "Complete the report language before marking this section done." : "Mark this section done or not done."}
    >
      <span className={`h-4 w-8 rounded-full p-0.5 ${done ? "bg-white/30" : "bg-slate-200"}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition ${done ? "translate-x-4" : "translate-x-0"}`} />
      </span>
      {done ? "Done" : "Mark done"}
    </button>
  );
}

function ReportEditorItemCard({ audit, item, onUpdateAudit }: { audit: Audit; item: ReportItem; onUpdateAudit: (audit: Audit) => void }) {
  const missing = reportItemNeedsAttention(item);
  const certificateCode = certificateCodeReference(audit);
  return (
    <div className="grid gap-1 rounded-md border bg-slate-50 p-3">
      <div className="text-sm font-semibold text-navy">{audit.protectedProperty} - {item.reviewType} - {item.category}</div>
      {!item.simpleExplanation ? <div className="flex flex-wrap gap-2">
        {item.extraIndex === undefined ? (
          <button
            type="button"
            className="min-h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-50"
            onClick={() => onUpdateAudit(addReportFinding(audit, item))}
          >
            Add Finding
          </button>
        ) : (
          <button
            type="button"
            className="min-h-9 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            onClick={() => onUpdateAudit(removeReportFinding(audit, item))}
          >
            Remove Finding
          </button>
        )}
      </div> : null}
      {!item.simpleExplanation && certificateCode.year ? <div className="text-xs font-medium text-slate-500">Certificate declared: {certificateCode.standard}, {certificateCode.year} Edition</div> : null}
      {item.note ? (
        <div className="text-sm font-medium text-red-700">
          <span className="font-bold">Field Note:</span> {item.note}
        </div>
      ) : (
        <div className="text-sm italic text-slate-500">Field note left empty.</div>
      )}
      <div className={`text-sm font-medium ${missing ? "text-amber-800" : "text-emerald-700"}`}>{missing ? (item.simpleExplanation ? "Add the reason this review was not completed." : "Report language needs attention.") : "Ready for final review."}</div>
      {item.simpleExplanation ? (
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Reason the review was not completed
          <textarea
            className="min-h-28 rounded-md border border-slate-300 bg-white p-3"
            value={item.finding}
            onChange={(event) => onUpdateAudit(updateReportItem(audit, item, { reportFinding: event.target.value }))}
            placeholder="Explain why this review was not completed. This text will print under the related report section."
          />
        </label>
      ) : <ReportFindingFields
        value={reportValue(item)}
        showReportHelp
        helpStandard={certificateCode.standard}
        helpYear={certificateCode.year}
        onChange={(reportFields) => onUpdateAudit(updateReportItem(audit, item, reportFields))}
      />}
    </div>
  );
}

function LateResponsePage({ auditor, projectAmount }: { auditor: Auditor | null; projectAmount: string }) {
  return (
    <section className="report-page report-fixed-page print-page bg-white text-black shadow-sm print:shadow-none">
      <ReportHeader />
      <div className="report-letter report-late">
        <p><b>LATE RESPONSE</b></p>
        <p>To preserve the integrity of the UL Mark, timely resolution of issues noted as not being in compliance with the applicable codes, standards and /or program requirements is critical. If your reply is not received within 30 days from the date of this letter, where applicable based on the Listing type(s), the following actions will occur:</p>
        <ol className="report-late-list">
          <li>For certificate issuing Files, the ability to issue new or change existing protected property Certificates will be suspended.</li>
          <li>For monitoring facility Files, the ability to be designated as the monitoring location for alarm systems covered by newly issued Certificates will be suspended.</li>
          <li>A mandatory billable project in the amount of <mark className="report-highlight">{formatProjectAmount(projectAmount)}</mark> will be opened to help defray the additional administrative expense associated with handling late responses.</li>
        </ol>
        <p>If your reply has still not been received within 55 days of the date of this letter the following actions will occur:</p>
        <ol className="report-late-list">
          <li>For certificate issuing Files, the Listing(s) will be withdrawn, and all active Certificates will be canceled for the affected File(s).</li>
          <li>For monitoring facility Files, the Listing(s) will be withdrawn, and all active Certificates naming your organization as the monitoring location will be cancelled for the affected File(s).</li>
        </ol>
        <p>The procedure that we will follow for Late Response actions has been outlined in detail at this time so that there will be no misunderstanding of the procedure that will be followed.</p>
        <p>Please do not hesitate to contact this office if you have any questions.</p>
        <p className="report-signature">Sincerely,</p>
        <p><b>{auditor?.name || ""}</b><br />{auditor?.title || ""}<br /><SignatureDepartment department={auditor?.department} />{auditor?.phone || ""}<br />{auditor?.email || ""}</p>
      </div>
    </section>
  );
}

function SignatureDepartment({ department }: { department?: string }) {
  return (
    <>
      {(department || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => (
        <Fragment key={line}>{line}<br /></Fragment>
      ))}
    </>
  );
}

function AuditCommentsPage({ group, serviceCenterHasComment, serviceCenterComments }: { group: AscGroup; serviceCenterHasComment: boolean; serviceCenterComments: ServiceCenterComment[] }) {
  const printableServiceComments = serviceCenterHasComment ? serviceCenterComments.filter((comment) => comment.finding.trim() || comment.requiredAction.trim()) : [];
  const photoItems = reportPhotoAppendixItems(group.audits, printableServiceComments.length);
  let nextDeficiencyNumber = printableServiceComments.length + 1;
  const takeDeficiencyNumber = () => nextDeficiencyNumber++;
  return (
    <section className="report-page report-comments-page print-page bg-white text-black shadow-sm print:shadow-none">
      <h1>Audit Comments</h1>
      <p className="report-comments-intro">Provide in your response to this report a brief description of the action taken to correct any issues noted below.</p>
      <div className="report-major-section">
        <h2>Service Center Comments</h2>
        {printableServiceComments.length ? (
          printableServiceComments.map((comment, index) => <ServiceCenterFinding key={comment.id} number={index + 1} comment={comment} />)
        ) : (
          <p className="report-aligned-note">** No non-compliance issues were identified during the audit.</p>
        )}
      </div>
      <div className="report-major-section">
        <h2>Protected Property Comments</h2>
        {reportAuditsByCategory(group.audits).map((audit) => {
          const certificate = primaryCertificate(audit);
          const printableItems = printableReportItems(audit);
          const signalItems = printableItems.filter((item) => item.reviewType === "Signal Processing Review");
          const documentationItems = printableItems.filter((item) => item.reviewType === "Documentation Review");
          const installationItems = printableItems.filter((item) => item.reviewType === "Installation Review");
          const propertyLines = reportPropertyLines(audit, certificate);
          return (
            <div key={audit.id} className="report-audit-block">
              <p className="report-property">
                <b>SN: {audit.certificateNumber}</b><br />
                <b>CCN: {certificate?.categoryCode || ""}</b><br />
                {propertyLines.map((line) => <b key={line}>{line}<br /></b>)}
              </p>
              {!audit.deviceSystemLocal ? <SignalReportSection audit={audit} items={signalItems} takeNumber={takeDeficiencyNumber} /> : null}
              <ReportSection title="Documentation Review" items={documentationItems} emptyText="** No non-compliance issues were identified during the documentation review." takeNumber={takeDeficiencyNumber} />
              <ReportSection title="Installation Review" items={installationItems} emptyText="** No non-compliance issues were identified during the installation review." takeNumber={takeDeficiencyNumber} />
            </div>
          );
        })}
      </div>
      <p className="report-end">***END***</p>
      <ReportPhotoAppendix photos={photoItems} />
    </section>
  );
}

function ServiceCenterFinding({ number, comment }: { number: number; comment: ServiceCenterComment }) {
  return (
    <div className="report-finding">
      <div className="report-finding-row">
        <span className="report-finding-number">{number ? `${number}.` : ""}</span>
        <p><span className="report-finding-label">Finding:</span> {comment.finding}</p>
      </div>
      <div className="report-finding-row">
        <span className="report-finding-number" />
        <p><span className="report-finding-label">Required Action:</span> {comment.requiredAction}</p>
      </div>
      <div className="report-finding-row">
        <span className="report-finding-number" />
        <p><span className="report-code-reference-label">Code Reference:</span> {formatServiceCenterCodeReference(comment)}</p>
      </div>
    </div>
  );
}

function reportAuditsByCategory(audits: Audit[]) {
  return [...audits].sort((first, second) => {
    const firstCategory = primaryCertificate(first)?.categoryCode || "";
    const secondCategory = primaryCertificate(second)?.categoryCode || "";
    const categoryRank = categoryReportRank(firstCategory) - categoryReportRank(secondCategory);
    if (categoryRank) return categoryRank;
    return first.protectedProperty.localeCompare(second.protectedProperty);
  });
}

function categoryReportRank(category: string) {
  const normalized = category.trim().toUpperCase();
  if (normalized === "UUFX") return 0;
  if (normalized === "UUJS") return 1;
  return 2;
}

function SignalReportSection({ audit, items, takeNumber }: { audit: Audit; items: ReportItem[]; takeNumber: () => number }) {
  const counts = {
    alarm: audit.signalLog.filter((row) => row.signalType === "Alarm").length,
    supervisory: audit.signalLog.filter((row) => row.signalType === "Supervisory").length,
    trouble: audit.signalLog.filter((row) => row.signalType === "Trouble").length,
  };
  if (!audit.signalLog.some((row) => row.signalType)) return null;
  return (
    <div className="report-review-section">
      <h3>----Signal Processing Review----</h3>
      <p className="report-aligned-note">A total of {counts.alarm} alarm, {counts.supervisory} supervisory, and {counts.trouble} trouble signal event(s) has been reviewed.</p>
      {!items.length ? <p className="report-aligned-note">** No non-compliance issues were identified during the signal review.</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={item.simpleExplanation ? 0 : takeNumber()} />)}
    </div>
  );
}

function ReportSection({ title, items, emptyText, takeNumber }: { title: ReportReview; items: ReportItem[]; emptyText: string; takeNumber: () => number }) {
  return (
    <div className="report-review-section">
      <h3>----{title}----</h3>
      {!items.length ? <p className="report-aligned-note">{emptyText}</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={item.simpleExplanation ? 0 : takeNumber()} />)}
    </div>
  );
}

function ReportFinding({ item, number }: { item: ReportItem; number: number }) {
  if (item.simpleExplanation) {
    return (
      <div className="report-finding">
        <h4>{item.category}</h4>
        <p>{item.finding || "Reason not provided."}</p>
      </div>
    );
  }
  return (
    <div className="report-finding">
      <h4>{item.category}</h4>
      <div className="report-finding-row">
        <span className="report-finding-number">{number ? `${number}.` : ""}</span>
        <p><span className="report-finding-label">Finding:</span> {item.finding}</p>
      </div>
      <div className="report-finding-row">
        <span className="report-finding-number" />
        <p><span className="report-finding-label">Required Action:</span> {item.requiredAction}</p>
      </div>
      <div className="report-finding-row">
        <span className="report-finding-number" />
        <p><span className="report-code-reference-label">Code Reference:</span> {formatCodeReference(item)}</p>
      </div>
    </div>
  );
}

function ReportPhotoAppendix({ photos }: { photos: ReportPhotoItem[] }) {
  if (!photos.length) return null;
  return (
    <section className="report-photo-appendix">
      <h2>Deficiency Photographs</h2>
      <p className="report-photo-intro">Installation review photographs captured by the auditor are referenced to the related report deficiency below.</p>
      <div className="report-photo-grid">
        {photos.map((photo) => (
          <figure key={photo.id} className="report-photo-card">
            <img src={photo.dataUrl} alt={`Deficiency ${photo.deficiencyNumber} - ${photo.category}`} />
            <figcaption>
              <b>Deficiency {photo.deficiencyNumber}</b>
              <span>{photo.reviewType} - {photo.category}</span>
              <span>{photo.propertyName}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function collectReportItems(audit: Audit): ReportItem[] {
  const baseItems = [
    ...sectionReviewItems(audit),
    ...(audit.deviceSystemLocal ? [] : audit.signalLog.filter((row) => row.handlingStatus === "VAR").map((row) => signalItem(row))),
    ...audit.documentation.filter((row) => row.status === "VAR").map((row) => checklistItem(row, "Documentation Review")),
    ...certificateConditionItems(audit),
    ...audit.installation.filter((row) => row.status === "VAR").map((row) => checklistItem(row, "Installation Review")),
    ...audit.deviceTests.filter((row) => row.result === "VAR").map((row) => deviceItem(row)),
  ];
  return baseItems.flatMap((item) => expandReportItem(audit, item));
}

function reportPhotoAppendixItems(audits: Audit[], serviceCenterCount: number): ReportPhotoItem[] {
  let nextNumber = serviceCenterCount + 1;
  const photos: ReportPhotoItem[] = [];
  reportAuditsByCategory(audits).forEach((audit) => {
    const installationRows = new Map(audit.installation.map((row) => [row.id, row]));
    printableReportItems(audit).forEach((item) => {
      const deficiencyNumber = nextNumber++;
      if (item.source !== "installation" || item.extraIndex !== undefined) return;
      const row = installationRows.get(item.rowId);
      if (!row?.photos.length) return;
      row.photos.forEach((photoId, index) => {
        const dataUrl = loadPhoto(photoId);
        if (!dataUrl) return;
        photos.push({
          id: `${item.id}-${photoId}-${index}`,
          photoId,
          dataUrl,
          deficiencyNumber,
          propertyName: audit.protectedProperty,
          reviewType: item.reviewType,
          category: item.category,
        });
      });
    });
  });
  return photos;
}

function printableReportItems(audit: Audit): ReportItem[] {
  return collectReportItems(audit).filter((item) => item.extraIndex === undefined || reportItemHasContent(item));
}

function reportItemHasContent(item: ReportItem) {
  if (item.simpleExplanation) return Boolean(item.finding.trim());
  return Boolean(item.finding.trim() || item.requiredAction.trim() || item.codeEdition.trim() || item.codeSection.trim() || (item.codeStandard.trim() && item.codeStandard.trim() !== "NFPA 72"));
}

function reportItemNeedsAttention(item: ReportItem) {
  if (item.simpleExplanation) return !item.finding.trim();
  return !item.finding.trim() || !item.requiredAction.trim() || !isReferenceComplete(item.codeStandard, "NFPA 72") || !isReferenceComplete(item.codeEdition) || !isReferenceComplete(item.codeSection);
}

function serviceCenterCommentNeedsAttention(comment: ServiceCenterComment) {
  return !comment.finding.trim() || !comment.requiredAction.trim() || !isReferenceComplete(comment.codeStandard, "NFPA 72") || !isReferenceComplete(comment.codeEdition) || !isReferenceComplete(comment.codeSection);
}

function pastReportRowsFromCompletedReport(audits: Audit[], serviceComments: ServiceCenterComment[], reportName: string): AuditorReportFinding[] {
  const rows: AuditorReportFinding[] = [];
  serviceComments
    .filter((comment) => !serviceCenterCommentNeedsAttention(comment))
    .forEach((comment, index) => {
      rows.push(pastReportRow({
        id: `HR-SC-${Date.now().toString(36)}-${index}`,
        standard: comment.codeStandard,
        year: comment.codeEdition,
        section: comment.codeSection,
        reviewType: "Service Center Comments",
        category: "Service Center Comments",
        finding: comment.finding,
        requiredAction: comment.requiredAction,
        reportName,
      }));
    });
  reportAuditsByCategory(audits).forEach((audit) => {
    printableReportItems(audit)
      .filter((item) => !reportItemNeedsAttention(item))
      .forEach((item) => {
        rows.push(pastReportRow({
          id: `HR-${audit.id}-${item.id}`,
          standard: item.codeStandard,
          year: item.codeEdition,
          section: item.codeSection,
          reviewType: item.reviewType,
          category: item.category,
          finding: item.finding,
          requiredAction: item.requiredAction,
          reportName,
        }));
      });
  });
  return rows;
}

function pastReportRow({ id, standard, year, section, reviewType, category, finding, requiredAction, reportName }: { id: string; standard: string; year: string; section: string; reviewType: string; category: string; finding: string; requiredAction: string; reportName: string }): AuditorReportFinding {
  return {
    id,
    standard: printableReferenceValue(standard, "NFPA 72"),
    year: printableReferenceValue(year),
    reviewType,
    category,
    findingType: category,
    section: printableReferenceValue(section),
    finding,
    requiredAction,
    keywords: [category, reviewType, standard, year, section, finding].join(" ").toLowerCase(),
    examples: `Created by Haudy from ${reportName}`,
  };
}

function reportPropertyStats(audit: Audit) {
  const items = printableReportItems(audit);
  const sections: ReportPropertySection[] = ["signal", "documentation", "installation"];
  const sectionsWithWork = sections.filter((section) => sectionItemsForAudit(audit, section).length > 0);
  const missing = items.filter(reportItemNeedsAttention).length;
  const incompleteSections = sectionsWithWork.filter((section) => !audit.reportSectionStatus?.[section]).length;
  return {
    total: items.length,
    missing,
    needsAttention: missing > 0 || incompleteSections > 0,
  };
}

function reportCompletionStatus(audits: Audit[], serviceCenterHasComment: boolean, serviceCenterDone: boolean, serviceCenterIncomplete: boolean) {
  const sections: ReportPropertySection[] = ["signal", "documentation", "installation"];
  const missingItems = audits.flatMap((audit) => printableReportItems(audit).filter(reportItemNeedsAttention));
  const unfinishedSections = audits.flatMap((audit) => sections
    .filter((section) => sectionItemsForAudit(audit, section).length > 0 && !audit.reportSectionStatus?.[section])
    .map((section) => `${audit.protectedProperty || "Property"} — ${reportSectionLabel(section)}`));
  const serviceCenterNeedsReview = serviceCenterHasComment && (serviceCenterIncomplete || !serviceCenterDone);
  return {
    ready: missingItems.length === 0 && unfinishedSections.length === 0 && !serviceCenterNeedsReview,
    missingItems: missingItems.length,
    unfinishedSections,
    serviceCenterNeedsReview,
  };
}

function reportSectionLabel(section: ReportPropertySection) {
  if (section === "signal") return "Signal Processing";
  if (section === "documentation") return "Documentation";
  return "Installation";
}

function ReportCompletionRequiredDialog({ completion, onClose }: { completion: ReturnType<typeof reportCompletionStatus>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-labelledby="report-completion-title">
      <div className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 id="report-completion-title" className="text-xl font-bold text-navy">Complete the report first</h2>
          <p className="mt-1 text-sm text-slate-600">Save Report Draft and Save as PDF are available after every report item is complete and each applicable section is marked Done.</p>
        </div>
        <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {completion.missingItems ? <p><b>{completion.missingItems}</b> report item{completion.missingItems === 1 ? "" : "s"} still need{completion.missingItems === 1 ? "s" : ""} Finding, Required Action, or Code Reference details.</p> : null}
          {completion.serviceCenterNeedsReview ? <p><b>Service Center Comments</b> must be completed and marked Done.</p> : null}
          {completion.unfinishedSections.length ? (
            <div>
              <p className="font-semibold">Mark these completed sections Done:</p>
              <ul className="mt-1 list-disc pl-5">
                {completion.unfinishedSections.map((section) => <li key={section}>{section}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <button type="button" className="min-h-10 rounded-md border border-navy bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90" onClick={onClose}>Continue Editing</button>
        </div>
      </div>
    </div>
  );
}

function sectionItemsForAudit(audit: Audit, section: ReportPropertySection) {
  return printableReportItems(audit).filter((item) => {
    if (section === "signal") return item.reviewType === "Signal Processing Review";
    if (section === "documentation") return item.reviewType === "Documentation Review";
    return item.reviewType === "Installation Review";
  });
}

type ReportSectionUiStatus = "none" | "needs" | "ready" | "done";

function serviceCenterTabStatus(hasComment: boolean, done: boolean, incomplete: boolean): ReportSectionUiStatus {
  if (!hasComment) return "done";
  if (incomplete) return "needs";
  return done ? "done" : "ready";
}

function sectionTabStatus(audit: Audit | undefined, section: ReportPropertySection, items: ReportItem[]): ReportSectionUiStatus {
  if (!items.length) return "done";
  if (items.some(reportItemNeedsAttention)) return "needs";
  return audit?.reportSectionStatus?.[section] ? "done" : "ready";
}

function reportSectionTabClass(status: ReportSectionUiStatus) {
  if (status === "needs") return "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100";
  if (status === "ready") return "border-sky-200 bg-white text-sky-900 hover:bg-sky-50";
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
  return "border-sky-100 bg-white text-slate-700 hover:bg-sky-100";
}

function reportSectionTabTextClass(status: ReportSectionUiStatus) {
  if (status === "needs") return "text-amber-700";
  if (status === "ready") return "text-sky-700";
  if (status === "done") return "text-emerald-700";
  return "text-slate-500";
}

function reportSectionTabLabel(status: ReportSectionUiStatus) {
  if (status === "needs") return "Needs attention";
  if (status === "ready") return "Ready for final review";
  if (status === "done") return "Done";
  return "No deficiencies";
}

function expandReportItem(audit: Audit, item: ReportItem): ReportItem[] {
  const extras = audit.reportExtraFindings?.[item.baseId] || [];
  return [
    item,
    ...extras.map((entry, extraIndex) => ({
      ...item,
      id: `${item.baseId}-extra-${extraIndex}`,
      extraIndex,
      finding: entry.finding,
      requiredAction: entry.requiredAction,
      codeStandard: entry.codeStandard,
      codeEdition: entry.codeEdition,
      codeSection: entry.codeSection,
    })),
  ];
}

function sectionReviewItems(audit: Audit): ReportItem[] {
  const items: ReportItem[] = [];
  if (!audit.deviceSystemLocal && !audit.signalProcessingReviewed && (audit.editedFields?.signalProcessingReviewed || audit.signalReviewNotes)) {
    items.push({
      id: `section-signal-${audit.id}`,
      baseId: `section-signal-${audit.id}`,
      source: "sectionReview",
      rowId: "signalProcessingReviewed",
      reviewType: "Signal Processing Review",
      category: "Signal Processing Review Not Completed",
      note: audit.signalReviewNotes,
      finding: audit.signalReviewReportFinding,
      requiredAction: audit.signalReviewReportRequiredAction,
      codeStandard: audit.signalReviewReportCodeStandard,
      codeEdition: audit.signalReviewReportCodeEdition,
      codeSection: audit.signalReviewReportCodeSection,
    });
  }
  if (!audit.documentationReviewed && (audit.editedFields?.documentationReviewed || audit.documentationReviewNotes)) {
    items.push({
      id: `section-documentation-${audit.id}`,
      baseId: `section-documentation-${audit.id}`,
      source: "sectionReview",
      rowId: "documentationReviewed",
      reviewType: "Documentation Review",
      category: "Documentation Review Not Completed",
      note: audit.documentationReviewNotes,
      finding: audit.documentationReviewReportFinding,
      requiredAction: audit.documentationReviewReportRequiredAction,
      codeStandard: audit.documentationReviewReportCodeStandard,
      codeEdition: audit.documentationReviewReportCodeEdition,
      codeSection: audit.documentationReviewReportCodeSection,
    });
  }
  if (!audit.installationReviewed && (audit.editedFields?.installationReviewed || audit.installationReviewNotes)) {
    items.push({
      id: `section-installation-${audit.id}`,
      baseId: `section-installation-${audit.id}`,
      source: "sectionReview",
      rowId: "installationReviewed",
      reviewType: "Installation Review",
      category: "Installation Review Not Completed",
      note: audit.installationReviewNotes,
      finding: audit.installationReviewReportFinding,
      requiredAction: audit.installationReviewReportRequiredAction,
      codeStandard: audit.installationReviewReportCodeStandard,
      codeEdition: audit.installationReviewReportCodeEdition,
      codeSection: audit.installationReviewReportCodeSection,
      simpleExplanation: true,
    });
  }
  if (!audit.deviceTestingReviewed && (audit.editedFields?.deviceTestingReviewed || audit.deviceTestingNotes)) {
    items.push({
      id: `section-device-${audit.id}`,
      baseId: `section-device-${audit.id}`,
      source: "sectionReview",
      rowId: "deviceTestingReviewed",
      reviewType: "Installation Review",
      category: "Device Testing Review Not Completed",
      note: audit.deviceTestingNotes,
      finding: audit.deviceTestingReportFinding,
      requiredAction: audit.deviceTestingReportRequiredAction,
      codeStandard: audit.deviceTestingReportCodeStandard,
      codeEdition: audit.deviceTestingReportCodeEdition,
      codeSection: audit.deviceTestingReportCodeSection,
      simpleExplanation: true,
    });
  }
  return items;
}

function signalItem(row: SignalLogRow): ReportItem {
  return {
    id: `signal-${row.id}`,
    baseId: `signal-${row.id}`,
    source: "signalLog",
    rowId: row.id,
    reviewType: "Signal Processing Review",
    category: [row.signalType, row.date, row.time].filter(Boolean).join(" - ") || "Signal event",
    note: row.notes || row.description,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeStandard: row.reportCodeStandard,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function checklistItem(row: AuditRow, reviewType: ReportReview): ReportItem {
  return {
    id: `${reviewType}-${row.id}`,
    baseId: `${reviewType}-${row.id}`,
    source: reviewType === "Documentation Review" ? "documentation" : "installation",
    rowId: row.id,
    reviewType,
    category: row.element || reviewType,
    note: row.notes,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeStandard: row.reportCodeStandard,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function deviceItem(row: DeviceTestRow): ReportItem {
  return {
    id: `device-${row.id}`,
    baseId: `device-${row.id}`,
    source: "deviceTests",
    rowId: row.id,
    reviewType: "Installation Review",
    category: ["Device Test", row.deviceType, row.location || row.deviceId].filter(Boolean).join(" - "),
    note: row.notes,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeStandard: row.reportCodeStandard,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function certificateConditionItems(audit: Audit): ReportItem[] {
  const hasCertificateVariation = audit.matchesCertificateStatus === "VAR" || audit.certificateDisplayedStatus === "VAR";
  if (!hasCertificateVariation) return [];
  const useMatchReportFields = Boolean(
    audit.certificateMatchReportFinding ||
    audit.certificateMatchReportRequiredAction ||
    audit.certificateMatchReportCodeStandard ||
    audit.certificateMatchReportCodeEdition ||
    audit.certificateMatchReportCodeSection,
  );
  const notes = [
    audit.matchesCertificateStatus === "VAR" && audit.certificateMatchNotes.trim()
      ? `Certificate declarations variation: ${audit.certificateMatchNotes.trim()}`
      : "",
    audit.certificateDisplayedStatus === "VAR" ? "Certificate was not displayed." : "",
  ].filter(Boolean).join("\n");
  return [{
    id: `certificate-condition-${audit.id}`,
    baseId: `certificate-condition-${audit.id}`,
    source: "installation",
    rowId: `certificate-condition-${audit.id}`,
    reviewType: "Installation Review",
    category: "Certificate",
    note: notes,
    finding: useMatchReportFields ? audit.certificateMatchReportFinding : audit.certificateDisplayedReportFinding,
    requiredAction: useMatchReportFields ? audit.certificateMatchReportRequiredAction : audit.certificateDisplayedReportRequiredAction,
    codeStandard: useMatchReportFields ? audit.certificateMatchReportCodeStandard : audit.certificateDisplayedReportCodeStandard,
    codeEdition: useMatchReportFields ? audit.certificateMatchReportCodeEdition : audit.certificateDisplayedReportCodeEdition,
    codeSection: useMatchReportFields ? audit.certificateMatchReportCodeSection : audit.certificateDisplayedReportCodeSection,
  }];
}

function reportValue(item: ReportItem): ReportFindingValue {
  return {
    reportFinding: item.finding,
    reportRequiredAction: item.requiredAction,
    reportCodeStandard: item.codeStandard || "NFPA 72",
    reportCodeEdition: item.codeEdition,
    reportCodeSection: item.codeSection,
  };
}

function blankReportFindingEntry(): ReportFindingEntry {
  return {
    finding: "",
    requiredAction: "",
    codeStandard: "NFPA 72",
    codeEdition: "",
    codeSection: "",
  };
}

function addReportFinding(audit: Audit, item: ReportItem): Audit {
  const updatedAt = new Date().toISOString();
  const current = audit.reportExtraFindings?.[item.baseId] || [];
  return {
    ...audit,
    updatedAt,
    reportExtraFindings: {
      ...(audit.reportExtraFindings || {}),
      [item.baseId]: [...current, blankReportFindingEntry()],
    },
  };
}

function removeReportFinding(audit: Audit, item: ReportItem): Audit {
  if (item.extraIndex === undefined) return audit;
  const updatedAt = new Date().toISOString();
  const current = audit.reportExtraFindings?.[item.baseId] || [];
  const nextEntries = current.filter((_, index) => index !== item.extraIndex);
  const nextExtraFindings = { ...(audit.reportExtraFindings || {}) };
  if (nextEntries.length) {
    nextExtraFindings[item.baseId] = nextEntries;
  } else {
    delete nextExtraFindings[item.baseId];
  }
  return { ...audit, updatedAt, reportExtraFindings: nextExtraFindings };
}

function updateReportSectionStatus(audit: Audit, section: ReportPropertySection, done: boolean): Audit {
  return {
    ...audit,
    updatedAt: new Date().toISOString(),
    reportSectionStatus: {
      ...(audit.reportSectionStatus || {}),
      [section]: done,
    },
  };
}

function updateReportItem(audit: Audit, item: ReportItem, reportFields: Partial<ReportFindingValue>): Audit {
  const patch = {
    ...("reportFinding" in reportFields ? { reportFinding: reportFields.reportFinding || "" } : {}),
    ...("reportRequiredAction" in reportFields ? { reportRequiredAction: reportFields.reportRequiredAction || "" } : {}),
    ...("reportCodeStandard" in reportFields ? { reportCodeStandard: reportFields.reportCodeStandard || (reportFields.reportCodeStandard === UNUSED_REFERENCE_VALUE ? UNUSED_REFERENCE_VALUE : "NFPA 72") } : {}),
    ...("reportCodeEdition" in reportFields ? { reportCodeEdition: reportFields.reportCodeEdition || "" } : {}),
    ...("reportCodeSection" in reportFields ? { reportCodeSection: reportFields.reportCodeSection || "" } : {}),
  };
  const updatedAt = new Date().toISOString();
  if (item.extraIndex !== undefined) {
    const current = audit.reportExtraFindings?.[item.baseId] || [];
    const nextEntries = [...current];
    const existing = nextEntries[item.extraIndex] || blankReportFindingEntry();
    nextEntries[item.extraIndex] = {
      ...existing,
      ...("reportFinding" in reportFields ? { finding: reportFields.reportFinding || "" } : {}),
      ...("reportRequiredAction" in reportFields ? { requiredAction: reportFields.reportRequiredAction || "" } : {}),
      ...("reportCodeStandard" in reportFields ? { codeStandard: reportFields.reportCodeStandard || (reportFields.reportCodeStandard === UNUSED_REFERENCE_VALUE ? UNUSED_REFERENCE_VALUE : "NFPA 72") } : {}),
      ...("reportCodeEdition" in reportFields ? { codeEdition: reportFields.reportCodeEdition || "" } : {}),
      ...("reportCodeSection" in reportFields ? { codeSection: reportFields.reportCodeSection || "" } : {}),
    };
    return {
      ...audit,
      updatedAt,
      reportExtraFindings: {
        ...(audit.reportExtraFindings || {}),
        [item.baseId]: nextEntries,
      },
    };
  }
  if (item.source === "signalLog") {
    return { ...audit, updatedAt, signalLog: audit.signalLog.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  if (item.source === "documentation") {
    return { ...audit, updatedAt, documentation: audit.documentation.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  if (item.source === "sectionReview") {
    if (item.rowId === "signalProcessingReviewed") {
      return {
        ...audit,
        updatedAt,
        signalReviewReportFinding: patch.reportFinding ?? audit.signalReviewReportFinding,
        signalReviewReportRequiredAction: patch.reportRequiredAction ?? audit.signalReviewReportRequiredAction,
        signalReviewReportCodeStandard: patch.reportCodeStandard ?? audit.signalReviewReportCodeStandard,
        signalReviewReportCodeEdition: patch.reportCodeEdition ?? audit.signalReviewReportCodeEdition,
        signalReviewReportCodeSection: patch.reportCodeSection ?? audit.signalReviewReportCodeSection,
      };
    }
    if (item.rowId === "documentationReviewed") {
      return {
        ...audit,
        updatedAt,
        documentationReviewReportFinding: patch.reportFinding ?? audit.documentationReviewReportFinding,
        documentationReviewReportRequiredAction: patch.reportRequiredAction ?? audit.documentationReviewReportRequiredAction,
        documentationReviewReportCodeStandard: patch.reportCodeStandard ?? audit.documentationReviewReportCodeStandard,
        documentationReviewReportCodeEdition: patch.reportCodeEdition ?? audit.documentationReviewReportCodeEdition,
        documentationReviewReportCodeSection: patch.reportCodeSection ?? audit.documentationReviewReportCodeSection,
      };
    }
    if (item.rowId === "deviceTestingReviewed") {
      return {
        ...audit,
        updatedAt,
        deviceTestingReportFinding: patch.reportFinding ?? audit.deviceTestingReportFinding,
        deviceTestingReportRequiredAction: patch.reportRequiredAction ?? audit.deviceTestingReportRequiredAction,
        deviceTestingReportCodeStandard: patch.reportCodeStandard ?? audit.deviceTestingReportCodeStandard,
        deviceTestingReportCodeEdition: patch.reportCodeEdition ?? audit.deviceTestingReportCodeEdition,
        deviceTestingReportCodeSection: patch.reportCodeSection ?? audit.deviceTestingReportCodeSection,
      };
    }
    return {
      ...audit,
      updatedAt,
      installationReviewReportFinding: patch.reportFinding ?? audit.installationReviewReportFinding,
      installationReviewReportRequiredAction: patch.reportRequiredAction ?? audit.installationReviewReportRequiredAction,
      installationReviewReportCodeStandard: patch.reportCodeStandard ?? audit.installationReviewReportCodeStandard,
      installationReviewReportCodeEdition: patch.reportCodeEdition ?? audit.installationReviewReportCodeEdition,
      installationReviewReportCodeSection: patch.reportCodeSection ?? audit.installationReviewReportCodeSection,
    };
  }
  if (item.source === "installation") {
    if (item.rowId.startsWith("certificate-condition-") || item.rowId.startsWith("certificate-match-")) {
      return {
        ...audit,
        updatedAt,
        certificateMatchReportFinding: patch.reportFinding ?? audit.certificateMatchReportFinding,
        certificateMatchReportRequiredAction: patch.reportRequiredAction ?? audit.certificateMatchReportRequiredAction,
        certificateMatchReportCodeStandard: patch.reportCodeStandard ?? audit.certificateMatchReportCodeStandard,
        certificateMatchReportCodeEdition: patch.reportCodeEdition ?? audit.certificateMatchReportCodeEdition,
        certificateMatchReportCodeSection: patch.reportCodeSection ?? audit.certificateMatchReportCodeSection,
      };
    }
    if (item.rowId.startsWith("certificate-displayed-")) {
      return {
        ...audit,
        updatedAt,
        certificateDisplayedReportFinding: patch.reportFinding ?? audit.certificateDisplayedReportFinding,
        certificateDisplayedReportRequiredAction: patch.reportRequiredAction ?? audit.certificateDisplayedReportRequiredAction,
        certificateDisplayedReportCodeStandard: patch.reportCodeStandard ?? audit.certificateDisplayedReportCodeStandard,
        certificateDisplayedReportCodeEdition: patch.reportCodeEdition ?? audit.certificateDisplayedReportCodeEdition,
        certificateDisplayedReportCodeSection: patch.reportCodeSection ?? audit.certificateDisplayedReportCodeSection,
      };
    }
    return { ...audit, updatedAt, installation: audit.installation.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  return { ...audit, updatedAt, deviceTests: audit.deviceTests.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
}

function propertyAddressLines(address: string) {
  const cleanAddress = cleanReportAddress(address);
  if (!cleanAddress) return [];
  const fullAddressMatch = cleanAddress.match(/^(.+?),\s*([^,]+),?\s+([A-Z]{2}|California)\s+(\d{5}(?:-\d{4})?)(?:\s+UNITED STATES)?$/i);
  if (fullAddressMatch) {
    const state = fullAddressMatch[3].toUpperCase() === "CALIFORNIA" ? "CA" : fullAddressMatch[3].toUpperCase();
    return [fullAddressMatch[1].trim(), `${fullAddressMatch[2].trim()}, ${state} ${fullAddressMatch[4]} UNITED STATES`];
  }
  const cityOnlyMatch = cleanAddress.match(/^([^,]+),?\s+([A-Z]{2}|California)\s+(\d{5}(?:-\d{4})?)(?:\s+UNITED STATES)?$/i);
  if (cityOnlyMatch) {
    const state = cityOnlyMatch[2].toUpperCase() === "CALIFORNIA" ? "CA" : cityOnlyMatch[2].toUpperCase();
    return [`${cityOnlyMatch[1].trim()}, ${state} ${cityOnlyMatch[3]} UNITED STATES`];
  }
  const parts = cleanAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [cleanAddress];
  return [parts[0], parts.slice(1).join(", ")];
}

function reportPropertyLines(audit: Audit, certificate: ParsedCertificate | undefined) {
  const propertyName = cleanReportAddress(audit.protectedProperty || certificate?.propertyName || "");
  const addressLines = propertyAddressLines(certificate?.propertyAddress || "");
  const split = splitTrailingStreetAddress(propertyName);
  if (!split) return [propertyName, ...addressLines].filter(Boolean);

  const hasStreetAddress = addressLines.some((line) => /\d/.test(line) && streetSuffixPattern.test(line));
  const lines = [split.name];
  if (!hasStreetAddress) lines.push(split.street);
  return [...lines, ...addressLines].filter(Boolean);
}

const streetSuffixPattern = /\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|way|place|pl\.?|parkway|pkwy\.?)\b/i;

function splitTrailingStreetAddress(value: string) {
  const match = value.match(/\b(\d{1,6}\s+.+?\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|way|place|pl\.?|parkway|pkwy\.?))$/i);
  if (!match?.index || match.index < 4) return null;
  const name = value.slice(0, match.index).trim();
  const street = match[1].trim();
  if (!name || !street) return null;
  return { name, street };
}

function ascReportAddressLines(certificate: ParsedCertificate | undefined, fallback: string) {
  const cleanAddress = cleanReportAddress(certificate?.ascAddress || fallback);
  if (!cleanAddress) return [];

  const city = (certificate?.ascCity || "").replace(/\s+/g, " ").trim();
  const state = (certificate?.ascState || "").replace(/\s+/g, " ").trim();
  if (city && state) {
    const cityStatePattern = new RegExp(`\\b${escapeRegExp(city)}\\s*,?\\s+${escapeRegExp(state)}\\s+\\d{5}(?:-\\d{4})?(?:\\s+UNITED STATES)?$`, "i");
    const cityStateMatch = cleanAddress.match(cityStatePattern);
    if (cityStateMatch?.index !== undefined && cityStateMatch.index > 0) {
      const street = cleanAddress.slice(0, cityStateMatch.index).replace(/,\s*$/, "").trim();
      return [street, cityStateMatch[0].replace(/\s+UNITED STATES$/i, " UNITED STATES").trim()].filter(Boolean);
    }
  }

  return propertyAddressLines(cleanAddress);
}

function cleanReportAddress(address: string) {
  return address
    .replace(/\s+/g, " ")
    .replace(/\s+UNITED STATES\b.*$/i, " UNITED STATES")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCodeReference(item: ReportItem) {
  const standard = printableReferenceValue(item.codeStandard, "NFPA 72");
  const editionValue = printableReferenceValue(item.codeEdition);
  const sectionValue = printableReferenceValue(item.codeSection);
  const edition = editionValue ? `${editionValue.replace(/\D/g, "") || editionValue} Edition` : "";
  const section = sectionValue ? `Section ${sectionValue}` : "";
  return [standard, edition, section].filter(Boolean).join(", ") || "Not used";
}

function formatServiceCenterCodeReference(comment: ServiceCenterComment) {
  const standard = printableReferenceValue(comment.codeStandard, "NFPA 72");
  const editionValue = printableReferenceValue(comment.codeEdition);
  const sectionValue = printableReferenceValue(comment.codeSection);
  const edition = editionValue ? `${editionValue.replace(/\D/g, "") || editionValue} Edition` : "";
  const section = sectionValue ? `Section ${sectionValue}` : "";
  return [standard, edition, section].filter(Boolean).join(", ") || "Not used";
}

function formatProjectAmount(value: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

function ReportHeader() {
  return (
    <header className="confirmation-header">
      <img className="confirmation-logo" src="/confirmation-logo.png" alt="UL Solutions" />
      <img className="confirmation-safety" src="/confirmation-safety.png" alt="Safety. Science. Transformation." />
    </header>
  );
}

function ReportFooter() {
  return (
    <footer className="confirmation-footer">
      <div>UL Solutions<br />333 Pfingsten Road<br />Northbrook, IL 60062<br />+1.887.854.3577<br /><b>UL.com/Solution</b></div>
      <div>UL LLC &copy; 2022. All rights reserved.</div>
    </footer>
  );
}

function primaryCertificate(audit: Audit) {
  return audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
}

function certificateCodeReference(audit: Audit) {
  const declaredStandard = primaryCertificate(audit)?.standardReferenced || audit.codeEdition || "";
  return {
    standard: declaredStandard.match(/\bNFPA\s*(70|71|72)\b/i)?.[0]?.replace(/\s+/g, " ").toUpperCase() || "NFPA 72",
    year: declaredStandard.match(/\b(19|20)\d{2}\b/)?.[0] || "",
  };
}

function referenceFiles(audits: Audit[]) {
  const values = new Set<string>();
  audits.forEach((audit) => {
    const certificate = primaryCertificate(audit);
    if (certificate?.fileNo) values.add(certificate.fileNo);
  });
  return Array.from(values).join(", ");
}

function reportFileName(group: AscGroup, date: Date, files: string, scn: string, reportKind: "standard" | "crzh") {
  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
  const categorySuffix = Array.from(new Set(group.audits.map((audit) => categoryOutputCode(primaryCertificate(audit)?.categoryCode || "")).filter(Boolean))).join("_");
  const prefix = reportKind === "crzh" ? "NI_Report" : "Report";
  return [`${prefix}_${date.getFullYear()}_${group.ascName.toUpperCase()}${cityStateCode(ascAddress) ? `-${cityStateCode(ascAddress)}` : ""}`, filesForName(files), `SCN${scn}`, categorySuffix].filter(Boolean).join("_");
}

function filesForName(files: string) {
  return files.split(",").map((value, index) => `${index ? " " : ""}${value.trim()}`).filter((value) => value.trim()).join("_");
}

function cityStateCode(address: string) {
  const match = address.match(/,\s*([^,]+),\s*([A-Z]{2}|[A-Za-z]+)\s+\d/i);
  if (!match) return "";
  const city = match[1].trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const state = match[2].toUpperCase() === "CALIFORNIA" ? "CA" : match[2].toUpperCase();
  return `${city}-${state}`;
}

function categoryOutputCode(category: string) {
  const codes: Record<string, string> = { UUJS: "FA", UUFX: "FD", CVSG: "MR", CRZH: "NI" };
  return codes[category.toUpperCase()] || category.toUpperCase();
}

function formatAscAddress(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function dateFromInput(value: string) {
  return value ? new Date(`${value}T12:00:00`) : new Date();
}

function todayInputValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}
