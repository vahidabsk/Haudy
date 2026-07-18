import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { groupAssignmentsAndAudits, loadAuditAssignments } from "../lib/audit-assignments";
import { loadAscDocuments, saveAscDocument } from "../lib/asc-documents";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { canSaveDocumentsToFolder, saveCurrentDocumentSnapshot, storageDetailsFromAsc, storageFoldersForDetails } from "../lib/local-document-storage";
import { canSavePdfDirectly, savePrintablePagesAsPdfToFolder, savePrintablePagesAsPdfWithResult } from "../lib/pdf-saver";
import { Audit, Auditor, ParsedCertificate } from "../lib/types";

export function ConfirmationPage({ auditor }: { auditor: Auditor | null }) {
  const { ascKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const auditorName = auditor?.name || "";
  const store = useAudits(auditorName);
  const assignmentGroups = groupAssignmentsAndAudits(loadAuditAssignments(), store.audits);
  const group = assignmentGroups.find((item) => item.key === decodeURIComponent(ascKey)) || groupByAsc(store.audits).find((item) => item.key === decodeURIComponent(ascKey));
  const savedConfirmation = loadAscDocuments()[decodeURIComponent(ascKey)]?.confirmation;
  const pocName = searchParams.get("poc") || "";
  const startDate = searchParams.get("start") || searchParams.get("date") || savedConfirmation?.startDate || "";
  const endDate = searchParams.get("end") || savedConfirmation?.endDate || startDate;
  const startTime = searchParams.get("time") || savedConfirmation?.startTime || "";
  const meetingLocation = searchParams.get("location") || savedConfirmation?.meetingLocation || "";
  const conversationDate = searchParams.get("conversation") || savedConfirmation?.conversationDate || todayInputValue();
  const letterDate = searchParams.get("letter") || savedConfirmation?.letterDate || todayInputValue();
  const scn = searchParams.get("scn") || "";
  const psn = searchParams.get("psn") || "";

  if (!group) return <main className="p-6">ASC not found.</main>;

  return <ConfirmationDocument ascKey={decodeURIComponent(ascKey)} group={group} auditor={auditor} pocName={pocName} startDate={startDate} endDate={endDate} startTime={startTime} meetingLocation={meetingLocation} conversationDate={conversationDate} letterDate={letterDate} scn={scn} psn={psn} />;
}

function ConfirmationDocument({ ascKey, group, auditor, pocName, startDate, endDate, startTime, meetingLocation, conversationDate, letterDate, scn, psn }: { ascKey: string; group: AscGroup; auditor: Auditor | null; pocName: string; startDate: string; endDate: string; startTime: string; meetingLocation: string; conversationDate: string; letterDate: string; scn: string; psn: string }) {
  const navigate = useNavigate();
  const [savedAt, setSavedAt] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const [auditStartDate, setAuditStartDate] = useState(startDate);
  const [auditEndDate, setAuditEndDate] = useState(endDate || startDate);
  const [auditStartTime, setAuditStartTime] = useState(startTime);
  const [auditMeetingLocation, setAuditMeetingLocation] = useState(meetingLocation);
  const [scheduleConversationDate, setScheduleConversationDate] = useState(conversationDate);
  const [confirmationLetterDate, setConfirmationLetterDate] = useState(letterDate);
  const [savedSnapshot, setSavedSnapshot] = useState(() => confirmationSnapshot({ startDate, endDate: endDate || startDate, startTime, meetingLocation, conversationDate, letterDate }));
  const [pendingNavigation, setPendingNavigation] = useState("");
  const today = new Date();
  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
  const ascAddressLines = formatAscAddressLines(ascAddress || group.location);
  const fileReferences = referenceFiles(group.audits);
  const selectedSites = groupByCategory(group.audits);
  const scheduledYear = auditStartDate ? dateParts(auditStartDate).year : today.getFullYear().toString();
  const confirmationFileName = confirmationName({
    year: scheduledYear,
    ascName: group.ascName,
    ascAddress,
    files: fileReferences,
    scn,
    categories: selectedSites.map((section) => section.category),
  });
  const maxEndDate = maxAuditEndDate(auditStartDate);
  const currentSnapshot = confirmationSnapshot({ startDate: auditStartDate, endDate: auditEndDate, startTime: auditStartTime, meetingLocation: auditMeetingLocation, conversationDate: scheduleConversationDate, letterDate: confirmationLetterDate });
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot;
  const updateDetails = (next: { startDate?: string; endDate?: string; startTime?: string; meetingLocation?: string; conversationDate?: string; letterDate?: string }) => {
    const nextStartDate = next.startDate ?? auditStartDate;
    const nextEndDate = next.endDate ?? auditEndDate;
    const nextStartTime = next.startTime ?? auditStartTime;
    const nextMeetingLocation = next.meetingLocation ?? auditMeetingLocation;
    const nextConversationDate = next.conversationDate ?? scheduleConversationDate;
    const nextLetterDate = next.letterDate ?? confirmationLetterDate;
    setAuditStartDate(nextStartDate);
    setAuditEndDate(nextEndDate);
    setAuditStartTime(nextStartTime);
    setAuditMeetingLocation(nextMeetingLocation);
    setScheduleConversationDate(nextConversationDate);
    setConfirmationLetterDate(nextLetterDate);
  };

  async function saveConfirmation() {
    let next = saveAscDocument(ascKey, "confirmation", { pocName, scn, psn, startDate: auditStartDate, endDate: auditEndDate, startTime: auditStartTime, meetingLocation: auditMeetingLocation, conversationDate: scheduleConversationDate, letterDate: confirmationLetterDate });
    setSavedAt(next[ascKey]?.confirmation?.updatedAt || "");
    setSavedSnapshot(currentSnapshot);
    if (canSaveDocumentsToFolder()) {
      try {
        await saveCurrentDocumentSnapshot(storageDetailsFromAsc({ year: scheduledYear, ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Confirmation", fileName: confirmationFileName }));
        const confirmationPdfPath = await savePrintablePagesAsPdfToFolder(confirmationFileName, storageFoldersForDetails(storageDetailsFromAsc({ year: scheduledYear, ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Confirmation", fileName: confirmationFileName })));
        next = saveAscDocument(ascKey, "confirmation", { ...next[ascKey]?.confirmation, pocName, scn, psn, startDate: auditStartDate, endDate: auditEndDate, startTime: auditStartTime, meetingLocation: auditMeetingLocation, conversationDate: scheduleConversationDate, letterDate: confirmationLetterDate, confirmationPdfPath });
        setSavedAt(next[ascKey]?.confirmation?.updatedAt || "");
        setFolderMessage("Confirmation and PDF saved to Haudy Database.");
      } catch (error) {
        setFolderMessage(`Confirmation saved, but its PDF attachment could not be created: ${error instanceof Error ? error.message : "Unknown error"}. Use Save as PDF to select and save the attachment.`);
      }
    }
  }

  async function saveConfirmationPdf() {
    if (!canSavePdfDirectly()) {
      window.print();
      return;
    }
    try {
      const result = await savePrintablePagesAsPdfWithResult(confirmationFileName, storageFoldersForDetails(storageDetailsFromAsc({ year: scheduledYear, ascName: group.ascName, cityState: cityStateCode(ascAddress), psn, folder: "Confirmation", fileName: confirmationFileName })));
      if (!result.path) {
        setFolderMessage(result.message);
        return;
      }
      const next = saveAscDocument(ascKey, "confirmation", {
        ...(loadAscDocuments()[ascKey]?.confirmation || {}),
        pocName,
        scn,
        psn,
        startDate: auditStartDate,
        endDate: auditEndDate,
        startTime: auditStartTime,
        meetingLocation: auditMeetingLocation,
        conversationDate: scheduleConversationDate,
        letterDate: confirmationLetterDate,
        confirmationPdfPath: result.path,
      });
      setSavedAt(next[ascKey]?.confirmation?.updatedAt || "");
      setSavedSnapshot(currentSnapshot);
      setFolderMessage("PDF saved and linked to this confirmation email.");
    } catch (error) {
      setFolderMessage(error instanceof Error ? error.message : "Could not save PDF.");
    }
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
    await saveConfirmation();
    navigate(destination);
  }

  function discardAndNavigate() {
    if (!pendingNavigation) return;
    const destination = pendingNavigation;
    setPendingNavigation("");
    navigate(destination);
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [ascKey]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = confirmationFileName;
    return () => {
      document.title = previousTitle;
    };
  }, [confirmationFileName]);

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 grid gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2">
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
              onClick={() => void saveConfirmationPdf()}
            >
              {canSavePdfDirectly() ? "Save as PDF" : "Print PDF"}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              onClick={saveConfirmation}
            >
              Save Confirmation
            </button>
          </div>
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
        <div className="grid gap-3 rounded-md border border-sky-100 bg-sky-50 p-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit start date
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" type="date" value={auditStartDate} onChange={(event) => {
              const nextStartDate = event.target.value;
              const nextMaxEndDate = maxAuditEndDate(nextStartDate);
              const nextEndDate = !auditEndDate || auditEndDate < nextStartDate || (nextMaxEndDate && auditEndDate > nextMaxEndDate) ? nextStartDate : auditEndDate;
              updateDetails({ startDate: nextStartDate, endDate: nextEndDate });
            }} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit end date
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" type="date" value={auditEndDate} min={auditStartDate} max={maxEndDate} onChange={(event) => updateDetails({ endDate: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit start time <span className="font-normal text-slate-500">(optional)</span>
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" type="time" value={auditStartTime} onChange={(event) => updateDetails({ startTime: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-3">
            Audit meeting location <span className="font-normal text-slate-500">(optional)</span>
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" value={auditMeetingLocation} onChange={(event) => updateDetails({ meetingLocation: event.target.value })} placeholder="Example: Main lobby, fire command center, or central station office" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Schedule conversation date
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" type="date" value={scheduleConversationDate} onChange={(event) => updateDetails({ conversationDate: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Letter date
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3" type="date" value={confirmationLetterDate} onChange={(event) => updateDetails({ letterDate: event.target.value })} />
          </label>
        </div>
      </div>

      <section className="confirmation-page print-page bg-white text-black shadow-sm print:shadow-none">
        <ConfirmationHeader />
        <div className="confirmation-letter">
          <p>{formatLongDate(confirmationLetterDate || today)}</p>
          <p>
            {pocName}<br />
            {group.ascName}<br />
            {ascAddressLines.map((line) => <span key={line}>{line}<br /></span>)}
          </p>
          <p>Our Reference: FILE(s): {fileReferences || "Not listed"}<span className="confirmation-reference-gap">SCN: {scn || ""}</span><span className="confirmation-reference-gap">PSN: {psn || ""}</span></p>
          <p>Subject: Annual Audit Confirmation</p>
          <p>Dear {fullName(pocName)},</p>
          <p>This is to confirm our conversation on {formatLongDate(scheduleConversationDate || today)} during which we scheduled the annual audit of the referenced file for {formatDateRange(auditStartDate, auditEndDate)}{auditScheduleDetails(auditStartTime, auditMeetingLocation)}.</p>
          <p>As noted in the Service Agreement that your organization executed with UL, your continued Listing is contingent upon your continued ability to deliver Code/Standard compliant service. Your organization was granted a Listing based on a favorable assessment of its ability to fulfill this obligation. Our audit this year is intended to verify this ability.</p>
          <p>We will review compliance to the applicable standards for the category or categories being audited. This could include but is not limited to certificated field installations, documentation, records, signal handling, operational procedures, response procedures, and/or monitoring facilities.</p>
          <p>Our objective is to verify that your organization is still capable of delivering Code/Standard compliant service. Our desire is to make the process as smooth as possible. Our experience is that preparation is key to success on both counts.</p>
          <p className="confirmation-sincerely">Sincerely,</p>
          <p>
            <b>{auditor?.name || ""}</b><br />
            {auditor?.title || ""}<br />
            <SignatureDepartment department={auditor?.department} />
            {auditor?.phone || ""}<br />
            {auditor?.email || ""}
          </p>
        </div>
        <ConfirmationFooter />
      </section>

      <section className="confirmation-page confirmation-sites-page print-page bg-white text-black shadow-sm print:shadow-none">
        <h1>SELECTED SITES FOR UL AUDIT -{scheduledYear}</h1>
        {selectedSites.map((section) => (
          <div key={section.category} className="confirmation-site-section">
            <h2>{section.category}</h2>
            <table>
              <thead>
                <tr>
                  <th>Certificate Number</th>
                  <th>Protected Property</th>
                  <th>Protected Property Address</th>
                </tr>
              </thead>
              <tbody>
                {section.audits.map((audit) => (
                  <tr key={audit.id}>
                    <td>{audit.certificateNumber}</td>
                    <td>{audit.protectedProperty}</td>
                    <td>{formatSiteAddress(primaryCertificate(audit)?.propertyAddress || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
      {pendingNavigation ? <UnsavedChangesDialog onSave={saveAndNavigate} onDiscard={discardAndNavigate} onCancel={() => setPendingNavigation("")} /> : null}
    </main>
  );
}

function confirmationSnapshot(details: { startDate: string; endDate: string; startTime: string; meetingLocation: string; conversationDate: string; letterDate: string }) {
  return JSON.stringify({
    startDate: details.startDate || "",
    endDate: details.endDate || "",
    startTime: details.startTime || "",
    meetingLocation: details.meetingLocation || "",
    conversationDate: details.conversationDate || "",
    letterDate: details.letterDate || "",
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

function ConfirmationHeader() {
  return (
    <header className="confirmation-header">
      <img className="confirmation-logo" src="/confirmation-logo.png" alt="UL Solutions" />
      <img className="confirmation-safety" src="/confirmation-safety.png" alt="Safety. Science. Transformation." />
    </header>
  );
}

function ConfirmationFooter() {
  return (
    <footer className="confirmation-footer">
      <div>
        UL Solutions<br />
        333 Pfingsten Road<br />
        Northbrook, IL 60062<br />
        +1.887.854.3577<br />
        <b>UL.com/Solution</b>
      </div>
      <div>UL LLC &copy; 2022. All rights reserved.</div>
    </footer>
  );
}

function primaryCertificate(audit: Audit): ParsedCertificate | undefined {
  return audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
}

function referenceFiles(audits: Audit[]) {
  const references = new Set<string>();
  for (const audit of audits) {
    const certificate = primaryCertificate(audit);
    if (certificate?.fileNo) references.add(certificate.fileNo);
  }
  return Array.from(references).join(", ");
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

function confirmationName({ year, ascName, ascAddress, files, scn, categories }: { year: string; ascName: string; ascAddress: string; files: string; scn: string; categories: string[] }) {
  const cityState = cityStateCode(ascAddress);
  const categorySuffix = categories.map(categoryOutputCode).filter(Boolean).join("_");
  return [
    `Confirmation_${year}_${ascName.trim().toUpperCase()}${cityState ? `-${cityState}` : ""}`,
    filesForName(files),
    `SCN${scn || ""}`,
    categorySuffix,
  ].filter(Boolean).join("_");
}

function filesForName(files: string) {
  const values = files.split(",").map((value) => value.trim()).filter(Boolean);
  if (!values.length) return "";
  return values.map((value, index) => (index === 0 ? value : ` ${value}`)).join("_");
}

function cityStateCode(address: string) {
  const lines = formatAscAddressLines(address);
  const location = lines[1] || lines[0] || "";
  const match = location.match(/^([^,]+),\s*([A-Za-z]+|[A-Z]{2})\b/);
  if (!match) return "";
  const city = match[1].trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const state = stateCode(match[2].trim());
  return [city, state].filter(Boolean).join("-");
}

function stateCode(value: string) {
  const states: Record<string, string> = { CALIFORNIA: "CA", CA: "CA" };
  return states[value.toUpperCase()] || value.toUpperCase();
}

function categoryOutputCode(category: string) {
  const codes: Record<string, string> = { UUJS: "FA", UUFX: "FD" };
  return codes[category.toUpperCase()] || category.toUpperCase();
}

function formatSiteAddress(address: string) {
  return address
    .replace(/\s+UNITED STATES$/i, "")
    .replace(/\bCA\b/g, "California")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAscAddressLines(address: string) {
  const normalized = cleanCountryTail(address).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2}|[A-Za-z]+)\s+([0-9-]+)(?:\s+(UNITED STATES|United States))?$/);
  if (!match) return normalized ? [normalized] : [];

  const street = match[1].trim();
  const city = match[2].trim().toUpperCase();
  const state = stateName(match[3].trim());
  const postalCode = match[4].trim();
  const country = match[5]?.toUpperCase() || "UNITED STATES";
  return [street, `${city}, ${state} ${postalCode} ${country}`];
}

function cleanCountryTail(value: string) {
  return value.replace(/\bUNITED STATES\b.*$/i, "UNITED STATES").trim();
}

function stateName(value: string) {
  const states: Record<string, string> = { CA: "California" };
  return states[value.toUpperCase()] || value;
}

function groupByCategory(audits: Audit[]) {
  const groups = new Map<string, Audit[]>();
  for (const audit of audits) {
    const certificate = primaryCertificate(audit);
    const category = certificate?.categoryCode || categoryFromText([certificate?.fileName, certificate?.certificateType, certificate?.coverageType, certificate?.areaCovered].filter(Boolean).join(" ")) || "SELECTED SITES";
    groups.set(category, [...(groups.get(category) || []), audit]);
  }
  return Array.from(groups, ([category, sectionAudits]) => ({ category, audits: sectionAudits }));
}

function categoryFromText(value: string) {
  return value.match(/\b(UUFX|UUJS|UUHX|UUFM|CVSG|CRZH)\b/i)?.[1]?.toUpperCase();
}

function fullName(name: string) {
  return name.trim().replace(/\s+/g, " ") || "there";
}

function auditScheduleDetails(startTime: string, meetingLocation: string) {
  const time = formatTime(startTime);
  const location = meetingLocation.trim();
  if (time && location) return `, beginning at ${time} at ${location}`;
  if (time) return `, beginning at ${time}`;
  if (location) return `, beginning at ${location}`;
  return "";
}

function formatTime(value: string) {
  if (!value) return "";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatLongDate(value: string | Date) {
  const date = value instanceof Date ? value : dateParts(value).date;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string) {
  if (!start) return "";
  if (!end || start === end) return formatLongDate(start);

  const startDate = dateParts(start).date;
  const endDate = dateParts(end).date;
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    const days = daysBetween(startDate, endDate);
    if (days.length > 1 && days.length <= 5) {
      const dayText = days.length === 2 ? `${days[0]} and ${days[1]}` : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
      return `${startDate.toLocaleDateString("en-US", { month: "long" })} ${dayText}, ${startDate.getFullYear()}`;
    }
    return `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} through ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }

  if (sameYear) {
    return `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} through ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }

  return `${formatLongDate(start)} through ${formatLongDate(end)}`;
}

function daysBetween(start: Date, end: Date) {
  const days: number[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.getDate());
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateParts(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return { date, year: date.getFullYear().toString() };
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
