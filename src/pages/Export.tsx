import { useParams } from "react-router-dom";
import { ReactNode } from "react";
import { useAudits } from "../hooks/use-audits";
import { auditToCsv } from "../lib/export-csv";
import { loadPhoto } from "../lib/photo-store";
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

  const attachmentRows = photoAttachments(audit);
  const totalPages = 3 + Math.ceil(attachmentRows.length / 4);

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="min-h-11 rounded-md border px-4" onClick={csv}>Download CSV</button>
        <button className="min-h-11 rounded-md bg-navy px-4 font-semibold text-white" onClick={() => window.print()}>Print PDF</button>
      </div>
      <FieldNotesPage pageNumber={1} totalPages={totalPages} audit={audit} showTitle>
        <SignalReview audit={audit} />
        <Checklist title="Documentation Reviewed:" rows={audit.documentation} codeEdition={audit.codeEdition} reviewed={audit.documentationReviewed} />
        <CommentsBox comments={audit.comments} />
      </FieldNotesPage>
      <FieldNotesPage pageNumber={2} totalPages={totalPages} audit={audit} showTitle>
        <Checklist
          title="Installation Reviewed:"
          rows={audit.installation}
          codeEdition={audit.codeEdition}
          reviewed={audit.installationReviewed}
          extraHeader={
            <>
              <span>Installation Matches Certificate Declarations?</span> <StatusCheck status={audit.matchesCertificateStatus} match="OK" /> OK <StatusCheck status={audit.matchesCertificateStatus} match="VAR" /> VAR
              <span className="ml-6">Certificate Displayed?</span> <StatusCheck status={audit.certificateDisplayedStatus} match="OK" /> OK <StatusCheck status={audit.certificateDisplayedStatus} match="VAR" /> VAR <StatusCheck status={audit.certificateDisplayedStatus} match="NA" /> N/A
            </>
          }
        />
        <DeviceTable rows={padDeviceRows(audit.deviceTests.slice(0, deviceRowsPage2), deviceRowsPage2)} localSystem={audit.deviceSystemLocal} />
        <CommentsBox comments="" compact />
      </FieldNotesPage>
      <FieldNotesPage pageNumber={3} totalPages={totalPages} audit={audit}>
        <DeviceTable rows={padDeviceRows(audit.deviceTests.slice(deviceRowsPage2), deviceRowsPage3)} localSystem={audit.deviceSystemLocal} continued />
      </FieldNotesPage>
      {chunk(attachmentRows, 4).map((rows, index) => (
        <AttachmentPage key={index} audit={audit} rows={rows} pageNumber={4 + index} totalPages={totalPages} />
      ))}
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
      <div className="field-header-row field-header-row-top">
        <span className="field-header-item">Date:<Line value={audit.auditDate} width="auto" /></span>
        <span className="field-header-item">ASC:<Line value={audit.ascName} width="auto" /></span>
        <span className="field-header-item">File/SCN:<Line value={audit.fileScn} width="auto" /></span>
        <span className="field-header-item">Auditor:<Line value={audit.auditorName} width="auto" /></span>
      </div>
      <div className="field-header-row field-header-row-bottom">
        <span className="field-header-item">Certificate #:<Line value={audit.certificateNumber} width="auto" /></span>
        <span className="field-header-item">PP:<Line value={audit.protectedProperty} width="auto" /></span>
      </div>
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
            Signal Processing Reviewed: <Check checked={audit.signalProcessingReviewed} /> YES <Check checked={!audit.signalProcessingReviewed} /> NO
            <span className="ml-12">SIGNAL PROCESSING REVIEW PERIOD:</span><Line value={audit.signalReviewStart} width="1.35in" /> TO: <Line value={audit.signalReviewEnd} width="1.35in" />
          </td>
        </tr>
        <tr className="thick-row">
          <td colSpan={4} className="field-subhead">
            # of Alarms (A) = {alarms || ""}<span className="ml-24"># of Supervisory (S) = {supervisory || ""}</span><span className="ml-24"># of Troubles (T) = {troubles || ""}</span>
            <span className="float-right">Auto Tests = <StatusCheck status={audit.autoTestsStatus} match="OK" /> OK <StatusCheck status={audit.autoTestsStatus} match="VAR" /> VAR</span>
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

