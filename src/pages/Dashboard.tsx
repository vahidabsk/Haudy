import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Download, FilePenLine, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { relativeTime } from "../lib/utils";
import { OFFLINE_READY_KEY } from "../register-service-worker";

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const groups = groupByAsc(audits.audits);
  const [offlineReady, setOfflineReady] = useState(() => localStorage.getItem(OFFLINE_READY_KEY) === "true");
  const [online, setOnline] = useState(() => navigator.onLine);

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
              const audit = audits.createFromCertificate(certificate);
              navigate(`/audit/${audit.id}`);
            }} />
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Metric label="ASCs" value={groups.length} />
            <Metric label="Field Notes" value={audits.audits.length} />
            <Metric label="Offline Status" value={offlineReady ? "Ready" : "Preparing"} />
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Field notes are stored on this device for fast site work.</div>
          </div>
        </div>
      </section>
      <section className="grid gap-4">
        {audits.audits.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No certificates yet.</div> : null}
        {groups.map((group) => (
          <section key={group.ascName} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-navy"><Building2 size={21} /></div>
                <div>
                  <h2 className="text-xl font-bold text-navy">{group.ascName}</h2>
                  <p className="text-sm text-slate-600">{group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <ShieldCheck className="hidden text-emerald-600 sm:block" size={24} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            </div>
          </section>
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

function groupByAsc(audits: ReturnType<typeof useAudits>["audits"]) {
  const groups = new Map<string, typeof audits>();
  for (const audit of audits) {
    const ascName = audit.ascName || "ASC not set";
    groups.set(ascName, [...(groups.get(ascName) || []), audit]);
  }
  return Array.from(groups, ([ascName, groupAudits]) => ({
    ascName,
    audits: groupAudits.sort((a, b) => (a.protectedProperty || "").localeCompare(b.protectedProperty || "") || (a.certificateNumber || "").localeCompare(b.certificateNumber || "")),
  })).sort((a, b) => a.ascName.localeCompare(b.ascName));
}
