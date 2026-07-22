import { useState } from "react";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { AscDocumentState, SavedDocumentStatus, loadAscDocuments, saveAscDocument } from "../lib/asc-documents";
import { AscProfile } from "../lib/asc-profile";
import { chooseConfirmationPdf, chooseEmailAttachments, prepareOutlookConfirmationEmail } from "../lib/desktop-bridge";
import { storageDetailsFromAsc, storageFoldersForDetails } from "../lib/local-document-storage";

export type AuditEmailType = "confirmation" | "report" | "reminder";

export interface AuditEmailGroup {
  key: string;
  ascName: string;
  location?: string;
  psn?: string;
}

interface AuditEmailDialogProps {
  type: AuditEmailType;
  group: AuditEmailGroup;
  profile?: AscProfile;
  confirmation?: SavedDocumentStatus;
  report?: SavedDocumentStatus;
  reportDocumentKey?: keyof Pick<AscDocumentState, "report" | "crzhReport">;
  onClose: () => void;
  onDocumentsChanged?: () => void;
}

export function AuditEmailDialog({ type, group, profile, confirmation, report, reportDocumentKey = "report", onClose, onDocumentsChanged }: AuditEmailDialogProps) {
  const [currentConfirmation, setCurrentConfirmation] = useState(confirmation);
  const [currentReport, setCurrentReport] = useState(report);
  const [confirmationAttachmentPath, setConfirmationAttachmentPath] = useState(confirmation?.confirmationPdfPath || "");
  const [reportAttachmentPath, setReportAttachmentPath] = useState(report?.reportPdfPath || "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(confirmation?.startTime || "");
  const [meetingLocation, setMeetingLocation] = useState(confirmation?.meetingLocation || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "warning" | "error" } | null>(null);
  const activeProfile = profile || { pocName: currentConfirmation?.pocName || currentReport?.pocName || "", pocEmail: "", psn: currentConfirmation?.psn || currentReport?.psn || group.psn || "", scn: "", updatedAt: "" };
  const emailLabel = type === "confirmation" ? "Confirmation Email" : type === "report" ? "Report Email" : "Reminder Email";
  const history = type === "confirmation"
    ? currentConfirmation?.confirmationEmailDrafts || (currentConfirmation?.confirmationEmailPreparedAt ? [currentConfirmation.confirmationEmailPreparedAt] : [])
    : type === "report"
      ? currentReport?.reportEmailDrafts || (currentReport?.reportEmailPreparedAt ? [currentReport.reportEmailPreparedAt] : [])
      : currentReport?.reminderEmailDrafts || (currentReport?.reminderEmailPreparedAt ? [currentReport.reminderEmailPreparedAt] : []);
  const markedSent = type === "confirmation" ? currentConfirmation?.confirmationEmailSentAt : type === "report" ? currentReport?.reportEmailSentAt : currentReport?.reminderEmailSentAt;
  const ready = type === "confirmation"
    ? Boolean(currentConfirmation && confirmationAttachmentPath)
    : type === "report"
      ? Boolean(currentReport?.reportCreated && reportAttachmentPath)
      : Boolean(currentReport?.reportCreated && currentReport?.sentToClient);

  function folders(folder: "Confirmation" | "Report") {
    const year = (currentConfirmation?.startDate || currentReport?.letterDate || new Date().toISOString()).slice(0, 4);
    return storageFoldersForDetails(storageDetailsFromAsc({ year, ascName: group.ascName, cityState: "", psn: activeProfile.psn || group.psn || "PSN", folder, fileName: emailLabel }));
  }

  async function chooseConfirmation() {
    try {
      const path = await chooseConfirmationPdf(folders("Confirmation"));
      if (!path || !currentConfirmation) return;
      const next = saveAscDocument(group.key, "confirmation", { ...currentConfirmation, confirmationPdfPath: path });
      const saved = next[group.key]?.confirmation;
      setCurrentConfirmation(saved);
      setConfirmationAttachmentPath(path);
      onDocumentsChanged?.();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not select the confirmation letter.", tone: "error" });
    }
  }

  async function chooseAttachments(reportFile = false) {
    try {
      const paths = await chooseEmailAttachments(folders(reportFile ? "Report" : "Confirmation"));
      if (!paths.length) return;
      if (reportFile && currentReport) {
        const path = paths[0];
        const next = saveAscDocument(group.key, reportDocumentKey, { ...currentReport, reportPdfPath: path });
        setCurrentReport(next[group.key]?.[reportDocumentKey]);
        setReportAttachmentPath(path);
        onDocumentsChanged?.();
      } else {
        setAttachments((current) => Array.from(new Set([...current, ...paths])));
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not select attachments.", tone: "error" });
    }
  }

  async function prepare() {
    if (!activeProfile.pocEmail?.trim()) {
      setMessage({ text: "Add a POC email address before preparing this email.", tone: "warning" });
      return;
    }
    if (!ready) {
      setMessage({ text: type === "confirmation" ? "Attach the confirmation letter before opening the Outlook draft." : type === "report" ? "Create and attach the saved audit report before opening the Outlook draft." : "Mark the report as sent before preparing a reminder.", tone: "warning" });
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      if (type === "confirmation" && currentConfirmation) {
        const start = displayDate(currentConfirmation.startDate);
        const end = displayDate(currentConfirmation.endDate || currentConfirmation.startDate);
        const range = start === end ? start : `${start} to ${end}`;
        const subject = `***UL Audit - ${shortDate(currentConfirmation.startDate)}${currentConfirmation.endDate && currentConfirmation.endDate !== currentConfirmation.startDate ? ` to ${shortDate(currentConfirmation.endDate)}` : ""} - ${group.ascName} - ${group.location || "Location TBD"} - PSN#${activeProfile.psn || group.psn || ""}`;
        const body = `Dear ${activeProfile.pocName},\n\nThank you for your assistance in coordinating the upcoming UL audit.\n\nThis email confirms that your UL audit is scheduled for ${range}, beginning at ${displayTime(startTime || currentConfirmation.startTime || "8:00 AM")}, at ${meetingLocation.trim() || currentConfirmation.meetingLocation?.trim() || "the first location you will arrange (TBD)"}. If the audit is scheduled for multiple days, it will continue on the scheduled dates.\n\nPlease find attached the following:\n\n• Official UL Audit Confirmation Letter${attachments.length ? "\n• Audit Preparation Checklist" : ""}\n\nPlease ensure the assigned technician has the required test equipment available. We also recommend notifying the selected site(s) in advance, as portions of the audit may require functional testing that could temporarily activate audible or visual notification appliances.\n\nPlease note that arrival times may vary slightly due to travel conditions between audit locations. We appreciate your flexibility and cooperation.\n\nIf you have any questions before the audit, please do not hesitate to contact me.\n\nThank you, and I look forward to working with you.\n\nKind regards,`;
        await prepareOutlookConfirmationEmail(activeProfile.pocEmail, subject, body, [confirmationAttachmentPath, ...attachments]);
        const next = saveAscDocument(group.key, "confirmation", { ...currentConfirmation, confirmationPdfPath: confirmationAttachmentPath, confirmationEmailPreparedAt: now, confirmationEmailDrafts: [...(currentConfirmation.confirmationEmailDrafts || []), now] });
        setCurrentConfirmation(next[group.key]?.confirmation);
      } else if (currentReport) {
        const deadline = new Date(currentReport.clearanceStartDate || currentReport.letterDate || currentReport.reportSentAt?.slice(0, 10) || new Date().toISOString());
        deadline.setDate(deadline.getDate() + 30);
        const dueDate = displayDate(deadline.toISOString().slice(0, 10));
        const daysRemaining = Math.ceil((deadline.getTime() - startOfToday().getTime()) / 86400000);
        const reminder = reminderInfo(daysRemaining);
        const subject = type === "report" ? `UL Annual Audit Report – ${group.ascName}` : `${reminder.prefix}: UL Audit Corrective Action Response Due – ${group.ascName}`;
        const body = type === "report"
          ? `Dear ${activeProfile.pocName},\n\nPlease find attached the UL Annual Audit Report for ${group.ascName}.\n\nPlease review the report carefully and complete the required corrective actions identified in the report.\n\nThe deadline to submit your official response and supporting documentation is ${dueDate}.\n\nSupporting documentation may include photographs, records, or other evidence demonstrating that the identified deficiencies have been corrected.\n\nImportant: Failure to submit the required response and supporting documentation by the stated deadline may result in cancellation of the affected UL Certificates.\n\nIf you have any questions regarding the report or the corrective action process, please do not hesitate to contact me.\n\nThank you for your cooperation.\n\nKind regards,`
          : `Dear ${activeProfile.pocName},\n\nThis is a ${reminder.label.toLowerCase()} reminder regarding the UL Annual Audit Report issued for ${group.ascName}.\n\n${reminder.remaining} to submit your official response and supporting documentation. The submission deadline is ${dueDate}.\n\nPlease ensure your response includes all required supporting documentation, such as photographs, records, or other evidence demonstrating that the identified deficiencies have been corrected.\n\nImportant: Failure to submit the required response and supporting documentation by the deadline may result in cancellation of the affected UL Certificates.\n\nIf you have any questions or require assistance, please do not hesitate to contact me.\n\nThank you for your prompt attention to this matter.\n\nKind regards,`;
        await prepareOutlookConfirmationEmail(activeProfile.pocEmail, subject, body, type === "report" ? [reportAttachmentPath] : []);
        const next = saveAscDocument(group.key, reportDocumentKey, { ...currentReport, reportPdfPath: reportAttachmentPath || currentReport.reportPdfPath, ...(type === "report" ? { reportEmailPreparedAt: now, reportEmailDrafts: [...(currentReport.reportEmailDrafts || []), now] } : { reminderEmailPreparedAt: now, reminderEmailDrafts: [...(currentReport.reminderEmailDrafts || []), now] }) });
        setCurrentReport(next[group.key]?.[reportDocumentKey]);
      }
      onDocumentsChanged?.();
      setMessage({ text: `Outlook ${emailLabel.toLowerCase()} draft opened. Review and send it in Outlook.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not prepare the Outlook email.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function markSent() {
    const now = new Date().toISOString();
    if (type === "confirmation" && currentConfirmation) {
      const next = saveAscDocument(group.key, "confirmation", { ...currentConfirmation, confirmationEmailSentAt: now });
      setCurrentConfirmation(next[group.key]?.confirmation);
    } else if (currentReport) {
      const next = saveAscDocument(group.key, reportDocumentKey, { ...currentReport, ...(type === "report" ? { reportEmailSentAt: now, sentToClient: true, reportSentAt: currentReport.reportSentAt || now, clearanceStartDate: currentReport.clearanceStartDate || now.slice(0, 10) } : { reminderEmailSentAt: now }) });
      setCurrentReport(next[group.key]?.[reportDocumentKey]);
    }
    onDocumentsChanged?.();
    setMessage({ text: `${emailLabel} marked as sent.`, tone: "success" });
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
    <section className="grid max-h-[calc(100vh-3rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={emailLabel}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><h2 className="text-xl font-bold text-navy">{emailLabel}</h2><p className="mt-1 text-sm text-slate-600">Review the email details and attachments before Haudy opens Outlook.</p></div><button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50" onClick={onClose} disabled={busy} aria-label={`Close ${emailLabel}`}><X size={18} /></button></div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700"><p><span className="font-semibold text-navy">To:</span> {activeProfile.pocName} &lt;{activeProfile.pocEmail || "No email saved"}&gt;</p><p className="mt-1"><span className="font-semibold text-navy">ASC:</span> {group.ascName} <span className="mx-2 text-slate-300">|</span><span className="font-semibold text-navy">PSN:</span> {activeProfile.psn || group.psn}</p></div>
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-3"><h3 className="text-sm font-bold text-navy">Email activity</h3>{history.length || markedSent ? <ul className="mt-2 grid gap-1 text-sm text-slate-700">{history.map((timestamp, index) => <li key={`${timestamp}-${index}`}><span className="font-semibold text-sky-800">{emailLabel} draft created</span> — {formatTime(timestamp)}</li>)}{markedSent ? <li><span className="font-semibold text-emerald-800">{emailLabel} marked sent</span> — {formatTime(markedSent)}</li> : null}</ul> : <p className="mt-1 text-sm text-slate-500">No email activity yet.</p>}</section>
      {message ? <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : message.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>{message.text}</div> : null}
      {type === "confirmation" ? <><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium text-slate-700">Audit start time<input className="min-h-11 rounded-md border border-slate-300 px-3" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="grid gap-1 text-sm font-medium text-slate-700">Meeting location<input className="min-h-11 rounded-md border border-slate-300 px-3" value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} placeholder="First location or service center" /></label></div><AttachmentPanel label="Confirmation letter" path={confirmationAttachmentPath} buttonLabel="Attach Confirmation Letter" onChoose={chooseConfirmation} /><div className="flex flex-wrap gap-2"><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100" onClick={() => void chooseAttachments()}><UploadCloud size={16} /> Add Preparation Checklist</button>{attachments.map((path) => <span key={path} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><FileText size={15} />{path.split(/[/\\]/).pop()}<button type="button" className="font-bold text-red-700" onClick={() => setAttachments((current) => current.filter((item) => item !== path))}>×</button></span>)}</div></> : type === "report" ? <AttachmentPanel label="Audit report" path={reportAttachmentPath} buttonLabel="Attach Audit Report" onChoose={() => chooseAttachments(true)} /> : <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Reminder email</p><p className="mt-1">Haudy calculates the reminder level and due date from the report clearance timeline.</p></section>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">{busy ? <span className="mr-auto inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-sky-800"><span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700" /> Creating Outlook draft…</span> : null}{history.length && !markedSent ? <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100" onClick={markSent} disabled={busy}><CheckCircle2 size={16} /> Mark Sent</button> : null}<button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose} disabled={busy}>Close</button><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready || busy} onClick={() => void prepare()}><UploadCloud size={16} /> {busy ? "Preparing…" : history.length ? "Open Outlook Draft Again" : "Open Outlook Draft"}</button></div>
    </section>
  </div>;
}

function AttachmentPanel({ label, path, buttonLabel, onChoose }: { label: string; path: string; buttonLabel: string; onChoose: () => void | Promise<void> }) { return <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-navy">{label}</h3><p className="text-sm text-slate-600">Attach the saved file before opening the Outlook draft.</p></div><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50" onClick={() => void onChoose()}><FileText size={16} /> {buttonLabel}</button></div><div className={`rounded-md border px-3 py-2 text-sm font-semibold ${path ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{path ? <><FileText className="mr-2 inline" size={16} />{path.split(/[/\\]/).pop()}</> : `${label} not attached yet`}</div></section>; }
function displayDate(value?: string) { if (!value) return "TBD"; const [year, month, day] = value.slice(0, 10).split("-"); return year && month && day ? new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : value; }
function shortDate(value?: string) { if (!value) return "TBD"; const [year, month, day] = value.slice(0, 10).split("-"); return year && month && day ? `${month}/${day}/${year.slice(-2)}` : value; }
function displayTime(value: string) { if (!/^\d{2}:\d{2}$/.test(value)) return value; const [hour, minute] = value.split(":").map(Number); return `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`; }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
function reminderInfo(days: number) { if (days < 0) return { prefix: "Past Due Notice", label: "Past Due", remaining: `${Math.abs(days)} day(s) past due` }; if (days === 0) return { prefix: "Action Required: Due Today", label: "Due Today", remaining: "The response is due today" }; if (days === 1) return { prefix: "Final Reminder", label: "Final", remaining: "1 day remains" }; if (days <= 6) return { prefix: "Urgent Reminder", label: "Urgent", remaining: `${days} day(s) remain` }; if (days <= 14) return { prefix: "Important Reminder", label: "Important", remaining: `${days} day(s) remain` }; return { prefix: "Reminder", label: "Friendly", remaining: `${days} day(s) remain` }; }
function formatTime(value: string) { return new Date(value).toLocaleString(); }
