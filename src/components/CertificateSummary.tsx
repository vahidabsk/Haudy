import { ParsedCertificate } from "../lib/types";
import { BadgeCheck } from "lucide-react";

export function CertificateSummary({ certificate }: { certificate?: ParsedCertificate }) {
  if (!certificate) return <div className="rounded-lg border bg-white p-4 text-slate-600">No certificate selected.</div>;
  const rows = [
    ["Property", certificate.propertyName],
    ["Address", certificate.propertyAddress],
    ["ASC", certificate.ascName],
    ["Central station", certificate.centralStation],
    ["System", certificate.certificateType],
    ["Coverage", certificate.coverageType],
    ["Standard", certificate.standardReferenced],
    ["Issued/Revised", [certificate.issuedDate, certificate.revisedDate].filter(Boolean).join(" / ")],
  ];
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 font-semibold text-navy"><BadgeCheck size={18} className="text-emerald-600" />Primary Certificate Summary</h3>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="break-words rounded-md border border-slate-100 bg-slate-50 p-3">
            <dt className="text-xs uppercase text-slate-500">{label}</dt>
            <dd className="mt-1 font-medium">{value || "Not detected"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
