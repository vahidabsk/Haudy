import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck, CalendarDays, CheckCircle2, Clock3, Download, FilePenLine, FileText, MapPin, Search, Share, ShieldCheck, Target, Trash2, UploadCloud, X } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { assignmentCertificateOverrides, assignmentProfileDefaults, groupAssignmentsAndAudits, importTrackerAssignments, loadAuditAssignments, saveAuditAssignments, AssignmentGroup } from "../lib/audit-assignments";
import { clearAscDocuments, deleteAscDocuments, loadAscDocuments, saveAscDocument, updateAscDocumentDraft } from "../lib/asc-documents";
import type { AscDocumentState } from "../lib/asc-documents";
import { AscProfile, clearAscProfiles, completeAscProfile, deleteAscProfile, loadAscProfiles, saveAscProfiles } from "../lib/asc-profile";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { auditHasProgress, auditIdentity, certificateIdentity } from "../lib/audit-duplicates";
import { chooseConfirmationPdf, chooseEmailAttachments, openAuditTracker, openCustomerContactList, prepareOutlookConfirmationEmail, restoreHaudyDatabaseSnapshot } from "../lib/desktop-bridge";
import { CustomerContact, contactsForPsn, loadCustomerContacts, loadTrackerDirectory, saveCustomerContacts, saveTrackerDirectory } from "../lib/customer-contacts";
import { exportFieldNotesForIHaudy, IHAUDY_FIELD_NOTES_ACCEPT, importFieldNotesFromIHaudy } from "../lib/ihaudy-transfer";
import { exportHaudyBackup, importHaudyBackupFile, importHaudyBackupText } from "../lib/haudy-data-transfer";
import { isDesktopApp } from "../lib/desktop-runtime";
import { canSaveDocumentsToFolder, chooseStorageRoot, hasStorageRoot, prepareStorageFolders, storageDetailsFromAsc, storageDetailsFromAudit, storageFoldersForDetails } from "../lib/local-document-storage";
import { Audit, ParsedCertificate } from "../lib/types";
import { formatUsPhone, relativeTime } from "../lib/utils";
import { OFFLINE_READY_KEY } from "../register-service-worker";
import { isProtectedAreaAudit } from "../lib/audit-program";
import { FIELD_NOTE_READY_PERCENT, fieldNoteProgress, groupFieldNoteProgress } from "../lib/field-note-progress";

interface DuplicateUploadReview {
  certificates: ParsedCertificate[];
  duplicates: Array<{ certificate: ParsedCertificate; audit: Audit }>;
  hasProgress: boolean;
  group?: AssignmentGroup;
}

