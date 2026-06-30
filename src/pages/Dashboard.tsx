import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck, Download, FilePenLine, FileText, MapPin, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { clearAscDocuments, deleteAscDocuments, loadAscDocuments } from "../lib/asc-documents";
import { AscProfile, clearAscProfiles, completeAscProfile, deleteAscProfile, loadAscProfiles, saveAscProfiles } from "../lib/asc-profile";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { auditHasProgress, auditIdentity, certificateIdentity } from "../lib/audit-duplicates";
import { prepareStorageFolders } from "../lib/local-document-storage";
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
  const [offlineReady, setOfflineReady] = useState(() => localStorage.getItem(OFFLINE_READY_KEY) === "true");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [confirmationGroup, setConfirmationGroup] = useState<AscGroup | null>(null);
  const [profileGroup, setProfileGroup] = useState<AscGroup | null>(null);
  const [ascProfiles, setAscProfiles] = useState(() => loadAscProfiles());
  const [ascDocuments, setAscDocuments] = useState(() => loadAscDocuments());
  const [storageMessage, setStorageMessage] = useState("");
  const [duplicateUpload, setDuplicateUpload] = useState<DuplicateUploadReview | null>(null);

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
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("haudy:offline-ready", refresh);
      window.removeEventListener("focus", refreshDocuments);
    };
  }, []);

  useEffect(() => {
    if (audits.audits.length > 0) return;
    setAscProfiles(clearAscProfiles());
    setAscDocuments(clearAscDocuments());
  }, [audits.audits.length]);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_380px] lg:p-6">
          <div className="grid content-start gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-navy text-white"><UploadCloud size={24} /></div>
              <div>
                <h2 className="text-2xl font-bold text-navy">Upload Certificate</h2>
                <p className="mt-1 text-sm text-slate-600">Start a fire alarm system audit by uploading the DOCX certificate.</p>
              </div>
            </div>
            <div className={`rounded-md border px-3 py-2 text-sm font-medium ${offlineReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {offlineReady ? "Offline ready on this device" : online ? "Preparing offline access. Keep this screen open online until ready." : "Offline access is not ready on this device yet."}
            </div>
            <UploadDialog onParsed={(certificate) => {
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
                return `${duplicates.length} duplicate certificate${duplicates.length === 1 ? "" : "s"} found. Review the Haudy warning before replacing.`;
              }
              audits.createManyFromCertificates(certificate);
              return undefined;
            }} />
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div>
                <h3 className="font-semibold text-navy">Where do you want Haudy to store the files?</h3>
                <p className="mt-1 text-sm text-slate-600">Haudy will create Haudy Storage, year, ASC, Confirmation, Report, and Field Notes folders.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      const year = new Date().getFullYear().toString();
                      await prepareStorageFolders(groups.map((group) => ({
                        year,
                        ascName: group.ascName,
                        cityState: group.location,
                        psn: ascProfiles[group.key]?.psn || "not-set",
                      })));
                      setStorageMessage("Storage location saved and folders created.");
                    } catch (error) {
                      setStorageMessage(error instanceof Error ? error.message : "Could not choose storage location.");
                    }
                  }}
                >
                  Choose Storage Location
                </button>
                {storageMessage ? <span className="text-sm text-slate-600">{storageMessage}</span> : null}
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Metric label="ASCs" value={groups.length} />
            <Metric label="Certificates" value={audits.audits.length} />
            <Metric label="Offline Status" value={offlineReady ? "Ready" : "Preparing"} />
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Field notes are stored on this device for fast site work.</div>
          </div>
        </div>
      </section>
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
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span>To create confirmation letter and report, add POC, SCN, and PSN.</span>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100" onClick={() => setProfileGroup(group)}>
                  <FilePenLine size={16} /> Add Info
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
            audits.replaceManyFromCertificates(duplicateUpload.certificates);
            duplicateUpload.duplicates.forEach(({ audit }) => deleteAscDocuments(auditIdentityAscKey(audit)));
            setAscDocuments(loadAscDocuments());
            setDuplicateUpload(null);
          }}
        />
      ) : null}
    </main>
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
  const ready = startDate && endDate && completeAscProfile(profile);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
      <form
        className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onCreate({ start: startDate, end: endDate });
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
              setStartDate(event.target.value);
              if (!endDate) setEndDate(event.target.value);
            }} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Audit end date
            <input className="min-h-11 rounded-md border px-3" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
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

export function AscPropertiesPage({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const { ascKey = "" } = useParams();
  const group = groupByAsc(audits.audits).find((item) => item.key === decodeURIComponent(ascKey));

  if (!group) {
    return (
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
        <Link className="inline-flex w-fit items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-navy" to="/"><ArrowLeft size={16} /> Back to ASCs</Link>
        <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">ASC not found.</div>
      </main>
    );
  }

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
      <section className="grid gap-3">
        {group.audits.map((audit) => (
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
                <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}`}><FilePenLine size={16} /> Edit Field Note</Link>
                <Link className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/audit/${audit.id}/export`}><Download size={16} /> Export Field Note</Link>
                <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50" onClick={() => {
                  const deletingLastPropertyForAsc = group.audits.length === 1;
                  audits.deleteAudit(audit.id);
                  deleteAscDocuments(group.key);
                  if (deletingLastPropertyForAsc) {
                    deleteAscProfile(group.key);
                  }
                }}><Trash2 size={16} /> Delete Field Note</button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function primaryCertificateAddress(audit: { primaryCertificateIndex: number; certificates: Array<{ propertyAddress?: string }> }) {
  return audit.certificates[audit.primaryCertificateIndex]?.propertyAddress || audit.certificates[0]?.propertyAddress || "";
}

function auditIdentityAscKey(audit: { ascName: string; ascCity: string; ascState: string }) {
  return [audit.ascName || "ASC not set", audit.ascCity || "", audit.ascState || ""].join("|");
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xl font-bold text-navy">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
