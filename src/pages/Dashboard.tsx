import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="rounded-xl bg-reserve p-6">
        <h2 className="text-2xl font-bold text-navy">Upload Certificate</h2>
        <p className="mt-2 max-w-2xl text-slate-700">Start a fire alarm system audit by uploading the DOCX certificate.</p>
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${offlineReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {offlineReady ? "Offline ready on this device" : online ? "Preparing offline access. Keep this screen open online until ready." : "Offline access is not ready on this device yet."}
        </div>
        <div className="mt-5 max-w-xl">
          <UploadDialog onParsed={(certificate) => {
            const audit = audits.createFromCertificate(certificate);
            navigate(`/audit/${audit.id}`);
          }} />
        </div>
      </section>
      <section className="grid gap-4">
        {audits.audits.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No certificates yet.</div> : null}
        {groups.map((group) => (
          <section key={group.ascName} className="grid gap-3 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-navy">{group.ascName}</h2>
              <p className="text-sm text-slate-600">{group.audits.length} certificate{group.audits.length === 1 ? "" : "s"}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {group.audits.map((audit) => (
                <article key={audit.id} className="grid gap-3 rounded-md border bg-slate-50 p-4">
                  <div>
                    <h3 className="font-semibold text-navy">{audit.certificateNumber || "Certificate not set"}</h3>
                    <p className="text-sm text-slate-700">{audit.protectedProperty || "Property name not set"}</p>
                  </div>
                  <p className="text-xs text-slate-500">Updated {relativeTime(audit.updatedAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link className="min-h-11 rounded-md bg-sky-700 px-4 py-2 text-center font-semibold text-white shadow-sm hover:bg-sky-800" to={`/audit/${audit.id}`}>Edit Field Note</Link>
                    <Link className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 text-center font-semibold text-white shadow-sm hover:bg-emerald-800" to={`/audit/${audit.id}/export`}>Export Field Note</Link>
                    <button className="min-h-11 rounded-md bg-red-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-red-800" onClick={() => audits.deleteAudit(audit.id)}>Delete Field Note</button>
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