interface ConfirmationEmailEditorState {
  group: AssignmentGroup;
  profile: AscProfile;
  confirmation: NonNullable<AscDocumentState["confirmation"]>;
  startTime: string;
  meetingLocation: string;
  confirmationAttachmentPath: string;
  reportAttachmentPath: string;
  attachments: string[];
  emailType: "confirmation" | "report" | "reminder";
  reportCreated: boolean;
  reportSent: boolean;
  report?: NonNullable<AscDocumentState["report"]>;
}

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const location = useLocation();
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
  const [confirmationEmailMessage, setConfirmationEmailMessage] = useState<{ ascKey: string; text: string; tone: "success" | "warning" | "error" } | null>(null);
  const [confirmationEmailEditor, setConfirmationEmailEditor] = useState<ConfirmationEmailEditorState | null>(null);
  const [preparingConfirmationEmail, setPreparingConfirmationEmail] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUploadReview | null>(null);
  const [deleteAscGroup, setDeleteAscGroup] = useState<AssignmentGroup | null>(null);
  const [activeJobTab, setActiveJobTab] = useState<HomeJobStatus>("pool");
  const [poolSearch, setPoolSearch] = useState("");
  const [focusAscKey, setFocusAscKey] = useState("");
  const [showProgressDashboard, setShowProgressDashboard] = useState(false);
  const [showCustomerPhoneBook, setShowCustomerPhoneBook] = useState(false);
  const restoredAscRoute = useRef("");
  const jobCards = groups.map((group) => {
    const documents = ascDocuments[group.key];
    return { group, documents, status: homeJobStatus(group, documents) };
  });
  const jobTabs = homeJobTabs(jobCards);
  const dashboardMetrics = auditProgressMetrics(groups, ascDocuments);
  const visibleJobCards = jobCards
    .filter((item) => item.status.id === activeJobTab)
    .filter((item) => activeJobTab !== "pool" || groupMatchesPoolSearch(item.group, poolSearch))
    .sort((a, b) => compareJobCards(a, b, activeJobTab));

  function openAscFromDashboard(group: AssignmentGroup) {
    const status = homeJobStatus(group, ascDocuments[group.key]);
    setActiveJobTab(status.id);
    setFocusAscKey(group.key);
    window.history.replaceState(null, "", `?asc=${encodeURIComponent(group.key)}`);
  }

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
    window.dispatchEvent(new CustomEvent("haudy:workspace-counts", {
      detail: { ascs: groups.length, certificates: audits.audits.length },
    }));
  }, [groups.length, audits.audits.length]);

  useEffect(() => {
    if (audits.audits.length > 0 || assignments.length > 0) return;
    setAscProfiles(clearAscProfiles());
    setAscDocuments(clearAscDocuments());
  }, [audits.audits.length, assignments.length]);

  useEffect(() => {
    const searchKey = new URLSearchParams(location.search).get("asc") || "";
    const hashKey = location.hash.replace(/^#/, "");
    const key = decodeURIComponent(searchKey || hashKey);
    if (!key || !groups.length) return;
    if (restoredAscRoute.current === key) return;
    const card = jobCards.find((item) => item.group.key === key);
    if (!card) return;
    restoredAscRoute.current = key;
    setFocusAscKey(key);
    setActiveJobTab(card.status.id);
  }, [ascDocuments, assignments.length, audits.audits.length, groups.length, location.hash, location.search]);

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
      saveTrackerDirectory(rows.map((row) => ({ psn: row.psn, ascName: row.ascName, city: row.city, state: row.state, auditorName: row.auditorName })));
      const result = importTrackerAssignments(rows, auditorName);
      setAssignments(result.assignments);
      const nextProfiles = { ...loadAscProfiles() };
      for (const group of groupAssignmentsAndAudits(result.assignments, audits.audits)) {
        const defaults = assignmentProfileDefaults(group);
        if (!defaults.psn && !defaults.scn) continue;
        nextProfiles[group.key] = {
          pocName: nextProfiles[group.key]?.pocName || "",
          pocPhone: nextProfiles[group.key]?.pocPhone || "",
          pocEmail: nextProfiles[group.key]?.pocEmail || "",
          pocType: nextProfiles[group.key]?.pocType || "",
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

  async function chooseDatabase() {
    try {
      await chooseStorageRoot();
      setStorageReady(true);
      setStorageMessage("Haudy Database location saved.");
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "Could not choose storage location.");
    }
  }

  async function importCustomerContactList() {
    try {
      setTransferMessage("Reading customer contact list...");
      const contacts = await openCustomerContactList();
      if (!contacts.length) {
        setTransferMessage("No customer contacts were imported from the selected file.");
        return;
      }
      saveCustomerContacts(contacts.map((contact) => ({ ...contact, phone: formatUsPhone(contact.phone), type: contact.contactType })));
      setTransferMessage(`${contacts.length} customer contact${contacts.length === 1 ? "" : "s"} imported.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : "Could not import the customer contact list.");
    }
  }

  useEffect(() => {
    const handleImport = () => void importTracker();
    const handleContactImport = () => void importCustomerContactList();
    const handleOpenPhoneBook = () => setShowCustomerPhoneBook(true);
    const handleOpenDashboard = () => setShowProgressDashboard(true);
    const handleChooseDatabase = () => void chooseDatabase();
    const handleBackupWorkspace = () => {
      void exportHaudyBackup({ includePhotos: true })
        .then((message) => setTransferMessage(message))
        .catch(() => setTransferMessage("Could not create the workspace backup."));
    };
    const handleRestoreWorkspace = () => {
      if (isDesktopApp()) {
        if (!window.confirm("Restore a complete Haudy backup? The current workspace and Haudy Database files will be replaced.")) return;
        setTransferMessage("Restoring complete workspace backup...");
        void restoreHaudyDatabaseSnapshot()
          .then(async (snapshot) => {
            if (!snapshot) {
              setTransferMessage("Workspace restore cancelled.");
              return;
            }
            const restored = await importHaudyBackupText(snapshot.backupContents) || { imported: 0, skippedPhotos: 0 };
            setTransferMessage(`Workspace restored (${restored.imported} data items and ${snapshot.restoredFiles} Haudy Database files). Reloading Haudy...`);
            window.setTimeout(() => window.location.reload(), 900);
          })
          .catch((error) => setTransferMessage(error instanceof Error ? error.message : "Could not restore the workspace backup."));
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".haudy-data.json,application/json,text/plain";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!window.confirm("Restore this Haudy backup? The current workspace on this computer will be replaced.")) return;
        setTransferMessage("Restoring workspace backup...");
        void importHaudyBackupFile(file)
          .then((result) => {
            const restored = result || { imported: 0, skippedPhotos: 0 };
            setTransferMessage(`Workspace restored (${restored.imported} data items${restored.skippedPhotos ? `; ${restored.skippedPhotos} photo item${restored.skippedPhotos === 1 ? "" : "s"} could not be restored` : ""}). Reloading Haudy...`);
            window.setTimeout(() => window.location.reload(), 900);
          })
          .catch((error) => setTransferMessage(error instanceof Error ? error.message : "Could not restore the workspace backup."));
      };
      input.click();
    };
    window.addEventListener("haudy:import-audit-tracker", handleImport);
    window.addEventListener("haudy:import-customer-contact-list", handleContactImport);
    window.addEventListener("haudy:open-customer-phone-book", handleOpenPhoneBook);
    window.addEventListener("haudy:open-audit-dashboard", handleOpenDashboard);
    window.addEventListener("haudy:choose-database", handleChooseDatabase);
    window.addEventListener("haudy:backup-workspace", handleBackupWorkspace);
    window.addEventListener("haudy:restore-workspace", handleRestoreWorkspace);
    return () => {
      window.removeEventListener("haudy:import-audit-tracker", handleImport);
      window.removeEventListener("haudy:import-customer-contact-list", handleContactImport);
      window.removeEventListener("haudy:open-customer-phone-book", handleOpenPhoneBook);
      window.removeEventListener("haudy:open-audit-dashboard", handleOpenDashboard);
      window.removeEventListener("haudy:choose-database", handleChooseDatabase);
      window.removeEventListener("haudy:backup-workspace", handleBackupWorkspace);
      window.removeEventListener("haudy:restore-workspace", handleRestoreWorkspace);
    };
  });

  async function addCertificatesToGroup(group: AssignmentGroup, certificates: ParsedCertificate[]) {
    setActiveJobTab(homeJobStatus(group, ascDocuments[group.key]).id);
    setFocusAscKey(group.key);
    const mismatch = findWrongAscCertificate(group, certificates);
    if (mismatch) return mismatch;
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
    const documentKey = reportTracks(group, loadAscDocuments()).find((track) => track.report?.sentToClient)?.key;
    if (!documentKey) return;
    const existingReport = loadAscDocuments()[group.key]?.[documentKey];
    if (!existingReport) return;
    const next = updateAscDocumentDraft(group.key, documentKey, {
      ...existingReport,
      clearanceResponseReceived: received,
      clearanceResponseAt: received ? new Date().toISOString() : "",
    });
    setAscDocuments(next);
  }

  function markReportSent(group: AssignmentGroup, clearanceStartDate: string) {
    const documentKey = dashboardReportKey(group);
    const existingReport = loadAscDocuments()[group.key]?.[documentKey];
    if (!existingReport) return;
    const next = updateAscDocumentDraft(group.key, documentKey, {
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

  async function prepareConfirmationEmail(group: AssignmentGroup, profile: AscProfile, confirmation: NonNullable<AscDocumentState["confirmation"]>, options: Pick<ConfirmationEmailEditorState, "startTime" | "meetingLocation" | "confirmationAttachmentPath" | "attachments">) {
    if (!(profile.pocEmail || "").trim()) {
      setConfirmationEmailMessage({ ascKey: group.key, text: "Add a POC email address before preparing the confirmation email.", tone: "warning" });
      return;
    }
    try {
      let attachmentPath = options.confirmationAttachmentPath || "";
      if (!attachmentPath) {
        setConfirmationEmailMessage({ ascKey: group.key, text: "Attach the confirmation letter before opening the Outlook draft.", tone: "warning" });
        return false;
      }
      const start = emailDate(confirmation.startDate);
      const end = emailDate(confirmation.endDate || confirmation.startDate);
      const range = start === end ? start : `${start} to ${end}`;
      const startTime = emailTime(options.startTime || confirmation.startTime || "8:00 AM");
      const location = options.meetingLocation.trim() || confirmation.meetingLocation?.trim() || "the first location you will arrange (TBD)";
      const subject = `***UL Audit - ${emailShortDate(confirmation.startDate)}${confirmation.endDate && confirmation.endDate !== confirmation.startDate ? ` to ${emailShortDate(confirmation.endDate)}` : ""} - ${group.ascName} - ${group.location || "Location TBD"} - PSN#${profile.psn || group.psn}`;
      const attachmentList = ["• Official UL Audit Confirmation Letter", ...(options.attachments.length ? ["• Audit Preparation Checklist"] : [])].join("\n");
      const checklistGuidance = options.attachments.length
        ? "Please review the preparation checklist and ensure the assigned technician has the required test equipment available."
        : "Please ensure the assigned technician has the required test equipment available.";
      const body = `Dear ${profile.pocName},\n\nThank you for your assistance in coordinating the upcoming UL audit.\n\nThis email confirms that your UL audit is scheduled for ${range}, beginning at ${startTime}, at ${location}. If the audit is scheduled for multiple days, it will continue on the scheduled dates.\n\nPlease find attached the following:\n\n${attachmentList}\n\n${checklistGuidance} We also recommend notifying the selected site(s) in advance, as portions of the audit may require functional testing that could temporarily activate audible or visual notification appliances.\n\nPlease note that arrival times may vary slightly due to travel conditions between audit locations. We appreciate your flexibility and cooperation.\n\nIf you have any questions before the audit, please do not hesitate to contact me.\n\nThank you, and I look forward to working with you.\n\nKind regards,`;
      await prepareOutlookConfirmationEmail(profile.pocEmail || "", subject, body, [attachmentPath, ...options.attachments]);
      const preparedAt = new Date().toISOString();
      const next = saveAscDocument(group.key, "confirmation", {
        ...confirmation,
        confirmationPdfPath: attachmentPath,
        confirmationEmailPreparedAt: preparedAt,
        confirmationEmailDrafts: [...(confirmation.confirmationEmailDrafts || []), preparedAt],
      });
      setAscDocuments(next);
      setConfirmationEmailMessage({ ascKey: group.key, text: `Outlook email draft opened with the confirmation PDF${options.attachments.length ? ` and ${options.attachments.length} additional attachment${options.attachments.length === 1 ? "" : "s"}` : ""}. Review and send it in Outlook.`, tone: "success" });
      return true;
    } catch (error) {
      setConfirmationEmailMessage({ ascKey: group.key, text: error instanceof Error ? error.message : "Could not prepare the Outlook email.", tone: "error" });
      return false;
    }
  }

  function markConfirmationEmailSent(group: AssignmentGroup, confirmation: NonNullable<AscDocumentState["confirmation"]>) {
    const next = saveAscDocument(group.key, "confirmation", { ...confirmation, confirmationEmailSentAt: new Date().toISOString() });
    setAscDocuments(next);
    setConfirmationEmailMessage({ ascKey: group.key, text: "Confirmation email marked as sent.", tone: "success" });
  }

  function markSelectedEmailSent(editor: ConfirmationEmailEditorState) {
    const sentAt = new Date().toISOString();
    if (editor.emailType === "confirmation") {
      markConfirmationEmailSent(editor.group, editor.confirmation);
      const confirmation = loadAscDocuments()[editor.group.key]?.confirmation;
      if (confirmation) setConfirmationEmailEditor((current) => current ? { ...current, confirmation } : null);
      return;
    }
    if (!editor.report) return;
    const documentKey = dashboardReportKey(editor.group);
    const next = saveAscDocument(editor.group.key, documentKey, {
      ...editor.report,
      ...(editor.emailType === "report" ? {
        reportEmailSentAt: sentAt,
        sentToClient: true,
        reportSentAt: editor.report.reportSentAt || sentAt,
        clearanceStartDate: editor.report.clearanceStartDate || sentAt.slice(0, 10),
      } : {
        reminderEmailSentAt: sentAt,
      }),
    });
    const report = next[editor.group.key]?.[documentKey];
    setAscDocuments(next);
    setConfirmationEmailEditor((current) => current ? { ...current, report, reportSent: Boolean(report?.sentToClient) } : null);
    setConfirmationEmailMessage({ ascKey: editor.group.key, text: `${editor.emailType === "report" ? "Report" : "Reminder"} email marked as sent.`, tone: "success" });
  }

  async function prepareReportOrReminderEmail(editor: ConfirmationEmailEditorState) {
    const report = editor.report;
    if (!report || !(editor.profile.pocEmail || "").trim()) {
      setConfirmationEmailMessage({ ascKey: editor.group.key, text: "Add a POC email address before preparing this email.", tone: "warning" });
      return false;
    }
    if (editor.emailType === "report" && !editor.reportAttachmentPath) {
      setConfirmationEmailMessage({ ascKey: editor.group.key, text: "Attach the saved audit report before opening the Outlook draft.", tone: "warning" });
      return false;
    }
    if (editor.emailType === "reminder" && !editor.reportSent) {
      setConfirmationEmailMessage({ ascKey: editor.group.key, text: "Mark the report as sent to the customer before preparing a reminder.", tone: "warning" });
      return false;
    }
    try {
      const deadline = addDays(parseLocalDate(report.clearanceStartDate || report.letterDate || report.reportSentAt?.slice(0, 10) || "") || startOfLocalDay(new Date()), 30);
      const remaining = daysBetween(startOfLocalDay(new Date()), deadline);
      const dueDate = formatDisplayDate(localDateKey(deadline));
      const reminder = reminderDetails(remaining);
      const subject = editor.emailType === "report"
        ? `UL Annual Audit Report – ${editor.group.ascName}`
        : `${reminder.subjectPrefix}: UL Audit Corrective Action Response Due – ${editor.group.ascName}`;
      const body = editor.emailType === "report"
        ? `Dear ${editor.profile.pocName},\n\nPlease find attached the UL Annual Audit Report for ${editor.group.ascName}.\n\nPlease review the report carefully and complete the required corrective actions identified in the report.\n\nThe deadline to submit your official response and supporting documentation is ${dueDate}.\n\nSupporting documentation may include photographs, records, or other evidence demonstrating that the identified deficiencies have been corrected.\n\nImportant: Failure to submit the required response and supporting documentation by the stated deadline may result in cancellation of the affected UL Certificates.\n\nIf you have any questions regarding the report or the corrective action process, please do not hesitate to contact me.\n\nThank you for your cooperation.\n\nKind regards,`
        : `Dear ${editor.profile.pocName},\n\nThis is a ${reminder.label.toLowerCase()} reminder regarding the UL Annual Audit Report issued for ${editor.group.ascName}.\n\n${reminder.remainingText} to submit your official response and supporting documentation. The submission deadline is ${dueDate}.\n\nPlease ensure your response includes all required supporting documentation, such as photographs, records, or other evidence demonstrating that the identified deficiencies have been corrected.\n\nImportant: Failure to submit the required response and supporting documentation by the deadline may result in cancellation of the affected UL Certificates.\n\nIf you have any questions or require assistance, please do not hesitate to contact me.\n\nThank you for your prompt attention to this matter.\n\nKind regards,`;
      await prepareOutlookConfirmationEmail(editor.profile.pocEmail || "", subject, body, editor.emailType === "report" ? [editor.reportAttachmentPath] : []);
      const preparedAt = new Date().toISOString();
      const type = dashboardReportKey(editor.group);
      const next = saveAscDocument(editor.group.key, type, {
        ...report,
        reportPdfPath: editor.reportAttachmentPath || report.reportPdfPath,
        ...(editor.emailType === "report" ? {
          reportEmailPreparedAt: preparedAt,
          reportEmailDrafts: [...(report.reportEmailDrafts || []), preparedAt],
        } : {
          reminderEmailPreparedAt: preparedAt,
          reminderEmailDrafts: [...(report.reminderEmailDrafts || []), preparedAt],
        }),
      });
      const savedReport = next[editor.group.key]?.[type];
      setAscDocuments(next);
      setConfirmationEmailEditor((current) => current ? { ...current, report: savedReport, reportAttachmentPath: savedReport?.reportPdfPath || current.reportAttachmentPath } : null);
      setConfirmationEmailMessage({ ascKey: editor.group.key, text: `Outlook ${editor.emailType} email draft opened. Review and send it in Outlook.`, tone: "success" });
      return true;
    } catch (error) {
      setConfirmationEmailMessage({ ascKey: editor.group.key, text: error instanceof Error ? error.message : "Could not prepare the Outlook email.", tone: "error" });
      return false;
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      {storageMessage || transferMessage ? (
        <section className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            {storageMessage ? <span>{storageMessage}</span> : null}
            {transferMessage ? <span>{transferMessage}</span> : null}
        </section>
      ) : null}
      {desktopStorageAvailable && (!storageReady || groups.length === 0) ? (
        <section className="grid gap-3 rounded-xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Quick start</p>
            <h2 className="mt-1 text-lg font-bold text-navy">Set up this audit workspace</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" className="haudy-setup-step text-left" onClick={() => void chooseDatabase()}>
              <span className="haudy-setup-number">1</span>
              <span><strong>Choose the audit file location</strong><small>Select the secure folder where Haudy will organize and store audit files, reports, and field notes.</small></span>
              <span className="haudy-setup-state">{storageReady ? "Location selected" : "Choose location"}</span>
            </button>
            <button type="button" className="haudy-setup-step text-left" onClick={() => void importTracker()}>
              <span className="haudy-setup-number">2</span>
              <span><strong>Import the Audit Tracker</strong><small>Load the current tracker to create the ASC assignment cards allocated to this auditor.</small></span>
              <span className="haudy-setup-state">Import tracker</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">Both commands remain available at any time from the menu in the upper-left corner.</p>
        </section>
      ) : null}
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
      {groups.length && showProgressDashboard ? <AuditorProgressDashboard metrics={dashboardMetrics} onHide={() => setShowProgressDashboard(false)} onOpenGroup={openAscFromDashboard} /> : null}
      <section className="grid gap-4">
        {groups.length ? (
          <div className="sticky top-[4.75rem] z-40 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {jobTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${jobTabStyle(tab.id, activeJobTab === tab.id).button}`}
                  onClick={() => setActiveJobTab(tab.id)}
                  aria-pressed={activeJobTab === tab.id}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${jobTabStyle(tab.id, activeJobTab === tab.id).badge}`}>{tab.count}</span>
                </button>
              ))}
            </div>
            {activeJobTab === "pool" ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex min-h-12 flex-1 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-inner focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-navy/10 text-navy">
                      <Search size={17} />
                    </span>
                    <input
                      className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-navy outline-none placeholder:text-slate-400"
                      value={poolSearch}
                      onChange={(event) => setPoolSearch(event.target.value)}
                      placeholder="Search ASC name or PSN"
                    />
                    {poolSearch.trim() ? (
                      <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-navy"
                        onClick={() => setPoolSearch("")}
                        aria-label="Clear ASC search"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </label>
                  <span className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-32 sm:text-right">
                    {poolSearch.trim() ? `${visibleJobCards.length} result${visibleJobCards.length === 1 ? "" : "s"}` : "Pool Search"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {groups.length && visibleJobCards.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">
            {activeJobTab === "pool" && poolSearch.trim() ? "No Pool of Jobs ASC matches that ASC name or PSN." : "No ASC cards in this status."}
          </div>
        ) : null}
        {visibleJobCards.map(({ group, status }) => {
          const trackerDefaults = assignmentProfileDefaults(group);
          const profile = ascProfiles[group.key] || { pocName: "", pocPhone: "", pocEmail: "", pocType: "", scn: trackerDefaults.scn || "", psn: trackerDefaults.psn || "", updatedAt: "" };
          const readyForDocuments = completeAscProfile(profile);
          const missingProfileFields = [
            !profile.pocName.trim() ? "POC" : "",
            !profile.scn.trim() ? "SCN" : "",
            !profile.psn.trim() ? "PSN" : "",
          ].filter(Boolean);
          const missingProfileText = missingProfileFields.length === 1
            ? missingProfileFields[0]
            : `${missingProfileFields.slice(0, -1).join(", ")} and ${missingProfileFields[missingProfileFields.length - 1]}`;
          const documents = ascDocuments[group.key];
          const confirmationSaved = documents?.confirmation?.saved;
          const reportSaved = documents?.report?.saved;
          const crzhReportSaved = documents?.crzhReport?.saved;
          const hasCrzhCertificates = group.audits.some(isProtectedAreaAudit);
          const hasNonCrzhCertificates = group.audits.some((audit) => !isProtectedAreaAudit(audit));
          const hasCertificates = group.audits.length > 0;
          const dashboardReport = firstSentReport(group, documents) || documents?.[dashboardReportKey(group)];
          const nextAction = nextAuditAction(group, profile, documents);
          const trackerFileSummary = group.assignments.map((assignment) => [assignment.ccn, assignment.fileNo].filter(Boolean).join(" ")).filter(Boolean).slice(0, 4).join(" | ");
          return (
          <section id={ascCardDomId(group.key)} key={group.key} className={`haudy-asc-card grid gap-3 rounded-lg border p-4 shadow-sm transition hover:shadow-md ${status.cardClassName} ${focusAscKey === group.key ? "ring-2 ring-sky-300" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="haudy-asc-title text-xl font-bold">{group.ascName}</h2>
                  </div>
                  <p className="haudy-asc-muted mt-1 flex items-center gap-1 text-sm">
                    <MapPin size={14} />
                    {group.location || "City and state not detected"}
                  </p>
                  <p className="haudy-asc-muted mt-1 text-sm">
                    <span className="font-semibold text-white">PSN:</span> {group.psn || profile.psn || "not detected"}
                    {trackerFileSummary ? <span className="ml-3 text-xs text-slate-500">{trackerFileSummary}{group.assignments.length > 4 ? " ..." : ""}</span> : null}
                  </p>
                  <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                    {status.label}
                    {status.detail ? <span className="ml-2 font-medium opacity-80">{status.detail}</span> : null}
                  </div>
                  <div className={`mt-2 flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${nextAction.className}`}>
                    <Target size={15} aria-hidden="true" />
                    <span className="font-semibold">Next action:</span>
                    <span>{nextAction.label}</span>
                  </div>
                  {shouldShowClearanceToggle(group, documents) ? (
                    <label className="mt-3 flex w-fit items-center gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-emerald-600"
                        checked={Boolean(dashboardReport?.clearanceResponseReceived)}
                        onChange={(event) => setClearanceResponseReceived(group, event.target.checked)}
                      />
                      Response to deficiencies received
                    </label>
                  ) : null}
                  {shouldShowReportSentToggle(group, documents) ? (
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {status.id === "clearance" && documents?.confirmation && dashboardReport ? (
                  <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20" onClick={() => setConfirmationEmailEditor({ group, profile, confirmation: documents.confirmation!, startTime: documents.confirmation?.startTime || "", meetingLocation: documents.confirmation?.meetingLocation || "", confirmationAttachmentPath: documents.confirmation?.confirmationPdfPath || "", reportAttachmentPath: dashboardReport.reportPdfPath || "", attachments: [], emailType: "reminder", reportCreated: Boolean(dashboardReport.reportCreated), reportSent: Boolean(dashboardReport.sentToClient), report: dashboardReport })}>
                    <UploadCloud size={16} /> Reminder Email
                  </button>
                ) : null}
                <div>
                  <UploadDialog compact compactLabel="Add Certificate" onParsed={(certificates) => addCertificatesToGroup(group, certificates)} />
                </div>
                <ShieldCheck className="hidden text-emerald-600 sm:block" size={24} />
              </div>
            </div>
            {readyForDocuments ? (
              <div className="haudy-asc-detail-panel flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold text-navy">POC:</span> {profile.pocName}
                  {profile.pocPhone ? <><span className="mx-2 text-slate-300">|</span><span className="font-semibold text-navy">Phone:</span> {formatUsPhone(profile.pocPhone)}</> : null}
                  {profile.pocEmail ? <><span className="mx-2 text-slate-300">|</span><span className="font-semibold text-navy">Email:</span> {profile.pocEmail}</> : null}
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-navy">SCN:</span> {profile.scn}
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-navy">PSN:</span> {profile.psn}
                  <div className="mt-1 text-xs text-slate-500">
                    Confirmation: {confirmationSaved ? `saved ${relativeTime(documents.confirmation?.updatedAt || "")}` : "not saved yet"}
                    {hasNonCrzhCertificates ? (
                      <>
                        <span className="mx-2 text-slate-300">|</span>
                        Report: {reportSaved ? `saved ${relativeTime(documents.report?.updatedAt || "")}` : "not saved yet"}
                      </>
                    ) : null}
                    {hasCrzhCertificates ? (
                      <>
                        <span className="mx-2 text-slate-300">|</span>
                        CRZH Report: {crzhReportSaved ? `saved ${relativeTime(documents.crzhReport?.updatedAt || "")}` : "not saved yet"}
                      </>
                    ) : null}
                    {documents?.report?.reportCreated ? <span className="ml-2 font-semibold text-sky-700">PDF created</span> : null}
                    {documents?.crzhReport?.reportCreated ? <span className="ml-2 font-semibold text-violet-700">CRZH PDF created</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="haudy-card-action" onClick={() => setProfileGroup(group)}>
                    <FilePenLine size={16} /> Edit Info
                  </button>
                  <button className="haudy-card-action" onClick={() => navigate(`/asc/${encodeURIComponent(group.key)}`)}>
                    <Building2 size={16} /> Field Notes
                  </button>
                  <button className="haudy-card-action disabled:cursor-not-allowed disabled:opacity-50" disabled={!confirmationSaved && !hasCertificates} title={!confirmationSaved && !hasCertificates ? "Add a certificate before creating a confirmation letter." : undefined} onClick={() => {
                    if (!confirmationSaved && !hasCertificates) return;
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
                    <CalendarCheck size={16} /> {confirmationSaved ? "View / Edit Confirmation" : hasCertificates ? "Create Confirmation" : "Add Certificate First"}
                  </button>
                  {hasNonCrzhCertificates ? (
                    <button className="haudy-card-action disabled:cursor-not-allowed disabled:opacity-50" disabled={!reportSaved && !groupFieldNoteProgress(group.audits.filter((audit) => !isProtectedAreaAudit(audit))).readyForReport} title={!reportSaved && !groupFieldNoteProgress(group.audits.filter((audit) => !isProtectedAreaAudit(audit))).readyForReport ? `Complete field notes to ${FIELD_NOTE_READY_PERCENT}% for every visited property before creating the report.` : undefined} onClick={() => {
                      const params = new URLSearchParams({ poc: profile.pocName, scn: profile.scn, psn: profile.psn });
                      navigate(`/asc/${encodeURIComponent(group.key)}/report?${params.toString()}`);
                    }}>
                      <FileText size={16} /> {reportSaved ? "View / Edit Report" : "Create Report"}
                    </button>
                  ) : null}
                  {hasCrzhCertificates ? (
                    <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={!crzhReportSaved && !groupFieldNoteProgress(group.audits.filter(isProtectedAreaAudit)).readyForReport} title={!crzhReportSaved && !groupFieldNoteProgress(group.audits.filter(isProtectedAreaAudit)).readyForReport ? `Complete field notes to ${FIELD_NOTE_READY_PERCENT}% for every visited property before creating the CRZH report.` : undefined} onClick={() => {
                      const params = new URLSearchParams({ poc: profile.pocName, scn: profile.scn, psn: profile.psn, kind: "crzh" });
                      navigate(`/asc/${encodeURIComponent(group.key)}/report?${params.toString()}`);
                    }}>
                      <FileText size={16} /> {crzhReportSaved ? "View / Edit CRZH Report" : "Create CRZH Report"}
                    </button>
                  ) : null}
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setDeleteAscGroup(group)}>
                    <Trash2 size={16} /> Delete ASC
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span>To create the confirmation letter and report, add {missingProfileText}.</span>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100" onClick={() => setProfileGroup(group)}>
                  <FilePenLine size={16} /> {missingProfileFields.length === 1 && missingProfileText === "POC" ? "Select / Add POC" : missingProfileFields.length === 1 ? `Add ${missingProfileText}` : "Add Info"}
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
            setActiveJobTab(homeJobStatus(profileGroup, ascDocuments[profileGroup.key]).id);
            setFocusAscKey(profileGroup.key);
            setAscProfiles(next);
            saveAscProfiles(next);
            setProfileGroup(null);
          }}
        />
      ) : null}
      {showCustomerPhoneBook ? <CustomerPhoneBook auditorName={auditorName} onClose={() => setShowCustomerPhoneBook(false)} /> : null}
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
      {confirmationEmailEditor ? (
        <ConfirmationEmailDialog
          editor={confirmationEmailEditor}
          onClose={() => setConfirmationEmailEditor(null)}
          onChange={setConfirmationEmailEditor}
          preparing={preparingConfirmationEmail}
          message={confirmationEmailMessage?.ascKey === confirmationEmailEditor.group.key ? confirmationEmailMessage : null}
          onChooseConfirmation={async () => {
            try {
              const folders = storageFoldersForDetails(storageDetailsFromAsc({ year: (confirmationEmailEditor.confirmation.startDate || new Date().toISOString()).slice(0, 4), ascName: confirmationEmailEditor.group.ascName, cityState: "", psn: confirmationEmailEditor.profile.psn || confirmationEmailEditor.group.psn, folder: "Confirmation", fileName: "Confirmation" }));
              const path = await chooseConfirmationPdf(folders);
              if (!path) return;
              const next = saveAscDocument(confirmationEmailEditor.group.key, "confirmation", { ...confirmationEmailEditor.confirmation, confirmationPdfPath: path });
              setAscDocuments(next);
              setConfirmationEmailEditor((current) => current ? { ...current, confirmationAttachmentPath: path, confirmation: next[current.group.key]?.confirmation || current.confirmation } : null);
            } catch (error) {
              setConfirmationEmailMessage({ ascKey: confirmationEmailEditor.group.key, text: error instanceof Error ? error.message : "Could not select the confirmation letter.", tone: "error" });
            }
          }}
          onAddAttachments={async () => {
            try {
              const folders = storageFoldersForDetails(storageDetailsFromAsc({ year: (confirmationEmailEditor.confirmation.startDate || new Date().toISOString()).slice(0, 4), ascName: confirmationEmailEditor.group.ascName, cityState: "", psn: confirmationEmailEditor.profile.psn || confirmationEmailEditor.group.psn, folder: "Confirmation", fileName: "Confirmation" }));
              const attachments = await chooseEmailAttachments(folders);
              setConfirmationEmailEditor((current) => current ? { ...current, attachments: Array.from(new Set([...current.attachments, ...attachments])) } : null);
            } catch (error) {
              setConfirmationEmailMessage({ ascKey: confirmationEmailEditor.group.key, text: error instanceof Error ? error.message : "Could not select additional attachments.", tone: "error" });
            }
          }}
          onChooseReport={async () => {
            try {
              const folders = storageFoldersForDetails(storageDetailsFromAsc({ year: new Date().getFullYear().toString(), ascName: confirmationEmailEditor.group.ascName, cityState: "", psn: confirmationEmailEditor.profile.psn || confirmationEmailEditor.group.psn, folder: "Report", fileName: "Report" }));
              const attachments = await chooseEmailAttachments(folders);
              const path = attachments[0];
              if (!path) return;
              setConfirmationEmailEditor((current) => current ? { ...current, reportAttachmentPath: path } : null);
            } catch (error) {
              setConfirmationEmailMessage({ ascKey: confirmationEmailEditor.group.key, text: error instanceof Error ? error.message : "Could not select the audit report.", tone: "error" });
            }
          }}
          onPrepare={async () => {
            setPreparingConfirmationEmail(true);
            try {
              if (confirmationEmailEditor.emailType === "confirmation") await prepareConfirmationEmail(confirmationEmailEditor.group, confirmationEmailEditor.profile, confirmationEmailEditor.confirmation, confirmationEmailEditor);
              else await prepareReportOrReminderEmail(confirmationEmailEditor);
              const next = loadAscDocuments()[confirmationEmailEditor.group.key]?.confirmation;
              if (next) setConfirmationEmailEditor((current) => current ? { ...current, confirmation: next } : null);
            } finally {
              setPreparingConfirmationEmail(false);
            }
          }}
          onMarkSent={() => markSelectedEmailSent(confirmationEmailEditor)}
        />
      ) : null}
      {reportSentGroup ? (
        <ReportSentDialog
          group={reportSentGroup}
          report={ascDocuments[reportSentGroup.key]?.[dashboardReportKey(reportSentGroup)]}
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

interface AuditProgressMetrics {
  seasonYear: number;
  seasonStart: Date;
  seasonEnd: Date;
  auditDaysAssigned: number;
  auditDaysComplete: number;
  auditDaysCompletionPercent: number;
  companyCountAssigned: number;
  companyCountCompleted: number;
  companyCountCompletionPercent: number;
  totalAuditCompletionPercent: number;
  totalJobs: number;
  completedJobs: number;
  remainingJobs: number;
  scheduledJobs: number;
  overdueReports: number;
  targetCompleted: number;
  completionPercent: number;
  targetPercent: number;
  remainingDays: number;
  schedule: ScheduledAuditDay[];
}

interface ScheduledAuditDay {
  date: Date;
  groups: AssignmentGroup[];
}

function CollapsedAuditDashboard({ metrics, onShow }: { metrics: AuditProgressMetrics; onShow: () => void }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold text-navy">Audit progress</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
          Audit days {metrics.auditDaysComplete}/{metrics.auditDaysAssigned || 0} ({metrics.auditDaysCompletionPercent}%)
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
          Companies {metrics.companyCountCompleted}/{metrics.companyCountAssigned} ({metrics.companyCountCompletionPercent}%)
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-800">
          Total {metrics.totalAuditCompletionPercent}%
        </span>
        <span className={metrics.overdueReports ? "font-semibold text-red-700" : "font-semibold text-slate-500"}>
          {metrics.overdueReports ? `${metrics.overdueReports} report${metrics.overdueReports === 1 ? "" : "s"} need attention` : "No overdue reports"}
        </span>
      </div>
      <button type="button" className="min-h-9 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={onShow}>
        Show dashboard
      </button>
    </section>
  );
}

function AuditorProgressDashboard({ metrics, onHide, onOpenGroup }: { metrics: AuditProgressMetrics; onHide: () => void; onOpenGroup: (group: AssignmentGroup) => void }) {
  const paceDelta = metrics.completedJobs - metrics.targetCompleted;
  const onPace = paceDelta >= 0;
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Auditor Dashboard</p>
          <h2 className="mt-1 text-2xl font-bold text-navy">Annual audit progress</h2>
          <p className="mt-1 text-sm text-slate-600">
            Audit season: {formatShortDate(metrics.seasonStart)} to {formatShortDate(metrics.seasonEnd)}. A job is complete when the report is sent.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-full border px-3 py-1 text-sm font-semibold ${onPace ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {onPace ? `${paceDelta} ahead of pace` : `${Math.abs(paceDelta)} behind pace`}
          </div>
          <button type="button" className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onHide}>
            Hide dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ProgressMetricCard icon={<CalendarCheck size={20} />} label="Audit Days Assigned" value={metrics.auditDaysAssigned} detail="From Audit Tracker days" className="border-sky-200 bg-sky-50 text-sky-900" />
        <ProgressMetricCard icon={<CheckCircle2 size={20} />} label="Audit Days Complete" value={metrics.auditDaysComplete} detail={`${metrics.auditDaysCompletionPercent}% complete`} className="border-emerald-200 bg-emerald-50 text-emerald-900" />
        <ProgressMetricCard icon={<Building2 size={20} />} label="Company Count Assigned" value={metrics.companyCountAssigned} detail="ASC assignment cards" className="border-violet-200 bg-violet-50 text-violet-900" />
        <ProgressMetricCard icon={<Target size={20} />} label="Company Count Completed" value={metrics.companyCountCompleted} detail={`${metrics.companyCountCompletionPercent}% complete`} className="border-teal-200 bg-teal-50 text-teal-900" />
        <ProgressMetricCard icon={<ShieldCheck size={20} />} label="Total Audit Completion" value={`${metrics.totalAuditCompletionPercent}%`} detail="Combined days and company progress" className="border-navy/20 bg-navy/5 text-navy" />
        <ProgressMetricCard icon={<Clock3 size={20} />} label="Report Attention" value={metrics.overdueReports} detail={`${metrics.remainingDays} season days left`} className={metrics.overdueReports ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50 text-slate-800"} />
        <ProgressMetricCard icon={<CalendarDays size={20} />} label="Scheduled Companies" value={metrics.scheduledJobs} detail={`${metrics.remainingJobs} remaining total`} className="border-amber-200 bg-amber-50 text-amber-900" />
        <ProgressMetricCard icon={<Target size={20} />} label="Expected By Today" value={metrics.targetCompleted} detail={`${metrics.targetPercent}% of season elapsed`} className="border-slate-200 bg-slate-50 text-slate-800" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-navy">
          <CalendarDays size={17} /> Audit Calendar
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 12 }, (_, index) => (
            <CalendarMonthBlock key={index} year={metrics.seasonYear} month={index} schedule={metrics.schedule} seasonStart={metrics.seasonStart} seasonEnd={metrics.seasonEnd} onOpenGroup={onOpenGroup} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgressMetricCard({ icon, label, value, detail, className }: { icon: ReactNode; label: string; value: string | number; detail: string; className: string }) {
  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-white/75">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="mt-3 text-sm font-bold">{label}</div>
      <div className="mt-1 text-xs font-semibold opacity-75">{detail}</div>
    </div>
  );
}

function CalendarMonthBlock({ year, month, schedule, seasonStart, seasonEnd, onOpenGroup }: { year: number; month: number; schedule: ScheduledAuditDay[]; seasonStart: Date; seasonEnd: Date; onOpenGroup: (group: AssignmentGroup) => void }) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const scheduledByDay = new Map(schedule.filter((item) => item.date.getMonth() === month).map((item) => [item.date.getDate(), item.groups]));
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, day: 0 })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-navy">{firstDay.toLocaleDateString(undefined, { month: "long" })}</h3>
        <span className="text-xs font-semibold text-slate-500">{scheduledByDay.size} audit day{scheduledByDay.size === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.day) return <span key={cell.key} className="aspect-square" />;
          const date = new Date(year, month, cell.day);
          const scheduledGroups = scheduledByDay.get(cell.day) || [];
          const inSeason = date >= seasonStart && date <= seasonEnd;
          if (scheduledGroups.length) {
            return (
              <button
                key={cell.key}
                type="button"
                title={scheduledGroups.map((group) => group.ascName).join("\n")}
                className="grid aspect-square place-items-center rounded-md border border-navy bg-navy text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/25"
                onClick={() => onOpenGroup(scheduledGroups[0])}
              >
                {cell.day}
              </button>
            );
          }
          return (
            <span key={cell.key} className={`grid aspect-square place-items-center rounded-md text-[11px] font-semibold ${inSeason ? "bg-slate-50 text-slate-600" : "bg-slate-100 text-slate-300"}`}>
              {cell.day}
            </span>
          );
        })}
      </div>
    </div>
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

function CustomerPhoneBook({ auditorName, onClose }: { auditorName: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const contacts = loadCustomerContacts();
  const trackerDirectory = loadTrackerDirectory();
  const query = search.trim().toLowerCase();
  const matchingAssignments = new Map(trackerDirectory.map((entry) => [entry.psn, entry]));
  const contactsByPsn = new Map<string, CustomerContact[]>();
  for (const contact of contacts) contactsByPsn.set(contact.psn, [...(contactsByPsn.get(contact.psn) || []), contact]);
  const matchingGroups = Array.from(contactsByPsn.entries())
    .filter(([psn, psnContacts]) => {
      if (!query) return true;
      const assignment = matchingAssignments.get(psn);
      return [psn, assignment?.ascName, ...psnContacts.flatMap((contact) => [contact.company, contact.name, contact.email, contact.address])]
        .some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort(([leftPsn, leftContacts], [rightPsn, rightContacts]) => {
      const leftName = matchingAssignments.get(leftPsn)?.ascName || leftContacts[0]?.company || "";
      const rightName = matchingAssignments.get(rightPsn)?.ascName || rightContacts[0]?.company || "";
      return leftName.localeCompare(rightName, undefined, { sensitivity: "base" }) || leftPsn.localeCompare(rightPsn);
    });

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 px-4 py-6">
      <section className="grid max-h-full w-full max-w-4xl gap-4 overflow-hidden rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="customer-phone-book-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="customer-phone-book-title" className="text-xl font-bold text-navy">Customer Phone Book</h2>
            <p className="mt-1 text-sm text-slate-600">United States customer contacts imported from the approved customer contact list.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50" onClick={onClose} aria-label="Close customer phone book"><X size={19} /></button>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-slate-50 px-3 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
          <Search size={19} className="text-slate-500" />
          <input className="min-w-0 flex-1 bg-transparent text-base font-medium text-navy outline-none placeholder:text-slate-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PSN, company, contact name, or email" autoFocus />
        </label>
        <div className="max-h-[58vh] overflow-y-auto rounded-lg border border-slate-200">
          {!contacts.length ? <p className="p-5 text-sm text-slate-600">No customer contacts have been imported. Use the hamburger menu to import the Customer Contact List.</p> : null}
          {contacts.length && !matchingGroups.length ? <p className="p-5 text-sm text-slate-600">No United States customer contacts match this search.</p> : null}
          {matchingGroups.map(([psn, psnContacts]) => {
            const primaryContact = psnContacts[0];
            const assignment = matchingAssignments.get(psn);
            const assignedToYou = assignment?.auditorName.trim().toLowerCase() === auditorName.trim().toLowerCase();
            return (
              <article key={psn} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-navy">{assignment?.ascName || primaryContact.company || "ASC name unavailable"}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">PSN {psn}</span>
                    {assignedToYou ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">In your assigned pool</span> : null}
                  </div>
                  {primaryContact.address ? <p className="mt-1 text-xs font-medium text-slate-500">{primaryContact.address}</p> : null}
                  <div className="mt-3 grid gap-2">
                    {psnContacts.map((contact) => <div key={`${contact.email}|${contact.name}`} className="rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-800">{contact.name}</span> <span className="text-slate-500">({contact.type})</span><span className="mx-2 text-slate-300">|</span><span className="text-slate-600">{formatUsPhone(contact.phone)} <span className="mx-1 text-slate-300">|</span> {contact.email}</span></div>)}
                  </div>
                </div>
                <div className="text-sm sm:text-right">
                  {assignment ? <><p className="font-semibold text-navy">Assigned to {assignedToYou ? "you" : assignment.auditorName}</p><p className="mt-1 text-slate-500">{[assignment.city, assignment.state].filter(Boolean).join(", ")}</p></> : <p className="font-medium text-amber-800">No matching audit-tracker assignment</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
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

function ReportSentDialog({ group, report, onCancel, onConfirm }: { group: AssignmentGroup; report?: AscDocumentState["report"]; onCancel: () => void; onConfirm: (clearanceStartDate: string) => void }) {
  const [clearanceStartDate, setClearanceStartDate] = useState(report?.clearanceStartDate || report?.letterDate || todayInputValue());
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4">
      <form
        className="grid w-full max-w-2xl gap-5 rounded-xl bg-white p-5 shadow-2xl sm:p-6"
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
  const [pocPhone, setPocPhone] = useState(profile?.pocPhone || "");
  const [pocEmail, setPocEmail] = useState(profile?.pocEmail || "");
  const [pocType, setPocType] = useState(profile?.pocType || "");
  const [scn, setScn] = useState(profile?.scn || "");
  const [psn, setPsn] = useState(profile?.psn || "");
  const contactPsn = psn.trim() || profile?.psn || "";
  const availableContacts = contactsForPsn(contactPsn);
  const ready = pocName.trim() && scn.trim() && psn.trim();

  function selectContact(contact: CustomerContact | null) {
    if (!contact) return;
    setPocName(contact.name);
    setPocPhone(formatUsPhone(contact.phone));
    setPocEmail(contact.email);
    setPocType(contact.type);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onSave({ pocName: pocName.trim(), pocPhone: formatUsPhone(pocPhone), pocEmail: pocEmail.trim(), pocType: pocType.trim(), scn: scn.trim(), psn: psn.trim(), updatedAt: new Date().toISOString() });
        }}
      >
        <div className="min-w-0 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-navy">ASC Document Information</h2>
          <p className="mt-1 text-sm text-slate-600">{group.ascName} - saved for confirmation letters and reports</p>
        </div>
        <section className="grid gap-2 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-navy">Select an imported POC</h3>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">PSN {contactPsn || "not set"}</span>
          </div>
          {availableContacts.length ? (
            <select className="min-h-11 w-full min-w-0 rounded-md border border-sky-200 bg-white px-3 text-sm font-semibold text-navy" value={availableContacts.some((contact) => contact.name === pocName && contact.email === pocEmail) ? `${pocName}|${pocEmail}` : ""} onChange={(event) => selectContact(availableContacts.find((contact) => `${contact.name}|${contact.email}` === event.target.value) || null)}>
              <option value="">Choose a contact for this ASC</option>
              {availableContacts.map((contact) => <option key={`${contact.psn}|${contact.email}|${contact.name}`} value={`${contact.name}|${contact.email}`}>{contact.name} — {contact.type} — {contact.email}</option>)}
            </select>
          ) : <p className="text-sm font-medium text-amber-900">No imported contacts match this PSN. You can enter a POC manually below.</p>}
        </section>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          POC name
          <input className="min-h-11 w-full min-w-0 rounded-md border px-3" value={pocName} onChange={(event) => setPocName(event.target.value)} placeholder="Contact name" autoFocus />
        </label>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">POC phone<input className="min-h-11 w-full min-w-0 rounded-md border px-3" inputMode="tel" value={pocPhone} onChange={(event) => setPocPhone(formatUsPhone(event.target.value))} placeholder="(123) 456-7890" /></label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">POC email<input className="min-h-11 w-full min-w-0 rounded-md border px-3" type="email" value={pocEmail} onChange={(event) => setPocEmail(event.target.value)} placeholder="name@example.com" /></label>
        </div>
        <div className="grid min-w-0 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            SCN number
            <input className="min-h-11 w-full min-w-0 rounded-md border px-3" value={scn} onChange={(event) => setScn(event.target.value)} placeholder="Example: 1" />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            PSN number
            <input className="min-h-11 w-full min-w-0 rounded-md border px-3" value={psn} onChange={(event) => setPsn(event.target.value)} placeholder="Example: 634867" />
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

function ConfirmationEmailDialog({ editor, preparing, message, onClose, onChange, onChooseConfirmation, onAddAttachments, onChooseReport, onPrepare, onMarkSent }: { editor: ConfirmationEmailEditorState; preparing: boolean; message: { text: string; tone: "success" | "warning" | "error" } | null; onClose: () => void; onChange: (next: ConfirmationEmailEditorState) => void; onChooseConfirmation: () => void | Promise<void>; onAddAttachments: () => void | Promise<void>; onChooseReport: () => void | Promise<void>; onPrepare: () => void | Promise<void>; onMarkSent: () => void }) {
  const draftHistory = editor.confirmation.confirmationEmailDrafts?.length ? editor.confirmation.confirmationEmailDrafts : editor.confirmation.confirmationEmailPreparedAt ? [editor.confirmation.confirmationEmailPreparedAt] : [];
  const reportDraftHistory = editor.report?.reportEmailDrafts?.length ? editor.report.reportEmailDrafts : editor.report?.reportEmailPreparedAt ? [editor.report.reportEmailPreparedAt] : [];
  const reminderDraftHistory = editor.report?.reminderEmailDrafts?.length ? editor.report.reminderEmailDrafts : editor.report?.reminderEmailPreparedAt ? [editor.report.reminderEmailPreparedAt] : [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
      <section className="grid max-h-[calc(100vh-3rem)] w-full max-w-2xl gap-4 overflow-y-auto rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Confirmation email">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-navy">Prepare Email</h2>
            <p className="mt-1 text-sm text-slate-600">Choose the email type, then review its details and attachments before Haudy opens Outlook.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50" onClick={onClose} disabled={preparing} aria-label="Close confirmation email"><X size={18} /></button>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
          <p><span className="font-semibold text-navy">To:</span> {editor.profile.pocName} &lt;{editor.profile.pocEmail}&gt;</p>
          <p className="mt-1"><span className="font-semibold text-navy">ASC:</span> {editor.group.ascName} <span className="mx-2 text-slate-300">|</span><span className="font-semibold text-navy">PSN:</span> {editor.profile.psn || editor.group.psn}</p>
        </div>
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-bold text-navy">Email activity</h3>
          {draftHistory.length || editor.confirmation.confirmationEmailSentAt || reportDraftHistory.length || editor.report?.reportEmailSentAt || reminderDraftHistory.length || editor.report?.reminderEmailSentAt ? (
            <ul className="mt-2 grid gap-1 text-sm text-slate-700">
              {draftHistory.map((timestamp, index) => <li key={`${timestamp}-${index}`}><span className="font-semibold text-sky-800">Confirmation email draft created</span> — {formatEmailActivityTime(timestamp)}</li>)}
              {editor.confirmation.confirmationEmailSentAt ? <li><span className="font-semibold text-emerald-800">Confirmation email marked sent</span> — {formatEmailActivityTime(editor.confirmation.confirmationEmailSentAt)}</li> : null}
              {reportDraftHistory.map((timestamp, index) => <li key={`report-${timestamp}-${index}`}><span className="font-semibold text-sky-800">Report email draft created</span> — {formatEmailActivityTime(timestamp)}</li>)}
              {editor.report?.reportEmailSentAt ? <li><span className="font-semibold text-emerald-800">Report email marked sent</span> — {formatEmailActivityTime(editor.report.reportEmailSentAt)}</li> : null}
              {reminderDraftHistory.map((timestamp, index) => <li key={`reminder-${timestamp}-${index}`}><span className="font-semibold text-amber-800">Reminder email draft created</span> — {formatEmailActivityTime(timestamp)}</li>)}
              {editor.report?.reminderEmailSentAt ? <li><span className="font-semibold text-emerald-800">Reminder email marked sent</span> — {formatEmailActivityTime(editor.report.reminderEmailSentAt)}</li> : null}
            </ul>
          ) : <p className="mt-1 text-sm text-slate-500">No email activity yet.</p>}
          <p className="mt-2 text-xs text-slate-500">This activity remains with the related confirmation or report record.</p>
        </section>
        {message ? <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : message.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>{message.text}</div> : null}
        {editor.emailType === "reminder" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Reminder Email</div>
        ) : (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Email type
            <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-semibold text-navy" value={editor.emailType} onChange={(event) => onChange({ ...editor, emailType: event.target.value as ConfirmationEmailEditorState["emailType"] })}>
              <option value="confirmation">Confirmation Email</option>
              <option value="report">Report Email</option>
              <option value="reminder">Reminder Email</option>
            </select>
          </label>
        )}
        {editor.emailType === "report" && !editor.reportCreated ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">No report PDF has been created yet.</p><p className="mt-1">Create and save the report PDF for this ASC before preparing a report email.</p>
          </div>
        ) : editor.emailType === "reminder" && (!editor.reportCreated || !editor.reportSent) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">The report has not been marked as sent.</p><p className="mt-1">Create the report PDF and mark the report sent to the customer before preparing a reminder.</p>
          </div>
        ) : editor.emailType === "confirmation" ? <>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit start time
            <input className="min-h-11 rounded-md border border-slate-300 px-3" type="time" value={editor.startTime} onChange={(event) => onChange({ ...editor, startTime: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Meeting location
            <input className="min-h-11 rounded-md border border-slate-300 px-3" value={editor.meetingLocation} onChange={(event) => onChange({ ...editor, meetingLocation: event.target.value })} placeholder="First location or service center" />
          </label>
        </div>
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-navy">Attachments</h3>
              <p className="text-sm text-slate-600">Attach the confirmation letter, then add a preparation checklist or other supporting documents if needed.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50" onClick={() => void onChooseConfirmation()}><FileText size={16} /> Attach Confirmation Letter</button>
              <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50" onClick={() => void onAddAttachments()}><UploadCloud size={16} /> Add Preparation Checklist</button>
            </div>
          </div>
          <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${editor.confirmationAttachmentPath ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {editor.confirmationAttachmentPath ? <><FileText className="mr-2 inline" size={16} />{editor.confirmationAttachmentPath.split(/[/\\]/).pop()}</> : "Confirmation letter not attached yet"}
          </div>
          {editor.attachments.map((path) => (
            <div key={path} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <span className="min-w-0 truncate"><FileText className="mr-2 inline text-sky-700" size={16} />{path.split(/[/\\]/).pop()}</span>
              <button type="button" className="text-sm font-semibold text-red-700 hover:text-red-900" onClick={() => onChange({ ...editor, attachments: editor.attachments.filter((item) => item !== path) })}>Remove</button>
            </div>
          ))}
        </section>
        </> : editor.emailType === "report" ? (
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-navy">Audit report attachment</h3><p className="text-sm text-slate-600">Attach the saved audit report before opening the Outlook draft.</p></div><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50" onClick={() => void onChooseReport()}><FileText size={16} /> Attach Audit Report</button></div>
            <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${editor.reportAttachmentPath ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{editor.reportAttachmentPath ? <><FileText className="mr-2 inline" size={16} />{editor.reportAttachmentPath.split(/[/\\]/).pop()}</> : "Audit report not attached yet"}</div>
          </section>
        ) : (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Reminder email</p><p className="mt-1">Haudy selects the reminder level and due date from the report’s clearance timeline.</p></section>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          {preparing ? <span className="mr-auto inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-sky-800"><span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700" /> Creating Outlook draft…</span> : null}
          {((editor.emailType === "confirmation" && editor.confirmation.confirmationEmailPreparedAt && !editor.confirmation.confirmationEmailSentAt) || (editor.emailType === "report" && editor.report?.reportEmailPreparedAt && !editor.report?.reportEmailSentAt) || (editor.emailType === "reminder" && editor.report?.reminderEmailPreparedAt && !editor.report?.reminderEmailSentAt)) ? <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50" onClick={onMarkSent} disabled={preparing}><CheckCircle2 size={16} /> Mark Sent</button> : null}
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={onClose} disabled={preparing}>Close</button>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={(editor.emailType === "report" && !editor.reportCreated) || (editor.emailType === "reminder" && (!editor.reportCreated || !editor.reportSent)) || preparing} onClick={() => void onPrepare()}><UploadCloud size={16} /> {preparing ? "Preparing…" : "Open Outlook Draft"}</button>
        </div>
      </section>
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
  const [visitStatusAudit, setVisitStatusAudit] = useState<Audit | null>(null);
  const [iHaudyMessage, setIHaudyMessage] = useState("");
  const iHaudyImportRef = useRef<HTMLInputElement | null>(null);
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
  const completion = groupFieldNoteProgress(group.audits);

  useEffect(() => {
    const auditId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!auditId) return;
    const element = document.getElementById(propertyCardDomId(auditId));
    if (!element) return;
    window.setTimeout(() => element.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  }, [group.key, group.audits.length]);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      <Link className="inline-flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-navy" to={`/?asc=${encodeURIComponent(group.key)}`}><ArrowLeft size={16} /> Back to ASCs</Link>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{group.ascName}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} />{group.location || "City and state not detected"}</p>
            <p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-navy">PSN:</span> {group.psn || "not detected"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-900 shadow-sm transition hover:bg-sky-100 active:translate-y-px"
                aria-label="Export field notes for iHaudy"
                title="Export field notes for iHaudy"
                onClick={async () => {
                  try {
                    setIHaudyMessage("Preparing iHaudy field notes file...");
                    setIHaudyMessage(await exportFieldNotesForIHaudy(group));
                  } catch (error) {
                    setIHaudyMessage(error instanceof Error ? error.message : "Could not export field notes for iHaudy.");
                  }
                }}
              >
                <UploadCloud size={21} />
              </button>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm transition hover:bg-emerald-100 active:translate-y-px"
                aria-label="Import field notes from iHaudy"
                title="Import field notes from iHaudy"
                onClick={() => iHaudyImportRef.current?.click()}
              >
                <Download size={21} />
              </button>
              <input
                ref={iHaudyImportRef}
                className="hidden"
                type="file"
                accept={IHAUDY_FIELD_NOTES_ACCEPT}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    setIHaudyMessage("Importing iHaudy field notes...");
                    const result = await importFieldNotesFromIHaudy(file, group);
                    audits.setAudits(result.audits);
                    setIHaudyMessage(`Imported field notes for ${result.imported} propert${result.imported === 1 ? "y" : "ies"} from iHaudy.`);
                  } catch (error) {
                    setIHaudyMessage(error instanceof Error ? error.message : "Could not import field notes from iHaudy.");
                  }
                }}
              />
            </div>
            {iHaudyMessage ? <p className="mt-2 text-sm font-medium text-slate-600">{iHaudyMessage}</p> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900">
              Field notes {completion.percentage}% complete
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
              {completion.visited} visited{completion.notVisited ? ` · ${completion.notVisited} not visited` : ""}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
              {group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}
            </span>
          </div>
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
            {categoryAudits.map((audit) => {
              const progress = fieldNoteProgress(audit);
              const notVisited = progress.notVisited;
              return (
              <article id={propertyCardDomId(audit.id)} key={audit.id} className={`haudy-property-card ${notVisited ? "border-slate-400 bg-slate-200" : `haudy-property-${category.toLowerCase()}`} grid gap-3 rounded-lg border p-4 shadow-sm transition hover:shadow-md`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold text-navy">{audit.protectedProperty || "Property name not set"}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} />
                        {primaryCertificateAddress(audit) || "Property address not detected"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{notVisited ? "Marked Not Visited" : `Field notes ${progress.percentage}% complete`} · Updated {relativeTime(audit.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!notVisited ? (
                      <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${progress.readyForReport ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                        {progress.percentage}% complete
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${notVisited ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      {notVisited ? "Not Visited" : audit.certificateNumber || "Certificate not set"}
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
                    {!notVisited ? <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}`}><FilePenLine size={16} /> Edit</Link> : null}
                    <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}/export`}><Download size={16} /> Export</Link>
                    <button className={`inline-flex min-h-9 items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 ${notVisited ? "border-sky-200 text-sky-800" : "border-amber-200 text-amber-800 hover:bg-amber-50"}`} onClick={() => setVisitStatusAudit(audit)}>{notVisited ? "Mark Visited" : "Mark Not Visited"}</button>
                    <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => setDeleteAudit(audit)}><Trash2 size={16} /> Delete</button>
                  </div>
                </div>
              </article>
              );
            })}
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
      {visitStatusAudit ? (
        <VisitStatusDialog
          audit={visitStatusAudit}
          onCancel={() => setVisitStatusAudit(null)}
          onConfirm={() => {
            const markingNotVisited = visitStatusAudit.fieldVisitStatus !== "notVisited";
            audits.setAudits(audits.audits.map((item) => item.id === visitStatusAudit.id ? {
              ...item,
              fieldVisitStatus: markingNotVisited ? "notVisited" : undefined,
              fieldVisitMarkedAt: markingNotVisited ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            } : item));
            setVisitStatusAudit(null);
          }}
        />
      ) : null}
    </main>
  );
}

function VisitStatusDialog({ audit, onCancel, onConfirm }: { audit: Audit; onCancel: () => void; onConfirm: () => void }) {
  const markingNotVisited = audit.fieldVisitStatus !== "notVisited";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <div className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold text-navy">{markingNotVisited ? "Mark Property Not Visited?" : "Mark Property Visited?"}</h2>
          <p className="mt-1 text-sm text-slate-600">{audit.protectedProperty || "Selected property"}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {markingNotVisited ? `This property will be clearly identified as Not Visited and excluded from the ASC field-note completion calculation.` : "This property will return to the field-note calculation and can be edited again."}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button type="button" className={`min-h-10 rounded-md border px-4 text-sm font-semibold text-white ${markingNotVisited ? "border-slate-700 bg-slate-700 hover:bg-slate-800" : "border-sky-700 bg-sky-700 hover:bg-sky-800"}`} onClick={onConfirm}>{markingNotVisited ? "Mark Not Visited" : "Mark Visited"}</button>
        </div>
      </div>
    </div>
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

function propertyCardDomId(auditId: string) {
  return `property-card-${auditId.replace(/[^a-z0-9_-]/gi, "-")}`;
}

function groupMatchesPoolSearch(group: AssignmentGroup, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    group.ascName,
    group.psn,
    group.ascCity,
    group.ascState,
  ].some((value) => value.toLowerCase().includes(query));
}

type HomeJobStatus = "pool" | "scheduled" | "reportDue" | "reportCreated" | "clearance" | "done";

interface HomeJobStatusDetails {
  id: HomeJobStatus;
  label: string;
  detail: string;
  className: string;
  cardClassName: string;
}

interface AscNextAction {
  label: string;
  className: string;
}

function nextAuditAction(group: AssignmentGroup, profile: AscProfile, documents?: AscDocumentState): AscNextAction {
  const confirmation = documents?.confirmation;
  if (!group.audits.length) return { label: "Add certificate", className: "border-sky-200 bg-sky-50 text-sky-900" };
  if (!profile.pocName.trim()) return { label: "Select or add the POC", className: "border-amber-200 bg-amber-50 text-amber-950" };
  if (!confirmation?.saved) return { label: "Create confirmation letter", className: "border-sky-200 bg-sky-50 text-sky-900" };
  if (!confirmation.confirmationEmailPreparedAt) return { label: "Prepare confirmation email", className: "border-sky-200 bg-sky-50 text-sky-900" };
  if (!group.audits.some(auditHasProgress)) return { label: "Complete field notes", className: "border-violet-200 bg-violet-50 text-violet-900" };
  const reportActions = reportActionsNeeded(group, documents);
  if (reportActions.length) return { label: reportActions.join(" • "), className: reportActions.some((item) => item.startsWith("Send")) ? "border-sky-200 bg-sky-50 text-sky-900" : "border-violet-200 bg-violet-50 text-violet-900" };
  const report = documents?.[dashboardReportKey(group)];
  if (groupDeficiencyCount(group, documents) > 0 && !report?.clearanceResponseReceived) {
    return { label: "Await customer response", className: "border-amber-200 bg-amber-50 text-amber-950" };
  }
  return { label: "Audit closed", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };
}

function reportActionsNeeded(group: AssignmentGroup, documents?: AscDocumentState) {
  const tracks: Array<{ audits: Audit[]; key: "report" | "crzhReport"; name: string }> = [];
  const standardAudits = group.audits.filter((audit) => !isProtectedAreaAudit(audit));
  const crzhAudits = group.audits.filter(isProtectedAreaAudit);
  if (standardAudits.length) tracks.push({ audits: standardAudits, key: "report", name: reportCategoryNames(standardAudits) || "standard certificates" });
  if (crzhAudits.length) tracks.push({ audits: crzhAudits, key: "crzhReport", name: reportCategoryNames(crzhAudits) || "CRZH" });
  return tracks.flatMap((track) => {
    const report = documents?.[track.key];
    if (!groupFieldNoteProgress(track.audits).readyForReport) return [`Complete field notes for ${track.name}`];
    if (!report?.saved) return [`Create report for ${track.name}`];
    if (!report.reportCreated) return [`Save report PDF for ${track.name}`];
    if (!report.reportEmailPreparedAt) return [`Send report email for ${track.name}`];
    if (!report.sentToClient) return [`Mark report email sent for ${track.name}`];
    return [];
  });
}

function reportCategoryNames(audits: Audit[]) {
  return Array.from(new Set(audits.flatMap((audit) => audit.certificates.map((certificate) => certificate.categoryCode?.trim().toUpperCase() || certificate.ccn?.trim().toUpperCase() || "")).filter(Boolean))).join(", ");
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

function emailDate(value?: string) {
  if (!value) return "the scheduled audit date";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

function emailShortDate(value?: string) {
  if (!value) return "TBD";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(date);
}

function emailTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours) || hours > 23) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function reminderDetails(daysRemaining: number) {
  if (daysRemaining < 0) return { label: "Past Due", subjectPrefix: "Past Due Notice", remainingText: `The response is ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} overdue` };
  if (daysRemaining === 0) return { label: "Due Today", subjectPrefix: "Action Required: Due Today", remainingText: "The response is due today" };
  if (daysRemaining === 1) return { label: "Final", subjectPrefix: "Final Reminder", remainingText: "1 day remains" };
  if (daysRemaining <= 6) return { label: "Urgent", subjectPrefix: "Urgent Reminder", remainingText: `${daysRemaining} days remain` };
  if (daysRemaining <= 14) return { label: "Important", subjectPrefix: "Important Reminder", remainingText: `${daysRemaining} days remain` };
  return { label: "Friendly", subjectPrefix: "Reminder", remainingText: `${daysRemaining} days remain` };
}

function formatEmailActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function jobTabStyle(status: HomeJobStatus, active: boolean) {
  const styles: Record<HomeJobStatus, { active: string; idle: string; activeBadge: string; idleBadge: string }> = {
    pool: {
      active: "border-navy bg-navy text-white shadow-sm ring-2 ring-navy/20",
      idle: "border-navy/20 bg-navy/5 text-navy hover:bg-navy/10",
      activeBadge: "bg-white/20 text-white",
      idleBadge: "bg-navy/10 text-navy",
    },
    scheduled: {
      active: "border-sky-700 bg-sky-700 text-white shadow-sm ring-2 ring-sky-200",
      idle: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
      activeBadge: "bg-white/20 text-white",
      idleBadge: "bg-sky-200/70 text-sky-950",
    },
    reportDue: {
      active: "border-red-700 bg-red-700 text-white shadow-sm ring-2 ring-red-200",
      idle: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
      activeBadge: "bg-white/20 text-white",
      idleBadge: "bg-red-200/70 text-red-900",
    },
    reportCreated: {
      active: "border-violet-700 bg-violet-700 text-white shadow-sm ring-2 ring-violet-200",
      idle: "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
      activeBadge: "bg-white/20 text-white",
      idleBadge: "bg-violet-200/70 text-violet-950",
    },
    clearance: {
      active: "border-amber-600 bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-200",
      idle: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
      activeBadge: "bg-white/45 text-amber-950",
      idleBadge: "bg-amber-200/80 text-amber-950",
    },
    done: {
      active: "border-emerald-700 bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-200",
      idle: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
      activeBadge: "bg-white/20 text-white",
      idleBadge: "bg-emerald-200/70 text-emerald-950",
    },
  };
  const palette = styles[status];
  return {
    button: active ? palette.active : palette.idle,
    badge: active ? palette.activeBadge : palette.idleBadge,
  };
}

function auditProgressMetrics(groups: AssignmentGroup[], documents: Record<string, AscDocumentState>): AuditProgressMetrics {
  const today = startOfLocalDay(new Date());
  const seasonYear = today.getFullYear();
  const seasonStart = new Date(seasonYear, 0, 15);
  const seasonEnd = new Date(seasonYear, 11, 15);
  const totalJobs = groups.length;
  const completedJobs = groups.filter((group) => groupReportSent(group, documents[group.key])).length;
  const remainingJobs = Math.max(0, totalJobs - completedJobs);
  const scheduledJobs = groups.filter((group) => Boolean(parseLocalDate(documents[group.key]?.confirmation?.startDate))).length;
  const overdueReports = groups.filter((group) => homeJobStatus(group, documents[group.key]).label === "Report overdue").length;
  const auditDaysAssigned = groups.reduce((total, group) => total + auditDaysForGroup(group, documents[group.key]), 0);
  const auditDaysComplete = groups.reduce((total, group) => {
    if (!groupReportSent(group, documents[group.key])) return total;
    return total + auditDaysForGroup(group, documents[group.key]);
  }, 0);
  const auditDaysCompletionPercent = percentComplete(auditDaysComplete, auditDaysAssigned);
  const companyCountAssigned = totalJobs;
  const companyCountCompleted = completedJobs;
  const companyCountCompletionPercent = percentComplete(companyCountCompleted, companyCountAssigned);
  const totalAuditCompletionPercent = percentComplete(auditDaysComplete + companyCountCompleted, auditDaysAssigned + companyCountAssigned);
  const seasonDays = Math.max(1, daysBetween(seasonStart, seasonEnd));
  const elapsedDays = Math.min(Math.max(daysBetween(seasonStart, today), 0), seasonDays);
  const targetPercent = Math.round((elapsedDays / seasonDays) * 100);
  const targetCompleted = Math.min(totalJobs, Math.ceil(totalJobs * (elapsedDays / seasonDays)));
  const completionPercent = totalJobs ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const remainingDays = Math.max(0, daysBetween(today, seasonEnd));
  return {
    seasonYear,
    seasonStart,
    seasonEnd,
    auditDaysAssigned,
    auditDaysComplete,
    auditDaysCompletionPercent,
    companyCountAssigned,
    companyCountCompleted,
    companyCountCompletionPercent,
    totalAuditCompletionPercent,
    totalJobs,
    completedJobs,
    remainingJobs,
    scheduledJobs,
    overdueReports,
    targetCompleted,
    completionPercent,
    targetPercent,
    remainingDays,
    schedule: scheduledAuditDays(groups, documents),
  };
}

function auditDaysForGroup(group: AssignmentGroup, documents?: AscDocumentState) {
  const trackerDays = trackerAuditDaysForGroup(group);
  if (trackerDays > 0) return trackerDays;
  const start = parseLocalDate(documents?.confirmation?.startDate);
  if (!start) return 0;
  const end = parseLocalDate(documents?.confirmation?.endDate || documents?.confirmation?.startDate) || start;
  return Math.max(1, daysBetween(startOfLocalDay(start), startOfLocalDay(end)) + 1);
}

function trackerAuditDaysForGroup(group: AssignmentGroup) {
  const values = group.assignments.map((assignment) => parseAuditDays(assignment.auditDays)).filter((value) => value > 0);
  if (!values.length) return 0;
  return roundMetric(Math.max(...values));
}

function parseAuditDays(value: string | undefined) {
  const match = (value || "").match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function percentComplete(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function groupReportSent(group: AssignmentGroup, documents?: AscDocumentState) {
  const keys = applicableReportKeys(group);
  return keys.length > 0 && keys.every((key) => Boolean(documents?.[key]?.sentToClient));
}

function applicableReportKeys(group: AssignmentGroup): Array<"report" | "crzhReport">;
function applicableReportKeys(group: AssignmentGroup): Array<"report" | "crzhReport"> {
  const keys: Array<"report" | "crzhReport"> = [];
  if (group.audits.some((audit) => !isProtectedAreaAudit(audit))) keys.push("report");
  if (group.audits.some(isProtectedAreaAudit)) keys.push("crzhReport");
  return keys;
}

function scheduledAuditDays(groups: AssignmentGroup[], documents: Record<string, AscDocumentState>): ScheduledAuditDay[] {
  const byDate = new Map<string, { date: Date; groups: AssignmentGroup[] }>();
  for (const group of groups) {
    const confirmation = documents[group.key]?.confirmation;
    const start = parseLocalDate(confirmation?.startDate);
    const end = parseLocalDate(confirmation?.endDate || confirmation?.startDate);
    if (!start || !end) continue;
    for (let date = startOfLocalDay(start); date <= end; date = addDays(date, 1)) {
      const key = localDateKey(date);
      const existing = byDate.get(key) || { date, groups: [] };
      existing.groups.push(group);
      byDate.set(key, existing);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function homeJobStatus(group: AssignmentGroup, documents?: AscDocumentState): HomeJobStatusDetails {
  const confirmation = documents?.confirmation;
  const report = firstSentReport(group, documents) || documents?.[dashboardReportKey(group)];
  const sentTracks = reportTracks(group, documents).filter((track) => track.report?.sentToClient);
  const pendingTracks = reportTracks(group, documents).filter((track) => !track.report?.sentToClient);
  const today = startOfLocalDay(new Date());
  const auditStart = parseLocalDate(confirmation?.startDate);
  const auditEnd = parseLocalDate(confirmation?.endDate || confirmation?.startDate);
  const clearanceStartDate = earliestClearanceStart(sentTracks);

  if (sentTracks.length && clearanceStartDate) {
    const tracksAwaitingResponse = sentTracks.filter((track) => reportDeficiencyCount(group, track.key, documents) > 0 && !track.report?.clearanceResponseReceived);
    const trackDetails = sentTracks.map((track) => clearanceTrackDetail(group, track, documents, today));
    const pendingDetail = pendingTracks.map((track) => `${track.name}: complete and send report`);
    const detail = [...trackDetails, ...pendingDetail].join(" • ");
    if (!pendingTracks.length && !tracksAwaitingResponse.length) {
      return {
        id: "done",
        label: "Audit done",
        detail: "All report tracks have been sent and closed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        cardClassName: "border-emerald-200 bg-emerald-50/45",
      };
    }
    const clearanceDeadline = addDays(clearanceStartDate, 30);
    const remaining = daysBetween(today, clearanceDeadline);
    if (remaining < 0) {
      return {
        id: "clearance",
        label: "Open late clearance project",
        detail,
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
      detail,
      className: remaining <= 5 ? "border-orange-300 bg-orange-50 text-orange-900" : remaining <= 10 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-200 bg-violet-50 text-violet-800",
      cardClassName: urgencyClass,
    };
  }

  if (reportTracks(group, documents).some((track) => track.report?.reportCreated && !track.report.sentToClient)) {
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
  const sentTracks = reportTracks(group, documents).filter((track) => track.report?.sentToClient);
  return sentTracks.length === 1 && reportDeficiencyCount(group, sentTracks[0].key, documents) > 0;
}

type DashboardJobCard = {
  group: AssignmentGroup;
  documents?: AscDocumentState;
  status: HomeJobStatusDetails;
};

function compareJobCards(a: DashboardJobCard, b: DashboardJobCard, status: HomeJobStatus) {
  const first = jobCardSortTime(a.group, a.documents, status);
  const second = jobCardSortTime(b.group, b.documents, status);
  if (first !== second) return first - second;
  return a.group.ascName.localeCompare(b.group.ascName, undefined, { sensitivity: "base" });
}

function jobCardSortTime(
  group: AssignmentGroup,
  documents: AscDocumentState | undefined,
  status: HomeJobStatus,
) {
  const confirmation = documents?.confirmation;
  const report = firstSentReport(group, documents) || documents?.[dashboardReportKey(group)];
  const auditStart = parseLocalDate(confirmation?.startDate);
  const auditEnd = parseLocalDate(confirmation?.endDate || confirmation?.startDate);
  const clearanceStart = parseLocalDate(
    report?.clearanceStartDate ||
      report?.letterDate ||
      report?.reportSentAt?.slice(0, 10) ||
      "",
  );

  switch (status) {
    case "pool":
    case "scheduled":
      return auditStart?.getTime() ?? Number.POSITIVE_INFINITY;
    case "reportDue":
      return auditEnd ? addDays(auditEnd, 14).getTime() : Number.POSITIVE_INFINITY;
    case "reportCreated":
      return timestampOrInfinity(report?.reportCreatedAt);
    case "clearance":
      return clearanceStart ? addDays(clearanceStart, 30).getTime() : Number.POSITIVE_INFINITY;
    case "done":
      return timestampOrInfinity(report?.clearanceResponseAt || report?.reportSentAt || report?.reportCreatedAt);
  }
}

function timestampOrInfinity(value?: string) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function shouldShowReportSentToggle(group: AssignmentGroup, documents?: AscDocumentState) {
  return false;
}

function groupDeficiencyCount(group: AssignmentGroup, documents?: AscDocumentState) {
  return reportDeficiencyCount(group, dashboardReportKey(group), documents);
}

function reportDeficiencyCount(group: AssignmentGroup, documentKey: "report" | "crzhReport", documents?: AscDocumentState) {
  const report = documents?.[documentKey];
  const serviceCenterComments = report?.serviceCenterHasComment ? report.serviceCenterComments || [] : [];
  const serviceCenterCount = serviceCenterComments.filter((comment) => comment.finding.trim() || comment.requiredAction.trim()).length;
  const reportAudits = group.audits.filter((audit) => documentKey === "crzhReport" ? isProtectedAreaAudit(audit) : !isProtectedAreaAudit(audit));
  return serviceCenterCount + reportAudits.reduce((total, audit) => total + auditDeficiencyCount(audit), 0);
}

function reportTracks(group: AssignmentGroup, documents?: AscDocumentState) {
  return applicableReportKeys(group).map((key) => ({
    key,
    report: documents?.[key],
    name: reportCategoryNames(group.audits.filter((audit) => key === "crzhReport" ? isProtectedAreaAudit(audit) : !isProtectedAreaAudit(audit))) || (key === "crzhReport" ? "CRZH" : "report"),
  }));
}

function firstSentReport(group: AssignmentGroup, documents?: AscDocumentState) {
  return reportTracks(group, documents).find((track) => track.report?.sentToClient)?.report;
}

function earliestClearanceStart(tracks: ReturnType<typeof reportTracks>) {
  return tracks
    .map((track) => parseLocalDate(track.report?.letterDate || track.report?.clearanceStartDate || track.report?.reportSentAt?.slice(0, 10) || ""))
    .filter((date): date is Date => Boolean(date))
    .sort((first, second) => first.getTime() - second.getTime())[0];
}

function clearanceTrackDetail(group: AssignmentGroup, track: ReturnType<typeof reportTracks>[number], documents: AscDocumentState | undefined, today: Date) {
  if (reportDeficiencyCount(group, track.key, documents) === 0) return `${track.name}: report sent`;
  if (track.report?.clearanceResponseReceived) return `${track.name}: response received`;
  const start = parseLocalDate(track.report?.letterDate || track.report?.clearanceStartDate || track.report?.reportSentAt?.slice(0, 10) || "");
  if (!start) return `${track.name}: awaiting response`;
  const remaining = daysBetween(today, addDays(start, 30));
  return remaining < 0
    ? `${track.name}: ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} past due`
    : remaining === 0
      ? `${track.name}: due today`
      : `${track.name}: ${remaining} day${remaining === 1 ? "" : "s"} left`;
}

function dashboardReportKey(group: AssignmentGroup): "report" | "crzhReport" {
  const hasNonCrzh = group.audits.some((audit) => !isProtectedAreaAudit(audit));
  return hasNonCrzh ? "report" : "crzhReport";
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

function findWrongAscCertificate(group: AssignmentGroup, certificates: ParsedCertificate[]) {
  const expectedName = normalizeAscName(group.ascName);
  if (!expectedName) return "";

  for (const certificate of certificates) {
    const certificateName = certificate.ascName?.trim();
    if (!certificateName) continue;
    if (normalizeAscName(certificateName) === expectedName) continue;

    const uploadName = certificate.fileName || certificate.certificateNumber || "this certificate";
    return `This certificate belongs to ${certificateName}, not ${group.ascName}. Haudy matches ASC cards by the ASC name. Open the ${certificateName} ASC card before uploading ${uploadName}.`;
  }
  return "";
}

function normalizeAscName(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:incorporated|inc)\b/g, " inc ")
    .replace(/\b(?:company|co)\b/g, " company ")
    .replace(/\b(?:limited liability company|l\s*\.?\s*l\s*\.?\s*c)\b/g, " llc ")
    .replace(/\b(?:dba|doing business as)\b/g, " dba ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

function localDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function StatusChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-700">
      <b className="text-navy">{value}</b>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
    </span>
  );
}
