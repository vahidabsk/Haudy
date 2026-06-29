import { Link, useNavigate } from "react-router-dom";
import { UploadDialog } from "../components/UploadDialog";
import { useAudits } from "../hooks/use-audits";
import { relativeTime } from "../lib/utils";

export function Dashboard({ auditorName }: { auditorName: string }) {
  const audits = useAudits(auditorName);
  const navigate = useNavigate();
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {audits.audits.length === 0 ? <div className="rounded-lg border border-dashed bg-white p-6 text-slate-600">No audits yet.</div> : null}
        {audits.audits.map((audit) => (
          <article key={audit.id} className="grid gap-3 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <h3 className="font-semibold text-navy">{audit.ascName || "ASC not set"}</h3>
              <p className="text-sm text-slate-600">{audit.protectedProperty || "Protected property not set"}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {audit.certificates.map((cert) => <span key={cert.fileName} className="rounded-full bg-slate-100 px-2 py-1">{cert.certificateNumber || cert.fileName}</span>)}
            </div>
            <p className="text-xs text-slate-500">Updated {relativeTime(audit.updatedAt)}</p>
            <div className="flex gap-2">
              <Link className="min-h-11 rounded-md bg-navy px-4 py-2 text-center font-semibold text-white" to={`/audit/${audit.id}`}>Open</Link>
              <Link className="min-h-11 rounded-md border px-4 py-2 text-center" to={`/audit/${audit.id}/export`}>Export</Link>
              <button className="min-h-11 rounded-md border px-4 py-2" onClick={() => audits.deleteAudit(audit.id)}>Delete</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
