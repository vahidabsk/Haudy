import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { loadAscDocuments, saveAscDocument, ServiceCenterComment, updateAscDocumentDraft } from "../lib/asc-documents";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { saveCurrentDocumentSnapshot, storageDetailsFromAsc } from "../lib/local-document-storage";
import { loadPhoto } from "../lib/photo-store";
import { Audit, AuditRow, Auditor, DeviceTestRow, ParsedCertificate, ReportFindingEntry, SignalLogRow } from "../lib/types";
import { ReportFindingFields, ReportFindingValue } from "../components/ReportFindingFields";

type ReportReview = "Signal Processing Review" | "Documentation Review" | "Installation Review";
type ReportSource = "signalLog" | "documentation" | "installation" | "deviceTests" | "sectionReview";

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
  const auditorName = auditor?.name || "";
  const store = useAudits(auditorName);
  const group = groupByAsc(store.audits).find((item) => item.key === decodeURIComponent(ascKey));
  if (!group) return <main className="p-6">ASC not found.</main>;

  return (
    <ReportDocument
      group={group}
      ascKey={decodeURIComponent(ascKey)}
      auditor={auditor}
      pocName={searchParams.get("poc") || ""}
      scn={searchParams.get("scn") || ""}
      psn={searchParams.get("psn") || ""}
      onUpdateAudit={store.updateAudit}
    />
  );
}

