import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarCheck, Download, FilePenLine, FileText, MapPin, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { AscProfile, completeAscProfile, loadAscProfiles, saveAscProfiles } from "../lib/asc-profile";
import { AscGroup, groupByAsc } from "../lib/asc-groups";
import { relativeTime } from "../lib/utils";
import { OFFLINE_READY_KEY } from "../register-service-worker";

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const groups = groupByAsc(audits.audits);
  const [offlineReady, setOfflineReady] = useState(() => localStorage.getItem(OFFLINE_READY_KEY) === "true");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [confirmationGroup, setConfirmationGroup] = useState<AscGroup | null>(null);
  const [profileGroup, setProfileGroup] = useState<AscGroup | null>(null);
  const [ascProfiles, setAscProfiles] = useState(() => loadAscProfiles());

  useEffect(() => {
    function refresh() {
      setOfflineReady(localStorage.getItem(OFFLINE_READY_KEY) === "true");
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("haudy:offline-ready", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("haudy:offline-ready", refresh);
    };
  }, []);

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
              audits.createManyFromCertificates(certificate);
            }} />
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setProfileGroup(group)}>
                    <FilePenLine size={16} /> Edit Info
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setConfirmationGroup(group)}>
                    <CalendarCheck size={16} /> Confirmation
                  </button>
                  <button className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => {
                    const params = new URLSearchParams({ poc: profile.pocName, scn: profile.scn, psn: profile.psn });
                    navigate(`/asc/${encodeURIComponent(group.key)}/report?${params.toString()}`);
                  }}>
                    <FileText size={16} /> Report
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
    </main>
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
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.audits.map((audit) => (
          <article key={audit.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-signal">{audit.certificateNumber || "Certificate not set"}</p>
              <h3 className="mt-1 text-lg font-bold text-navy">{audit.protectedProperty || "Property name not set"}</h3>
            </div>
            <p className="text-xs text-slate-500">Updated {relativeTime(audit.updatedAt)}</p>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100" to={`/audit/${audit.id}`}><FilePenLine size={16} /> Edit Field Note</Link>
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100" to={`/audit/${audit.id}/export`}><Download size={16} /> Export Field Note</Link>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100" onClick={() => audits.deleteAudit(audit.id)}><Trash2 size={16} /> Delete Field Note</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xl font-bold text-navy">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
