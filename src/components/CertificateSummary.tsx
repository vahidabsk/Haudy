import { ParsedCertificate } from "../lib/types";
import { BadgeCheck } from "lucide-react";

export function CertificateSummary({ certificate }: { certificate?: ParsedCertificate }) {
  if (!certificate) return <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">No certificate selected.</div>;
  const details = [
    ["Standard", certificate.standardReferenced],
    ["Monitoring", certificate.centralStation],
    ["Control unit", joinParts(certificate.controlUnitMfr, certificate.controlUnitModel)],
    ["Transmitter", joinParts(certificate.signalTransmitterMfr, certificate.signalTransmitterModel) || certificate.primaryTransmission],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-start gap-2">
        <BadgeCheck size={16} className="mt-1 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-navy" title={certificate.propertyName || "Property not detected"}>{certificate.propertyName || "Property not detected"}</div>
          <div className="truncate text-sm text-slate-600" title={certificate.propertyAddress || "Address not detected"}>{certificate.propertyAddress || "Address not detected"}</div>
        </div>
      </div>
      {details.length ? (
        <dl className="mt-2 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded border border-slate-200 bg-white px-2 py-1">
              <dt className="uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="truncate font-semibold text-slate-800" title={value || "Not detected"}>{value || "Not detected"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function joinParts(...parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" ");
}
