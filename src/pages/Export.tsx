import { useParams } from "react-router-dom";
import { ReactNode } from "react";
import { useAudits } from "../hooks/use-audits";
import { auditToCsv } from "../lib/export-csv";
import { Audit, AuditRow, DeviceTestRow, SignalLogRow, StatusCode } from "../lib/types";

const deviceRowsPage2 = 20;
const deviceRowsPage3 = 58;

export function ExportPage({ auditorName }: { auditorName: string }) {
  const { auditId } = useParams();
  const store = useAudits(auditorName);
  const audit = store.audits.find((item) => item.id === auditId);
  if (!audit) return <main className="p-6">Audit not found.</main>;
  const currentAudit = audit;

  function csv() {
    const blob = new Blob([auditToCsv(currentAudit)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentAudit.certificateNumber || currentAudit.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="min-h-11 rounded-md border px-4" onClick={csv}>Download CSV</button>
        <button className="min-h-11 rounded-md bg-navy px-4 font-semibold text-white" onClick={() => window.print()}>Print PDF</button>
      </div>
      <FieldNotesPage pageNumber={1} totalPages={3} audit={audit} showTitle>
        <SignalReview audit={audit} />
        <Checklist title="Documentation Reviewed:" rows={audit.documentation} />
        <CommentsBox comments={audit.comments} />
      </FieldNotesPage>
      <FieldNotesPage pageNumber={2} totalPages={3} audit={audit} showTitle>
        <Checklist
          title="Installation Reviewed:"
          rows={audit.installation}
          extraHeader={
            <>
              <span>Installation Matches Certificate Declarations?</span> <Check checked={audit.matchesCertificate} /> OK <Check checked={!audit.matchesCertificate} /> VAR
              <span className="ml-6">Certificate Displayed?</span> <Check checked={audit.certificateDisplayed} /> OK <Check checked={!audit.certificateDisplayed} /> VAR <Check checked={false} /> N/A
            </>
          }
        />
        <DeviceTable rows={audit.deviceTests.slice(0, deviceRowsPage2)} localSystem />
        <CommentsBox comments="" compact />
      </FieldNotesPage>
      <FieldNotesPage pageNumber={3} totalPages={3} audit={audit}>
        <DeviceTable rows={padDeviceRows(audit.deviceTests.slice(deviceRowsPage2), deviceRowsPage3)} includeNa />
      </FieldNotesPage>
    </main>
  );
}

function FieldNotesPage({ audit, children, pageNumber, totalPages, showTitle }: { audit: Audit; children: ReactNode; pageNumber: number; totalPages: number; showTitle?: boolean }) {
  return (
    <section className="print-page field-page bg-white text-black shadow-sm print:shadow-none">
      {showTitle ? <h1 className="field-title">Fire Alarm System Audit Field Notes Form</h1> : null}
      <Header audit={audit} />
      {children}
      {pageNumber > 1 ? <Footer pageNumber={pageNumber} totalPages={totalPages} /> : null}
    </section>
  );
}

function Header({ audit }: { audit: Audit }) {
  return (
    <div className="field-header">
      <div>Date: <Line value={audit.auditDate} width="1.15in" /> ASC: <Line value={audit.ascName} width="1.75in" /> File/SCN:<Line value={audit.fileScn} width="1.75in" /> Auditor:<Line value={audit.auditorName} width="1.55in" /></div>
      <div>Certificate #:<Line value={audit.certificateNumber} width="2.45in" /> PP:<Line value={audit.protectedProperty} width="4.55in" /></div>
    </div>
  );
}

function SignalReview({ audit }: { audit: Audit }) {
  const alarms = audit.signalLog.filter((row) => row.signalType === "Alarm").length;
  const supervisory = audit.signalLog.filter((row) => row.signalType === "Supervisory").length;
  const troubles = audit.signalLog.filter((row) => row.signalType === "Trouble").length;
  return (
    <table className="field-table signal-table">
      <tbody>
        <tr className="thick-row">
          <td colSpan={4} className="field-subhead">
            Signal Processing Reviewed: <Check checked={audit.signalLog.some(hasSignalContent)} /> YES <Check checked={!audit.signalLog.some(hasSignalContent)} /> NO
            <span className="ml-12">SIGNAL PROCESSING REVIEW PERIOD:</span><Line width="1.35in" /> TO: <Line width="1.35in" />
          </td>
        </tr>
        <tr className="thick-row">
          <td colSpan={4} className="field-subhead">
            # of Alarms (A) = {alarms || ""}<span className="ml-24"># of Supervisory (S) = {supervisory || ""}</span><span className="ml-24"># of Troubles (T) = {troubles || ""}</span>
            <span className="float-right">Auto Tests = <Check checked={false} /> OK <Check checked={false} /> VAR</span>
          </td>
        </tr>
        <tr className="field-table-head">
          <th className="w-[1.1in]">Signal Type<br />(A, S, T)</th>
          <th className="w-[0.85in]">Date</th>
          <th className="w-[0.75in]">Time</th>
          <th>Comments and / or Signals Not Properly Handled - Variations shall be included in report</th>
        </tr>
        {padSignalRows(audit.signalLog, 9).map((row, index) => (
          <tr key={row.id || index} className="field-small-row">
            <td>{signalCode(row.signalType)}</td>
            <td>{row.date}</td>
            <td>{row.time}</td>
            <td>{[row.description, row.notes].filter(Boolean).join(" - ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Checklist({ title, rows, extraHeader }: { title: string; rows: AuditRow[]; extraHeader?: ReactNode }) {
  return (
    <table className="field-table checklist-table">
      <tbody>
        <tr className="thick-row">
          <td colSpan={6} className="field-subhead">
            {title} <Check checked={rows.some((row) => row.status)} /> YES <Check checked={!rows.some((row) => row.status)} /> NO
            {extraHeader ? <span className="ml-8">{extraHeader}</span> : <span className="ml-12">KEY: <b>OK</b> = In Conformance <span className="ml-4"><b>VAR</b> = Variations Noted</span> <span className="ml-4"><b>N/A</b> = Not Applicable</span> <span className="ml-4"><b>N/R</b> = Not Reviewed</span></span>}
          </td>
        </tr>
        <tr className="field-table-head">
          <th className="w-[1.72in] text-left">Element</th>
          <th className="vertical-head">OK</th>
          <th className="vertical-head">VAR</th>
          <th className="vertical-head">N/A</th>
          <th className="vertical-head">N/R</th>
          <th className="text-left">Comments and / or Variations Noted - Variations shall be included in report</th>
        </tr>
        {rows.map((row) => (
          <tr key={row.id} className={row.element.startsWith("NFPA") ? "code-row" : "field-small-row"}>
            <td><span className={row.element.startsWith("NFPA") ? "code-label" : ""}>{row.element}</span></td>
            <td>{row.element.startsWith("NFPA") ? "" : <StatusCheck status={row.status} match="OK" />}</td>
            <td>{row.element.startsWith("NFPA") ? "" : <StatusCheck status={row.status} match="VAR" />}</td>
            <td>{row.element.startsWith("NFPA") ? "" : <StatusCheck status={row.status} match="NA" />}</td>
            <td>{row.element.startsWith("NFPA") ? "" : <StatusCheck status={row.status} match="NR" />}</td>
            <td>{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeviceTable({ rows, localSystem, includeNa }: { rows: DeviceTestRow[]; localSystem?: boolean; includeNa?: boolean }) {
  return (
    <table className="field-table device-table">
      <tbody>
        <tr className="field-table-head">
          <th className="w-[2in] text-left">Device Type Tested / Location</th>
          <th>F</th>
          <th>A</th>
          <th>S</th>
          <th>T</th>
          <th colSpan={4} className="text-left">F = Functional&nbsp;&nbsp;&nbsp; A = Alarm&nbsp;&nbsp;&nbsp; S = Supervisory&nbsp;&nbsp;&nbsp; T = Trouble {localSystem ? <>N/A <Check checked={false} /> = Local System</> : null}</th>
        </tr>
        {rows.map((row, index) => (
          <tr key={row.id || index} className="device-row">
            <td>{[row.deviceType, row.location, row.deviceId].filter(Boolean).join(" / ")}</td>
            <td><Check checked={!!row.functional} /></td>
            <td><Check checked={!!row.alarm} /></td>
            <td><Check checked={!!row.supervisory} /></td>
            <td><Check checked={!!row.trouble} /></td>
            <td>Trip Time: {row.tripTime}</td>
            <td>Time Rcvd{localSystem ? " or N/A" : ""}: {row.timeReceived}</td>
            <td><StatusCheck status={row.result} match="OK" /> OK&nbsp;&nbsp; <StatusCheck status={row.result} match="VAR" /> VAR</td>
            <td>{includeNa ? <><Check checked={!!row.notApplicable} /> N/A</> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CommentsBox({ comments, compact }: { comments: string; compact?: boolean }) {
  return (
    <div className={`comments-box ${compact ? "comments-box-compact" : ""}`}>
      <b>Additional Comments</b>
      <div>{comments}</div>
    </div>
  );
}

function Footer({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) {
  return (
    <footer className="field-footer">
      <span>01-CA-F0851 Alarm Certificate Service -Fire Alarm System Audit Field Notes- Issue 1.0<br />Controlled Document: Direct Request for Revision to Alarm Certificate Service Program Owner</span>
      <span>Page {pageNumber} of {totalPages}</span>
    </footer>
  );
}

function Line({ value = "", width }: { value?: string; width: string }) {
  return <span className="field-line" style={{ width }}>{value}</span>;
}

function Check({ checked }: { checked: boolean }) {
  return <span className="field-check">{checked ? "☑" : "☐"}</span>;
}

function StatusCheck({ status, match }: { status: StatusCode | ""; match: StatusCode }) {
  return <Check checked={status === match} />;
}

function hasSignalContent(row: SignalLogRow) {
  return Boolean(row.signalType || row.date || row.time || row.description || row.notes);
}

function signalCode(signalType: SignalLogRow["signalType"]) {
  if (signalType === "Alarm") return "A";
  if (signalType === "Supervisory") return "S";
  if (signalType === "Trouble") return "T";
  return "";
}

function padSignalRows(rows: SignalLogRow[], size: number) {
  return [...rows, ...Array.from({ length: Math.max(0, size - rows.length) }, (_, index) => ({ id: `blank-signal-${index}`, signalType: "" as const, date: "", time: "", description: "", notes: "", updatedAt: "" }))].slice(0, size);
}

function padDeviceRows(rows: DeviceTestRow[], size: number) {
  return [...rows, ...Array.from({ length: Math.max(0, size - rows.length) }, (_, index) => ({ id: `blank-device-${index}`, deviceType: "", location: "", deviceId: "", signalType: "" as const, functional: false, alarm: false, supervisory: false, trouble: false, notApplicable: false, tripTime: "", timeReceived: "", signalReceived: false, restoralReceived: false, localIndication: false, result: "" as const, notes: "", photos: [], updatedAt: "" }))].slice(0, size);
}