function ReportDocument({ group, ascKey, auditor, pocName, scn, psn, onUpdateAudit }: { group: AscGroup; ascKey: string; auditor: Auditor | null; pocName: string; scn: string; psn: string; onUpdateAudit: (audit: Audit) => void }) {
  const [savedAt, setSavedAt] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const savedReportDraft = loadAscDocuments()[ascKey]?.report;
  const [serviceCenterHasComment, setServiceCenterHasComment] = useState(savedReportDraft?.serviceCenterHasComment ?? false);
  const [serviceCenterComments, setServiceCenterComments] = useState<ServiceCenterComment[]>(() => serviceCenterCommentsFromDraft(savedReportDraft));
  const reportItems = useMemo(() => group.audits.flatMap((audit) => collectReportItems(audit).map((item) => ({ audit, item }))), [group.audits]);
  const incomplete = reportItems.filter(({ item }) => !item.finding.trim() || !item.requiredAction.trim() || !(item.codeStandard || "NFPA 72").trim() || !item.codeEdition.trim() || !item.codeSection.trim());
  const serviceCenterIncomplete = serviceCenterHasComment && serviceCenterComments.some((comment) => !comment.finding.trim() || !comment.requiredAction.trim() || !(comment.codeStandard || "NFPA 72").trim() || !comment.codeEdition.trim() || !comment.codeSection.trim());
  const today = new Date();
  const fileReferences = referenceFiles(group.audits);
  const reportName = reportFileName(group, today, fileReferences, scn);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = reportName;
    return () => {
      document.title = previousTitle;
    };
  }, [reportName]);

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 grid gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/">
              <ArrowLeft size={16} /> Back to ASCs
            </Link>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/asc/${encodeURIComponent(group.key)}`}>
              Back to Properties
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-10 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100" onClick={() => window.print()}>Print PDF</button>
            <button
              className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              onClick={async () => {
                const next = saveAscDocument(ascKey, "report", { pocName, scn, psn, serviceCenterHasComment, serviceCenterComments });
                setSavedAt(next[ascKey]?.report?.updatedAt || "");
                try {
                  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
                  await saveCurrentDocumentSnapshot(storageDetailsFromAsc({ year: today.getFullYear().toString(), ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Report", fileName: reportName }));
                  setFolderMessage("Saved to Haudy Storage.");
                } catch (error) {
                  setFolderMessage(error instanceof Error ? error.message : "Could not save to folder.");
                }
              }}
            >
              Save Report
            </button>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy">Report Content Review</h2>
          <p className="mt-1 text-sm text-slate-600">{reportItems.length} variation{reportItems.length === 1 ? "" : "s"} found from completed field notes. Enter the report wording in the field note variation rows before printing.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold text-navy">POC:</span> {pocName || ""}
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold text-navy">SCN:</span> {scn || ""}
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-semibold text-navy">PSN:</span> {psn || ""}
          {savedAt ? <div className="mt-1 text-xs text-emerald-700">Saved.</div> : null}
          {folderMessage ? <div className="mt-1 text-xs text-slate-600">{folderMessage}</div> : null}
        </div>
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Does the service center have any comments?
            <select
              className="min-h-11 rounded-md border bg-white px-3"
              value={serviceCenterHasComment ? "YES" : "NO"}
              onChange={(event) => {
                const nextHasComment = event.target.value === "YES";
                setServiceCenterHasComment(nextHasComment);
                const nextComments = nextHasComment && !serviceCenterComments.length ? [blankServiceCenterComment()] : serviceCenterComments;
                if (nextComments !== serviceCenterComments) setServiceCenterComments(nextComments);
                updateAscDocumentDraft(ascKey, "report", { pocName, scn, psn, serviceCenterHasComment: nextHasComment, serviceCenterComments: nextComments });
              }}
            >
              <option value="NO">No</option>
              <option value="YES">Yes</option>
            </select>
          </label>
          {serviceCenterHasComment ? (
            <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-amber-950">Service Center Comments</div>
                <button
                  type="button"
                  className="min-h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  onClick={() => updateServiceCenterComments([...serviceCenterComments, blankServiceCenterComment()])}
                >
                  Add Finding
                </button>
              </div>
              {serviceCenterComments.map((comment, index) => (
                <div key={comment.id} className="grid gap-2 rounded-md border border-amber-200 bg-white/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-amber-950">
                    <span>Service Center Comment {index + 1}</span>
                    {serviceCenterComments.length > 1 ? (
                      <button
                        type="button"
                        className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => updateServiceCenterComments(serviceCenterComments.filter((item) => item.id !== comment.id))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <ReportFindingFields
                    value={serviceCenterReportValue(comment)}
                    showCsisHelp
                    onChange={(reportFields) => updateServiceCenterComment(comment.id, serviceCenterPatch(reportFields))}
                  />
                </div>
              ))}
              {serviceCenterIncomplete ? <div className="text-sm font-medium text-amber-800">Service center comment needs attention.</div> : <div className="text-sm font-medium text-emerald-700">Service center comment ready for report.</div>}
            </div>
          ) : null}
        </div>
        {reportItems.length ? (
          <div className="grid gap-3">
            {reportItems.map(({ audit, item }) => {
              const missing = !item.finding.trim() || !item.requiredAction.trim() || !(item.codeStandard || "NFPA 72").trim() || !item.codeEdition.trim() || !item.codeSection.trim();
              const certificateCode = certificateCodeReference(audit);
              return (
                <div key={`${audit.id}-${item.id}`} className="grid gap-1 rounded-md border bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-navy">{audit.protectedProperty} - {item.reviewType} - {item.category}</div>
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                  {certificateCode.year ? <div className="text-xs font-medium text-slate-500">Certificate declared: {certificateCode.standard}, {certificateCode.year} Edition</div> : null}
                  {item.note ? (
                    <div className="text-sm font-medium text-red-700">
                      <span className="font-bold">Field Note:</span> {item.note}
                    </div>
                  ) : (
                    <div className="text-sm italic text-slate-500">Field note left empty.</div>
                  )}
                  <div className={`text-sm font-medium ${missing ? "text-amber-800" : "text-emerald-700"}`}>{missing ? "Report wording needs attention." : "Ready for report."}</div>
                  <ReportFindingFields
                    value={reportValue(item)}
                    showCsisHelp
                    helpStandard={certificateCode.standard}
                    helpYear={certificateCode.year}
                    onChange={(reportFields) => onUpdateAudit(updateReportItem(audit, item, reportFields))}
                  />
                </div>
              );
            })}
            {incomplete.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{incomplete.length} variation{incomplete.length === 1 ? "" : "s"} will print with blank report fields until completed.</div> : null}
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No variations found for this ASC.</div>
        )}
      </div>

      <ReportLetterPage group={group} pocName={pocName} date={today} files={fileReferences} scn={scn} psn={psn} />
      <LateResponsePage auditor={auditor} />
      <AuditCommentsPage group={group} serviceCenterHasComment={serviceCenterHasComment} serviceCenterComments={serviceCenterComments} />
    </main>
  );

  function updateServiceCenterComments(nextComments: ServiceCenterComment[]) {
    setServiceCenterComments(nextComments);
    updateAscDocumentDraft(ascKey, "report", { pocName, scn, psn, serviceCenterHasComment, serviceCenterComments: nextComments });
  }

  function updateServiceCenterComment(id: string, patch: Partial<ServiceCenterComment>) {
    updateServiceCenterComments(serviceCenterComments.map((comment) => (comment.id === id ? { ...comment, ...patch } : comment)));
  }
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
    ...("reportCodeStandard" in reportFields ? { codeStandard: reportFields.reportCodeStandard || "NFPA 72" } : {}),
    ...("reportCodeEdition" in reportFields ? { codeEdition: reportFields.reportCodeEdition || "" } : {}),
    ...("reportCodeSection" in reportFields ? { codeSection: reportFields.reportCodeSection || "" } : {}),
  };
}

function LateResponsePage({ auditor }: { auditor: Auditor | null }) {
  return (
    <section className="report-page report-fixed-page print-page bg-white text-black shadow-sm print:shadow-none">
      <ReportHeader />
      <div className="report-letter report-late">
        <p><b>LATE RESPONSE</b></p>
        <p>To preserve the integrity of the UL Mark, timely resolution of issues noted as not being in compliance with the applicable codes, standards and /or program requirements is critical. If your reply is not received within 30 days from the date of this letter, where applicable based on the Listing type(s), the following actions will occur:</p>
        <ol className="report-late-list">
          <li>For certificate issuing Files, the ability to issue new or change existing protected property Certificates will be suspended.</li>
          <li>For monitoring facility Files, the ability to be designated as the monitoring location for alarm systems covered by newly issued Certificates will be suspended.</li>
          <li>A mandatory billable project in the amount of <mark className="report-highlight">$1436</mark> will be opened to help defray the additional administrative expense associated with handling late responses.</li>
        </ol>
        <p>If your reply has still not been received within 55 days of the date of this letter the following actions will occur:</p>
        <ol className="report-late-list">
          <li>For certificate issuing Files, the Listing(s) will be withdrawn, and all active Certificates will be canceled for the affected File(s).</li>
          <li>For monitoring facility Files, the Listing(s) will be withdrawn, and all active Certificates naming your organization as the monitoring location will be cancelled for the affected File(s).</li>
        </ol>
        <p>The procedure that we will follow for Late Response actions has been outlined in detail at this time so that there will be no misunderstanding of the procedure that will be followed.</p>
        <p>Please do not hesitate to contact this office if you have any questions.</p>
        <p className="report-signature">Sincerely,</p>
        <p><b>{auditor?.name || ""}</b><br />{auditor?.title || ""}<br />{auditor?.department || ""}<br />{auditor?.phone || ""}<br />{auditor?.email || ""}</p>
      </div>
    </section>
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
  return (
    <div className="report-review-section">
      <h3>----Signal Processing Review----</h3>
      <p className="report-aligned-note">A total of {counts.alarm} alarm, {counts.supervisory} supervisory, and {counts.trouble} trouble signal event(s) has been reviewed.</p>
      {!items.length ? <p className="report-aligned-note">** No non-compliance issues were identified during the signal review.</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={takeNumber()} />)}
    </div>
  );
}

function ReportSection({ title, items, emptyText, takeNumber }: { title: ReportReview; items: ReportItem[]; emptyText: string; takeNumber: () => number }) {
  return (
    <div className="report-review-section">
      <h3>----{title}----</h3>
      {!items.length ? <p className="report-aligned-note">{emptyText}</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={takeNumber()} />)}
    </div>
  );
}

function ReportFinding({ item, number }: { item: ReportItem; number: number }) {
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
  return Boolean(item.finding.trim() || item.requiredAction.trim() || item.codeEdition.trim() || item.codeSection.trim() || (item.codeStandard.trim() && item.codeStandard.trim() !== "NFPA 72"));
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
  const items: ReportItem[] = [];
  if (audit.matchesCertificateStatus === "VAR") {
    items.push({
      id: `certificate-match-${audit.id}`,
      baseId: `certificate-match-${audit.id}`,
      source: "installation",
      rowId: `certificate-match-${audit.id}`,
      reviewType: "Installation Review",
      category: "Certificate - Installation Matches Certificate Declarations",
      note: "",
      finding: audit.certificateMatchReportFinding,
      requiredAction: audit.certificateMatchReportRequiredAction,
      codeStandard: audit.certificateMatchReportCodeStandard,
      codeEdition: audit.certificateMatchReportCodeEdition,
      codeSection: audit.certificateMatchReportCodeSection,
    });
  }
  if (audit.certificateDisplayedStatus === "VAR") {
    items.push({
      id: `certificate-displayed-${audit.id}`,
      baseId: `certificate-displayed-${audit.id}`,
      source: "installation",
      rowId: `certificate-displayed-${audit.id}`,
      reviewType: "Installation Review",
      category: "Certificate - Certificate Displayed",
      note: "",
      finding: audit.certificateDisplayedReportFinding,
      requiredAction: audit.certificateDisplayedReportRequiredAction,
      codeStandard: audit.certificateDisplayedReportCodeStandard,
      codeEdition: audit.certificateDisplayedReportCodeEdition,
      codeSection: audit.certificateDisplayedReportCodeSection,
    });
  }
  return items;
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

function updateReportItem(audit: Audit, item: ReportItem, reportFields: Partial<ReportFindingValue>): Audit {
  const patch = {
    ...("reportFinding" in reportFields ? { reportFinding: reportFields.reportFinding || "" } : {}),
    ...("reportRequiredAction" in reportFields ? { reportRequiredAction: reportFields.reportRequiredAction || "" } : {}),
    ...("reportCodeStandard" in reportFields ? { reportCodeStandard: reportFields.reportCodeStandard || "NFPA 72" } : {}),
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
      ...("reportCodeStandard" in reportFields ? { codeStandard: reportFields.reportCodeStandard || "NFPA 72" } : {}),
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
    if (item.rowId.startsWith("certificate-match-")) {
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
  const edition = item.codeEdition ? `${item.codeEdition.replace(/\D/g, "") || item.codeEdition} Edition` : "";
  const section = item.codeSection ? `Section ${item.codeSection}` : "";
  const standard = item.codeStandard || "NFPA 72";
  return [standard, edition, section].filter(Boolean).join(", ");
}

function formatServiceCenterCodeReference(comment: ServiceCenterComment) {
  const edition = comment.codeEdition ? `${comment.codeEdition.replace(/\D/g, "") || comment.codeEdition} Edition` : "";
  const section = comment.codeSection ? `Section ${comment.codeSection}` : "";
  const standard = comment.codeStandard || "NFPA 72";
  return [standard, edition, section].filter(Boolean).join(", ");
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
    if (certificate?.ccn) values.add(certificate.ccn);
  });
  return Array.from(values).join(", ");
}

function reportFileName(group: AscGroup, date: Date, files: string, scn: string) {
  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
  const categorySuffix = Array.from(new Set(group.audits.map((audit) => categoryOutputCode(primaryCertificate(audit)?.categoryCode || "")).filter(Boolean))).join("_");
  return [`Report_${date.getFullYear()}_${group.ascName.toUpperCase()}${cityStateCode(ascAddress) ? `-${cityStateCode(ascAddress)}` : ""}`, filesForName(files), `SCN${scn}`, categorySuffix].filter(Boolean).join("_");
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
  const codes: Record<string, string> = { UUJS: "FA", UUFX: "FD" };
  return codes[category.toUpperCase()] || category.toUpperCase();
}

function formatAscAddress(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
