import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck, Download, FilePenLine, FileText, MapPin, Share, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { clearAscDocuments, deleteAscDocuments, loadAscDocuments, updateAscDocumentDraft } from "../lib/asc-documents";
import { AscProfile, clearAscProfiles, completeAscProfile, deleteAscProfile, loadAscProfiles, saveAscProfiles } from "../lib/asc-profile";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { auditHasProgress, auditIdentity, certificateIdentity } from "../lib/audit-duplicates";
import { exportHaudyBackup, importHaudyBackupFile } from "../lib/haudy-data-transfer";
import { canSaveDocumentsToFolder, chooseStorageRoot, hasStorageRoot, prepareStorageFolders, storageDetailsFromAudit } from "../lib/local-document-storage";
import { Audit, ParsedCertificate } from "../lib/types";
import { relativeTime } from "../lib/utils";
import { OFFLINE_READY_KEY } from "../register-service-worker";

interface DuplicateUploadReview {
  certificates: ParsedCertificate[];
  duplicates: Array<{ certificate: ParsedCertificate; audit: Audit }>;
  hasProgress: boolean;
}

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const groups = groupByAsc(audits.audits);
  const desktopStorageAvailable = canSaveDocumentsToFolder();
  const [offlineReady, setOfflineReady] = useState(() => localStorage.getItem(OFFLINE_READY_KEY) === "true");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showInstallHelp, setShowInstallHelp] = useState(() => shouldShowIosInstallHelp());
  const [confirmationGroup, setConfirmationGroup] = useState<AscGroup | null>(null);
  const [profileGroup, setProfileGroup] = useState<AscGroup | null>(null);
  const [ascProfiles, setAscProfiles] = useState(() => loadAscProfiles());
  const [ascDocuments, setAscDocuments] = useState(() => loadAscDocuments());
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUploadReview | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [deleteAscGroup, setDeleteAscGroup] = useState<AscGroup | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
    if (audits.audits.length > 0) return;
    setAscProfiles(clearAscProfiles());
    setAscDocuments(clearAscDocuments());
  }, [audits.audits.length]);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <UploadDialog compact onParsed={async (certificate) => {
              if (audits.audits.length === 0) {
                setAscProfiles(clearAscProfiles());
                setAscDocuments(clearAscDocuments());
              }
              const existingByKey = new Map(audits.audits.map((audit) => [auditIdentity(audit), audit]));
              const duplicates = certificate
                .map((item) => ({ certificate: item, audit: existingByKey.get(certificateIdentity(item)) }))
                .filter((item): item is { certificate: ParsedCertificate; audit: Audit } => Boolean(item.audit));
              if (duplicates.length) {
                const hasProgress = duplicates.some(({ audit }) => audit && auditHasProgress(audit));
                setDuplicateUpload({ certificates: certificate, duplicates, hasProgress });
                return null;
              }
              const created = audits.createManyFromCertificates(certificate);
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
            }} />
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
            <span className={`inline-flex min-h-9 items-center rounded-full border px-3 font-semibold ${offlineReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {offlineReady ? "Offline ready" : online ? "Preparing offline" : "Offline not ready"}
            </span>
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
            Choose a Haudy Database location once, then Haudy will save reports, confirmations, and field notes into the right folders automatically.
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
        {audits.audits.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No certificates yet.</div> : null}
        {groups.map((group) => {
          const profile = ascProfiles[group.key];
          const readyForDocuments = completeAscProfile(profile);
          const documents = ascDocuments[group.key];
          const confirmationSaved = documents?.confirmation?.saved;
          const reportSaved = documents?.report?.saved;
          return (
          <section key={group.key} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="text-xl font-bold text-navy hover:text-sky-700" to={`/asc/${encodeURIComponent(group.key)}`}>{group.ascName}</Link>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                    <MapPin size={14} />
                    {group.location || "City and state not detected"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                  {group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}
                </span>
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
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setProfileGroup(group)}>
                    <FilePenLine size={16} /> Edit Info
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
          profile={ascProfiles[profileGroup.key]}
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
          profile={ascProfiles[confirmationGroup.key]}
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
  const group = groupByAsc(audits.audits).find((item) => item.key === decodeURIComponent(ascKey));

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
      <Link className="inline-flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-navy" to="/"><ArrowLeft size={16} /> Back to ASCs</Link>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{group.ascName}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} />{group.location || "City and state not detected"}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
            {group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>
      <section className="grid gap-5">
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
            const deletingLastPropertyForAsc = group.audits.length === 1;
            audits.deleteAudit(deleteAudit.id);
            deleteAscDocuments(group.key);
            if (deletingLastPropertyForAsc) {
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

function StatusChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 font-semibold text-slate-700">
      <b className="text-navy">{value}</b>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
    </span>
  );
}
