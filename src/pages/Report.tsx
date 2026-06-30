import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { Audit, AuditRow, DeviceTestRow, SignalLogRow } from "../lib/types";
import { ReportFindingFields, ReportFindingValue } from "../components/ReportFindingFields";

type ReportReview = "Signal Processing Review" | "Documentation Review" | "Installation Review";
type ReportSource = "signalLog" | "documentation" | "installation" | "deviceTests";

interface ReportItem {
  id: string;
  source: ReportSource;
  rowId: string;
  reviewType: ReportReview;
  category: string;
  note: string;
  finding: string;
  requiredAction: string;
  codeEdition: string;
  codeSection: string;
}

export function ReportPage({ auditorName }: { auditorName: string }) {
  const { ascKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const store = useAudits(auditorName);
  const group = groupByAsc(store.audits).find((item) => item.key === decodeURIComponent(ascKey));
  if (!group) return <main className="p-6">ASC not found.</main>;

  return (
    <ReportDocument
      group={group}
      auditorName={auditorName}
      pocName={searchParams.get("poc") || ""}
      scn={searchParams.get("scn") || ""}
      psn={searchParams.get("psn") || ""}
      onUpdateAudit={store.updateAudit}
    />
  );
}

function ReportDocument({ group, auditorName, pocName, scn, psn, onUpdateAudit }: { group: AscGroup; auditorName: string; pocName: string; scn: string; psn: string; onUpdateAudit: (audit: Audit) => void }) {
  const reportItems = useMemo(() => group.audits.flatMap((audit) => collectReportItems(audit).map((item) => ({ audit, item }))), [group.audits]);
  const incomplete = reportItems.filter(({ item }) => !item.finding.trim() || !item.requiredAction.trim() || !item.codeEdition.trim() || !item.codeSection.trim());
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
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/asc/${encodeURIComponent(group.key)}`}>
            <ArrowLeft size={16} /> Back to Properties
          </Link>
          <button className="min-h-10 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100" onClick={() => window.print()}>Print PDF</button>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy">Report Content Review</h2>
          <p className="mt-1 text-sm text-slate-600">{reportItems.length} variation{reportItems.length === 1 ? "" : "s"} found from completed field notes. Enter the report wording in the field note variation rows before printing.</p>
        </div>
        {reportItems.length ? (
          <div className="grid gap-3">
            {reportItems.map(({ audit, item }) => {
              const missing = !item.finding.trim() || !item.requiredAction.trim() || !item.codeEdition.trim() || !item.codeSection.trim();
              return (
                <div key={`${audit.id}-${item.id}`} className="grid gap-1 rounded-md border bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-navy">{audit.protectedProperty} - {item.reviewType} - {item.category}</div>
                  <div className="text-sm text-slate-600">{item.note || "No field note entered."}</div>
                  <div className={`text-sm font-medium ${missing ? "text-amber-800" : "text-emerald-700"}`}>{missing ? "Report wording needs attention." : "Ready for report."}</div>
                  <ReportFindingFields
                    value={reportValue(item)}
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
      <LateResponsePage auditorName={auditorName} />
      <AuditCommentsPage group={group} />
    </main>
  );
}

function ReportLetterPage({ group, pocName, date, files, scn, psn }: { group: AscGroup; pocName: string; date: Date; files: string; scn: string; psn: string }) {
  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
  return (
    <section className="report-page print-page bg-white text-black shadow-sm print:shadow-none">
      <ReportHeader />
      <div className="report-letter">
        <p>{formatLongDate(date)}</p>
        <p>{pocName}<br />{group.ascName}<br />{formatAscAddress(ascAddress || group.location)}</p>
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

function LateResponsePage({ auditorName }: { auditorName: string }) {
  return (
    <section className="report-page print-page bg-white text-black shadow-sm print:shadow-none">
      <div className="report-letter report-late">
        <p><b>LATE RESPONSE</b></p>
        <p>To preserve the integrity of the UL Mark, timely resolution of issues noted as not being in compliance with the applicable codes, standards and /or program requirements is critical. If your reply is not received within 30 days from the date of this letter, where applicable based on the Listing type(s), the following actions will occur:</p>
        <p>1. For certificate issuing Files, the ability to issue new or change existing protected property Certificates will be suspended.</p>
        <p>2. For monitoring facility Files, the ability to be designated as the monitoring location for alarm systems covered by newly issued Certificates will be suspended.</p>
        <p>If your reply has still not been received within the established timeline, a mandatory billable project may be opened to help defray the additional administrative expense associated with handling late responses.</p>
        <p>If your reply has still not been received within the established timeline, where applicable, the Listing(s) will be withdrawn and active Certificates will be canceled for the affected File(s).</p>
        <p>The procedure that we will follow for Late Response actions has been outlined in detail at this time so that there will be no misunderstanding of the procedure that will be followed.</p>
        <p>Please do not hesitate to contact this office if you have any questions.</p>
        <p className="report-signature">Sincerely,</p>
        <p><b>{auditorName || "Vahid Abbasi"}</b><br />Alarm System Auditor<br />Fire and Security Service Solutions<br />+1.510.358.6443<br />Vahid.Abbasikoohenjani@ul.com</p>
      </div>
    </section>
  );
}

function AuditCommentsPage({ group }: { group: AscGroup }) {
  const deficiencyNumbers = numberedDeficiencies(group);
  return (
    <section className="report-page report-comments-page print-page bg-white text-black shadow-sm print:shadow-none">
      <h1>Audit Comments</h1>
      <p className="report-comments-intro">Provide in your response to this report a brief description of the action taken to correct any issues noted below.</p>
      <div className="report-major-section">
        <h2>Service Center Comments</h2>
        <p>** No non-compliance issues were identified during the audit.</p>
      </div>
      <div className="report-major-section">
        <h2>Protected Property Comments</h2>
        {group.audits.map((audit) => {
          const certificate = primaryCertificate(audit);
          const signalItems = collectReportItems(audit).filter((item) => item.reviewType === "Signal Processing Review");
          const documentationItems = collectReportItems(audit).filter((item) => item.reviewType === "Documentation Review");
          const installationItems = collectReportItems(audit).filter((item) => item.reviewType === "Installation Review");
          const addressLines = propertyAddressLines(certificate?.propertyAddress || "");
          return (
            <div key={audit.id} className="report-audit-block">
              <p className="report-property">
                <b>SN: {audit.certificateNumber}</b><br />
                <b>CCN: {certificate?.categoryCode || ""}</b><br />
                <b>{audit.protectedProperty}</b><br />
                {addressLines.map((line) => <b key={line}>{line}<br /></b>)}
              </p>
              <SignalReportSection audit={audit} items={signalItems} numbers={deficiencyNumbers} />
              <ReportSection title="Documentation Review" items={documentationItems} emptyText="** No non-compliance issues were identified during the documentation review." numbers={deficiencyNumbers} auditId={audit.id} />
              <ReportSection title="Installation Review" items={installationItems} emptyText="** No non-compliance issues were identified during the installation review." numbers={deficiencyNumbers} auditId={audit.id} />
            </div>
          );
        })}
      </div>
      <p>END</p>
    </section>
  );
}

function SignalReportSection({ audit, items, numbers }: { audit: Audit; items: ReportItem[]; numbers: Map<string, number> }) {
  const counts = {
    alarm: audit.signalLog.filter((row) => row.signalType === "Alarm").length,
    supervisory: audit.signalLog.filter((row) => row.signalType === "Supervisory").length,
    trouble: audit.signalLog.filter((row) => row.signalType === "Trouble").length,
  };
  return (
    <div className="report-review-section">
      <h3>----Signal Processing Review----</h3>
      <p>A total of {counts.alarm} alarm, {counts.supervisory} supervisory, and {counts.trouble} trouble signal event(s) has been reviewed.</p>
      {!items.length ? <p>** No non-compliance issues were identified during the signal review.</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={numbers.get(deficiencyKey(audit.id, item.id)) || 0} />)}
    </div>
  );
}

function ReportSection({ title, items, emptyText, numbers, auditId }: { title: ReportReview; items: ReportItem[]; emptyText: string; numbers: Map<string, number>; auditId: string }) {
  return (
    <div className="report-review-section">
      <h3>----{title}----</h3>
      {!items.length ? <p>{emptyText}</p> : null}
      {items.map((item) => <ReportFinding key={item.id} item={item} number={numbers.get(deficiencyKey(auditId, item.id)) || 0} />)}
    </div>
  );
}

function ReportFinding({ item, number }: { item: ReportItem; number: number }) {
  return (
    <div className="report-finding">
      <h4>{number ? `${number}. ` : ""}{item.category}</h4>
      <p><span className="report-finding-label">Finding:</span> {item.finding}</p>
      <p><span className="report-finding-label">Required Action:</span> {item.requiredAction}</p>
      <p><span className="report-finding-label">Code Reference:</span> {formatCodeReference(item)}</p>
    </div>
  );
}

function collectReportItems(audit: Audit): ReportItem[] {
  return [
    ...audit.signalLog.filter((row) => row.handlingStatus === "VAR").map((row) => signalItem(row)),
    ...audit.documentation.filter((row) => row.status === "VAR").map((row) => checklistItem(row, "Documentation Review")),
    ...audit.installation.filter((row) => row.status === "VAR").map((row) => checklistItem(row, "Installation Review")),
    ...audit.deviceTests.filter((row) => row.result === "VAR").map((row) => deviceItem(row)),
  ];
}

function signalItem(row: SignalLogRow): ReportItem {
  return {
    id: `signal-${row.id}`,
    source: "signalLog",
    rowId: row.id,
    reviewType: "Signal Processing Review",
    category: [row.signalType, row.date, row.time].filter(Boolean).join(" - ") || "Signal event",
    note: row.notes || row.description,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function checklistItem(row: AuditRow, reviewType: ReportReview): ReportItem {
  return {
    id: `${reviewType}-${row.id}`,
    source: reviewType === "Documentation Review" ? "documentation" : "installation",
    rowId: row.id,
    reviewType,
    category: row.element || reviewType,
    note: row.notes,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function deviceItem(row: DeviceTestRow): ReportItem {
  return {
    id: `device-${row.id}`,
    source: "deviceTests",
    rowId: row.id,
    reviewType: "Installation Review",
    category: ["Device Test", row.deviceType, row.location || row.deviceId].filter(Boolean).join(" - "),
    note: row.notes,
    finding: row.reportFinding,
    requiredAction: row.reportRequiredAction,
    codeEdition: row.reportCodeEdition,
    codeSection: row.reportCodeSection,
  };
}

function reportValue(item: ReportItem): ReportFindingValue {
  return {
    reportFinding: item.finding,
    reportRequiredAction: item.requiredAction,
    reportCodeEdition: item.codeEdition,
    reportCodeSection: item.codeSection,
  };
}

function updateReportItem(audit: Audit, item: ReportItem, reportFields: Partial<ReportFindingValue>): Audit {
  const patch = {
    ...("reportFinding" in reportFields ? { reportFinding: reportFields.reportFinding || "" } : {}),
    ...("reportRequiredAction" in reportFields ? { reportRequiredAction: reportFields.reportRequiredAction || "" } : {}),
    ...("reportCodeEdition" in reportFields ? { reportCodeEdition: reportFields.reportCodeEdition || "" } : {}),
    ...("reportCodeSection" in reportFields ? { reportCodeSection: reportFields.reportCodeSection || "" } : {}),
  };
  const updatedAt = new Date().toISOString();
  if (item.source === "signalLog") {
    return { ...audit, updatedAt, signalLog: audit.signalLog.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  if (item.source === "documentation") {
    return { ...audit, updatedAt, documentation: audit.documentation.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  if (item.source === "installation") {
    return { ...audit, updatedAt, installation: audit.installation.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
  }
  return { ...audit, updatedAt, deviceTests: audit.deviceTests.map((row) => row.id === item.rowId ? { ...row, ...patch, updatedAt } : row) };
}

function numberedDeficiencies(group: AscGroup) {
  const numbers = new Map<string, number>();
  let nextNumber = 1;
  group.audits.forEach((audit) => {
    collectReportItems(audit).forEach((item) => {
      numbers.set(deficiencyKey(audit.id, item.id), nextNumber);
      nextNumber += 1;
    });
  });
  return numbers;
}

function deficiencyKey(auditId: string, itemId: string) {
  return `${auditId}:${itemId}`;
}

function propertyAddressLines(address: string) {
  const cleanAddress = address.replace(/\s+/g, " ").trim();
  if (!cleanAddress) return [];
  const parts = cleanAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [cleanAddress];
  return [parts[0], parts.slice(1).join(", ")];
}

function formatCodeReference(item: ReportItem) {
  const edition = item.codeEdition ? `${item.codeEdition.replace(/\D/g, "") || item.codeEdition} Edition` : "";
  const section = item.codeSection ? `Section ${item.codeSection}` : "";
  return ["NFPA 72", edition, section].filter(Boolean).join(", ").replace("NFPA 72,", "NFPA 72");
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
      <div>UL Solutions<br />333 Pfingsten Road<br />Northbrook, IL 600623<br />+1.887.854.3577<br /><b>UL.com/Solution</b></div>
      <div>UL LLC &copy; 2022. All rights reserved.</div>
    </footer>
  );
}

function primaryCertificate(audit: Audit) {
  return audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
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
