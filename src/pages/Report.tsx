import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { Audit } from "../lib/types";
import { bestFinding, collectVariationCandidates, VariationCandidate } from "../lib/report-findings";

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
    />
  );
}

function ReportDocument({ group, auditorName, pocName, scn, psn }: { group: AscGroup; auditorName: string; pocName: string; scn: string; psn: string }) {
  const candidates = useMemo(() => collectVariationCandidates(group.audits), [group.audits]);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.matches[0]?.finding.Finding_ID || ""])));
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

  const numbered = candidates.map((candidate, index) => ({
    candidate,
    finding: bestFinding(candidate, selected[candidate.id]),
    number: index + 1,
  })).filter((item) => item.finding);

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
          <h2 className="text-xl font-bold text-navy">Report Findings Review</h2>
          <p className="mt-1 text-sm text-slate-600">{candidates.length} variation{candidates.length === 1 ? "" : "s"} found. Haudy selected the best match from the findings database.</p>
        </div>
        {candidates.length ? (
          <div className="grid gap-3">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="grid gap-2 rounded-md border bg-slate-50 p-3">
                <div className="text-sm font-semibold text-navy">{candidate.audit.protectedProperty} - {candidate.reviewType} - {candidate.category}</div>
                <div className="text-sm text-slate-600">{candidate.notes || "No note entered."}</div>
                <select className="min-h-11 rounded-md border bg-white px-3 text-sm" value={selected[candidate.id] || ""} onChange={(event) => setSelected((current) => ({ ...current, [candidate.id]: event.target.value }))}>
                  {candidate.matches.map((match) => (
                    <option key={match.finding.Finding_ID} value={match.finding.Finding_ID}>
                      {match.finding.Finding_ID} - {match.finding.Category || match.finding.Review_Type} - {match.finding.Finding_Type}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No variations found for this ASC.</div>
        )}
      </div>

      <ReportLetterPage group={group} pocName={pocName} date={today} files={fileReferences} scn={scn} psn={psn} />
      <LateResponsePage auditorName={auditorName} />
      <AuditCommentsPage group={group} numbered={numbered} />
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

function AuditCommentsPage({ group, numbered }: { group: AscGroup; numbered: Array<{ candidate: VariationCandidate; finding: NonNullable<ReturnType<typeof bestFinding>>; number: number }> }) {
  return (
    <section className="report-page report-comments-page print-page bg-white text-black shadow-sm print:shadow-none">
      <h1>Audit Comments</h1>
      <p className="report-comments-intro">Provide in your response to this report a brief description of the action taken to correct any issues noted below.</p>
      {group.audits.map((audit) => {
        const auditFindings = numbered.filter((item) => item.candidate.audit.id === audit.id);
        const certificate = primaryCertificate(audit);
        return (
          <div key={audit.id} className="report-audit-block">
            <p className="report-property"><b>SN: {audit.certificateNumber}</b><br /><b>CCN: {certificate?.categoryCode || ""}</b><br /><b>{audit.protectedProperty}</b><br /><b>{certificate?.propertyAddress || ""}</b></p>
            {["Documentation Review", "Installation Review", "Signal Processing Review", "Device Test"].map((section) => (
              <ReportSection key={section} title={section} items={auditFindings.filter((item) => item.candidate.reviewType === section)} />
            ))}
          </div>
        );
      })}
      <p>END</p>
    </section>
  );
}

function ReportSection({ title, items }: { title: string; items: Array<{ candidate: VariationCandidate; finding: NonNullable<ReturnType<typeof bestFinding>>; number: number }> }) {
  if (!items.length && title !== "Documentation Review" && title !== "Installation Review") return null;
  return (
    <div className="report-review-section">
      <h2>----{title}----</h2>
      {!items.length ? <p>** No non-compliance issues were identified during the audit.</p> : null}
      {items.map((item) => (
        <div key={item.candidate.id} className="report-finding">
          <h3>{item.candidate.category}</h3>
          <p>{item.number}. {item.finding.Standard} {item.finding.Edition} Edition,<br />{item.finding.Code_Section} {item.finding.Code_Text}</p>
          <p><b><u>Findings:</u></b> {item.finding.Finding}</p>
          <p><b><u>Required Action:</u></b> {item.finding.Required_Action}</p>
        </div>
      ))}
    </div>
  );
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