function Checklist({ title, rows, codeEdition, reviewed, extraHeader }: { title: string; rows: AuditRow[]; codeEdition: string; reviewed: boolean; extraHeader?: ReactNode }) {
  const displayRows = checklistRows(title, rows);
  return (
    <table className="field-table checklist-table">
      <tbody>
        <tr className="thick-row">
          <td colSpan={6} className="field-subhead">
            {title} <Check checked={reviewed} /> YES <Check checked={!reviewed} /> NO
            {title.startsWith("Documentation") ? <span className="ml-10">KEY:&nbsp;&nbsp;&nbsp; OK = In Conformance&nbsp;&nbsp;&nbsp; VAR = Variations Noted&nbsp;&nbsp;&nbsp; N/A = Not Applicable&nbsp;&nbsp;&nbsp; N/R = Not Reviewed</span> : null}
            {extraHeader ? <span className="ml-8">{extraHeader}</span> : null}
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
        <tr className="code-row">
          <td><span className="code-label">{codeEdition || "NFPA 72"}</span></td>
          <td />
          <td />
          <td />
          <td />
          <td />
        </tr>
        {displayRows.map((row) => (
          <tr key={row.id} className="field-small-row">
            <td>{row.element}</td>
            <td><StatusCheck status={row.status} match="OK" /></td>
            <td><StatusCheck status={row.status} match="VAR" /></td>
            <td><StatusCheck status={row.status} match="NA" /></td>
            <td><StatusCheck status={row.status} match="NR" /></td>
            <td>{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function checklistRows(title: string, rows: AuditRow[]) {
  const targetSize = title.startsWith("Documentation") ? 12 : title.startsWith("Installation") ? 18 : rows.length;
  const baseRows = title.startsWith("Documentation") && !rows.some((row) => row.element === "Codes and Standards")
    ? [...rows, blankChecklistRow("Codes and Standards")]
    : rows;
  const visibleRows = baseRows.filter((row) => row.element.trim() || row.status || row.notes);
  return [
    ...visibleRows,
    ...Array.from({ length: Math.max(0, targetSize - visibleRows.length) }, (_, index) => blankChecklistRow("", index)),
  ];
}

function blankChecklistRow(element: string, index = 0): AuditRow {
  return { id: `blank-checklist-${element || index}`, element, status: "", notes: "", photos: [], updatedAt: "", updatedBy: "" };
}

function DeviceTable({ rows, localSystem, continued }: { rows: DeviceTestRow[]; localSystem?: boolean; continued?: boolean }) {
  return (
    <table className="field-table device-table">
      <tbody>
        <tr className="field-table-head">
          <th className="w-[2in] text-left">Device Type Tested / Location</th>
          <th>F</th>
          <th>A</th>
          <th>S</th>
          <th>T</th>
          <th colSpan={3} className="text-left">
            F = Functional&nbsp;&nbsp;&nbsp; A = Alarm&nbsp;&nbsp;&nbsp; S = Supervisory&nbsp;&nbsp;&nbsp; T = Trouble
            {!continued ? <span className="float-right">N/A <Check checked={!!localSystem} /> = Local System</span> : null}
          </th>
        </tr>
        {rows.map((row, index) => {
          const completed = hasDeviceContent(row);
          return (
            <tr key={row.id || index} className="device-row">
              <td>{[row.deviceType, row.location, row.deviceId].filter(Boolean).join(" / ")}</td>
              <td><Check checked={!!row.functional} /></td>
              <td><Check checked={!!row.alarm} /></td>
              <td><Check checked={!!row.supervisory} /></td>
              <td><Check checked={!!row.trouble} /></td>
              <td>Trip Time: {row.tripTime}</td>
              <td>
                Time Rcvd{!continued ? " or N/A" : ""}:
                {!continued ? <>&nbsp;<Check checked={!!localSystem && completed} /></> : null}
                {localSystem && completed ? "" : row.timeReceived}
              </td>
              <td>
                <StatusCheck status={row.result} match="OK" /> OK&nbsp;&nbsp; <StatusCheck status={row.result} match="VAR" /> VAR
                {continued ? <>&nbsp;&nbsp; <Check checked={!!localSystem && completed} /> N/A</> : null}
              </td>
            </tr>
          );
        })}
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

function AttachmentPage({ audit, rows, pageNumber, totalPages }: { audit: Audit; rows: PhotoAttachment[]; pageNumber: number; totalPages: number }) {
  return (
    <section className="print-page field-page bg-white text-black shadow-sm print:shadow-none">
      <Header audit={audit} />
      <h2 className="attachment-title">Photo Attachments</h2>
      <div className="attachment-grid">
        {rows.map((row) => (
          <figure key={row.id} className="attachment-card">
            <img src={loadPhoto(row.id)} alt="" />
            <figcaption>
              <b>{row.section}</b>
              <span>{row.label}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <Footer pageNumber={pageNumber} totalPages={totalPages} />
    </section>
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

function hasDeviceContent(row: DeviceTestRow) {
  return Boolean(row.deviceType || row.location || row.deviceId || row.functional || row.alarm || row.supervisory || row.trouble || row.tripTime || row.timeReceived || row.result || row.notes);
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

interface PhotoAttachment {
  id: string;
  section: string;
  label: string;
}

function photoAttachments(audit: Audit): PhotoAttachment[] {
  return rowPhotos("Installation", audit.installation);
}

function rowPhotos(section: string, rows: AuditRow[]): PhotoAttachment[] {
  return rows.flatMap((row) => row.photos.map((id) => ({ id, section, label: row.element || "Additional row" })));
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
