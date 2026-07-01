import { ParsedCertificate } from "../lib/types";
import { BadgeCheck } from "lucide-react";

export function CertificateSummary({ certificate }: { certificate?: ParsedCertificate }) {
  if (!certificate) return <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">No certificate selected.</div>;
  const rows = [
    ["Property", certificate.propertyName],
    ["Address", certificate.propertyAddress],
    ["ASC", certificate.ascName],
    ["Coverage", certificate.coverageType],
    ["Standard", certificate.standardReferenced],
    ["Issued/Revised", [certificate.issuedDate, certificate.revisedDate].filter(Boolean).join(" / ")],
  ];
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy"><BadgeCheck size={16} className="text-emerald-600" />Primary Certificate</div>
      <dl className="grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="truncate font-semibold text-slate-800" title={value || "Not detected"}>{value || "Not detected"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
