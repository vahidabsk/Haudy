import { Link, useNavigate } from "react-router-dom";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { relativeTime } from "../lib/utils";

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
  const groups = groupByAsc(audits.audits);

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
      <section className="rounded-xl bg-reserve p-6">
        <h2 className="text-2xl font-bold text-navy">Upload Certificate</h2>
        <p className="mt-2 max-w-2xl text-slate-700">Start a fire alarm system audit by uploading the DOCX certificate. PDF extraction is best-effort.</p>
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
                    <Link className="min-h-11 rounded-md bg-navy px-4 py-2 text-center font-semibold text-white" to={`/audit/${audit.id}`}>Edit Field Note</Link>
                    <Link className="min-h-11 rounded-md border bg-white px-4 py-2 text-center" to={`/audit/${audit.id}/export`}>Export Field Note</Link>
                    <button className="min-h-11 rounded-md border bg-white px-4 py-2" onClick={() => audits.deleteAudit(audit.id)}>Delete Field Note</button>
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
